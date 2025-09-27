import type { DeathScreenState } from '../hooks/useGame'

interface DeathScreenProps {
  state: DeathScreenState
  onBetChange: (value: string) => void
  onBetBlur: () => void
  onRetry: () => void
}

export function DeathScreen({ state, onBetChange, onBetBlur, onRetry }: DeathScreenProps) {
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
            <input
              id="retryBetInput"
              type="number"
              min={1}
              step={1}
              value={state.betValue}
              onChange={(event) => onBetChange(event.target.value)}
              onBlur={onBetBlur}
            />
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
