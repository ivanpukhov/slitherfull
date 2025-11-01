import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

export interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number
}

interface ToastRecord {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastContextValue {
  pushToast: (options: ToastOptions) => string
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 10000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const timeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const timeout = timeoutsRef.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutsRef.current.delete(id)
    }
  }, [])

  const scheduleRemoval = useCallback(
    (id: string, duration: number) => {
      if (duration <= 0) return
      const existing = timeoutsRef.current.get(id)
      if (existing) {
        clearTimeout(existing)
      }
      const timeoutId = setTimeout(() => {
        dismissToast(id)
      }, duration)
      timeoutsRef.current.set(id, timeoutId)
    },
    [dismissToast]
  )

  const pushToast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const next: ToastRecord = {
        id,
        message: options.message,
        type: options.type ?? 'info',
        duration: options.duration ?? DEFAULT_DURATION
      }
      setToasts((prev) => [...prev, next])
      scheduleRemoval(id, next.duration)
      return id
    },
    [scheduleRemoval]
  )

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      timeoutsRef.current.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(() => ({ pushToast, dismissToast }), [dismissToast, pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const role = toast.type === 'error' ? 'alert' : 'status'
          return (
            <div key={toast.id} className={`toast toast--${toast.type}`} role={role}>
              <span className="toast__message">{toast.message}</span>
              <button
                type="button"
                className="toast__dismiss"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
