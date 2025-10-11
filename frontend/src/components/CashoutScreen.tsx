import type { CashoutScreenState } from '../hooks/useGame'

interface CashoutScreenProps {
  state: CashoutScreenState
  onClose: () => void
}

export function CashoutScreen({ state, onClose }: CashoutScreenProps) {
  return (
    <div id="cashoutScreen" className={state.visible ? 'overlay' : 'overlay hidden'}>
      <div className="card">
        <div className="summary" id="cashoutTitle">
          Balance cashed out
        </div>
        <div className="summary" id="cashoutSummary">
          {state.summary}
        </div>
        <button className="primary" id="cashoutCloseBtn" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
