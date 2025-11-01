import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { SKINS } from '../hooks/useGame'
import { shadeColor, withAlpha } from '../utils/helpers'
import { strokeSmoothPath } from '../utils/drawing'

const DEFAULT_SKIN_COLOR = '#38bdf8'

interface LobbyBackdropProps {
  visible: boolean
}

interface LobbySnakeConfig {
  id: string
  position: 'left' | 'right'
  align: 'top' | 'bottom'
  colors: string[]
  length: number
  width: number
  height: number
  offset: { x: number; y: number }
  delay: number
  speed: number
  path: (time: number, dims: { width: number; height: number }) => { x: number; y: number }
  bob: { amplitude: number; speed: number; phase?: number }
  rotation: { amplitude: number; speed: number; phase?: number }
  scale: { amplitude: number; speed: number; phase?: number }
}

type OscillationConfig = {
  amplitude: number
  frequency: number
  phase?: number
}

interface LissajousOptions {
  radiusX: number
  radiusY: number
  frequencyX: number
  frequencyY: number
  twistAmplitude: number
  twistFrequency: number
  twistPhase?: number
  offsetPhase?: number
  centerOffsetX?: number
  centerOffsetY?: number
  radiusSwayX?: OscillationConfig
  radiusSwayY?: OscillationConfig
  driftX?: OscillationConfig
  driftY?: OscillationConfig
}

function sampleOscillation(osc: OscillationConfig | undefined, time: number): number {
  if (!osc || osc.amplitude === 0) {
    return 0
  }

  return Math.sin(time * osc.frequency + (osc.phase ?? 0)) * osc.amplitude
}

function createLissajousPath({
  radiusX,
  radiusY,
  frequencyX,
  frequencyY,
  twistAmplitude,
  twistFrequency,
  twistPhase = 0,
  offsetPhase = 0,
  centerOffsetX = 0,
  centerOffsetY = 0,
  radiusSwayX,
  radiusSwayY,
  driftX,
  driftY
}: LissajousOptions) {
  return (time: number, dims: { width: number; height: number }) => {
    const centerX = dims.width / 2 + centerOffsetX
    const centerY = dims.height / 2 + centerOffsetY
    const radiusXWithSway = radiusX + sampleOscillation(radiusSwayX, time)
    const radiusYWithSway = radiusY + sampleOscillation(radiusSwayY, time)
    const x =
      centerX +
      Math.cos(time * frequencyX + offsetPhase) * radiusXWithSway +
      Math.sin(time * twistFrequency + twistPhase) * twistAmplitude +
      sampleOscillation(driftX, time)
    const y =
      centerY +
      Math.sin(time * frequencyY + offsetPhase * 0.82) * radiusYWithSway +
      Math.cos(time * twistFrequency + twistPhase * 1.12) * twistAmplitude * 0.6 +
      sampleOscillation(driftY, time)
    return { x, y }
  }
}

export function LobbyBackdrop({ visible }: LobbyBackdropProps) {
  const snakes = useMemo<LobbySnakeConfig[]>(
    () => [
      {
        id: 'lobby-left-primary',
        position: 'left',
        align: 'top',
        colors: SKINS.amber,
        length: 260,
        width: 420,
        height: 220,
        offset: { x: -380, y: -160 },
        delay: 0,
        speed: 0.8,
        path: createLissajousPath({
          radiusX: 170,
          radiusY: 105,
          frequencyX: 0.82,
          frequencyY: 0.66,
          twistAmplitude: 48,
          twistFrequency: 1.44,
          twistPhase: 0.6,
          offsetPhase: 0.2,
          centerOffsetX: -70,
          centerOffsetY: -18,
          radiusSwayX: { amplitude: 28, frequency: 0.38, phase: 0.5 },
          radiusSwayY: { amplitude: 18, frequency: 0.42, phase: 1.1 },
          driftX: { amplitude: 120, frequency: 0.18, phase: -0.4 },
          driftY: { amplitude: 36, frequency: 0.22, phase: 0.8 }
        }),
        bob: { amplitude: 14, speed: 1.6 },
        rotation: { amplitude: 4.5, speed: 0.65 },
        scale: { amplitude: 0.035, speed: 0.7 }
      },
      {
        id: 'lobby-left-secondary',
        position: 'left',
        align: 'bottom',
        colors: SKINS.default,
        length: 220,
        width: 360,
        height: 200,
        offset: { x: -340, y: 210 },
        delay: 2.6,
        speed: 0.72,
        path: createLissajousPath({
          radiusX: 150,
          radiusY: 100,
          frequencyX: 0.66,
          frequencyY: 0.9,
          twistAmplitude: 52,
          twistFrequency: 1.16,
          twistPhase: 1.7,
          offsetPhase: 0.9,
          centerOffsetX: -58,
          centerOffsetY: 24,
          radiusSwayX: { amplitude: 22, frequency: 0.34, phase: 0.2 },
          radiusSwayY: { amplitude: 16, frequency: 0.36, phase: 0.7 },
          driftX: { amplitude: 110, frequency: 0.16, phase: 0.35 },
          driftY: { amplitude: 42, frequency: 0.21, phase: 1.1 }
        }),
        bob: { amplitude: 16, speed: 1.4, phase: 0.6 },
        rotation: { amplitude: 3.5, speed: 0.55, phase: 0.4 },
        scale: { amplitude: 0.03, speed: 0.64, phase: 0.3 }
      },
      {
        id: 'lobby-right-primary',
        position: 'right',
        align: 'top',
        colors: SKINS.crimson,
        length: 300,
        width: 440,
        height: 230,
        offset: { x: 360, y: -150 },
        delay: 1.4,
        speed: 0.88,
        path: createLissajousPath({
          radiusX: 190,
          radiusY: 112,
          frequencyX: 0.9,
          frequencyY: 0.72,
          twistAmplitude: 56,
          twistFrequency: 1.6,
          twistPhase: 1.1,
          offsetPhase: 0.4,
          centerOffsetX: 76,
          centerOffsetY: -22,
          radiusSwayX: { amplitude: 30, frequency: 0.36, phase: 0.3 },
          radiusSwayY: { amplitude: 20, frequency: 0.4, phase: 0.9 },
          driftX: { amplitude: 130, frequency: 0.2, phase: 0.6 },
          driftY: { amplitude: 44, frequency: 0.24, phase: -0.2 }
        }),
        bob: { amplitude: 18, speed: 1.5, phase: 0.2 },
        rotation: { amplitude: 5, speed: 0.7, phase: 0.5 },
        scale: { amplitude: 0.04, speed: 0.76, phase: 0.2 }
      },
      {
        id: 'lobby-right-secondary',
        position: 'right',
        align: 'bottom',
        colors: SKINS.violet,
        length: 240,
        width: 360,
        height: 210,
        offset: { x: 330, y: 220 },
        delay: 3.8,
        speed: 0.78,
        path: createLissajousPath({
          radiusX: 165,
          radiusY: 104,
          frequencyX: 0.74,
          frequencyY: 0.82,
          twistAmplitude: 50,
          twistFrequency: 1.34,
          twistPhase: 2.1,
          offsetPhase: 1.4,
          centerOffsetX: 64,
          centerOffsetY: 26,
          radiusSwayX: { amplitude: 24, frequency: 0.32, phase: 0.1 },
          radiusSwayY: { amplitude: 18, frequency: 0.34, phase: 0.5 },
          driftX: { amplitude: 118, frequency: 0.17, phase: -0.7 },
          driftY: { amplitude: 40, frequency: 0.2, phase: -1.3 }
        }),
        bob: { amplitude: 17, speed: 1.3, phase: 0.8 },
        rotation: { amplitude: 4, speed: 0.6, phase: 0.65 },
        scale: { amplitude: 0.032, speed: 0.7, phase: 0.5 }
      }
    ],
    []
  )

  if (!visible) {
    return null
  }

  return (
    <div className="lobby-backdrop" aria-hidden="true">
      {snakes.map((config) => (
        <LobbySnake key={config.id} config={config} />
      ))}
    </div>
  )
}

function LobbySnake({ config }: { config: LobbySnakeConfig }) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const figureRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const wrapperStyle = {
    '--lobby-x': `${config.offset.x}px`,
    '--lobby-y': `${config.offset.y}px`
  } as CSSProperties

  useEffect(() => {
    const figureEl = figureRef.current

    if (!figureEl) {
      return
    }

    let animationFrame = 0
    let startTime: number | null = null

    const applyFrame = (elapsedSeconds: number) => {
      const bobPhase = elapsedSeconds * config.bob.speed + (config.bob.phase ?? 0)
      const scalePhase = elapsedSeconds * config.scale.speed + (config.scale.phase ?? 0)
      const rotationPhase = elapsedSeconds * config.rotation.speed + (config.rotation.phase ?? 0)

      const bob = Math.sin(bobPhase) * config.bob.amplitude
      const scale = 1 + Math.sin(scalePhase) * config.scale.amplitude
      const rotation = Math.sin(rotationPhase) * config.rotation.amplitude

      figureEl.style.transform = `translate3d(0, ${bob}px, 0) scale(${scale}) rotate(${rotation}deg)`
    }

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp
      }

      const elapsed = (timestamp - startTime) / 1000 - config.delay

      if (elapsed >= 0) {
        applyFrame(elapsed)
      }

      animationFrame = requestAnimationFrame(step)
    }

    applyFrame(0)
    animationFrame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [config])

  useEffect(() => {
    const canvas = canvasRef.current
    const figureEl = figureRef.current

    if (!canvas || !figureEl) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const logicalWidth = config.width
    const logicalHeight = config.height

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = logicalWidth * dpr
      canvas.height = logicalHeight * dpr
      canvas.style.width = `${logicalWidth}px`
      canvas.style.height = `${logicalHeight}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    resize()

    const segmentSpacing = 4.6
    const segmentCount = Math.max(24, Math.round(config.length / segmentSpacing))
    const segments = Array.from({ length: segmentCount }, () => ({ x: 0, y: 0 }))
    const dims = { width: logicalWidth, height: logicalHeight }
    const palette = config.colors && config.colors.length ? config.colors : [DEFAULT_SKIN_COLOR]
    const baseColor = palette[0] ?? DEFAULT_SKIN_COLOR
    let headDirection = 0

    const warmupStep = 1 / 45
    const warmupStart = -warmupStep * (segmentCount + 24)

    let lastHead = config.path(warmupStart * config.speed, dims)
    for (const segment of segments) {
      segment.x = lastHead.x
      segment.y = lastHead.y
    }

    const placeSegments = (headX: number, headY: number) => {
      const head = segments[segmentCount - 1]
      head.x = headX
      head.y = headY
      for (let i = segmentCount - 2; i >= 0; i--) {
        const next = segments[i + 1]
        const current = segments[i]
        const dx = next.x - current.x
        const dy = next.y - current.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const ratio = segmentSpacing / dist
        current.x = next.x - dx * ratio
        current.y = next.y - dy * ratio
      }
    }

    const advance = (time: number) => {
      const scaled = time * config.speed
      const target = config.path(scaled, dims)
      const deltaX = target.x - lastHead.x
      const deltaY = target.y - lastHead.y
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const maxStep = segmentSpacing * 0.55
      const steps = distance > maxStep ? Math.max(1, Math.ceil(distance / maxStep)) : 1

      for (let step = 1; step <= steps; step++) {
        const x = lastHead.x + (deltaX * step) / steps
        const y = lastHead.y + (deltaY * step) / steps
        placeSegments(x, y)
      }

      const lookAhead = config.path(scaled + 0.002, dims)
      headDirection = Math.atan2(lookAhead.y - target.y, lookAhead.x - target.x)
      lastHead = target
    }

    for (let t = warmupStart; t <= 0; t += warmupStep) {
      advance(t)
    }

    const drawSnake = () => {
      ctx.clearRect(0, 0, logicalWidth, logicalHeight)

      const displayLength = Math.max(1, config.length)
      const bodyRadius = Math.max(7.2, Math.min(30, 6.4 + Math.pow(displayLength, 0.42)))
      const head = segments[segmentCount - 1]
      const neck = segments[segmentCount - 2]

      const pathPoints = segments.map((point) => ({ x: point.x, y: point.y }))

      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = shadeColor(baseColor, -0.55)
      ctx.lineWidth = bodyRadius * 2 + 6
      strokeSmoothPath(ctx, pathPoints)
      ctx.restore()

      const grad = ctx.createLinearGradient(pathPoints[0].x, pathPoints[0].y, head.x, head.y)
      if (palette.length === 1) {
        grad.addColorStop(0, baseColor)
        grad.addColorStop(1, baseColor)
      } else {
        const stopStep = 1 / (palette.length - 1)
        palette.forEach((color, index) => {
          grad.addColorStop(index * stopStep, color)
        })
      }

      ctx.save()
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = grad
      ctx.lineWidth = bodyRadius * 2
      ctx.shadowColor = withAlpha(baseColor, 0.45)
      ctx.shadowBlur = bodyRadius * 0.9
      strokeSmoothPath(ctx, pathPoints)
      ctx.restore()

      const highlight = pathPoints.slice(Math.max(0, pathPoints.length - 18))
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

      ctx.save()
      const headRadius = bodyRadius * 1.02
      const headGradient = ctx.createRadialGradient(head.x, head.y, headRadius * 0.2, head.x, head.y, headRadius * 1.4)
      headGradient.addColorStop(0, '#ffffff')
      headGradient.addColorStop(0.22, baseColor)
      headGradient.addColorStop(1, shadeColor(baseColor, -0.4))
      ctx.fillStyle = headGradient
      ctx.beginPath()
      ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      const dir = headDirection || Math.atan2(head.y - neck.y, head.x - neck.x)
      const eyeOffset = headRadius * 0.58
      const sideOffset = headRadius * 0.32
      const pupilOffset = headRadius * 0.18
      const eyeRadius = headRadius * 0.28
      const pupilRadius = headRadius * 0.16

      const ex1 = head.x + Math.cos(dir) * eyeOffset - Math.sin(dir) * sideOffset
      const ey1 = head.y + Math.sin(dir) * eyeOffset + Math.cos(dir) * sideOffset
      const ex2 = head.x + Math.cos(dir) * eyeOffset + Math.sin(dir) * sideOffset
      const ey2 = head.y + Math.sin(dir) * eyeOffset - Math.cos(dir) * sideOffset

      ctx.save()
      ctx.fillStyle = '#f8fafc'
      ctx.beginPath()
      ctx.arc(ex1, ey1, eyeRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex2, ey2, eyeRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.arc(ex1 + Math.cos(dir) * pupilOffset, ey1 + Math.sin(dir) * pupilOffset, pupilRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(ex2 + Math.cos(dir) * pupilOffset, ey2 + Math.sin(dir) * pupilOffset, pupilRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    let animationFrame = 0
    let startTime: number | null = null
    let simTime = 0

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp
      }

      const elapsed = (timestamp - startTime) / 1000
      const targetTime = Math.max(0, elapsed - config.delay)

      if (targetTime > simTime) {
        let t = simTime
        const maxStep = 1 / 120
        while (t < targetTime) {
          t = Math.min(targetTime, t + maxStep)
          advance(t)
        }
        simTime = targetTime
      }

      drawSnake()
      animationFrame = requestAnimationFrame(step)
    }

    animationFrame = requestAnimationFrame(step)

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', onResize)
    }
  }, [config])

  return (
    <div
      className={`lobby-backdrop__snake lobby-backdrop__snake--${config.position} lobby-backdrop__snake--${config.align}`}
      style={wrapperStyle}
      ref={wrapperRef}
    >
      <div className="lobby-backdrop__snake-canvas">
        <div className="lobby-backdrop__snake-figure" ref={figureRef}>
          <canvas ref={canvasRef} width={config.width} height={config.height} />
        </div>
      </div>
    </div>
  )
}
