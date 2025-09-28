import { formatNumber } from '../utils/helpers'

interface ScorePanelProps {
  score: number
  scoreMeta: string
}

export function ScorePanel({ score, scoreMeta }: ScorePanelProps) {
  return (
    <div id="scorePanel" className="panel">
      <div className="label">Длина</div>
      <div id="scoreValue">{formatNumber(score)}</div>
      <div id="scoreMeta">{scoreMeta}</div>
    </div>
  )
}
