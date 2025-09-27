import { useEffect } from 'react'
import { MINIMAP_SIZE, CAMERA_ZOOM } from './useGame'
import type { GameController } from './useGame'

interface UseCanvasOptions {
  canvasRef: React.RefObject<HTMLCanvasElement>
  minimapRef: React.RefObject<HTMLCanvasElement>
  controller: GameController
}

const DPR_LIMIT = 2.5

function getDpr() {
  return Math.max(1, Math.min(DPR_LIMIT, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1))
}

function buildHexPattern(ctx: CanvasRenderingContext2D) {
  const r = 35
  const W = Math.round(3 * r)
  const H = Math.round(Math.sqrt(3) * r)
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const c = off.getContext('2d')
  if (!c) return null

  const base = c.createLinearGradient(0, 0, W, H)
  base.addColorStop(0, '#0b0f16')
  base.addColorStop(1, '#151a24')
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
    c.fillStyle = '#111722'
    c.fill(path)

    c.save()
    c.clip(path)
    const inner = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
    inner.addColorStop(0, '#131a26')
    inner.addColorStop(0.65, '#0e1420')
    inner.addColorStop(1, '#0a0f18')
    c.fillStyle = inner
    c.fillRect(cx - r, cy - r, 2 * r, 2 * r)

    const topLight = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    topLight.addColorStop(0, 'rgba(97,123,163,0.22)')
    topLight.addColorStop(0.4, 'rgba(61,82,113,0.15)')
    topLight.addColorStop(1, 'rgba(0,0,0,0)')
    c.globalCompositeOperation = 'lighter'
    c.fillStyle = topLight
    c.fillRect(cx - r, cy - r, 2 * r, 2 * r)
    c.globalCompositeOperation = 'source-over'
    c.restore()

    c.lineJoin = 'round'
    c.lineWidth = Math.max(2, r * 0.1)
    const rim = c.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    rim.addColorStop(0, '#27384f')
    rim.addColorStop(0.5, '#1d2735')
    rim.addColorStop(1, '#121925')
    c.strokeStyle = rim
    c.stroke(path)

    c.save()
    c.clip(path)
    c.lineWidth = Math.max(1.2, r * 0.06)
    const innerRim = c.createLinearGradient(cx + r, cy - r, cx - r, cy + r)
    innerRim.addColorStop(0, 'rgba(59,130,246,0.24)')
    innerRim.addColorStop(1, 'rgba(12,23,38,0.42)')
    c.strokeStyle = innerRim
    c.stroke(path)
    c.restore()

    c.lineWidth = 10
    c.strokeStyle = '#0a0e14'
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

export function useCanvas({ canvasRef, minimapRef, controller }: UseCanvasOptions) {
  useEffect(() => {
    const canvas = canvasRef.current
    const minimap = minimapRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const minimapCtx = minimap ? minimap.getContext('2d') : null
    let animationFrame: number | null = null
    let dpr = getDpr()

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

    const setMinimapSize = () => {
      if (!minimap || !minimapCtx) return
      const size = MINIMAP_SIZE
      minimap.width = Math.round(size * dpr)
      minimap.height = Math.round(size * dpr)
      minimap.style.width = `${size}px`
      minimap.style.height = `${size}px`
      minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const handleResize = () => {
      setCanvasSize()
      setMinimapSize()
    }

    setCanvasSize()
    setMinimapSize()
    window.addEventListener('resize', handleResize)

    let lastTime = performance.now()

    const loop = (now: number) => {
      const dt = Math.min(1 / 30, Math.max(0, (now - lastTime) / 1000))
      lastTime = now
      controller.update(dt)
      controller.draw(canvas, ctx, now / 1000, dpr)
      if (minimap && minimapCtx) {
        controller.drawMinimap(minimap, minimapCtx, dpr)
      }
      animationFrame = requestAnimationFrame(loop)
    }

    animationFrame = requestAnimationFrame(loop)

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', handleResize)
    }
  }, [canvasRef, minimapRef, controller])
}
