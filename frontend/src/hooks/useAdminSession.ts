import { useCallback, useEffect, useMemo, useState } from 'react'

export type AdminRole = 'viewer' | 'manager' | 'superadmin'

export interface AdminSession {
  token: string
  role: AdminRole
  email: string
}

export interface AdminLoginResult {
  ok: boolean
  error?: string
}

const STORAGE_KEY = 'admin_session'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://191.101.184.209:8080'

interface StoredSession {
  token: string
  role: AdminRole
  email: string
}

function readStoredSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    if (parsed && typeof parsed.token === 'string' && typeof parsed.role === 'string') {
      return { token: parsed.token, role: parsed.role as AdminRole, email: parsed.email || '' }
    }
  } catch (err) {
    console.warn('Failed to parse admin session from storage', err)
  }
  return null
}

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(() => readStoredSession())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = useMemo(() => !loading, [loading])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (session) {
      const payload: StoredSession = {
        token: session.token,
        role: session.role,
        email: session.email
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }, [session])

  const login = useCallback(async (email: string, password: string): Promise<AdminLoginResult> => {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPassword = password.trim()
    if (!normalizedEmail || !normalizedPassword) {
      setError('missing_credentials')
      return { ok: false, error: 'missing_credentials' }
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: normalizedPassword })
      })
      if (!res.ok) {
        const data = await safeJson(res)
        const code = (data && data.error) || 'login_failed'
        setError(code)
        return { ok: false, error: code }
      }
      const data = await res.json()
      const nextSession: AdminSession = {
        token: data.token,
        role: data.role as AdminRole,
        email: data.email || normalizedEmail
      }
      setSession(nextSession)
      return { ok: true }
    } catch (err) {
      setError('network_error')
      return { ok: false, error: 'network_error' }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setSession(null)
  }, [])

  return {
    session,
    ready,
    loading,
    error,
    login,
    logout,
    setSession
  }
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json()
  } catch (err) {
    return null
  }
}
