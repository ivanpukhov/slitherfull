import type { Ref } from 'react'
import type { CashoutControlState } from '../hooks/useGame'

interface CashoutControlProps {
  state: CashoutControlState
  buttonRef: Ref<HTMLButtonElement>
  onClick?: () => void
}

export function CashoutControl({ state, buttonRef, onClick }: CashoutControlProps) {
  return (
    <div id="cashoutControl">
      <button
        id="cashoutButton"
        className={`cashout-button${state.holding ? ' holding' : ''}`}
        type="button"
        disabled={state.disabled}
        aria-disabled={state.disabled ? 'true' : 'false'}
        ref={buttonRef}
        onClick={onClick}
      >
        {state.label}
      </button>
      <div id="cashoutHint" className="cashout-hint">
        {state.hint}
      </div>
    </div>
  )
}
