import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface AuditLogEntry {
  id: string
  timestamp: string
  actorEmail: string
  actorRole: string
  action: string
  subject: string
  metadata?: Record<string, unknown>
}

export interface AuditFilters {
  search?: string
  action?: string
  role?: string
  from?: string
  to?: string
}

export interface AdminAuditState {
  entries: AuditLogEntry[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://191.101.184.209:8080'

export function useAdminAudit(token: string | null, filters: AuditFilters): AdminAuditState {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<EventSource | null>(null)

  const serializeFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.action) params.set('action', filters.action)
    if (filters.role) params.set('role', filters.role)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    return params
  }, [filters.action, filters.from, filters.role, filters.search, filters.to])

  const refresh = useCallback(async () => {
    if (!token) {
      setEntries([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = serializeFilters()
      const query = params.toString()
      const response = await fetch(`${API_BASE_URL}/api/admin/audit${query ? `?${query}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        const data = await safeJson(response)
        const code = (data && data.error) || 'audit_failed'
        setError(code)
        setEntries([])
        return
      }
      const data = await response.json()
      setEntries(Array.isArray(data.data) ? data.data : data.logs ?? [])
    } catch (err) {
      setError('network_error')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [serializeFilters, token])

  useEffect(() => {
    if (!token) {
      setEntries([])
      return
    }
    refresh()
  }, [refresh, token])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!token) {
      streamRef.current?.close()
      streamRef.current = null
      return
    }
    if (typeof window.EventSource === 'undefined') {
      return
    }
    const params = serializeFilters()
    params.set('token', token)
    const query = params.toString()
    const url = `${API_BASE_URL}/api/admin/audit/stream${query ? `?${query}` : ''}`
    const stream = new EventSource(url)
    streamRef.current?.close()
    streamRef.current = stream
    const handleMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data)
        if (!payload || !payload.entry) return
        setEntries((prev) => {
          const next = [payload.entry as AuditLogEntry, ...prev]
          return next.slice(0, 200)
        })
      } catch (err) {
        console.warn('Invalid audit entry payload', err)
      }
    }
    const handleError = () => {
      setError('audit_stream_error')
    }
    stream.addEventListener('message', handleMessage)
    stream.addEventListener('error', handleError)
    return () => {
      stream.removeEventListener('message', handleMessage)
      stream.removeEventListener('error', handleError)
      stream.close()
    }
  }, [serializeFilters, token])

  return useMemo(
    () => ({
      entries,
      loading,
      error,
      refresh
    }),
    [entries, loading, error, refresh]
  )
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json()
  } catch (err) {
    return null
  }
}
