import { FormEvent, useMemo, useState } from 'react'
import type { AuthResult } from '../hooks/useAuth'

interface AuthModalProps {
  open: boolean
  status: 'checking' | 'authenticated' | 'unauthenticated'
  onLogin: (email: string, password: string) => Promise<AuthResult>
  onRegister: (email: string, password: string, nickname: string) => Promise<AuthResult>
}

type AuthMode = 'login' | 'register'

export function AuthModal({ open, status, onLogin, onRegister }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overlayClass = open ? 'overlay auth-overlay' : 'overlay hidden'
  const isLoading = status === 'checking' || submitting

  const title = useMemo(() => (mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'), [mode])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    if (!trimmedEmail || !trimmedPassword || (mode === 'register' && !nickname.trim())) {
      setError('Пожалуйста, заполните все поля.')
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
        <div className="auth-toggle" role="tablist">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => toggleMode('login')}
            disabled={submitting}
          >
            Вход
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => toggleMode('register')}
            disabled={submitting}
          >
            Регистрация
          </button>
        </div>
        <h2>{title}</h2>
        <p className="auth-hint">
          Войдите или создайте аккаунт, чтобы сохранять ник и баланс. На старте выдаётся 10 монет для ставок.
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
          <label className="auth-label" htmlFor="authPassword">Пароль</label>
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
              <label className="auth-label" htmlFor="authNickname">Никнейм</label>
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
            {submitting ? 'Отправка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
          {status === 'checking' && !submitting && (
            <p className="auth-status">Проверяем сессию...</p>
          )}
        </form>
      </div>
    </div>
  )
}

function mapError(code?: string | null) {
  if (!code) return 'Не удалось обработать запрос.'
  const messages: Record<string, string> = {
    invalid_payload: 'Проверьте корректность введённых данных.',
    email_taken: 'Такой email уже зарегистрирован.',
    nickname_taken: 'Выбранный никнейм занят.',
    invalid_credentials: 'Неверный email или пароль.',
    network_error: 'Не удалось подключиться к серверу.',
    server_error: 'Произошла ошибка сервера. Повторите попытку позже.'
  }
  return messages[code] || 'Не удалось обработать запрос.'
}
