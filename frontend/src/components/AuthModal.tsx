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
        <h2>{title}</h2>
        <p className="auth-hint">{t('auth.modal.hint')}</p>
        <form onSubmit={handleSubmit}>
          <label className="auth-label" htmlFor="authEmail">{t('auth.fields.email')}</label>
          <input
            id="authEmail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
            required
          />
          <label className="auth-label" htmlFor="authPassword">{t('auth.fields.password')}</label>
          <input
            id="authPassword"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={mode === 'register' ? 6 : undefined}
            disabled={isLoading}
            required
          />
          {mode === 'register' && (
            <>
              <label className="auth-label" htmlFor="authNickname">{t('auth.fields.nickname')}</label>
              <input
                id="authNickname"
                type="text"
                autoComplete="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={16}
                disabled={isLoading}
                required
              />
            </>
          )}
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={isLoading}>
            {submitting
              ? t('auth.modal.submitting')
              : mode === 'login'
                ? t('auth.modal.loginAction')
                : t('auth.modal.registerAction')}
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
        </form>
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
