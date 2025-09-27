import { formatNumber } from '../utils/helpers'
import type { AccountState } from '../hooks/useGame'

interface ScorePanelProps {
  score: number
  scoreMeta: string
  account: AccountState
}

export function ScorePanel({ score, scoreMeta, account }: ScorePanelProps) {
  return (
    <div id="scorePanel" className="panel">
      <div className="label">Длина</div>
      <div id="scoreValue">{formatNumber(score)}</div>
      <div id="scoreMeta">{scoreMeta}</div>
      <div className="account">
        <div className="account-row">
          <span className="account-label">Баланс</span>
          <span className="account-value" id="balanceValue">
            {formatNumber(account.balance)}
          </span>
        </div>
        <div className="account-row">
          <span className="account-label">Ставка</span>
          <span className="account-value" id="betValue">
            {formatNumber(account.currentBet)}
          </span>
        </div>
      </div>
    </div>
  )
}
