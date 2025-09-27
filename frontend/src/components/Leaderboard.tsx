import type { LeaderboardEntry } from '../hooks/useGame'

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  meName: string | null
}

export function Leaderboard({ entries, meName }: LeaderboardProps) {
  return (
    <div id="leaderboard" className="panel">
      <div className="title">Лидеры</div>
      <ol id="leaderboardList">
        {entries.slice(0, 10).map((entry, idx) => {
          const key = entry?.id ?? `${entry?.name ?? 'player'}-${idx}`
          return (
            <li key={key} className={entry?.name === meName ? 'me' : undefined}>
              <span className="name">
                {idx + 1}. {entry?.name ?? 'Anon'}
              </span>
              <span>{(entry?.length ?? 0).toLocaleString('ru-RU')}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
