import { useEffect, useMemo, useState } from 'react'
import type { LeaderboardEntry } from '../hooks/useGame'
import type { WinningsLeaderboardEntry } from '../hooks/useWinningsLeaderboard'
import { getIntlLocale, useTranslation } from '../hooks/useTranslation'
import { formatNumber, formatUsd } from '../utils/helpers'

interface GameLeaderboardProps {
  entries: LeaderboardEntry[]
  meName: string | null
}

export function GameLeaderboard({ entries, meName }: GameLeaderboardProps) {
  const { t } = useTranslation()
  const visible = entries.slice(0, 8)
  const hasData = visible.length > 0

  return (
    <div id="leaderboard" className="panel game-leaderboard" role="complementary" aria-live="polite">
      <div className="leaderboard-header">
        <div className="title">{t('leaderboard.game.title')}</div>
      </div>
      <ol id="leaderboardList" className={!hasData ? 'empty' : undefined}>
        {!hasData ? <li className="placeholder">{t('leaderboard.game.empty')}</li> : null}
        {visible.map((entry, idx) => (
          <li key={entry.id ?? `${entry.name}-${idx}`} className={entry.name === meName ? 'me' : undefined}>
            <div className="info">
              <span className="name">
                {idx + 1}. {entry.name}
              </span>
              {typeof entry.bet === 'number' ? (
                <span className="bet">{t('leaderboard.game.bet', { amount: formatUsd(entry.bet) })}</span>
              ) : null}
            </div>
            <div className="amounts">
              <span className="amount-length">{formatNumber(entry.length)}</span>
              <span className="amount-label">{t('leaderboard.game.lengthLabel')}</span>
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
  priceHint?: string | null
}

export function WinningsLeaderboardCard({
  entries,
  loading,
  error,
  priceHint
}: WinningsLeaderboardCardProps) {
  const { t } = useTranslation()
  const safeEntries = entries.slice(0, 5)

  return (
    <div className="winnings-card" role="complementary">
      <div className="winnings-card-header">
        <div className="winnings-card-titles">
          <div className="winnings-card-title">{t('leaderboard.winnings.title')}</div>
          {priceHint ? <div className="winnings-card-subtitle">{priceHint}</div> : null}
        </div>
      </div>
      <ol className={`winnings-card-list${loading ? ' loading' : ''}`}>
        {loading && safeEntries.length === 0 ? (
          <li className="placeholder">{t('leaderboard.winnings.loading')}</li>
        ) : null}
        {!loading && error ? <li className="placeholder">{t('leaderboard.winnings.error')}</li> : null}
        {!loading && !error && safeEntries.length === 0 ? (
          <li className="placeholder">{t('leaderboard.winnings.empty')}</li>
        ) : null}
        {safeEntries.map((entry, index) => (
          <li key={entry.userId}>
            <div className="winnings-item-rank">{index + 1}</div>
            <div className="winnings-item-body">
              <div className="winnings-item-name">{entry.nickname}</div>
              <div className="winnings-item-meta">
                {t('leaderboard.winnings.wins', { count: formatNumber(entry.payoutCount ?? 0) })}
              </div>
            </div>
            <div className="winnings-item-amount">
              <AnimatedCurrencyAmount amount={entry.totalUsd} />
              <span className="winnings-item-sol">
                {t('leaderboard.winnings.solAmount', { amount: entry.totalSol.toFixed(3) })}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function AnimatedCurrencyAmount({ amount }: { amount: number }) {
  const [displayValue, setDisplayValue] = useState(0)
  const { locale } = useTranslation()

  useEffect(() => {
    let frame: number | null = null
    let start: number | null = null
    const duration = 1200

    const step = (timestamp: number) => {
      if (start === null) {
        start = timestamp
      }
      const progress = Math.min(1, (timestamp - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(amount * eased)
      if (progress < 1) {
        frame = requestAnimationFrame(step)
      }
    }

    setDisplayValue(0)
    frame = requestAnimationFrame(step)

    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [amount])

  const formatted = useMemo(
    () =>
      new Intl.NumberFormat(getIntlLocale(locale), {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
      }).format(displayValue),
    [displayValue, locale]
  )

  return <span className="winnings-item-usd">{formatted}</span>
}
