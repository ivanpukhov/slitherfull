import type { DeathScreenState } from '../hooks/useGame'
import { BET_AMOUNTS_CENTS, centsToUsdInput, sanitizeBetValue } from '../utils/helpers'

interface DeathScreenProps {
  state: DeathScreenState
  onBetChange: (value: string) => void
  onBetBlur: () => void
  onRetry: () => void
}

export function DeathScreen({ state, onBetChange, onBetBlur, onRetry }: DeathScreenProps) {
  const normalizedBetCents = sanitizeBetValue(state.betValue, state.balanceCents)
  const selectedBetCents = normalizedBetCents > 0 ? normalizedBetCents : null
  const betOptions = BET_AMOUNTS_CENTS.map((value) => ({
    value,
    label: `$${centsToUsdInput(value)}`,
    disabled: value > state.balanceCents
  }))
  const betOptionsText = betOptions.map((option) => option.label).join(', ')

  const handleBetSelect = (valueCents: number) => {
    if (valueCents > state.balanceCents) return
    onBetChange(centsToUsdInput(valueCents))
    onBetBlur()
  }

  return (
    <div id="deathScreen" className={state.visible ? 'overlay' : 'overlay hidden'}>
      <div className="card">
        <div className="summary" id="deathSummary">
          {state.summary}
        </div>
        <div className="score" id="deathScore">
          {state.score}
        </div>
        <div className="death-balance" id="deathBalance">
          {state.balance}
        </div>
        {state.showBetControl ? (
          <div className="bet-control" id="deathBetControl">
            <label id="deathRetryBetLabel" htmlFor="retryBetInput">
              Новая ставка
            </label>
            <div className="bet-options bet-options--compact" role="group" aria-labelledby="deathRetryBetLabel">
              {betOptions.map((option) => {
                const selected = option.value === selectedBetCents
                return (
                  <button
                    type="button"
                    key={`death-${option.value}`}
                    className={`bet-option bet-option--compact${selected ? ' selected' : ''}`}
                    onClick={() => handleBetSelect(option.value)}
                    disabled={option.disabled}
                    aria-pressed={selected}
                  >
                    <span className="bet-option-value">{option.label}</span>
                  </button>
                )
              })}
            </div>
            <input id="retryBetInput" type="hidden" value={state.betValue} readOnly />
            <div className="bet-hint">
              Ставки: <span className="bet-options-list">{betOptionsText}</span>. Доступно:{' '}
              <span id="deathBetBalance">{state.betBalance}</span>
            </div>
          </div>
        ) : null}
        <button className="primary" id="retryBtn" type="button" onClick={onRetry} disabled={!state.canRetry}>
          Играть снова
        </button>
      </div>
    </div>
  )
}
