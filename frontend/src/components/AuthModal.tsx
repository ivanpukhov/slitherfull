import { FormEvent, useMemo, useState } from 'react'
import type { AuthResult } from '../hooks/useAuth'

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

  const overlayClass = open ? 'overlay auth-overlay' : 'overlay hidden'
  const isLoading = status === 'checking' || submitting

  const title = useMemo(() => (mode === 'login' ? 'Sign in to your account' : 'Create an account'), [mode])

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
      setError('Please fill in all fields.')
      setSubmitting(false)
      return
    }
    const result = mode === 'login'
      ? await onLogin(trimmedEmail, trimmedPassword)
      : await onRegister(trimmedEmail, trimmedPassword, nickname.trim())
    if (!result.ok) {
      setError(mapError(result.error))
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
            aria-label="Close authentication window"
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
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => toggleMode('register')}
            disabled={submitting}
          >
            Sign up
          </button>
        </div>
        <h2>{title}</h2>
        <p className="auth-hint">
          Sign in or create an account to save your nickname and balance. You start with 10 coins to place bets.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="auth-label" htmlFor="authEmail">Email</label>
          <input
            id="authEmail"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
            required
          />
          <label className="auth-label" htmlFor="authPassword">Password</label>
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
              <label className="auth-label" htmlFor="authNickname">Nickname</label>
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
            {submitting ? 'Submitting...' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </button>
          {status === 'checking' && !submitting && (
            <p className="auth-status">Checking session...</p>
          )}
        </form>
      </div>
    </div>
  )
}

function mapError(code?: string | null) {
  if (!code) return 'Failed to process the request.'
  const messages: Record<string, string> = {
    invalid_payload: 'Please check the information you entered.',
    email_taken: 'This email is already registered.',
    nickname_taken: 'The selected nickname is taken.',
    invalid_credentials: 'Incorrect email or password.',
    network_error: 'Unable to connect to the server.',
    server_error: 'A server error occurred. Please try again later.'
  }
  return messages[code] || 'Failed to process the request.'
}
