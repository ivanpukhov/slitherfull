import { useEffect } from 'react'
import { isEditableTarget } from '../utils/helpers'
import type { GameController } from './useGame'

interface UsePointerControlsOptions {
  controller: GameController
  canvasRef: React.RefObject<HTMLCanvasElement>
  cashoutButtonRef?: React.RefObject<HTMLButtonElement>
}

function updatePointerAngle(controller: GameController, canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const angle = Math.atan2(clientY - cy, clientX - cx)
  const current = controller.state.pointerAngle
  if (typeof current === 'number') {
    let diff = angle - current
    while (diff < -Math.PI) diff += Math.PI * 2
    while (diff > Math.PI) diff -= Math.PI * 2
    controller.setTouchPointerAngle(current + diff)
  } else {
    controller.setTouchPointerAngle(angle)
  }
}

function updatePointerFromTouch(controller: GameController, canvas: HTMLCanvasElement, touch: Touch | null) {
  if (!touch) return
  const rect = canvas.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  controller.setTouchPointerAngle(Math.atan2(touch.clientY - cy, touch.clientX - cx))
}

export function usePointerControls({ controller, canvasRef, cashoutButtonRef }: UsePointerControlsOptions) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMouseMove = (event: MouseEvent) => {
      updatePointerAngle(controller, canvas, event.clientX, event.clientY)
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      controller.setBoostIntent(true)
    }

    const onMouseUp = () => {
      controller.resetBoostIntent()
    }

    const onBlur = () => {
      controller.resetBoostIntent()
      controller.setTouchPointerAngle(null)
      controller.resetCashoutHold()
    }

    let lastTapTime = 0
    let boostFromDoubleTap = false

    const onTouchStart = (event: TouchEvent) => {
      if (!event.touches || !event.touches.length) return
      const primaryTouch = event.touches[0]
      const now = performance.now()
      const tapDelta = now - lastTapTime
      if (tapDelta > 0 && tapDelta < 280) {
        boostFromDoubleTap = true
      }
      lastTapTime = now
      updatePointerFromTouch(controller, canvas, primaryTouch)
      if (boostFromDoubleTap || event.touches.length > 1) {
        controller.setBoostIntent(true)
      } else {
        controller.resetBoostIntent()
      }
      event.preventDefault()
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!event.touches || !event.touches.length) return
      const primaryTouch = event.touches[0]
      updatePointerFromTouch(controller, canvas, primaryTouch)
      if (boostFromDoubleTap || event.touches.length > 1) {
        controller.setBoostIntent(true)
      } else {
        controller.resetBoostIntent()
      }
      event.preventDefault()
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (!event.touches || event.touches.length === 0) {
        boostFromDoubleTap = false
        controller.resetBoostIntent()
        controller.setTouchPointerAngle(null)
      } else {
        const primaryTouch = event.touches[0]
        updatePointerFromTouch(controller, canvas, primaryTouch)
        if (boostFromDoubleTap || event.touches.length > 1) {
          controller.setBoostIntent(true)
        } else {
          controller.resetBoostIntent()
        }
      }
    }

    const onTouchCancel = () => {
      boostFromDoubleTap = false
      controller.resetBoostIntent()
      controller.setTouchPointerAngle(null)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', onBlur)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    canvas.addEventListener('touchcancel', onTouchCancel)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      canvas.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [controller, canvasRef])

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

    cashoutButton.addEventListener('pointerdown', startHold)
    cashoutButton.addEventListener('pointerup', stopHold)
    cashoutButton.addEventListener('pointerleave', stopHold)
    cashoutButton.addEventListener('pointercancel', stopHold)
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
