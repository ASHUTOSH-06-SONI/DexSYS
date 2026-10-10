use std::collections::HashSet;

use matching_engine::{MatchingEngine, Trade};
use shared::{Order as EngineOrder, OrderSide as EngineOrderSide, OrderType as EngineOrderType};

use crate::{
    error::OrderError,
    order::{Order, OrderSide, OrderStatus, OrderType},
    repository::{self, EngineOrderUpdate, ExecutionWrite, RepositoryError, RestingOrder},
};

/// One engine price tick represents 0.01 units of API quote/base price.
pub const ENGINE_PRICE_SCALE: i64 = 100;
/// One engine quantity unit represents 0.000001 API base-token units.
pub const ENGINE_QUANTITY_SCALE: i64 = 1_000_000;

#[derive(Debug)]
pub enum MatchingError {
    InvalidOrder,
    Persistence(RepositoryError),
}

impl From<RepositoryError> for MatchingError {
    fn from(error: RepositoryError) -> Self {
        Self::Persistence(error)
    }
}

pub fn engine_order_from_api(order: &Order) -> Result<EngineOrder, OrderError> {
    let price = order
        .price
        .map(|value| api_number_to_engine(value, ENGINE_PRICE_SCALE))
        .transpose()?;
    let quantity = api_number_to_engine(order.quantity, ENGINE_QUANTITY_SCALE)?;
    let side = match order.side {
        OrderSide::Buy => EngineOrderSide::Buy,
        OrderSide::Sell => EngineOrderSide::Sell,
    };
    let order_type = match order.order_type {
        OrderType::Limit => EngineOrderType::Limit,
        OrderType::Market => return Err(OrderError::InvalidOrder),
    };
    Ok(EngineOrder {
        id: order.id.clone(),
        user_id: order.user_id.clone(),
        trading_pair: order.trading_pair.clone(),
        side,
        order_type,
        price,
        quantity,
    })
}

pub fn restore_resting_order(
    engine: &mut MatchingEngine,
    order: &RestingOrder,
) -> Result<(), RepositoryError> {
    let price = decimal_to_scaled_i64(&order.price, ENGINE_PRICE_SCALE).map_err(|_| {
        RepositoryError::InvalidFinancialValue("persisted price is not an engine tick")
    })?;
    let quantity = decimal_to_scaled_i64(&order.remaining_quantity, ENGINE_QUANTITY_SCALE)
        .map_err(|_| {
            RepositoryError::InvalidFinancialValue("persisted quantity is not an engine unit")
        })?;
    engine.orderbook.add_order(EngineOrder {
        id: order.id.clone(),
        user_id: order.user_id.clone(),
        trading_pair: order.trading_pair.clone(),
        side: match order.side.as_str() {
            "BUY" => EngineOrderSide::Buy,
            "SELL" => EngineOrderSide::Sell,
            _ => {
                return Err(RepositoryError::InvalidFinancialValue(
                    "invalid persisted order side",
                ));
            }
        },
        order_type: EngineOrderType::Limit,
        price: Some(price),
        quantity,
    });
    Ok(())
}

pub async fn process_and_persist(
    pool: &sqlx::PgPool,
    engine: &mut MatchingEngine,
    order: &Order,
) -> Result<OrderStatus, MatchingError> {
    let engine_order = engine_order_from_api(order).map_err(|_| MatchingError::InvalidOrder)?;
    let mut staged_engine = engine.clone();
    let trades = staged_engine.process_order(engine_order);
    let incoming_remaining = api_number_to_engine(order.quantity, ENGINE_QUANTITY_SCALE)
        .map_err(|_| MatchingError::InvalidOrder)?
        .checked_sub(sum_trade_quantities(&trades)?)
        .ok_or(MatchingError::InvalidOrder)?;
    if incoming_remaining < 0 {
        return Err(MatchingError::InvalidOrder);
    }
    let incoming_remaining = engine_scaled_to_decimal(incoming_remaining, ENGINE_QUANTITY_SCALE)
        .map_err(|_| MatchingError::InvalidOrder)?;
    let maker_ids = trades
        .iter()
        .map(|trade| match order.side {
            OrderSide::Buy => trade.sell_order_id.as_str(),
            OrderSide::Sell => trade.buy_order_id.as_str(),
        })
        .collect::<HashSet<_>>();
    let maker_updates = maker_ids
        .into_iter()
        .map(|id| {
            let remaining = remaining_in_book(&staged_engine, id).unwrap_or(0);
            Ok(EngineOrderUpdate {
                id: id.to_owned(),
                remaining_quantity: engine_scaled_to_decimal(remaining, ENGINE_QUANTITY_SCALE)
                    .map_err(|_| MatchingError::InvalidOrder)?,
                status: if remaining == 0 {
                    OrderStatus::Filled
                } else {
                    OrderStatus::Pending
                },
            })
        })
        .collect::<Result<Vec<_>, MatchingError>>()?;
    let executions = trades
        .iter()
        .enumerate()
        .map(|(index, trade)| execution_write(&order.id, &order.trading_pair, index, trade))
        .collect::<Result<Vec<_>, _>>()?;
    let status = if incoming_remaining == "0" {
        OrderStatus::Filled
    } else {
        OrderStatus::Pending
    };
    repository::persist_matching_result(
        pool,
        order,
        &incoming_remaining,
        &status,
        &maker_updates,
        &executions,
    )
    .await?;
    *engine = staged_engine;
    Ok(status)
}

fn execution_write(
    taker_order_id: &str,
    pair_id: &str,
    index: usize,
    trade: &Trade,
) -> Result<ExecutionWrite, MatchingError> {
    Ok(ExecutionWrite {
        id: format!("{taker_order_id}:execution:{index}"),
        trading_pair_id: pair_id.to_owned(),
        buy_order_id: trade.buy_order_id.clone(),
        sell_order_id: trade.sell_order_id.clone(),
        execution_price: engine_scaled_to_decimal(trade.price, ENGINE_PRICE_SCALE)
            .map_err(|_| MatchingError::InvalidOrder)?,
        execution_quantity: engine_scaled_to_decimal(trade.quantity, ENGINE_QUANTITY_SCALE)
            .map_err(|_| MatchingError::InvalidOrder)?,
    })
}

fn remaining_in_book(engine: &MatchingEngine, id: &str) -> Option<i64> {
    engine
        .orderbook
        .bids
        .values()
        .chain(engine.orderbook.asks.values())
        .flat_map(|level| &level.orders)
        .find(|order| order.id == id)
        .map(|order| order.quantity)
}

fn sum_trade_quantities(trades: &[Trade]) -> Result<i64, MatchingError> {
    trades.iter().try_fold(0_i64, |total, trade| {
        total
            .checked_add(trade.quantity)
            .ok_or(MatchingError::InvalidOrder)
    })
}

pub fn api_number_to_engine(value: f64, scale: i64) -> Result<i64, OrderError> {
    if !value.is_finite() {
        return Err(OrderError::InvalidOrder);
    }
    decimal_to_scaled_i64(&value.to_string(), scale).map_err(|_| OrderError::InvalidOrder)
}

pub fn decimal_to_scaled_i64(value: &str, scale: i64) -> Result<i64, ()> {
    if scale <= 0 {
        return Err(());
    }
    let scale_power = decimal_scale_power(scale).ok_or(())?;
    let (mantissa, exponent) = match value.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => (mantissa, exponent.parse::<i32>().map_err(|_| ())?),
        None => (value, 0),
    };
    if !(-64..=64).contains(&exponent) {
        return Err(());
    }
    let (negative, unsigned) = match mantissa.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, mantissa.strip_prefix('+').unwrap_or(mantissa)),
    };
    let (whole, fraction) = unsigned.split_once('.').unwrap_or((unsigned, ""));
    if whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
        || whole.len() + fraction.len() > 128
    {
        return Err(());
    }
    let digits = format!("{whole}{fraction}");
    let coefficient = digits.parse::<i128>().map_err(|_| ())?;
    let power = exponent
        .checked_add(i32::try_from(scale_power).map_err(|_| ())?)
        .and_then(|power| power.checked_sub(i32::try_from(fraction.len()).ok()?))
        .ok_or(())?;
    let magnitude = if power >= 0 {
        coefficient
            .checked_mul(10_i128.checked_pow(power as u32).ok_or(())?)
            .ok_or(())?
    } else {
        let divisor = 10_i128.checked_pow(power.unsigned_abs()).ok_or(())?;
        if coefficient % divisor != 0 {
            return Err(());
        }
        coefficient / divisor
    };
    let signed = if negative {
        magnitude.checked_neg().ok_or(())?
    } else {
        magnitude
    };
    i64::try_from(signed).map_err(|_| ())
}

pub fn engine_scaled_to_decimal(value: i64, scale: i64) -> Result<String, ()> {
    let scale_power = decimal_scale_power(scale).ok_or(())?;
    let magnitude = i128::from(value).abs();
    let divisor = 10_i128.checked_pow(scale_power as u32).ok_or(())?;
    let whole = magnitude / divisor;
    let fraction = magnitude % divisor;
    let sign = if value < 0 { "-" } else { "" };
    if fraction == 0 {
        return Ok(format!("{sign}{whole}"));
    }
    let fraction = format!("{:0width$}", fraction, width = scale_power as usize);
    Ok(format!("{sign}{whole}.{}", fraction.trim_end_matches('0')))
}

fn decimal_scale_power(scale: i64) -> Option<u32> {
    let mut scale = scale;
    let mut power = 0;
    while scale > 1 && scale % 10 == 0 {
        scale /= 10;
        power += 1;
    }
    (scale == 1).then_some(power)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_api_values_only_when_exactly_representable() {
        assert_eq!(
            api_number_to_engine(123.45, ENGINE_PRICE_SCALE).unwrap(),
            12345
        );
        assert_eq!(
            api_number_to_engine(1.234567, ENGINE_QUANTITY_SCALE).unwrap(),
            1_234_567
        );
        assert!(api_number_to_engine(123.456, ENGINE_PRICE_SCALE).is_err());
        assert!(api_number_to_engine(0.0000001, ENGINE_QUANTITY_SCALE).is_err());
        assert!(api_number_to_engine(f64::INFINITY, ENGINE_PRICE_SCALE).is_err());
    }

    #[test]
    fn checked_conversion_rejects_engine_overflow_and_bad_scales() {
        assert!(decimal_to_scaled_i64("92233720368547758.08", 100).is_err());
        assert!(decimal_to_scaled_i64("1.0", 3).is_err());
        assert_eq!(decimal_to_scaled_i64("1.23e2", 100).unwrap(), 12300);
    }

    #[test]
    fn engine_units_convert_back_to_exact_api_decimal_strings() {
        assert_eq!(engine_scaled_to_decimal(12345, 100).unwrap(), "123.45");
        assert_eq!(
            engine_scaled_to_decimal(1_234_567, 1_000_000).unwrap(),
            "1.234567"
        );
        assert_eq!(engine_scaled_to_decimal(0, 100).unwrap(), "0");
    }
}
