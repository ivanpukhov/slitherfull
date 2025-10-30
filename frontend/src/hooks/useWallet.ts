import { useCallback, useEffect, useMemo, useState } from 'react'
import { translate } from './useTranslation'

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
const LAMPORTS_PER_SOL = 1_000_000_000

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
      const code = (err as Error).message || 'wallet_profile_failed'
      setError(mapWalletError(code))
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
      const code = (err as Error).message || 'wallet_refresh_failed'
      setError(mapWalletError(code))
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
        const code = (err as Error).message || 'airdrop_failed'
        setError(mapWalletError(code))
        return null
      } finally {
        setLoading(false)
      }
    },
    [profile, token]
  )

  const withdrawAll = useCallback(
    async (destination: string) => {
      if (!token) {
        throw new Error(translate('wallet.errors.authRequired'))
      }
      const normalized = typeof destination === 'string' ? destination.trim() : ''
      if (!normalized) {
        throw new Error(translate('wallet.errors.enterAddress'))
      }
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/api/wallet/withdraw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ destination: normalized })
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const code = data?.error || 'withdraw_failed'
          const message = getWithdrawErrorMessage(code)
          throw new Error(message)
        }
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
        const lamports = data.result?.lamports ?? 0
        const solAmount = data.result?.sol ?? (lamports ? lamports / LAMPORTS_PER_SOL : 0)
        return {
          lamports,
          sol: solAmount,
          signature: data.result?.signature ?? null,
          message:
            data.result?.message ||
            (solAmount > 0
              ? translate('wallet.withdraw.sent', { amount: solAmount.toFixed(4) })
              : translate('wallet.withdraw.success'))
        }
      } catch (err) {
        const code = (err as Error).message || 'withdraw_failed'
        const friendly = getWithdrawErrorMessage(code)
        setError(friendly)
        throw new Error(friendly)
      } finally {
        setLoading(false)
      }
    },
    [profile, token]
  )

  return useMemo(
    () => ({
      profile,
      loading,
      error,
      refresh,
      requestAirdrop,
      fetchProfile,
      withdrawAll
    }),
    [profile, loading, error, refresh, requestAirdrop, fetchProfile, withdrawAll]
  )
}

export type UseWalletController = ReturnType<typeof useWallet>

function getWithdrawErrorMessage(code: string) {
  const keyMap: Record<string, string> = {
    invalid_destination: 'wallet.errors.invalidDestination',
    insufficient_funds: 'wallet.errors.insufficientFunds',
    unauthorized: 'wallet.errors.authRequired',
    withdraw_failed: 'wallet.errors.withdrawFailed'
  }
  const key = keyMap[code] ?? 'wallet.errors.withdrawFailed'
  return translate(key)
}

function mapWalletError(code: string) {
  const keyMap: Record<string, string> = {
    unauthorized: 'wallet.errors.authRequired',
    wallet_profile_failed: 'wallet.errors.profileFailed',
    wallet_refresh_failed: 'wallet.errors.refreshFailed',
    airdrop_failed: 'wallet.errors.airdropFailed',
    invalid_destination: 'wallet.errors.invalidDestination',
    insufficient_funds: 'wallet.errors.insufficientFunds',
    withdraw_failed: 'wallet.errors.withdrawFailed'
  }
  const key = keyMap[code] ?? 'wallet.errors.generic'
  return translate(key)
}
