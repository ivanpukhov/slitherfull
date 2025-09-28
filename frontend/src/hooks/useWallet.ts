import { useCallback, useEffect, useState } from 'react'

export interface WalletProfile {
  walletAddress: string
  lamports: number
  sol: number
  usd: number | null
  usdRate: number | null
  units: number
  inGameBalance: number
}

interface UseWalletOptions {
  token?: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export function useWallet({ token }: UseWalletOptions) {
  const [profile, setProfile] = useState<WalletProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/wallet/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) {
        throw new Error('wallet_profile_failed')
      }
      const data = await res.json()
      setProfile({
        walletAddress: data.walletAddress,
        lamports: data.lamports,
        sol: data.sol,
        usd: data.usd ?? null,
        usdRate: data.usdRate ?? null,
        units: data.units,
        inGameBalance: data.inGameBalance
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      setProfile(null)
      return
    }
    fetchProfile()
  }, [fetchProfile, token])

  const refresh = useCallback(async () => {
    if (!token) return null
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/wallet/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      if (!res.ok) {
        throw new Error('wallet_refresh_failed')
      }
      const data = await res.json()
      const balance = data.balance ?? {}
      const next: WalletProfile = {
        walletAddress: balance.walletAddress ?? profile?.walletAddress ?? '',
        lamports: balance.lamports ?? profile?.lamports ?? 0,
        sol: balance.sol ?? profile?.sol ?? 0,
        usd: balance.usd ?? profile?.usd ?? null,
        usdRate: balance.usdRate ?? profile?.usdRate ?? null,
        units: balance.units ?? profile?.units ?? 0,
        inGameBalance: balance.inGameBalance ?? profile?.inGameBalance ?? 0
      }
      setProfile(next)
      return next
    } catch (err) {
      setError((err as Error).message)
      return null
    } finally {
      setLoading(false)
    }
  }, [profile, token])

  const requestAirdrop = useCallback(
    async (amountSol: number) => {
      if (!token) return null
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/api/wallet/airdrop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ amountSol })
        })
        if (!res.ok) {
          throw new Error('airdrop_failed')
        }
        const data = await res.json()
        const balance = data.balance ?? {}
        const next: WalletProfile = {
          walletAddress: balance.walletAddress ?? profile?.walletAddress ?? '',
          lamports: balance.lamports ?? profile?.lamports ?? 0,
          sol: balance.sol ?? profile?.sol ?? 0,
          usd: balance.usd ?? profile?.usd ?? null,
          usdRate: balance.usdRate ?? profile?.usdRate ?? null,
          units: balance.units ?? profile?.units ?? 0,
          inGameBalance: balance.inGameBalance ?? profile?.inGameBalance ?? 0
        }
        setProfile(next)
        return next
      } catch (err) {
        setError((err as Error).message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [profile, token]
  )

  return {
    profile,
    loading,
    error,
    refresh,
    requestAirdrop,
    fetchProfile
  }
}
