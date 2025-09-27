import { forwardRef } from 'react'
import type { Ref } from 'react'

interface TouchControlsProps {
  enabled: boolean
  joystickRef: Ref<HTMLDivElement>
  joystickHandleRef: Ref<HTMLDivElement>
  boostButtonRef: Ref<HTMLButtonElement>
}

export const TouchControls = forwardRef<HTMLDivElement, TouchControlsProps>(function TouchControls(
  { enabled, joystickRef, joystickHandleRef, boostButtonRef },
  ref
) {
  return (
    <div
      id="touchControls"
      className={enabled ? 'touch-controls active' : 'touch-controls'}
      aria-hidden={enabled ? 'false' : 'true'}
      ref={ref}
    >
      <div id="joystick" className="joystick" role="application" aria-label="Виртуальный джойстик" ref={joystickRef}>
        <div id="joystickHandle" className="joystick-handle" ref={joystickHandleRef} />
      </div>
      <button
        id="boostButton"
        className="boost-button"
        type="button"
        aria-pressed="false"
        aria-disabled="true"
        disabled
        ref={boostButtonRef}
      >
        Ускорение
      </button>
    </div>
  )
})
