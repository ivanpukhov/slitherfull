import { FormEvent, ReactNode, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAdminSession, type AdminSession } from '../hooks/useAdminSession'
import { useTranslation } from '../hooks/useTranslation'
import '../styles/admin.css'

interface AdminPortalLayoutProps {
  titleKey: string
  children: ReactNode | ((session: AdminSession) => ReactNode)
}

export function AdminPortalLayout({ titleKey, children }: AdminPortalLayoutProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const { session, login, logout, loading, error } = useAdminSession()
  const [email, setEmail] = useState('admin@tend.kz')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const navigation = useMemo(
    () => [
      { to: '/admin', label: t('admin.navigation.overview') },
      { to: '/admin/audit', label: t('admin.navigation.audit') }
    ],
    [t]
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await login(email, password)
    if (!result.ok && result.error) {
      setFormError(result.error)
    } else {
      setFormError(null)
      setPassword('')
    }
  }

  if (!session) {
    return (
      <div className="admin-wrapper">
        <div className="admin-card">
          <h1>{t('admin.portal.title')}</h1>
          <form className="admin-form" onSubmit={handleSubmit}>
            <label>
              {t('admin.portal.fields.email')}
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              {t('admin.portal.fields.password')}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? t('admin.portal.verifying') : t('admin.portal.signIn')}
            </button>
            {(formError || error) && (
              <div className="admin-error">{t('admin.portal.error', { message: formError || error })}</div>
            )}
          </form>
        </div>
      </div>
    )
  }

  const safeSession = session

  const renderChildren = (): ReactNode => {
    if (typeof children === 'function') {
      return (children as (session: typeof safeSession) => JSX.Element)(safeSession)
    }
    return children as ReactNode
  }

  return (
    <div className="admin-wrapper">
      <div className="admin-nav">
        <div className="admin-nav-brand">
          <h1>{t(titleKey)}</h1>
          <p>{t('admin.portal.roleDisplay', { role: t(`admin.roles.${session.role}`) })}</p>
        </div>
        <nav>
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} className={location.pathname === item.to ? 'active' : undefined}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-nav-actions">
          <span className="admin-user-email">{session.email}</span>
          <button type="button" className="admin-secondary" onClick={logout}>
            {t('admin.portal.signOut')}
          </button>
        </div>
      </div>
      <div className="admin-content">{renderChildren()}</div>
    </div>
  )
}
