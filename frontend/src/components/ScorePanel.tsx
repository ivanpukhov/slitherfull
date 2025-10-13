import { formatNumber } from '../utils/helpers'
import { useTranslation } from '../hooks/useTranslation'

interface ScorePanelProps {
  score: number
  scoreMeta: string
}

export function ScorePanel({ score, scoreMeta }: ScorePanelProps) {
  const { t } = useTranslation()
  return (
    <div id="scorePanel" className="panel">
      <div className="label">{t('scorePanel.lengthLabel')}</div>
      <div id="scoreValue">{formatNumber(score)}</div>
      <div id="scoreMeta">{scoreMeta}</div>
    </div>
  )
}
