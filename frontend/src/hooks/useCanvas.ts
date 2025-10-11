import { useEffect } from 'react'
import { CAMERA_ZOOM } from './useGame'
import type { GameController } from './useGame'
import { HEX_PATTERN_RADIUS, HEX_PATTERN_THEME, HEX_PATTERN_TILE_HEIGHT, HEX_PATTERN_TILE_WIDTH } from '../utils/hexTheme'

interface UseCanvasOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>
  controller: GameController
}

const DEFAULT_DPR_LIMIT = 2.5
const TOUCH_DPR_LIMIT = 1.5

function getDpr() {
  if (typeof window === 'undefined') {
    return 1
  }

  const base = window.devicePixelRatio || 1
  let limit = DEFAULT_DPR_LIMIT

  try {
    if (window.matchMedia('(pointer: coarse)').matches) {
      limit = TOUCH_DPR_LIMIT
    }
  } catch (error) {
    // matchMedia might be unavailable in rare environments; ignore and use default limit.
  }

  return Math.max(1, Math.min(limit, base))
}

function buildHexPattern(ctx: CanvasRenderingContext2D) {
  const r = HEX_PATTERN_RADIUS
  const W = HEX_PATTERN_TILE_WIDTH
  const H = HEX_PATTERN_TILE_HEIGHT
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const c = off.getContext('2d')
  if (!c) return null

  const base = c.createLinearGradient(0, 0, W, H)
  HEX_PATTERN_THEME.baseGradient.forEach(({ offset, color }) => base.addColorStop(offset, color))
  c.fillStyle = base
  c.fillRect(0, 0, W, H)

  const hexPath = (cx: number, cy: number) => {
    const path = new Path2D()
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      if (i === 0) path.moveTo(x, y)
      else path.lineTo(x, y)
    }
    path.closePath()
    return path
  }

  const drawHex = (cx: number, cy: number) => {
    const path = hexPath(cx, cy)
    c.save()
    c.fillStyle = HEX_PATTERN_THEME.hexFill
    c.fill(path)

    c.save()
    c.clip(path)
    const inner = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
    HEX_PATTERN_THEME.innerGradient.forEach(({ offset, color }) => inner.addColorStop(offset, color))
    c.fillStyle = inner
    c.fillRect(cx - r, cy - r, 2 * r, 2 * r)

    const topLight = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    HEX_PATTERN_THEME.topLightStops.forEach(({ offset, color }) => topLight.addColorStop(offset, color))
    c.globalCompositeOperation = 'lighter'
    c.fillStyle = topLight
    c.fillRect(cx - r, cy - r, 2 * r, 2 * r)
    c.globalCompositeOperation = 'source-over'
    c.restore()

    c.lineJoin = 'round'
    c.lineWidth = Math.max(2, r * 0.1)
    const rim = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    HEX_PATTERN_THEME.rimGradient.forEach(({ offset, color }) => rim.addColorStop(offset, color))
    c.strokeStyle = rim
    c.stroke(path)

    c.save()
    c.clip(path)
    c.lineWidth = Math.max(1.2, r * 0.06)
    const innerRim = c.createLinearGradient(cx + r, cy - r, cx - r, cy + r)
    HEX_PATTERN_THEME.innerRimGradient.forEach(({ offset, color }) => innerRim.addColorStop(offset, color))
    c.strokeStyle = innerRim
    c.stroke(path)
    c.restore()

    c.lineWidth = 10
    c.strokeStyle = HEX_PATTERN_THEME.outline
    c.stroke(path)

    c.restore()
  }

  const colStep = 1.5 * r
  const rowStep = Math.sqrt(3) * r
  for (let col = -1; col <= 2; col++) {
    const x = col * colStep + r + 0.5
    const yOff = col & 1 ? rowStep / 2 : 0
    for (let row = -1; row <= 1; row++) {
      const y = row * rowStep + H / 2 + yOff + 0.5
      drawHex(x, y)
    }
  }

  return ctx.createPattern(off, 'repeat')
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
      controller.hexPattern = buildHexPattern(ctx)
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
