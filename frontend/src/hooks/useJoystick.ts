import { useEffect } from 'react'
import type { GameController } from './useGame'

interface UseJoystickOptions {
  controller: GameController
  joystickRef?: React.RefObject<HTMLDivElement>
  joystickHandleRef?: React.RefObject<HTMLDivElement>
  boostButtonRef?: React.RefObject<HTMLButtonElement>
  cashoutButtonRef?: React.RefObject<HTMLButtonElement>
  touchControlsRef?: React.RefObject<HTMLDivElement>
}

function updateHandle(joystick: HTMLDivElement, handle: HTMLDivElement, clientX: number, clientY: number) {
  const rect = joystick.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = clientX - cx
  const dy = clientY - cy
  const radius = rect.width / 2
  const distance = Math.min(radius, Math.hypot(dx, dy))
  const angle = Math.atan2(dy, dx)
  const offsetX = Math.cos(angle) * distance
  const offsetY = Math.sin(angle) * distance
  handle.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`
  return angle
}

function resetHandle(handle: HTMLDivElement | null) {
  if (handle) {
    handle.style.transform = 'translate(-50%, -50%)'
  }
}

export function useJoystick({
  controller,
  joystickRef,
  joystickHandleRef,
  boostButtonRef,
  cashoutButtonRef,
  touchControlsRef
}: UseJoystickOptions) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const pointerMedia = window.matchMedia('(pointer: coarse)')
    let lastEnabled: boolean | null = null

    const updateEnabled = (matches: boolean) => {
      const hasTouchUI = Boolean(touchControlsRef?.current)
      const shouldEnable = hasTouchUI && matches
      if (lastEnabled === shouldEnable) return
      lastEnabled = shouldEnable
      controller.setTouchControlsEnabled(shouldEnable)
      document.body.classList.toggle('is-touch', shouldEnable)
      const touchControls = touchControlsRef?.current
      if (touchControls) {
        touchControls.classList.toggle('active', shouldEnable)
        touchControls.setAttribute('aria-hidden', shouldEnable ? 'false' : 'true')
      }
      if (!shouldEnable) {
        resetHandle(joystickHandleRef?.current ?? null)
      }
      controller.resetBoostIntent()
      controller.refreshBoostState(true)
    }

    updateEnabled(pointerMedia.matches)

    const handler = (event: MediaQueryListEvent) => {
      updateEnabled(event.matches)
    }

    pointerMedia.addEventListener('change', handler)

    return () => {
      pointerMedia.removeEventListener('change', handler)
      if (lastEnabled) {
        controller.setTouchControlsEnabled(false)
        document.body.classList.remove('is-touch')
      }
    }
  }, [controller, joystickHandleRef, touchControlsRef])

  useEffect(() => {
    const joystick = joystickRef?.current
    const handle = joystickHandleRef?.current
    if (!joystick || !handle) return
    let active = false

    const onPointerDown = (event: PointerEvent) => {
      active = true
      joystick.setPointerCapture(event.pointerId)
      const angle = updateHandle(joystick, handle, event.clientX, event.clientY)
      controller.setTouchPointerAngle(angle)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!active) return
      const angle = updateHandle(joystick, handle, event.clientX, event.clientY)
      controller.setTouchPointerAngle(angle)
    }

    const stop = () => {
      if (!active) return
      active = false
      resetHandle(handle)
      controller.setTouchPointerAngle(null)
    }

    joystick.addEventListener('pointerdown', onPointerDown)
    joystick.addEventListener('pointermove', onPointerMove)
    joystick.addEventListener('pointerup', stop)
    joystick.addEventListener('pointercancel', stop)
    joystick.addEventListener('lostpointercapture', stop)

    return () => {
      joystick.removeEventListener('pointerdown', onPointerDown)
      joystick.removeEventListener('pointermove', onPointerMove)
      joystick.removeEventListener('pointerup', stop)
      joystick.removeEventListener('pointercancel', stop)
      joystick.removeEventListener('lostpointercapture', stop)
    }
  }, [controller, joystickRef, joystickHandleRef])

  useEffect(() => {
    const boostButton = boostButtonRef?.current
    if (!boostButton) return

    const startBoost = (event: PointerEvent) => {
      if (event.button !== undefined && event.button !== 0) return
      controller.setBoostIntent(true)
    }

    const stopBoost = () => {
      controller.resetBoostIntent()
    }

    boostButton.addEventListener('pointerdown', startBoost)
    boostButton.addEventListener('pointerup', stopBoost)
    boostButton.addEventListener('pointerleave', stopBoost)
    boostButton.addEventListener('pointercancel', stopBoost)
    boostButton.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault()
        controller.setBoostIntent(true)
      }
    })
    boostButton.addEventListener('keyup', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault()
        controller.resetBoostIntent()
      }
    })

    return () => {
      boostButton.removeEventListener('pointerdown', startBoost)
      boostButton.removeEventListener('pointerup', stopBoost)
      boostButton.removeEventListener('pointerleave', stopBoost)
      boostButton.removeEventListener('pointercancel', stopBoost)
    }
  }, [controller, boostButtonRef])

  useEffect(() => {
    const cashoutButton = cashoutButtonRef?.current
    if (!cashoutButton) return

    const startHold = (event: PointerEvent) => {
      if (event.button !== undefined && event.button !== 0) return
      if (cashoutButton.disabled || cashoutButton.getAttribute('aria-disabled') === 'true') return
      event.preventDefault()
      controller.startCashoutHold('pointer')
    }

    const stopHold = () => {
      if (!controller.state.ui.cashout.pending) {
        controller.resetCashoutHold()
      }
    }

    cashoutButton.addEventListener('pointerdown', startHold)
    cashoutButton.addEventListener('pointerup', stopHold)
    cashoutButton.addEventListener('pointerleave', stopHold)
    cashoutButton.addEventListener('pointercancel', stopHold)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'Space') {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        controller.setBoostIntent(true)
      }
      if (event.code === 'KeyQ') {
        if (isEditableTarget(event.target)) return
        event.preventDefault()
        controller.startCashoutHold('keyboard')
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        controller.resetBoostIntent()
      }
      if (event.code === 'KeyQ') {
        if (!controller.state.ui.cashout.pending) {
          controller.resetCashoutHold()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      cashoutButton.removeEventListener('pointerdown', startHold)
      cashoutButton.removeEventListener('pointerup', stopHold)
      cashoutButton.removeEventListener('pointerleave', stopHold)
      cashoutButton.removeEventListener('pointercancel', stopHold)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [controller, cashoutButtonRef])
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}
