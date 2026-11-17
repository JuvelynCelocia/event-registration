import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, children, className = '', labelledBy }) {
  const panelRef = useRef(null)
  const restoreRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const panel = panelRef.current
    const previouslyFocused = document.activeElement
    restoreRef.current = previouslyFocused instanceof HTMLElement ? previouslyFocused : null

    const focusables = () =>
      panel
        ? Array.from(panel.querySelectorAll(FOCUSABLE)).filter(
            (element) => element.getClientRects().length > 0,
          )
        : []

    const first = focusables()[0]
    ;(first || panel)?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !panel) return

      const items = focusables()
      if (!items.length) {
        event.preventDefault()
        panel.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      const restore = restoreRef.current
      if (restore && document.contains(restore)) {
        restore.focus({ preventScroll: true })
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[rgba(20,38,31,0.55)] p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`w-full max-w-[460px] rounded-card border-[1.5px] border-line bg-card shadow-2xl outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon = 'trash',
  busy = false,
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="confirm-title">
      <div className="p-8">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-bg text-danger">
          <Icon name={icon} className="h-7 w-7" />
        </div>
        <h2 id="confirm-title" className="mb-2 mt-4 text-2xl font-bold md:text-[28px]">
          {title}
        </h2>
        <div className="mb-6 leading-relaxed text-mute">{children}</div>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-alt" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
