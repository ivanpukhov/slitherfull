import { useMemo } from 'react'
import type { LeaderboardEntry } from '../hooks/useGame'
import type { LeaderboardRange, WinningsLeaderboardEntry } from '../hooks/useWinningsLeaderboard'
import { formatNumber } from '../utils/helpers'

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

interface LeaderboardProps {
  entries: Record<LeaderboardRange, WinningsLeaderboardEntry[]> | null
  selectedRange: LeaderboardRange
  onSelectRange: (range: LeaderboardRange) => void
  loading?: boolean
  meName: string | null
  priceUsd?: number | null
  error?: string | null
}

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return '$0.00'
  return currencyFormatter.format(value)
}

function mapToGameEntries(list: WinningsLeaderboardEntry[]): LeaderboardEntry[] {
  return list.map((entry) => ({
    id: String(entry.userId),
    name: entry.nickname,
    amountUsd: entry.totalUsd,
    amountSol: entry.totalSol,
    payoutCount: entry.payoutCount
  }))
}

export function Leaderboard({
  entries,
  selectedRange,
  onSelectRange,
  loading,
  meName,
  priceUsd,
  error
}: LeaderboardProps) {
  const currentEntries = entries?.[selectedRange] ?? []
  const mappedEntries = useMemo(() => mapToGameEntries(currentEntries), [currentEntries])

  const priceHint = useMemo(() => {
    if (!Number.isFinite(priceUsd || NaN)) return null
    return `1 SOL ≈ ${formatUsd((priceUsd as number) || 0)}`
  }, [priceUsd])

  return (
    <div id="leaderboard" className="panel">
      <div className="leaderboard-header">
        <div className="title">Лидеры</div>
        <div className="leaderboard-tabs" role="tablist" aria-label="Диапазон рейтинга">
          {(Object.keys(RANGE_LABELS) as LeaderboardRange[]).map((range) => (
            <button
              key={range}
              type="button"
              role="tab"
              className={`leaderboard-tab${selectedRange === range ? ' active' : ''}`}
              aria-selected={selectedRange === range}
              onClick={() => onSelectRange(range)}
            >
              {RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>
      {priceHint ? <div className="leaderboard-price">{priceHint}</div> : null}
      <ol id="leaderboardList" className={loading ? 'loading' : undefined}>
        {loading && currentEntries.length === 0 ? (
          <li className="placeholder">Загрузка…</li>
        ) : null}
        {!loading && error && currentEntries.length === 0 ? (
          <li className="placeholder">Не удалось загрузить данные</li>
        ) : null}
        {!loading && !error && currentEntries.length === 0 ? (
          <li className="placeholder">Нет данных</li>
        ) : null}
        {mappedEntries.slice(0, 10).map((entry, idx) => (
          <li key={entry.id ?? `${entry.name}-${idx}`} className={entry.name === meName ? 'me' : undefined}>
            <div className="info">
              <span className="name">
                {idx + 1}. {entry.name}
              </span>
              <span className="bet">Выигрышей: {formatNumber(entry.payoutCount ?? 0)}</span>
            </div>
            <div className="amounts">
              <span className="amount-usd">{formatUsd(entry.amountUsd)}</span>
              {typeof entry.amountSol === 'number' ? (
                <span className="amount-sol">{entry.amountSol.toFixed(3)} SOL</span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
