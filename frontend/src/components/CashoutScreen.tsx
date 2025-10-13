import type { CashoutScreenState } from '../hooks/useGame'
import { useTranslation } from '../hooks/useTranslation'

interface CashoutScreenProps {
  state: CashoutScreenState
  onClose: () => void
}

export function CashoutScreen({ state, onClose }: CashoutScreenProps) {
  const { t } = useTranslation()
  return (
    <div id="cashoutScreen" className={state.visible ? 'overlay' : 'overlay hidden'}>
      <div className="card">
        <div className="summary" id="cashoutTitle">
          {t('cashoutScreen.title')}
        </div>
        <div className="summary" id="cashoutSummary">
          {state.summary}
        </div>
        <button className="primary" id="cashoutCloseBtn" type="button" onClick={onClose}>
          {t('cashoutScreen.close')}
        </button>
      </div>
    </div>
  )
}
