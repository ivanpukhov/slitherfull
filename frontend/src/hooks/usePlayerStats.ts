import { useCallback, useEffect, useState } from 'react'

export interface PlayerStatsPoint {
  date: string
  sol: number
  usd: number
  units: number
  count: number
}

export interface PlayerStatsData {
  priceUsd: number | null
  generatedAt: string
  totals: {
    sol: number
    usd: number
    units: number
    count: number
  }
  series: PlayerStatsPoint[]
}

interface UsePlayerStatsOptions {
  token?: string | null
  days?: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://191.101.184.209:8080'

export function usePlayerStats({ token, days = 30 }: UsePlayerStatsOptions) {
  const [data, setData] = useState<PlayerStatsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!token) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats/me?days=${days}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!response.ok) {
        throw new Error('player_stats_failed')
      }
      const payload = await response.json()
      setData(payload.data as PlayerStatsData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [days, token])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    data,
    loading,
    error,
    refresh: fetchStats
  }
}
