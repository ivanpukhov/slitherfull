import type { LastResultState } from '../hooks/useGame'
import { BET_AMOUNTS_CENTS, centsToUsdInput, sanitizeBetValue } from '../utils/helpers'
import { Modal } from './Modal'

interface ResultModalProps {
  open: boolean
  result: LastResultState | null
  balanceCents: number
  retryBetValue: string
  onRetryBetChange: (value: string) => void
  onRetryBetBlur: () => void
  onRetry: () => void
  onClose: () => void
  retryDisabled?: boolean
}

export function ResultModal({
  open,
  result,
  balanceCents,
  retryBetValue,
  onRetryBetChange,
  onRetryBetBlur,
  onRetry,
  onClose,
  retryDisabled
}: ResultModalProps) {
  if (!open || !result) {
    return null
  }

  const normalizedRetry = sanitizeBetValue(retryBetValue, balanceCents)
  const selectedRetryCents = normalizedRetry > 0 ? normalizedRetry : null
  const betOptions = BET_AMOUNTS_CENTS.map((value) => ({
    value,
    label: `$${centsToUsdInput(value)}`,
    disabled: value > balanceCents
  }))

  const handleSelect = (value: number) => {
    if (value > balanceCents) return
    onRetryBetChange(centsToUsdInput(value))
    onRetryBetBlur()
  }

  return (
    <Modal open={open} title={result.title} onClose={onClose} width="520px">
      <div className={`damn-card damn-card--result result-${result.variant}`}>
        <div className="damn-result__title">{result.title}</div>
        <ul className="damn-result__details">
          {result.details.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
        {result.showRetryControls ? (
          <div className="damn-result__retry">
            <div className="damn-field">
              <label className="damn-field__label" id="retryBetInputLabel" htmlFor="retryBetInput">
                Retry Bet
              </label>
              <div className="damn-bet-options damn-bet-options--compact" role="group" aria-labelledby="retryBetInputLabel">
                {betOptions.map((option) => {
                  const selected = option.value === selectedRetryCents
                  return (
                    <button
                      type="button"
                      key={`retry-${option.value}`}
                      className={`damn-bet-option damn-bet-option--compact${selected ? ' selected' : ''}`}
                      onClick={() => handleSelect(option.value)}
                      disabled={option.disabled}
                      aria-pressed={selected}
                    >
                      <span>{option.label}</span>
                    </button>
                  )
                })}
              </div>
              <input id="retryBetInput" type="hidden" value={retryBetValue} readOnly />
              <div className="damn-bet-hint">Available: {result.retryBalance}</div>
            </div>
            <button type="button" className="damn-primary-button" onClick={onRetry} disabled={retryDisabled}>
              Play again
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
