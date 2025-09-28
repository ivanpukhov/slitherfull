import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
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

  if (!token || !overview) {
    return (
      <div className="admin-wrapper">
        <div className="admin-card">
          <h1>Admin Portal</h1>
          <form onSubmit={handleSubmit} className="admin-form">
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Пароль
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Проверка...' : 'Войти'}
            </button>
            {error && <div className="admin-error">Ошибка: {error}</div>}
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
            <h1>Сводка кошельков</h1>
            <p className="admin-subtitle">Обновлено автоматически при входе</p>
          </div>
          <div className="admin-actions">
            <button type="button" onClick={() => fetchOverview(token)} disabled={loading}>
              {loading ? 'Обновление...' : 'Обновить'}
            </button>
            <button type="button" className="admin-secondary" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>
        <div className="admin-summary">
          <div>
            <span className="summary-label">Игровой кошелек</span>
            <span className="summary-value">{overview.gameWallet.walletSol.toFixed(3)} SOL</span>
            <span className="summary-address">{overview.gameWallet.walletAddress}</span>
          </div>
          <div>
            <span className="summary-label">Всего SOL</span>
            <span className="summary-value">{totalSol.toFixed(3)} SOL</span>
          </div>
        </div>
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Ник</th>
                <th>Кошелек</th>
                <th>Баланс (SOL)</th>
                <th>Lamports</th>
                <th>Игровой баланс</th>
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
                  <td>{user.walletLamports.toLocaleString('en-US')}</td>
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
