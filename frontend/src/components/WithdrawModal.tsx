import { FormEvent, useMemo, useRef } from 'react'
import { Modal } from './Modal'
import { formatUsd } from '../utils/helpers'
import { useTranslation } from '../hooks/useTranslation'

interface WithdrawModalProps {
  open: boolean
  balanceCents: number
  solBalance?: number | null
  usdBalance?: number | null
  pending?: boolean
  address: string
  error?: string | null
  status?: { type: 'success' | 'error'; message: string } | null
  onAddressChange: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}

export function WithdrawModal({
  open,
  balanceCents,
  solBalance,
  usdBalance,
  pending,
  address,
  error,
  status,
  onAddressChange,
  onSubmit,
  onClose
}: WithdrawModalProps) {
  const { t } = useTranslation()
  const amountRef = useRef<HTMLInputElement>(null)

  const formattedBalance = useMemo(() => formatUsd(balanceCents), [balanceCents])
  const formattedSol = useMemo(() => {
    if (typeof solBalance === 'number' && Number.isFinite(solBalance)) {
      return `${solBalance.toFixed(3)} SOL`
    }
    if (typeof usdBalance === 'number' && Number.isFinite(usdBalance)) {
      return `$${usdBalance.toFixed(2)}`
    }
    const dollars = balanceCents / 100
    return `${dollars.toFixed(2)} USD`
  }, [balanceCents, solBalance, usdBalance])

  const amountValue = useMemo(() => {
    if (typeof solBalance === 'number' && Number.isFinite(solBalance)) {
      return solBalance.toFixed(3)
    }
    return (balanceCents / 100).toFixed(2)
  }, [balanceCents, solBalance])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    onSubmit()
  }

  const handleMax = () => {
    const node = amountRef.current
    if (node) {
      node.focus()
      node.select()
    }
  }

  const message = error || status?.message || null
  const messageTone = error ? 'error' : status?.type ?? 'info'

  return (
    <Modal open={open} title={t('lobby.withdrawModal.title')} onClose={onClose} width="720px">
      <form className="withdraw-modal" onSubmit={handleSubmit}>
        <div className="withdraw-modal__summary">
          <div className="withdraw-modal__summary-item">
            <span>{t('lobby.withdrawModal.walletBalance')}</span>
            <strong>{formattedBalance}</strong>
          </div>
          <div className="withdraw-modal__summary-item">
            <span>{t('lobby.withdrawModal.balanceMeta')}</span>
            <strong>{formattedSol}</strong>
          </div>
        </div>
        <p className="withdraw-modal__hint">{t('lobby.withdrawModal.fullBalanceHint')}</p>
        <div className="withdraw-modal__field">
          <label className="withdraw-modal__label" htmlFor="withdrawAmount">
            {t('lobby.withdrawModal.amountLabel')}
          </label>
          <div className="withdraw-modal__control">
            <input
              id="withdrawAmount"
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amountValue}
              readOnly
              aria-readonly="true"
            />
            <button type="button" className="withdraw-modal__max" onClick={handleMax}>
              {t('lobby.withdrawModal.maxButton')}
            </button>
          </div>
        </div>
        <div className="withdraw-modal__field">
          <label className="withdraw-modal__label" htmlFor="withdrawAddress">
            {t('lobby.withdrawModal.addressLabel')}
          </label>
          <input
            id="withdrawAddress"
            type="text"
            placeholder={t('lobby.withdrawModal.addressPlaceholder')}
            value={address}
            onChange={(event) => onAddressChange(event.target.value)}
            disabled={pending}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {message ? (
          <div className={`withdraw-modal__message ${messageTone}`}>{message}</div>
        ) : null}
        <button type="submit" className="damn-primary-button withdraw-modal__submit" disabled={pending}>
          {pending ? t('lobby.withdrawModal.submitting') : t('lobby.withdrawModal.submit')}
        </button>
      </form>
    </Modal>
  )
}
