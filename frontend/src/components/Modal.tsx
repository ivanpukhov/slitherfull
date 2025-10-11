import type { MouseEvent, PropsWithChildren } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  width?: string
}

export function Modal({ open, title, onClose, width, children }: PropsWithChildren<ModalProps>) {
  if (!open) return null

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className="modal-window" style={width ? { width } : undefined}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
