import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'

const ToastContext = createContext(null)

const toneStyles = {
  success: 'border-accent/40 bg-card text-ink',
  danger: 'border-danger/40 bg-card text-ink',
  info: 'border-line bg-card text-ink',
}

const toneIcons = {
  success: 'check',
  danger: 'info',
  info: 'info',
}

const toneColors = {
  success: 'bg-mint text-accent',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-line/50 text-mute',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const toast = useCallback(
    (message, tone = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((current) => [...current, { id, message, tone }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-24 right-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 md:bottom-6"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-3 shadow-lg shadow-black/10 ${toneStyles[item.tone] || toneStyles.info}`}
          >
            <span
              className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${toneColors[item.tone] || toneColors.info}`}
            >
              <Icon name={toneIcons[item.tone] || 'info'} className="h-5 w-5" />
            </span>
            <p className="flex-1 pt-1 text-sm font-medium leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded-lg p-1 text-mute transition hover:text-ink"
              aria-label="Dismiss notification"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider')
  }
  return context
}
