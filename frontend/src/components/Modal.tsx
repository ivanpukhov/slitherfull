import type { MouseEvent, PropsWithChildren, ReactNode } from 'react'
import { useTranslation } from '../hooks/useTranslation'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  width?: string
  className?: string
  bodyClassName?: string
  headerActions?: ReactNode
}

export function Modal({
  open,
  title,
  onClose,
  width,
  className,
  bodyClassName,
  headerActions,
  children
}: PropsWithChildren<ModalProps>) {
  if (!open) return null
  const { t } = useTranslation()

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const windowClassName = className ? `modal-window ${className}` : 'modal-window'
  const bodyClassNameResolved = bodyClassName ? `modal-body ${bodyClassName}` : 'modal-body'

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className={windowClassName} style={width ? { width } : undefined}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          {headerActions ? <div className="modal-actions">{headerActions}</div> : null}
          <button type="button" className="modal-close" aria-label={t('modal.close')} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={bodyClassNameResolved}>{children}</div>
      </div>
    </div>
  )
}
