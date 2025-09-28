import { useCallback, useEffect, useMemo, useState } from 'react'

export interface AuthUser {
  id: number
  email: string
  nickname: string
  balance: number
  walletAddress: string | null
}

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

export interface AuthResult {
  ok: boolean
  error?: string
}

const TOKEN_KEY = 'slither_token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = window.localStorage.getItem(TOKEN_KEY)
    return stored || null
  })
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token)
    } else {
      window.localStorage.removeItem(TOKEN_KEY)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setUser(null)
      setProfileLoaded(true)
      setStatus('unauthenticated')
      return
    }
    if (profileLoaded && status === 'authenticated') {
      return
    }
    let cancelled = false
    const fetchProfile = async () => {
      setStatus('checking')
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        if (!response.ok) {
          if (!cancelled) {
            setToken(null)
            setUser(null)
            setProfileLoaded(true)
            setStatus('unauthenticated')
          }
          return
        }
        const data = await response.json()
        if (!cancelled) {
          setUser(data.user)
          setProfileLoaded(true)
          setStatus('authenticated')
        }
      } catch (err) {
        if (!cancelled) {
          setToken(null)
          setUser(null)
          setProfileLoaded(true)
          setStatus('unauthenticated')
        }
      }
    }
    fetchProfile()
    return () => {
      cancelled = true
    }
  }, [token, profileLoaded, status])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!response.ok) {
        const error = await safeError(response)
        return { ok: false, error }
      }
      const data = await response.json()
      setToken(data.token)
      setUser(data.user)
      setStatus('authenticated')
      setProfileLoaded(true)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: 'network_error' }
    }
  }, [])

  const register = useCallback(async (email: string, password: string, nickname: string): Promise<AuthResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname })
      })
      if (!response.ok) {
        const error = await safeError(response)
        return { ok: false, error }
      }
      const data = await response.json()
      setToken(data.token)
      setUser(data.user)
      setStatus('authenticated')
      setProfileLoaded(true)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: 'network_error' }
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setStatus('unauthenticated')
    setProfileLoaded(true)
  }, [])

  const syncBalance = useCallback((balance: number) => {
    setUser((prev) => (prev ? { ...prev, balance } : prev))
  }, [])

  const ready = useMemo(() => status !== 'checking', [status])

  return {
    token,
    user,
    status,
    ready,
    login,
    register,
    logout,
    syncBalance
  }
}

async function safeError(response: Response) {
  try {
    const data = await response.json()
    if (data && typeof data.error === 'string') {
      return data.error
    }
  } catch (err) {
    // ignore parse errors
  }
  return 'server_error'
}
