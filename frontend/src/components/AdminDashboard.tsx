import { FormEvent, useCallback, useMemo, useState } from 'react'
import { AdminPortalLayout } from './AdminPortalLayout'
import { useAdminOverview, type AdminTransferPayload } from '../hooks/useAdminOverview'
import { useAdminMetrics } from '../hooks/useAdminMetrics'
import { useTranslation, getIntlLocale } from '../hooks/useTranslation'
import type { AdminSession } from '../hooks/useAdminSession'
import { AdminMetricsBoard } from './AdminMetricsBoard'

interface ConfirmationModalState {
  userId: number
  action: 'ban' | 'unban'
}

export function AdminDashboard() {
  return (
    <AdminPortalLayout titleKey="admin.dashboard.title">
      {(session) => <AdminOverviewView session={session} />}
    </AdminPortalLayout>
  )
}

function AdminOverviewView({ session }: { session: AdminSession }) {
  const { t, locale } = useTranslation()
  const [transferKind, setTransferKind] = useState<'game_to_user' | 'user_to_game' | 'user_to_user'>('game_to_user')
  const [transferFromUserId, setTransferFromUserId] = useState('')
  const [transferToUserId, setTransferToUserId] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferResult, setTransferResult] = useState<{ error?: string; success?: string } | null>(null)
  const [transferLoading, setTransferLoading] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationModalState | null>(null)

  const { overview, loading, error, refresh, transfer, banUser, unbanUser } = useAdminOverview(session.token)
  const canManageUsers = overview?.permissions?.canManageUsers ?? session.role === 'superadmin'
  const canTransfer = overview?.permissions?.canTransfer ?? session.role !== 'viewer'
  const canViewMetrics = overview?.permissions?.canViewMetrics ?? session.role !== 'viewer'
  const metrics = useAdminMetrics(session.token, canViewMetrics)

  const totalSol = useMemo(() => {
    if (!overview) return 0
    const walletSol = overview.gameWallet.walletSol || 0
    const usersSol = overview.users.reduce((sum, user) => sum + (user.walletSol || 0), 0)
    return walletSol + usersSol
  }, [overview])

  const userOptions = useMemo(() => overview?.users ?? [], [overview])

  const resetTransferState = useCallback(() => {
    setTransferResult(null)
    if (transferKind === 'game_to_user') {
      setTransferFromUserId('')
    }
    if (transferKind === 'user_to_game') {
      setTransferToUserId('')
    }
  }, [transferKind])

  const handleTransferChange = useCallback(
    (kind: 'game_to_user' | 'user_to_game' | 'user_to_user') => {
      setTransferKind(kind)
      resetTransferState()
    },
    [resetTransferState]
  )

  const handleTransfer = useCallback(
    async (event: FormEvent) => {
      event.preventDefault()
      if (!canTransfer) {
        setTransferResult({ error: t('admin.transfers.errors.noPermission') })
        return
      }
      const amountValue = Number(transferAmount)
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        setTransferResult({ error: t('admin.transfers.validation.invalidAmount') })
        return
      }
      const payload: AdminTransferPayload = {
        amount: amountValue,
        fromType: transferKind === 'game_to_user' ? 'game' : 'user',
        toType: transferKind === 'user_to_game' ? 'game' : 'user'
      }
      if (transferKind !== 'game_to_user') {
        if (!transferFromUserId) {
          setTransferResult({ error: t('admin.transfers.validation.selectSender') })
          return
        }
        payload.fromUserId = Number(transferFromUserId)
      }
      if (transferKind !== 'user_to_game') {
        if (!transferToUserId) {
          setTransferResult({ error: t('admin.transfers.validation.selectRecipient') })
          return
        }
        payload.toUserId = Number(transferToUserId)
        if (payload.fromUserId && payload.toUserId === payload.fromUserId) {
          setTransferResult({ error: t('admin.transfers.validation.sameUser') })
          return
        }
      }
      setTransferLoading(true)
      setTransferResult(null)
      const result = await transfer(payload)
      if (result.ok) {
        setTransferAmount('')
        setTransferResult({ success: t('admin.transfers.success') })
      } else if (result.error) {
        const errorKey = `admin.transfers.errors.${result.error}`
        const translated = t(errorKey)
        setTransferResult({ error: translated === errorKey ? result.error : translated })
      }
      setTransferLoading(false)
    },
    [canTransfer, t, transferAmount, transferKind, transferFromUserId, transferToUserId, transfer]
  )

  const handleBan = useCallback(
    async (userId: number) => {
      if (!canManageUsers) return
      const result = await banUser(userId)
      if (!result.ok && result.error) {
        const errorKey = `admin.users.errors.${result.error}`
        const translated = t(errorKey)
        setTransferResult({ error: translated === errorKey ? result.error : translated })
      }
      setConfirmation(null)
    },
    [banUser, canManageUsers, t]
  )

  const handleUnban = useCallback(
    async (userId: number) => {
      if (!canManageUsers) return
      const result = await unbanUser(userId)
      if (!result.ok && result.error) {
        const errorKey = `admin.users.errors.${result.error}`
        const translated = t(errorKey)
        setTransferResult({ error: translated === errorKey ? result.error : translated })
      }
      setConfirmation(null)
    },
    [canManageUsers, t, unbanUser]
  )

  return (
    <div className="admin-card">
      <div className="admin-header">
        <div>
          <p className="admin-subtitle">{t('admin.dashboard.subtitle')}</p>
          {error && <div className="admin-error">{t('admin.dashboard.error', { message: error })}</div>}
        </div>
        <div className="admin-actions">
          <button type="button" onClick={refresh} disabled={loading}>
            {loading ? t('admin.common.refreshing') : t('admin.common.refresh')}
          </button>
        </div>
      </div>

      <div className="admin-summary">
        <div>
          <span className="summary-label">{t('admin.dashboard.gameWallet')}</span>
          <span className="summary-value">{overview?.gameWallet.walletSol.toFixed(3) ?? '0.000'} SOL</span>
          <span className="summary-address">{overview?.gameWallet.walletAddress}</span>
        </div>
        <div>
          <span className="summary-label">{t('admin.dashboard.totalSol')}</span>
          <span className="summary-value">{totalSol.toFixed(3)} SOL</span>
        </div>
        {overview?.totals?.totalBanned !== undefined && (
          <div>
            <span className="summary-label">{t('admin.dashboard.totalBanned')}</span>
            <span className="summary-value">{overview.totals.totalBanned}</span>
          </div>
        )}
      </div>

      {canViewMetrics && (
        <section className="admin-section">
          <div className="admin-section-header">
            <h2>{t('admin.metrics.title')}</h2>
            <button type="button" className="admin-secondary" onClick={metrics.refresh} disabled={metrics.loading}>
              {metrics.loading ? t('admin.metrics.refreshing') : t('admin.metrics.refresh')}
            </button>
          </div>
          {metrics.error && <div className="admin-error">{t('admin.metrics.error', { message: metrics.error })}</div>}
          <AdminMetricsBoard
            metrics={metrics.metrics}
            locale={getIntlLocale(locale)}
            emptyLabel={t('admin.metrics.empty')}
          />
        </section>
      )}

      {canTransfer && (
        <section className="admin-section">
          <h2>{t('admin.transfers.title')}</h2>
          <form onSubmit={handleTransfer} className="admin-transfer-form">
            <label>
              {t('admin.transfers.typeLabel')}
              <select value={transferKind} onChange={(event) => handleTransferChange(event.target.value as typeof transferKind)}>
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
            {transferResult?.error && <div className="admin-error">{transferResult.error}</div>}
            {transferResult?.success && <div className="admin-success">{transferResult.success}</div>}
          </form>
        </section>
      )}

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>{t('admin.table.title')}</h2>
          <span className="admin-table-hint">{t('admin.table.hint')}</span>
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
                <th>{t('admin.table.status')}</th>
                {canManageUsers && <th>{t('admin.table.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {overview?.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>{user.nickname}</td>
                  <td className="mono">{user.walletAddress}</td>
                  <td>{user.walletSol.toFixed(3)}</td>
                  <td>{user.walletLamports.toLocaleString(getIntlLocale(locale))}</td>
                  <td>{user.inGameBalance}</td>
                  <td>
                    <span className={`admin-status admin-status-${user.status}`}>
                      {t(`admin.users.status.${user.status}`)}
                    </span>
                  </td>
                  {canManageUsers && (
                    <td>
                      {user.status === 'banned' ? (
                        <button type="button" className="admin-link" onClick={() => setConfirmation({ userId: user.id, action: 'unban' })}>
                          {t('admin.users.actions.unban')}
                        </button>
                      ) : (
                        <button type="button" className="admin-link warning" onClick={() => setConfirmation({ userId: user.id, action: 'ban' })}>
                          {t('admin.users.actions.ban')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {confirmation && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <h3>
              {confirmation.action === 'ban'
                ? t('admin.users.confirmBanTitle')
                : t('admin.users.confirmUnbanTitle')}
            </h3>
            <p>
              {confirmation.action === 'ban'
                ? t('admin.users.confirmBanMessage', { id: confirmation.userId })
                : t('admin.users.confirmUnbanMessage', { id: confirmation.userId })}
            </p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary" onClick={() => setConfirmation(null)}>
                {t('admin.common.cancel')}
              </button>
              {confirmation.action === 'ban' ? (
                <button type="button" className="admin-danger" onClick={() => handleBan(confirmation.userId)}>
                  {t('admin.users.actions.ban')}
                </button>
              ) : (
                <button type="button" className="admin-link" onClick={() => handleUnban(confirmation.userId)}>
                  {t('admin.users.actions.unban')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
