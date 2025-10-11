import { useMemo } from 'react'
import type { PlayerStatsPoint } from '../hooks/usePlayerStats'

interface PlayerStatsChartProps {
  series: PlayerStatsPoint[]
  loading?: boolean
  totalUsd?: number
  totalSol?: number
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

export function PlayerStatsChart({ series, loading, totalUsd = 0, totalSol = 0 }: PlayerStatsChartProps) {
  const chart = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) {
      return { path: '', fill: '', labels: null, hasData: false }
    }
    const values = series.map((point) => Math.max(0, Number(point.usd) || 0))
    const maxValue = values.reduce((max, value) => (value > max ? value : max), 0)
    if (maxValue <= 0) {
      return { path: '', fill: '', labels: null, hasData: false }
    }
    const height = 100
    const width = 100
    const step = series.length > 1 ? width / (series.length - 1) : 0
    const points = series.map((point, index) => {
      const x = Math.min(width, Math.max(0, index * step))
      const ratio = values[index] / maxValue
      const y = height - ratio * height
      return { x, y }
    })
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
    const area = `M0,${height} ${points.map((point) => `L${point.x},${point.y}`).join(' ')} L${width},${height} Z`
    const labels = {
      start: formatDateLabel(series[0].date),
      end: formatDateLabel(series[series.length - 1].date)
    }
    return { path: line, fill: area, labels, hasData: true }
  }, [series])

  if (loading) {
    return (
      <div className="stats-card">
        <div className="stats-card-title">Winnings statistics</div>
        <div className="stats-card-body placeholder">Loading…</div>
      </div>
    )
  }

  if (!chart.hasData) {
    return (
      <div className="stats-card">
        <div className="stats-card-title">Winnings statistics</div>
        <div className="stats-card-body placeholder">No data to display</div>
      </div>
    )
  }

  return (
    <div className="stats-card">
      <div className="stats-card-title">Winnings statistics</div>
      <div className="stats-card-summary">
        <span>{formatUsd(totalUsd)}</span>
        <span>{totalSol.toFixed(3)} SOL</span>
      </div>
      <div className="stats-card-body">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="stats-chart">
          <path d={chart.fill} className="stats-chart-area" />
          <path d={chart.path} className="stats-chart-line" />
        </svg>
        {chart.labels ? (
          <div className="stats-chart-labels">
            <span>{chart.labels.start}</span>
            <span>{chart.labels.end}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
