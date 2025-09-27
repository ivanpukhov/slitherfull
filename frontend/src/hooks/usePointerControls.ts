import { useEffect } from 'react'
import { isEditableTarget } from '../utils/helpers'
import type { GameController } from './useGame'

interface UsePointerControlsOptions {
  controller: GameController
  canvasRef: React.RefObject<HTMLCanvasElement>
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

export function usePointerControls({ controller, canvasRef }: UsePointerControlsOptions) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMouseMove = (event: MouseEvent) => {
      updatePointerAngle(controller, canvas, event.clientX, event.clientY)
    }

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      if (isEditableTarget(event.target)) return
      if ((event.target as HTMLElement)?.closest?.('.touch-controls')) return
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

    const onTouchStart = (event: TouchEvent) => {
      if (controller.getUI().touchControlsEnabled) return
      if (!event.touches || !event.touches.length) return
      updatePointerFromTouch(controller, canvas, event.touches[0])
      controller.setBoostIntent(event.touches.length > 1)
      event.preventDefault()
    }

    const onTouchMove = (event: TouchEvent) => {
      if (controller.getUI().touchControlsEnabled) return
      if (!event.touches || !event.touches.length) return
      updatePointerFromTouch(controller, canvas, event.touches[0])
      controller.setBoostIntent(event.touches.length > 1)
      event.preventDefault()
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (controller.getUI().touchControlsEnabled) return
      if (!event.touches || event.touches.length === 0) {
        controller.resetBoostIntent()
      } else {
        controller.setBoostIntent(event.touches.length > 1)
      }
    }

    const onTouchCancel = () => {
      if (controller.getUI().touchControlsEnabled) return
      controller.resetBoostIntent()
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
}
