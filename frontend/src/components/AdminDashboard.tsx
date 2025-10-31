import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { getIntlLocale, useTranslation } from '../hooks/useTranslation'

interface AdminUser {
  id: number
  email: string
  nickname: string
  walletAddress: string
  walletLamports: number
  walletSol: number
  inGameBalance: number
}

interface AdminOverview {
  users: AdminUser[]
  gameWallet: {
    walletAddress: string
    walletLamports: number
    walletSol: number
  }
}

type TransferKind = 'game_to_user' | 'user_to_game' | 'user_to_user'

const TRANSFER_ERROR_MESSAGE_KEYS: Record<string, string> = {
  invalid_amount: 'admin.transfers.errors.invalidAmount',
  missing_destination_user_id: 'admin.transfers.errors.missingRecipient',
  missing_source_user_id: 'admin.transfers.errors.missingSender',
  missing_user_id: 'admin.transfers.errors.missingBoth',
  insufficient_funds: 'admin.transfers.errors.insufficientFunds',
  source_user_not_found: 'admin.transfers.errors.senderNotFound',
  destination_user_not_found: 'admin.transfers.errors.recipientNotFound',
  same_user_transfer: 'admin.transfers.errors.sameUser'
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://191.101.184.209:8080'
const STORAGE_KEY = 'admin_basic_token'

export function AdminDashboard() {
  const [email, setEmail] = useState('admin@tend.kz')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(STORAGE_KEY)
  })
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transferKind, setTransferKind] = useState<TransferKind>('game_to_user')
  const [transferFromUserId, setTransferFromUserId] = useState('')
  const [transferToUserId, setTransferToUserId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null)
  const { t, locale } = useTranslation()

  const fetchOverview = useCallback(
    async (basicToken: string) => {
      if (!basicToken) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/overview`, {
          headers: {
            Authorization: `Basic ${basicToken}`
          }
        })
        if (!res.ok) {
          throw new Error('unauthorized')
        }
        const data = await res.json()
        setOverview(data.data)
        return data.data as AdminOverview
      } catch (err) {
        const message = (err as Error).message || 'request_failed'
        setError(message)
        setOverview(null)
        if (message === 'unauthorized') {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(STORAGE_KEY)
          }
          setToken(null)
        }
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (token) {
      fetchOverview(token)
    }
  }, [fetchOverview, token])

  useEffect(() => {
    setTransferError(null)
    setTransferSuccess(null)
    if (transferKind === 'game_to_user') {
      setTransferFromUserId('')
    }
    if (transferKind === 'user_to_game') {
      setTransferToUserId('')
    }
  }, [transferKind])

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      const normalizedEmail = email.trim()
      const basic = btoa(`${normalizedEmail}:${password}`)
      window.localStorage.setItem(STORAGE_KEY, basic)
      setToken(basic)
      await fetchOverview(basic)
    },
    [email, password, fetchOverview]
  )

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setOverview(null)
    setPassword('')
  }, [])

  const totalSol = useMemo(() => {
    if (!overview) return 0
    return overview.users.reduce((sum, user) => sum + (user.walletSol || 0), overview.gameWallet.walletSol || 0)
  }, [overview])

  const userOptions = useMemo(() => overview?.users ?? [], [overview])

  const handleTransfer = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!token) return
      const amountValue = Number(transferAmount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setTransferError(t('admin.transfers.validation.invalidAmount'))
        setTransferSuccess(null)
        return
      }

      const payload: Record<string, unknown> = { amount: amountValue }

      if (transferKind === 'game_to_user') {
        if (!transferToUserId) {
          setTransferError(t('admin.transfers.validation.selectRecipient'))
          setTransferSuccess(null)
          return
        }
        payload.fromType = 'game'
        payload.toType = 'user'
        payload.toUserId = Number(transferToUserId)
      } else if (transferKind === 'user_to_game') {
        if (!transferFromUserId) {
          setTransferError(t('admin.transfers.validation.selectSender'))
          setTransferSuccess(null)
          return
        }
        payload.fromType = 'user'
        payload.toType = 'game'
        payload.fromUserId = Number(transferFromUserId)
      } else {
        if (!transferFromUserId || !transferToUserId) {
          setTransferError(t('admin.transfers.validation.selectBoth'))
          setTransferSuccess(null)
          return
        }
        if (transferFromUserId === transferToUserId) {
          setTransferError(t('admin.transfers.validation.sameUser'))
          setTransferSuccess(null)
          return
        }
        payload.fromType = 'user'
        payload.toType = 'user'
        payload.fromUserId = Number(transferFromUserId)
        payload.toUserId = Number(transferToUserId)
      }

      setTransferLoading(true)
      setTransferError(null)
      setTransferSuccess(null)
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/transfer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${token}`
          },
          body: JSON.stringify(payload)
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) {
          const message = data?.error || 'transfer_failed'
          throw new Error(message)
        }
        setTransferSuccess(t('admin.transfers.success'))
        setTransferAmount('')
        await fetchOverview(token)
      } catch (err) {
        const code = (err as Error).message || 'transfer_failed'
        setTransferError(getTransferErrorMessage(code, t) || code)
      } finally {
        setTransferLoading(false)
      }
    },
    [fetchOverview, t, token, transferAmount, transferFromUserId, transferKind, transferToUserId]
  )

  if (!token || !overview) {
    return (
      <div className="admin-wrapper">
        <div className="admin-card">
          <h1>{t('admin.portal.title')}</h1>
          <form onSubmit={handleSubmit} className="admin-form">
            <label>
              {t('admin.portal.fields.email')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              {t('admin.portal.fields.password')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? t('admin.portal.verifying') : t('admin.portal.signIn')}
            </button>
            {error && <div className="admin-error">{t('admin.portal.error', { message: error })}</div>}
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-wrapper">
      <div className="admin-card">
        <div className="admin-header">
          <div>
            <h1>{t('admin.dashboard.title')}</h1>
            <p className="admin-subtitle">{t('admin.dashboard.subtitle')}</p>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => fetchOverview(token)} disabled={loading}>
              {loading ? t('admin.common.refreshing') : t('admin.common.refresh')}
            </button>
            <button type="button" className="admin-secondary" onClick={handleLogout}>
              {t('admin.portal.signOut')}
            </button>
          </div>
        </div>
        <div className="admin-summary">
          <div>
            <span className="summary-label">{t('admin.dashboard.gameWallet')}</span>
            <span className="summary-value">{overview.gameWallet.walletSol.toFixed(3)} SOL</span>
            <span className="summary-address">{overview.gameWallet.walletAddress}</span>
          </div>
          <div>
            <span className="summary-label">{t('admin.dashboard.totalSol')}</span>
            <span className="summary-value">{totalSol.toFixed(3)} SOL</span>
          </div>
        </div>
        <div className="admin-transfer">
          <h2>{t('admin.transfers.title')}</h2>
          <form onSubmit={handleTransfer}>
            <label>
              {t('admin.transfers.typeLabel')}
              <select value={transferKind} onChange={(event) => setTransferKind(event.target.value as TransferKind)}>
                <option value="game_to_user">{t('admin.transfers.types.gameToUser')}</option>
                <option value="user_to_game">{t('admin.transfers.types.userToGame')}</option>
                <option value="user_to_user">{t('admin.transfers.types.userToUser')}</option>
              </select>
            </label>
            {(transferKind === 'user_to_game' || transferKind === 'user_to_user') && (
              <label>
                {t('admin.transfers.senderLabel')}
                <select value={transferFromUserId} onChange={(event) => setTransferFromUserId(event.target.value)}>
                  <option value="">{t('admin.transfers.selectUser')}</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      #{user.id} · {user.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(transferKind === 'game_to_user' || transferKind === 'user_to_user') && (
              <label>
                {t('admin.transfers.recipientLabel')}
                <select value={transferToUserId} onChange={(event) => setTransferToUserId(event.target.value)}>
                  <option value="">{t('admin.transfers.selectUser')}</option>
                  {userOptions.map((user) => (
                    <option key={user.id} value={user.id}>
                      #{user.id} · {user.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              {t('admin.transfers.amountLabel')}
              <input
                type="number"
                min="0"
                step="0.001"
                value={transferAmount}
                onChange={(event) => setTransferAmount(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={transferLoading}>
              {transferLoading ? t('admin.transfers.processing') : t('admin.transfers.submit')}
            </button>
            {transferError && <div className="admin-error">{transferError}</div>}
            {transferSuccess && <div className="admin-success">{transferSuccess}</div>}
          </form>
        </div>
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>{t('admin.table.id')}</th>
                <th>{t('admin.table.email')}</th>
                <th>{t('admin.table.nickname')}</th>
                <th>{t('admin.table.wallet')}</th>
                <th>{t('admin.table.sol')}</th>
                <th>{t('admin.table.lamports')}</th>
                <th>{t('admin.table.inGameBalance')}</th>
              </tr>
            </thead>
            <tbody>
              {overview.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.nickname}</td>
                  <td className="mono">{user.walletAddress}</td>
                  <td>{user.walletSol.toFixed(3)}</td>
                  <td>{user.walletLamports.toLocaleString(getIntlLocale(locale))}</td>
                  <td>{user.inGameBalance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function getTransferErrorMessage(code: string, t: ReturnType<typeof useTranslation>['t']) {
  const key = TRANSFER_ERROR_MESSAGE_KEYS[code]
  return key ? t(key) : null
}
