# Token and market information

## Sources and meaning

The unauthenticated backend `GET /tokens/{symbol}` reads PostgreSQL metadata for seeded `ETH` and `BTC`. `TokenInfo` contains `symbol`, `name`, `validated`, `price`, `change_24h`, `balance`, `contract_address`, and `supported_pairs`. At startup, missing rows receive seed values; existing rows are left unchanged. Seeded `balance` is a sample field and is not a user or wallet balance.

The frontend requests `ETH` and `BTC` metadata. It separately fetches USD values and 24-hour changes for ETH, BTC, USDC, and WBTC from CoinGecko's public `/api/v3/simple/price` endpoint every 60 seconds. That external quote layer can fail independently of DexSYS. Binance ETHBTC ticks provide pair spot display only.

## UI behavior

- Market rows can be searched and filtered by all assets or largest moves.
- Pair selection is limited by the trade control to `ETH/BTC` and `BTC/ETH`.
- API metadata and seeded fallback data have visible status messaging.
- Volume is shown as unavailable. No market-history chart or live depth is fabricated.
- Backend token metadata's `supported_pairs` are descriptive metadata and are not a wallet balance or proof of on-chain validation.

## Data limitations

Current PostgreSQL seed values are illustrative (including backend USD price/change fields). CoinGecko values are external references, not the executable order price. The browser ticker has only ETHBTC; BTC/ETH is its reciprocal. A reference-price update is not a matcher update or an indication of liquidity.
