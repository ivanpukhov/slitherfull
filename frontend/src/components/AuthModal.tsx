import { FormEvent, useMemo, useState } from 'react'
import type { AuthResult } from '../hooks/useAuth'
import { useTranslation } from '../hooks/useTranslation'

interface AuthModalProps {
  open: boolean
  status: 'checking' | 'authenticated' | 'unauthenticated'
  onLogin: (email: string, password: string) => Promise<AuthResult>
  onRegister: (email: string, password: string, nickname: string) => Promise<AuthResult>
  onClose?: () => void
}

type AuthMode = 'login' | 'register'

export function AuthModal({ open, status, onLogin, onRegister, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  const overlayClass = open ? 'overlay auth-overlay' : 'overlay hidden'
  const isLoading = status === 'checking' || submitting

  const title = useMemo(
    () => (mode === 'login' ? t('auth.modal.loginTitle') : t('auth.modal.registerTitle')),
    [mode, t]
  )

  const handleClose = () => {
    if (isLoading) return
    onClose?.()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    if (!trimmedEmail || !trimmedPassword || (mode === 'register' && !nickname.trim())) {
      setError(t('auth.modal.validation.missingFields'))
      setSubmitting(false)
      return
    }
    const result = mode === 'login'
      ? await onLogin(trimmedEmail, trimmedPassword)
      : await onRegister(trimmedEmail, trimmedPassword, nickname.trim())
    if (!result.ok) {
      setError(mapError(result.error, t))
    }
    setSubmitting(false)
  }

  const toggleMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError(null)
  }

  return (
    <div className={overlayClass} aria-hidden={!open}>
      <div className="card auth-card">
        {onClose && (
          <button
            type="button"
            className="auth-close"
            onClick={handleClose}
            aria-label={t('auth.modal.closeAria')}
            disabled={isLoading}
          >
            ×
          </button>
        )}
        <div className="auth-card__branding">
          <div className="auth-card__logo" aria-hidden="true">
            <span>Logo</span>
          </div>
          <h2 className="auth-card__title">{title}</h2>
          <p className="auth-card__hint">{t('auth.modal.hint')}</p>
        </div>
        <div className="auth-toggle" role="tablist">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => toggleMode('login')}
            disabled={submitting}
          >
            {t('auth.modal.loginTab')}
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => toggleMode('register')}
            disabled={submitting}
          >
            {t('auth.modal.registerTab')}
          </button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="authEmail">
              {t('auth.fields.email')}
            </label>
            <input
              id="authEmail"
              type="email"
              autoComplete="email"
              placeholder={t('auth.fields.emailPlaceholder')}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="authPassword">
              {t('auth.fields.password')}
            </label>
            <input
              id="authPassword"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={t('auth.fields.passwordPlaceholder')}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={mode === 'register' ? 6 : undefined}
              disabled={isLoading}
              required
            />
          </div>
          {mode === 'register' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="authNickname">
                {t('auth.fields.nickname')}
              </label>
              <input
                id="authNickname"
                type="text"
                autoComplete="nickname"
                placeholder={t('auth.fields.nicknamePlaceholder')}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={16}
                disabled={isLoading}
                required
              />
            </div>
          )}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="damn-primary-button auth-submit" type="submit" disabled={isLoading}>
            {submitting
              ? t('auth.modal.submitting')
              : mode === 'login'
                ? t('auth.modal.loginAction')
                : t('auth.modal.registerAction')}
          </button>
        </form>
        <div className="auth-divider">
          <span>{t('auth.modal.divider')}</span>
        </div>
        <button type="button" className="auth-google" disabled={isLoading}>
          <span className="auth-google__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path
                d="M21.35 11.1H12v2.9h5.32c-.23 1.4-.94 2.59-2 3.38v2.8h3.2c1.88-1.73 2.96-4.28 2.96-7.35 0-.71-.07-1.39-.2-2.03Z"
                fill="#4285F4"
              />
              <path
                d="M12 22c2.7 0 4.96-.89 6.62-2.38l-3.2-2.8c-.9.6-2.04.96-3.42.96-2.63 0-4.86-1.77-5.66-4.15H3.04v2.92C4.68 19.98 8.06 22 12 22Z"
                fill="#34A853"
              />
              <path
                d="M6.34 13.63c-.2-.6-.32-1.25-.32-1.93s.12-1.34.32-1.93V6.85H3.04A9.96 9.96 0 0 0 2 11.7c0 1.6.38 3.1 1.04 4.46l3.3-2.53Z"
                fill="#FBBC05"
              />
              <path
                d="M12 4.58c1.47 0 2.77.5 3.8 1.48l2.84-2.84C16.95 1.45 14.7.5 12 .5 8.06.5 4.68 2.52 3.04 5.48l3.3 2.53C7.14 6.35 9.37 4.58 12 4.58Z"
                fill="#EA4335"
              />
            </svg>
          </span>
          <span>{t('auth.modal.googleButton')}</span>
        </button>
        <p className="auth-legal">
          {t('auth.modal.legal.intro')}{' '}
          <a
            className="auth-legal-link"
            href="/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('auth.modal.legal.terms')}
          </a>{' '}
          {t('auth.modal.legal.and')}{' '}
          <a
            className="auth-legal-link"
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('auth.modal.legal.privacy')}
          </a>
          .
        </p>
        {status === 'checking' && !submitting && (
          <p className="auth-status">{t('auth.modal.checkingSession')}</p>
        )}
      </div>
    </div>
  )
}

function mapError(code: string | null | undefined, t: ReturnType<typeof useTranslation>['t']) {
  if (!code) return t('auth.errors.generic')
  const messages: Record<string, string> = {
    invalid_payload: t('auth.errors.invalidPayload'),
    email_taken: t('auth.errors.emailTaken'),
    nickname_taken: t('auth.errors.nicknameTaken'),
    invalid_credentials: t('auth.errors.invalidCredentials'),
    network_error: t('auth.errors.network'),
    server_error: t('auth.errors.server')
  }
  return messages[code] || t('auth.errors.generic')
}
