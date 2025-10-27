import { formatNumber } from '../utils/helpers'
import { useTranslation } from '../hooks/useTranslation'

interface ScorePanelProps {
  score: number
  scoreMeta: string
  fps?: number
  ping?: number
  jitter?: number
}

export function ScorePanel({ score, scoreMeta, fps, ping, jitter }: ScorePanelProps) {
  const { t } = useTranslation()
  const fpsValue = Number.isFinite(fps || NaN) && (fps || 0) > 0 ? Math.round(fps || 0) : null
  const pingValue = Number.isFinite(ping || NaN) && (ping || 0) > 0 ? Math.round(ping || 0) : null
  const jitterValue = Number.isFinite(jitter || NaN) && (jitter || 0) > 0 ? Math.round(jitter || 0) : null
  const fpsClass = ['metric', fpsValue !== null && fpsValue < 50 ? 'warning' : null]
    .filter(Boolean)
    .join(' ')
  const pingClass = ['metric', pingValue !== null && pingValue > 140 ? 'warning' : null]
    .filter(Boolean)
    .join(' ')
  const jitterClass = ['metric', jitterValue !== null && jitterValue > 60 ? 'warning' : null]
    .filter(Boolean)
    .join(' ')
  return (
    <div id="scorePanel" className="panel">
      <div className="label">{t('scorePanel.lengthLabel')}</div>
      <div id="scoreValue">{formatNumber(score)}</div>
      <div id="scoreMeta">{scoreMeta}</div>
      <div className="performance">
        <div className="performance-label">{t('scorePanel.performanceLabel')}</div>
        <div className="performance-metrics">
          <span className={fpsClass}>{t('scorePanel.fps', { value: fpsValue ?? '—' })}</span>
          <span className={pingClass}>{t('scorePanel.ping', { value: pingValue ?? '—' })}</span>
          <span className={jitterClass}>{t('scorePanel.jitter', { value: jitterValue ?? '—' })}</span>
        </div>
      </div>
    </div>
  )
}
