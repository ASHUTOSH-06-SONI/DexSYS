import type { Token } from '../types'

type TokenInputProps = {
  label: string
  token: Token
  amount: string
  tokens: Token[]
  balanceLabel: string
  onAmountChange: (value: string) => void
  onTokenChange: (value: string) => void
  onMax?: () => void
  disabledToken: string
  readOnly?: boolean
}

export default function TokenInput({ label, token, amount, tokens, balanceLabel, onAmountChange, onTokenChange, onMax, disabledToken, readOnly = false }: TokenInputProps) {
  return (
    <div className="token-input">
      <div className="input-label">
        <span>{label}</span>
        <span className="balance-actions">
          {balanceLabel} <strong>{token.balance.toLocaleString()}</strong>
          {!readOnly && <button className="max-button" type="button" onClick={onMax}>MAX</button>}
        </span>
      </div>
      <div className="input-row">
        <input
          aria-label={`${label} amount`}
          value={amount}
          placeholder="0.00"
          onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9.]/g, ''))}
          readOnly={readOnly}
        />
        <select value={token.symbol} onChange={(event) => onTokenChange(event.target.value)} aria-label={`${label} token`}>
          {tokens.filter((item) => item.symbol !== disabledToken).map((item) => <option value={item.symbol} key={item.symbol}>{item.icon} {item.symbol}</option>)}
        </select>
      </div>
    </div>
  )
}
