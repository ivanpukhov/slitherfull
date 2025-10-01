import { useEffect, useRef } from 'react'

interface SnakePreviewProps {
  colors: string[]
  length?: number
  width?: number
  height?: number
}

const DEFAULT_COLOR = '#38bdf8'
const DEFAULT_LENGTH = 100
const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 160

export function SnakePreview({
  colors,
  length = DEFAULT_LENGTH,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT
}: SnakePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

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

    let animationId: number

    const draw = (time: number) => {
      const dpr = window.devicePixelRatio || 1
      context.save()
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, logicalWidth, logicalHeight)

      const headX = logicalWidth * 0.75
      const centerY = logicalHeight / 2
      const amplitude = logicalHeight * 0.18
      const spacing = Math.max(2.2, (logicalWidth * 0.7) / Math.max(length, 1))
      const segmentCount = Math.max(8, Math.min(length, 220))
      const path: { x: number; y: number }[] = []

      for (let i = 0; i < segmentCount; i += 1) {
        const progress = i / segmentCount
        const angle = time * 0.004 + progress * 9.2
        const falloff = 1 - progress * 0.65
        const offsetX = headX - i * spacing
        const offsetY = centerY + Math.sin(angle) * amplitude * falloff
        path.push({ x: offsetX, y: offsetY })
      }

      if (path.length > 1) {
        const gradient = context.createLinearGradient(
          path[path.length - 1].x,
          path[path.length - 1].y,
          path[0].x,
          path[0].y
        )
        const palette = colors.length > 0 ? colors : [DEFAULT_COLOR]
        const step = palette.length > 1 ? 1 / (palette.length - 1) : 1
        palette.forEach((color, index) => {
          gradient.addColorStop(index * step, color)
        })

        context.lineCap = 'round'
        context.lineJoin = 'round'
        context.lineWidth = 18
        context.strokeStyle = gradient
        context.shadowColor = palette[0] ?? DEFAULT_COLOR
        context.shadowBlur = 22

        context.beginPath()
        context.moveTo(path[0].x, path[0].y)
        for (let i = 1; i < path.length; i += 1) {
          const point = path[i]
          context.lineTo(point.x, point.y)
        }
        context.stroke()

        context.shadowBlur = 0
        context.lineWidth = 12
        context.strokeStyle = 'rgba(255, 255, 255, 0.18)'
        context.beginPath()
        context.moveTo(path[0].x, path[0].y)
        for (let i = 1; i < path.length; i += 1) {
          context.lineTo(path[i].x, path[i].y)
        }
        context.stroke()
      }

      context.restore()
      animationId = window.requestAnimationFrame(draw)
    }

    animationId = window.requestAnimationFrame(draw)

    const handleResize = () => {
      resize()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.cancelAnimationFrame(animationId)
    }
  }, [colors, height, length, width])

  return (
    <div className="snake-preview" aria-hidden="true">
      <canvas ref={canvasRef} className="snake-preview__canvas" />
    </div>
  )
}
