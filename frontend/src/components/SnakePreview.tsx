import { useEffect, useRef } from 'react'

interface SnakePreviewProps {
  colors: string[]
  /** "Length" of the visual tail in pixels */
  length?: number
  width?: number
  height?: number
}

const DEFAULT_COLOR = '#38bdf8'
const DEFAULT_LENGTH = 100
const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 160

// === mini-utils as in drawing.ts ===
function withAlpha(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`
}

function shadeColor(hex: string, amount: number) {
  // amount in range [-1..1]: <0 — darker, >0 — lighter
  const { r, g, b } = hexToRgb(hex)
  if (amount >= 0) {
    const nr = r + (255 - r) * amount
    const ng = g + (255 - g) * amount
    const nb = b + (255 - b) * amount
    return rgbToHex(nr, ng, nb)
  } else {
    const k = 1 + amount // amount is negative
    return rgbToHex(r * k, g * k, b * k)
  }
}

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  const r = m ? parseInt(m[1], 16) : 148
  const g = m ? parseInt(m[2], 16) : 163
  const b = m ? parseInt(m[3], 16) : 184
  return { r, g, b }
}
function rgbToHex(r: number, g: number, b: number) {
  const to = (x: number) => {
    const v = Math.max(0, Math.min(255, Math.round(x)))
    return v.toString(16).padStart(2, '0')
  }
  return `#${to(r)}${to(g)}${to(b)}`
}

// Same smooth outline (Catmull-Rom -> Bezier) as in drawSnakes
function strokeSmoothPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  if (!points || points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1] || points[i]
    const p3 = points[i + 2] || p2
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
  }
  ctx.stroke()
}

export function SnakePreview({
                               colors,
                               length = DEFAULT_LENGTH, // defaults to 100
                               width = DEFAULT_WIDTH,
                               height = DEFAULT_HEIGHT
                             }: SnakePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const logicalWidth = width
    const logicalHeight = height

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = logicalWidth * dpr
      canvas.height = logicalHeight * dpr
      canvas.style.width = `${logicalWidth}px`
      canvas.style.height = `${logicalHeight}px`
    }

    resize()

    let raf = 0

    const draw = (time: number) => {
      const dpr = window.devicePixelRatio || 1
      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, logicalWidth, logicalHeight)

      // === Center the snake ===
      const centerX = logicalWidth / 2
      const centerY = logicalHeight / 2

      // === Geometry matches the game ===
      const displayLength = Math.max(1, length) // "snake length"
      const bodyRadius = Math.max(7.2, Math.min(30, 6.4 + Math.pow(displayLength, 0.42)))
      const headRadius = bodyRadius * 1.02

      // spacing same as the engine (SEGMENT_SPACING ~ 4.6)
      const spacing = 4.6
      const totalLenPx = displayLength // "visual length" in the preview equals length
      const segments = Math.max(3, Math.floor(totalLenPx / spacing) + 11)

      // Build a sinusoidal path of length totalLenPx around the center so everything stays centered
      const half = (segments - 1) * spacing * 0.5
      const amplitude = Math.min(logicalHeight * 0.12, bodyRadius * 2.2)
      const speed = 0.0028

      const path: { x: number; y: number }[] = []
      for (let i = 0; i < segments; i++) {
        const x = centerX + (i - segments / 1.3) * spacing
        const wave = Math.sin(time * speed + i * 0.15)
        const y = centerY + wave * amplitude
        path.push({ x, y })
      }

      // Compute head direction from the last two points
      const pA = path[path.length - 2]
      const pB = path[path.length - 1]
      const dir = Math.atan2(pB.y - pA.y, pB.x - pA.x)

      // === Palette as in drawSnakes ===
      const palette = colors && colors.length ? colors : [DEFAULT_COLOR]
      const baseColor = palette[0] || DEFAULT_COLOR

      // === Outline (dark) ===
      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = shadeColor(baseColor, -0.55) // same as there
      ctx.lineWidth = bodyRadius * 2 + 6
      strokeSmoothPath(ctx, path)
      ctx.restore()

      // === Main body with glow ===
      // Linear gradient along the body
      const grad = ctx.createLinearGradient(path[0].x, path[0].y, pB.x, pB.y)
      if (palette.length === 1) {
        grad.addColorStop(0, baseColor)
        grad.addColorStop(1, baseColor)
      } else {
        const step = 1 / (palette.length - 1)
        palette.forEach((c, i) => grad.addColorStop(i * step, c))
      }

      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = grad
      ctx.lineWidth = bodyRadius * 2
      ctx.shadowColor = withAlpha(baseColor, 0.45)
      ctx.shadowBlur = bodyRadius * 0.9
      strokeSmoothPath(ctx, path)
      ctx.restore()

      // === Light highlight on the head segments ===
      const highlight = path.slice(Math.max(0, path.length - 18))
      if (highlight.length >= 2) {
        ctx.save()
        ctx.globalAlpha = 0.55
        ctx.strokeStyle = withAlpha('#ffffff', 0.2)
        ctx.lineWidth = bodyRadius * 0.58
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        strokeSmoothPath(ctx, highlight)
        ctx.restore()
      }

      // === Head (radial gradient) ===
      ctx.save()
      const head = pB
      const headGradient = ctx.createRadialGradient(
          head.x, head.y, headRadius * 0.2,
          head.x, head.y, headRadius * 1.4
      )
      headGradient.addColorStop(0, '#ffffff')
      headGradient.addColorStop(0.22, baseColor)
      headGradient.addColorStop(1, shadeColor(baseColor, -0.4))
      ctx.fillStyle = headGradient
      ctx.beginPath()
      ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // === Eyes (as in drawSnakes — aligned with dir) ===
      const eyeOffset = headRadius * 0.58
      const sideOffset = headRadius * 0.32
      const pupilOffset = headRadius * 0.18
      const eyeRadius = headRadius * 0.28
      const pupilRadius = headRadius * 0.16

      const ex1 = pB.x + Math.cos(dir) * eyeOffset - Math.sin(dir) * sideOffset
      const ey1 = pB.y + Math.sin(dir) * eyeOffset + Math.cos(dir) * sideOffset
      const ex2 = pB.x + Math.cos(dir) * eyeOffset + Math.sin(dir) * sideOffset
      const ey2 = pB.y + Math.sin(dir) * eyeOffset - Math.cos(dir) * sideOffset

      // whites
      ctx.save()
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.arc(ex1, ey1, eyeRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex2, ey2, eyeRadius, 0, Math.PI * 2)
      ctx.fill()
      // pupils
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.arc(ex1 + Math.cos(dir) * pupilOffset, ey1 + Math.sin(dir) * pupilOffset, pupilRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex2 + Math.cos(dir) * pupilOffset, ey2 + Math.sin(dir) * pupilOffset, pupilRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      ctx.restore()
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [colors, width, height, length])

  return (
      <div className="snake-preview" aria-hidden="true">
        <canvas ref={canvasRef} className="snake-preview__canvas" />
      </div>
  )
}
