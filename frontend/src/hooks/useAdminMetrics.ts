import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface MetricPoint {
  timestamp: number
  value: number
}

export interface MetricSeries {
  id: string
  label: string
  color: string
  unit?: string
  points: MetricPoint[]
}

export interface AdminMetricsState {
  metrics: MetricSeries[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://191.101.184.209:8080'

const MAX_POINTS = 36

export function useAdminMetrics(token: string | null, enabled: boolean): AdminMetricsState {
  const [metrics, setMetrics] = useState<MetricSeries[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<EventSource | null>(null)
  const activeRef = useRef(false)

  const applySnapshot = useCallback((snapshot: any) => {
    if (!snapshot) return
    const nextSeries: MetricSeries[] = [
      {
        id: 'activePlayers',
        label: snapshot.labels?.activePlayers ?? 'Active Players',
        color: '#4c6ef5',
        points: normalizePoints(snapshot.series?.activePlayers),
        unit: 'players'
      },
      {
        id: 'revenueSol',
        label: snapshot.labels?.revenueSol ?? 'Revenue (SOL)',
        color: '#22b8cf',
        points: normalizePoints(snapshot.series?.revenueSol),
        unit: 'SOL'
      },
      {
        id: 'sessions',
        label: snapshot.labels?.sessions ?? 'Sessions',
        color: '#51cf66',
        points: normalizePoints(snapshot.series?.sessions),
        unit: 'sessions'
      }
    ]
    setMetrics(nextSeries)
  }, [])

  const refresh = useCallback(async () => {
    if (!token || !enabled) {
      setMetrics([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        const data = await safeJson(response)
        const code = (data && data.error) || 'metrics_failed'
        setError(code)
        setMetrics([])
        return
      }
      const data = await response.json()
      applySnapshot(data.data ?? data)
    } catch (err) {
      setError('network_error')
      setMetrics([])
    } finally {
      setLoading(false)
    }
  }, [token, enabled, applySnapshot])

  useEffect(() => {
    if (!token || !enabled) {
      streamRef.current?.close()
      streamRef.current = null
      setMetrics([])
      return
    }
    refresh()
  }, [refresh, token, enabled])

  const handleEventMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data)
        setMetrics((prev) => updateSeries(prev, payload))
      } catch (err) {
        console.warn('Invalid metrics payload', err)
      }
    },
    []
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!token || !enabled) {
      return
    }
    if (typeof window.EventSource === 'undefined') {
      return
    }
    const url = new URL(`${API_BASE_URL}/api/admin/metrics/stream`)
    url.searchParams.set('token', token)
    const stream = new EventSource(url.toString())
    activeRef.current = true
    streamRef.current = stream
    const handleMessage = (event: MessageEvent<string>) => {
      if (!activeRef.current) return
      handleEventMessage(event)
    }
    const handleError = () => {
      setError('metrics_stream_error')
    }
    stream.addEventListener('message', handleMessage)
    stream.addEventListener('error', handleError)
    return () => {
      activeRef.current = false
      stream.removeEventListener('message', handleMessage)
      stream.removeEventListener('error', handleError)
      stream.close()
    }
  }, [token, enabled, handleEventMessage])

  return useMemo(
    () => ({
      metrics,
      loading,
      error,
      refresh
    }),
    [metrics, loading, error, refresh]
  )
}

function normalizePoints(series: any): MetricPoint[] {
  if (!Array.isArray(series)) return []
  return series
    .map((item) => ({
      timestamp: Number(item.timestamp || item[0] || Date.now()),
      value: Number(item.value ?? item[1] ?? 0)
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.value))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_POINTS)
}

function updateSeries(prev: MetricSeries[], payload: any): MetricSeries[] {
  if (!payload || !payload.seriesId) {
    return prev
  }
  const timestamp = Number(payload.timestamp || Date.now())
  const value = Number(payload.value)
  if (!Number.isFinite(timestamp) || !Number.isFinite(value)) {
    return prev
  }
  return prev.map((series) => {
    if (series.id !== payload.seriesId) {
      return series
    }
    const nextPoints = [...series.points, { timestamp, value }]
    while (nextPoints.length > MAX_POINTS) {
      nextPoints.shift()
    }
    return { ...series, points: nextPoints }
  })
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json()
  } catch (err) {
    return null
  }
}
