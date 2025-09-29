import { useCallback, useEffect, useMemo, useState } from 'react'

export type LeaderboardRange = '24h' | '7d' | '30d'

export interface WinningsLeaderboardEntry {
  userId: number
  nickname: string
  totalSol: number
  totalUsd: number
  recordedUsd: number
  totalUnits: number
  payoutCount: number
}

export interface WinningsLeaderboardData {
  leaderboards: Record<LeaderboardRange, WinningsLeaderboardEntry[]>
  priceUsd: number | null
  generatedAt: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export function useWinningsLeaderboard(refreshIntervalMs = 60_000) {
  const [data, setData] = useState<WinningsLeaderboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats/leaderboard`)
      if (!response.ok) {
        throw new Error('leaderboard_unavailable')
      }
      const payload = await response.json()
      setData(payload.data as WinningsLeaderboardData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (refreshIntervalMs <= 0 || typeof window === 'undefined') return
    const id = window.setInterval(fetchData, refreshIntervalMs)
    return () => {
      window.clearInterval(id)
    }
  }, [fetchData, refreshIntervalMs])

  const ranges = useMemo(() => (data ? (Object.keys(data.leaderboards) as LeaderboardRange[]) : []), [data])

  return {
    data,
    ranges,
    loading,
    error,
    refresh: fetchData
  }
}
