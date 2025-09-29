import type { LeaderboardEntry } from '../hooks/useGame'
import type { LeaderboardRange, WinningsLeaderboardEntry } from '../hooks/useWinningsLeaderboard'
import { formatNumber, formatUsdCents } from '../utils/helpers'

const RANGE_LABELS: Record<LeaderboardRange, string> = {
  '24h': '24 часа',
  '7d': '7 дней',
  '30d': '30 дней'
}

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
})

interface GameLeaderboardProps {
  entries: LeaderboardEntry[]
  meName: string | null
}

export function GameLeaderboard({ entries, meName }: GameLeaderboardProps) {
  const visible = entries.slice(0, 8)
  const hasData = visible.length > 0

  return (
    <div id="leaderboard" className="panel game-leaderboard" role="complementary" aria-live="polite">
      <div className="leaderboard-header">
        <div className="title">Лидеры арены</div>
      </div>
      <ol id="leaderboardList" className={!hasData ? 'empty' : undefined}>
        {!hasData ? <li className="placeholder">Нет игроков на арене</li> : null}
        {visible.map((entry, idx) => (
          <li key={entry.id ?? `${entry.name}-${idx}`} className={entry.name === meName ? 'me' : undefined}>
            <div className="info">
              <span className="name">
                {idx + 1}. {entry.name}
              </span>
              {typeof entry.betUsdCents === 'number' ? (
                <span className="bet">Ставка: {formatUsdCents(entry.betUsdCents)}</span>
              ) : null}
            </div>
            <div className="amounts">
              <span className="amount-length">{formatNumber(entry.length)}</span>
              <span className="amount-label">длина</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface WinningsLeaderboardCardProps {
  entries: WinningsLeaderboardEntry[]
  loading?: boolean
  error?: string | null
  range: LeaderboardRange
  onRangeChange: (range: LeaderboardRange) => void
  priceHint?: string | null
}

export function WinningsLeaderboardCard({
  entries,
  loading,
  error,
  range,
  onRangeChange,
  priceHint
}: WinningsLeaderboardCardProps) {
  const safeEntries = entries.slice(0, 5)

  return (
    <div className="winnings-card" role="complementary">
      <div className="winnings-card-header">
        <div className="winnings-card-titles">
          <div className="winnings-card-title">Лидеры по выигрышу</div>
          {priceHint ? <div className="winnings-card-subtitle">{priceHint}</div> : null}
        </div>
        <label className="winnings-card-range" htmlFor="winningsRange">
          <span>Период</span>
          <select
            id="winningsRange"
            value={range}
            onChange={(event) => onRangeChange(event.target.value as LeaderboardRange)}
          >
            {(Object.keys(RANGE_LABELS) as LeaderboardRange[]).map((value) => (
              <option key={value} value={value}>
                {RANGE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol className={`winnings-card-list${loading ? ' loading' : ''}`}>
        {loading && safeEntries.length === 0 ? <li className="placeholder">Загрузка…</li> : null}
        {!loading && error ? <li className="placeholder">Не удалось загрузить данные</li> : null}
        {!loading && !error && safeEntries.length === 0 ? <li className="placeholder">Нет данных</li> : null}
        {safeEntries.map((entry, index) => (
          <li key={entry.userId}>
            <div className="winnings-item-rank">{index + 1}</div>
            <div className="winnings-item-body">
              <div className="winnings-item-name">{entry.nickname}</div>
              <div className="winnings-item-meta">Выигрышей: {formatNumber(entry.payoutCount ?? 0)}</div>
            </div>
            <div className="winnings-item-amount">
              <span className="winnings-item-usd">{currencyFormatter.format(entry.totalUsd)}</span>
              <span className="winnings-item-sol">{entry.totalSol.toFixed(3)} SOL</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
