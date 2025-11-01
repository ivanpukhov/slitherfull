import type { MetricSeries } from '../hooks/useAdminMetrics'

interface AdminMetricsBoardProps {
  metrics: MetricSeries[]
  locale: string
  emptyLabel: string
}

export function AdminMetricsBoard({ metrics, locale, emptyLabel }: AdminMetricsBoardProps) {
  if (!metrics.length) {
    return <div className="admin-metrics-empty">{emptyLabel}</div>
  }
  return (
    <div className="admin-metrics-grid">
      {metrics.map((series) => (
        <MetricCard key={series.id} series={series} locale={locale} />
      ))}
    </div>
  )
}

function MetricCard({ series, locale }: { series: MetricSeries; locale: string }) {
  const latest = series.points.at(-1)?.value ?? 0
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: series.unit === 'SOL' ? 3 : 0,
    minimumFractionDigits: series.unit === 'SOL' ? 2 : 0
  })
  const displayValue = `${formatter.format(latest)}${series.unit && series.unit !== 'players' ? ` ${series.unit}` : ''}`
  const width = 160
  const height = 60
  const values = series.points.map((point) => point.value)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const points = series.points.map((point, index) => {
    const x = (index / Math.max(series.points.length - 1, 1)) * width
    const normalized = max === min ? 0.5 : (point.value - min) / (max - min)
    const y = height - normalized * height
    return `${x},${y}`
  })
  return (
    <div className="admin-metric-card">
      <div className="metric-header">
        <span>{series.label}</span>
        <strong>{displayValue}</strong>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="presentation">
        <polyline
          fill="none"
          stroke={series.color}
          strokeWidth="3"
          points={points.length ? points.join(' ') : `0,${height} ${width},${height}`}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
