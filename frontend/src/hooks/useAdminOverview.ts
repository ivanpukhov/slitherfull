import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AdminRole } from './useAdminSession'

export interface AdminUserSummary {
  id: number
  email: string
  nickname: string
  walletAddress: string
  walletLamports: number
  walletSol: number
  inGameBalance: number
  status: 'active' | 'banned' | 'suspended'
  lastActiveAt?: string | null
}

export interface AdminPermissions {
  canTransfer: boolean
  canManageUsers: boolean
  canViewMetrics: boolean
  canViewAudit: boolean
}

export interface AdminOverviewData {
  users: AdminUserSummary[]
  gameWallet: {
    walletAddress: string
    walletLamports: number
    walletSol: number
  }
  totals?: {
    totalSol?: number
    totalBanned?: number
  }
  role?: AdminRole
  permissions?: AdminPermissions
}

export interface AdminTransferPayload {
  amount: number
  fromType: 'game' | 'user'
  toType: 'game' | 'user'
  fromUserId?: number
  toUserId?: number
}

export interface AdminOverviewState {
  overview: AdminOverviewData | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  transfer: (payload: AdminTransferPayload) => Promise<{ ok: boolean; error?: string }>
  banUser: (userId: number) => Promise<{ ok: boolean; error?: string }>
  unbanUser: (userId: number) => Promise<{ ok: boolean; error?: string }>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://191.101.184.209:8080'

export function useAdminOverview(token: string | null): AdminOverviewState {
  const [overview, setOverview] = useState<AdminOverviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) {
      setOverview(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        const data = await safeJson(response)
        const code = (data && data.error) || 'overview_failed'
        setError(code)
        setOverview(null)
        return
      }
      const data = await response.json()
      const nextOverview: AdminOverviewData = {
        users: data.data?.users ?? [],
        gameWallet: data.data?.gameWallet ?? { walletAddress: '', walletLamports: 0, walletSol: 0 },
        totals: data.data?.totals,
        role: data.data?.role,
        permissions: data.data?.permissions
      }
      setOverview(nextOverview)
    } catch (err) {
      setError('network_error')
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setOverview(null)
      return
    }
    refresh()
  }, [refresh, token])

  const withAuth = useCallback(
    async (
      path: string,
      options: RequestInit,
      fallbackError: string
    ): Promise<{ ok: boolean; error?: string }> => {
      if (!token) {
        return { ok: false, error: 'unauthorized' }
      }
      try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        if (!response.ok) {
          const data = await safeJson(response)
          const code = (data && data.error) || fallbackError
          return { ok: false, error: code }
        }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: 'network_error' }
      }
    },
    [token]
  )

  const transfer = useCallback(
    async (payload: AdminTransferPayload) => {
      const result = await withAuth('/api/admin/transfer', { method: 'POST', body: JSON.stringify(payload) }, 'transfer_failed')
      if (result.ok) {
        await refresh()
      }
      return result
    },
    [refresh, withAuth]
  )

  const banUser = useCallback(
    async (userId: number) => {
      const result = await withAuth(`/api/admin/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ reason: 'manual' }) }, 'ban_failed')
      if (result.ok) {
        await refresh()
      }
      return result
    },
    [refresh, withAuth]
  )

  const unbanUser = useCallback(
    async (userId: number) => {
      const result = await withAuth(`/api/admin/users/${userId}/unban`, { method: 'PUT', body: JSON.stringify({}) }, 'unban_failed')
      if (result.ok) {
        await refresh()
      }
      return result
    },
    [refresh, withAuth]
  )

  return useMemo(
    () => ({
      overview,
      loading,
      error,
      refresh,
      transfer,
      banUser,
      unbanUser
    }),
    [overview, loading, error, refresh, transfer, banUser, unbanUser]
  )
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json()
  } catch (err) {
    return null
  }
}
