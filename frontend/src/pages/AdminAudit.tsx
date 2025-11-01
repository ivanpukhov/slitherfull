import { useMemo, useState } from 'react'
import { AdminPortalLayout } from '../components/AdminPortalLayout'
import { useAdminAudit, type AuditFilters } from '../hooks/useAdminAudit'
import { useTranslation } from '../hooks/useTranslation'

const ACTION_OPTIONS = ['login', 'logout', 'transfer', 'ban', 'unban', 'update_role']

export function AdminAudit() {
  return (
    <AdminPortalLayout titleKey="admin.audit.title">
      {(activeSession) => <AuditView sessionToken={activeSession.token} />}
    </AdminPortalLayout>
  )
}

function AuditView({ sessionToken }: { sessionToken: string }) {
  const { t } = useTranslation()
  const [filters, setFilters] = useState<AuditFilters>({})
  const { entries, loading, error, refresh } = useAdminAudit(sessionToken, filters)

  const actions = useMemo(() => ACTION_OPTIONS.map((action) => ({ value: action, label: t(`admin.audit.actions.${action}`) })), [t])

  return (
    <div className="admin-card">
      <div className="admin-section-header">
        <h2>{t('admin.audit.title')}</h2>
        <button type="button" className="admin-secondary" onClick={refresh} disabled={loading}>
          {loading ? t('admin.common.refreshing') : t('admin.common.refresh')}
        </button>
      </div>
      <div className="admin-audit-filters">
        <label>
          {t('admin.audit.filters.search')}
          <input
            type="search"
            value={filters.search ?? ''}
            placeholder={t('admin.audit.filters.searchPlaceholder')}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
          />
        </label>
        <label>
          {t('admin.audit.filters.action')}
          <select
            value={filters.action ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value || undefined }))}
          >
            <option value="">{t('admin.audit.filters.any')}</option>
            {actions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('admin.audit.filters.role')}
          <select
            value={filters.role ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, role: event.target.value || undefined }))}
          >
            <option value="">{t('admin.audit.filters.any')}</option>
            <option value="viewer">{t('admin.roles.viewer')}</option>
            <option value="manager">{t('admin.roles.manager')}</option>
            <option value="superadmin">{t('admin.roles.superadmin')}</option>
          </select>
        </label>
        <label>
          {t('admin.audit.filters.from')}
          <input
            type="datetime-local"
            value={filters.from ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value || undefined }))}
          />
        </label>
        <label>
          {t('admin.audit.filters.to')}
          <input
            type="datetime-local"
            value={filters.to ?? ''}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value || undefined }))}
          />
        </label>
      </div>

      {error && <div className="admin-error">{t('admin.audit.error', { message: error })}</div>}

      <div className="admin-table">
        <table>
          <thead>
            <tr>
              <th>{t('admin.audit.table.timestamp')}</th>
              <th>{t('admin.audit.table.actor')}</th>
              <th>{t('admin.audit.table.role')}</th>
              <th>{t('admin.audit.table.action')}</th>
              <th>{t('admin.audit.table.subject')}</th>
              <th>{t('admin.audit.table.metadata')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                <td>{entry.actorEmail}</td>
                <td>{t(`admin.roles.${entry.actorRole}`, { defaultValue: entry.actorRole })}</td>
                <td>{t(`admin.audit.actions.${entry.action}`, { defaultValue: entry.action })}</td>
                <td>{entry.subject}</td>
                <td>
                  {entry.metadata ? (
                    <details>
                      <summary>{t('admin.audit.table.metadataSummary')}</summary>
                      <pre>{JSON.stringify(entry.metadata, null, 2)}</pre>
                    </details>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            ))}
            {!entries.length && (
              <tr>
                <td colSpan={6} className="admin-empty">
                  {t('admin.audit.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
