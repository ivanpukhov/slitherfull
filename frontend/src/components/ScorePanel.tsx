import { formatNumber } from '../utils/helpers'
import type { AccountState } from '../hooks/useGame'

interface ScorePanelProps {
  score: number
  scoreMeta: string
  account: AccountState
  walletAddress?: string | null
  walletSol?: number
  walletUsd?: number | null
  usdRate?: number | null
  walletLoading?: boolean
  onRefreshWallet?: () => void
  onTopUp?: () => void
}

export function ScorePanel({
  score,
  scoreMeta,
  account,
  walletAddress,
  walletSol,
  walletUsd,
  usdRate,
  walletLoading,
  onRefreshWallet,
  onTopUp
}: ScorePanelProps) {
  const formattedSol = typeof walletSol === 'number' ? walletSol.toFixed(3) : '0.000'
  const formattedUsd = typeof walletUsd === 'number' ? walletUsd.toFixed(2) : '—'
  const showWallet = Boolean(walletAddress)
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
      {showWallet && (
        <div className="wallet-section">
          <div className="wallet-row">
            <span className="wallet-label">SOL</span>
            <span className="wallet-value">{formattedSol}</span>
          </div>
          <div className="wallet-row">
            <span className="wallet-label">USD</span>
            <span className="wallet-value">
              {formattedUsd}
              {usdRate ? <span className="wallet-rate">@{usdRate.toFixed(2)}</span> : null}
            </span>
          </div>
          <div className="wallet-address" title={walletAddress ?? ''}>
            <span className="wallet-label">Кошелек</span>
            <span className="wallet-hash">{walletAddress}</span>
          </div>
          <div className="wallet-actions">
            <button
              type="button"
              className="wallet-button"
              onClick={onTopUp}
              disabled={walletLoading}
            >
              {walletLoading ? 'Обработка...' : 'Пополнить'}
            </button>
            <button
              type="button"
              className="wallet-button secondary"
              onClick={onRefreshWallet}
              disabled={walletLoading}
            >
              {walletLoading ? 'Обновление...' : 'Обновить'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
