# Core component/class relationships

This is a compact source-oriented view, not an exhaustive UML inventory.

```mermaid
classDiagram
  class AppState {
    +PgPool pool
    +HashMap~String, MatchingEngine~ matching_engines
    +restore(pool) AppState
  }
  class Authenticator {
    +issuer
    +audience
    +JWKS cache
    +validate(token) Principal
  }
  class Principal {
    +issuer
    +subject
  }
  class Order {
    +id
    +user_id
    +trading_pair
    +side
    +order_type
    +price: Option~f64~
    +quantity: f64
    +status
    +validate()
  }
  class MatchingEngine {
    +OrderBook orderbook
    +process_order(order) Trade[]
  }
  class OrderBook {
    +bids: BTreeMap
    +asks: BTreeMap
    +add_order()
    +cancel_order()
    +best_bid()
    +best_ask()
  }
  class Repository {
    +persist_matching_result()
    +list_resting_orders()
    +list_orders_for_principal()
    +update_order_status_for_principal()
  }
  class SettlementVault {
    +balances(address)
    +deposit()
    +withdraw(amount)
  }
  AppState "1" o-- "*" MatchingEngine : per pair, in memory
  MatchingEngine *-- OrderBook
  Authenticator ..> Principal : validates
  Repository ..> Order : persists and reads
  AppState ..> Repository : PostgreSQL pool
  SettlementVault ..> MatchingEngine : no integration
```

`Order` is the API/serialized record; engine `shared::Order` instead represents price and quantity as `i64`. Repository implementations use PostgreSQL; there is no contract class relationship in the running API.