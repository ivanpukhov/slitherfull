import { useEffect } from 'react'
import { CAMERA_ZOOM } from './useGame'
import type { GameController } from './useGame'
import { createHexPattern } from '../utils/patterns'

interface UseCanvasOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>
  controller: GameController
}

const DPR_LIMIT = 2.5

function getDpr() {
  return Math.max(1, Math.min(DPR_LIMIT, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1))
}

export function useCanvas({ canvasRef, controller }: UseCanvasOptions) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animationFrame: number | null = null
    let dpr = getDpr()
    let accumulator = 0

    const setCanvasSize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      dpr = getDpr()
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      controller.state.camera.zoom = CAMERA_ZOOM
      controller.hexPattern = createHexPattern(ctx, { variant: 'game' })
    }

    const handleResize = () => {
      setCanvasSize()
    }

    setCanvasSize()
    window.addEventListener('resize', handleResize)

    let lastTime = performance.now()

    const loop = (now: number) => {
      const frameSeconds = Math.max(0, Math.min(0.08, (now - lastTime) / 1000))
      lastTime = now
      accumulator += frameSeconds
      const maxStep = 1 / 60
      const minStep = 1 / 180

      while (accumulator >= minStep) {
        const step = Math.min(maxStep, accumulator)
        controller.update(step)
        accumulator -= step
      }

      if (accumulator > 0) {
        controller.update(accumulator)
        accumulator = 0
      }
      controller.draw(canvas, ctx, now / 1000, dpr)
      animationFrame = requestAnimationFrame(loop)
    }

    animationFrame = requestAnimationFrame(loop)

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', handleResize)
    }
  }, [canvasRef, controller])
}
