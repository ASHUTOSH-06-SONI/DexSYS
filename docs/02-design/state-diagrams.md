# Order-state and external-data states

## Persisted order status

The API database constraint permits `PENDING`, `FILLED`, and `CANCELLED`. The API only creates limit orders as `PENDING`, then matcher persistence can set `FILLED` when remaining quantity reaches zero. Cancellation updates only a pending order.

```mermaid
stateDiagram-v2
  [*] --> Pending: valid accepted order
  Pending --> Pending: partial execution / positive remainder
  Pending --> Filled: no remaining quantity
  Pending --> Cancelled: owner cancels
  Filled --> [*]
  Cancelled --> [*]
```

`Market` appears in enum/schema definitions but is rejected by the matcher adapter; it is not a working order type. A `Filled` state is an off-chain matching result, not settlement finality.

## Frontend Binance stream

```mermaid
stateDiagram-v2
  [*] --> Connecting
  Connecting --> Live: valid ETHBTC ticker received
  Connecting --> Reconnecting: connection failure
  Live --> Reconnecting: socket closes
  Reconnecting --> Live: valid ticker received
  Reconnecting --> Disconnected: eight retry attempts exhausted
  Disconnected --> Connecting: user retries
```

The frontend retains the last observed price and indicates staleness on connection loss. CoinGecko REST has separate loading/live/stale/error states; neither feed is an orderbook or trade API.