import { BET_OPTIONS_USD, formatUsdCents } from '../utils/helpers'
import type { DeathScreenState } from '../hooks/useGame'

interface DeathScreenProps {
  state: DeathScreenState
  betOptions?: readonly number[]
  onBetSelect: (value: number) => void
  onRetry: () => void
}

export function DeathScreen({ state, betOptions, onBetSelect, onRetry }: DeathScreenProps) {
  const options = betOptions && betOptions.length ? betOptions : BET_OPTIONS_USD
  const selectedBet = options.includes(Number(state.betValue)) ? Number(state.betValue) : options[0]

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
            <label htmlFor="retryBetInput">Новая ставка</label>
            <div className="bet-options" role="group" aria-labelledby="retryBetInput">
              {options.map((option) => (
                <button
                  type="button"
                  key={`death-${option}`}
                  className={`bet-option${selectedBet === option ? ' selected' : ''}`}
                  onClick={() => onBetSelect(option)}
                >
                  {formatUsdCents(option * 100)}
                </button>
              ))}
            </div>
            <div className="bet-hint">
              Доступно: <span id="deathBetBalance">{state.betBalance}</span>
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
