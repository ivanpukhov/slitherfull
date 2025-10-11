import { useEffect, useRef } from 'react'
import { createHexPattern } from '../utils/patterns'

type Vec2 = { x: number; y: number }

type Worm = {
  path: Vec2[]
  direction: number
  speed: number
  targetLength: number
  color: string
  alive: boolean
  respawnTimer: number
}

type Egg = Vec2 & { pulse: number }

type Burst = { x: number; y: number; life: number }

const WORM_COUNT = 4
const EGG_COUNT = 8
const MIN_LENGTH = 180
const MAX_LENGTH = 320

function randomRange(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function wrapPoint(point: Vec2, width: number, height: number) {
  return {
    x: ((point.x % width) + width) % width,
    y: ((point.y % height) + height) % height
  }
}

function spawnWorm(width: number, height: number): Worm {
  const origin = { x: randomRange(0, width), y: randomRange(0, height) }
  return {
    path: [origin],
    direction: randomRange(0, Math.PI * 2),
    speed: randomRange(45, 70),
    targetLength: randomRange(MIN_LENGTH, MAX_LENGTH),
    color: Math.random() > 0.5 ? '#38bdf8' : '#facc15',
    alive: true,
    respawnTimer: 0
  }
}

function spawnEgg(width: number, height: number): Egg {
  return {
    x: randomRange(0, width),
    y: randomRange(0, height),
    pulse: randomRange(0, Math.PI * 2)
  }
}

export function LobbyBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrame: number | null = null
    let pattern: CanvasPattern | null = null
    let width = 0
    let height = 0

    const worms: Worm[] = Array.from({ length: WORM_COUNT }, () => spawnWorm(1, 1))
    const eggs: Egg[] = Array.from({ length: EGG_COUNT }, () => spawnEgg(1, 1))
    const bursts: Burst[] = []

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1))
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      pattern = createHexPattern(ctx, { radius: 30, variant: 'lobby' })
      for (let i = 0; i < worms.length; i++) {
        worms[i] = spawnWorm(width, height)
      }
      for (let i = 0; i < eggs.length; i++) {
        eggs[i] = spawnEgg(width, height)
      }
    }

    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(container)

    let lastTime = performance.now()

    const updateWorm = (worm: Worm, dt: number) => {
      if (!worm.alive) {
        worm.respawnTimer -= dt
        if (worm.respawnTimer <= 0) {
          const revived = spawnWorm(width, height)
          worm.path = revived.path
          worm.direction = revived.direction
          worm.speed = revived.speed
          worm.targetLength = revived.targetLength
          worm.color = revived.color
          worm.alive = true
          worm.respawnTimer = 0
        }
        return
      }

      const wander = randomRange(-0.6, 0.6)
      worm.direction += wander * dt

      let head = { ...worm.path[0] }
      head.x += Math.cos(worm.direction) * worm.speed * dt
      head.y += Math.sin(worm.direction) * worm.speed * dt

      if (head.x < -40 || head.x > width + 40 || head.y < -40 || head.y > height + 40) {
        const cx = width / 2
        const cy = height / 2
        const angleToCenter = Math.atan2(cy - head.y, cx - head.x)
        worm.direction = angleToCenter + randomRange(-0.3, 0.3)
        head.x = Math.min(Math.max(head.x, -40), width + 40)
        head.y = Math.min(Math.max(head.y, -40), height + 40)
      }

      head = wrapPoint(head, width, height)
      worm.path.unshift(head)

      let length = 0
      for (let i = 1; i < worm.path.length; i++) {
        const prev = worm.path[i - 1]
        const curr = worm.path[i]
        length += Math.hypot(prev.x - curr.x, prev.y - curr.y)
        if (length >= worm.targetLength) {
          worm.path.length = i
          break
        }
      }
      if (worm.path.length > worm.targetLength / 4) {
        worm.path.length = Math.min(worm.path.length, Math.ceil(worm.targetLength / 4))
      }
    }

    const maybeCollide = (worms: Worm[], bursts: Burst[]) => {
      for (let i = 0; i < worms.length; i++) {
        const a = worms[i]
        if (!a.alive) continue
        const headA = a.path[0]
        for (let j = i + 1; j < worms.length; j++) {
          const b = worms[j]
          if (!b.alive) continue
          const headB = b.path[0]
          const dist = Math.hypot(headA.x - headB.x, headA.y - headB.y)
          if (dist < 26) {
            const victim = a.targetLength < b.targetLength ? a : b
            victim.alive = false
            victim.respawnTimer = randomRange(1.2, 2.4)
            bursts.push({ x: (headA.x + headB.x) / 2, y: (headA.y + headB.y) / 2, life: 0.6 })
            break
          }
        }
      }
    }

    const handleEggs = (worms: Worm[], eggs: Egg[]) => {
      for (const egg of eggs) {
        egg.pulse += 0.8
      }
      for (const worm of worms) {
        if (!worm.alive) continue
        const head = worm.path[0]
        for (const egg of eggs) {
          const dist = Math.hypot(head.x - egg.x, head.y - egg.y)
          if (dist < 24) {
            worm.targetLength = Math.min(MAX_LENGTH, worm.targetLength + randomRange(24, 48))
            egg.x = randomRange(0, width)
            egg.y = randomRange(0, height)
            egg.pulse = randomRange(0, Math.PI * 2)
            bursts.push({ x: head.x, y: head.y, life: 0.5 })
            break
          }
        }
      }
    }

    const draw = (ctx: CanvasRenderingContext2D) => {
      ctx.save()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#020203'
      ctx.fillRect(0, 0, width, height)
      if (pattern) {
        ctx.fillStyle = pattern
        ctx.fillRect(0, 0, width, height)
      }
      ctx.restore()

      ctx.save()
      const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.4, width / 2, height / 2, Math.max(width, height) * 0.9)
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.8)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, width, height)
      ctx.restore()

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (const egg of eggs) {
        const radius = 6 + Math.sin(egg.pulse * 0.08) * 1.6
        const gradient = ctx.createRadialGradient(egg.x, egg.y, radius * 0.3, egg.x, egg.y, radius)
        gradient.addColorStop(0, '#ffffff')
        gradient.addColorStop(0.45, '#facc15')
        gradient.addColorStop(1, 'rgba(250,204,21,0.2)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(egg.x, egg.y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      for (const worm of worms) {
        if (worm.path.length < 2) continue
        ctx.globalAlpha = worm.alive ? 0.9 : 0.35
        ctx.lineWidth = worm.alive ? 10 : 8
        const gradient = ctx.createLinearGradient(worm.path[worm.path.length - 1].x, worm.path[worm.path.length - 1].y, worm.path[0].x, worm.path[0].y)
        gradient.addColorStop(0, 'rgba(14,14,18,0.4)')
        gradient.addColorStop(1, worm.color)
        ctx.strokeStyle = gradient
        ctx.beginPath()
        ctx.moveTo(worm.path[0].x, worm.path[0].y)
        for (let i = 1; i < worm.path.length; i++) {
          ctx.lineTo(worm.path[i].x, worm.path[i].y)
        }
        ctx.stroke()
      }
      ctx.restore()

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = bursts.length - 1; i >= 0; i--) {
        const burst = bursts[i]
        const progress = Math.max(0, Math.min(1, burst.life / 0.6))
        const radius = (1 - progress) * 30 + 10
        ctx.globalAlpha = progress
        const gradient = ctx.createRadialGradient(burst.x, burst.y, radius * 0.2, burst.x, burst.y, radius)
        gradient.addColorStop(0, '#facc15')
        gradient.addColorStop(1, 'rgba(250,204,21,0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const loop = (now: number) => {
      const dt = Math.min(0.08, Math.max(0, (now - lastTime) / 1000))
      lastTime = now
      for (const worm of worms) {
        updateWorm(worm, dt)
      }
      maybeCollide(worms, bursts)
      handleEggs(worms, eggs)
      for (let i = bursts.length - 1; i >= 0; i--) {
        bursts[i].life -= dt
        if (bursts[i].life <= 0) {
          bursts.splice(i, 1)
        }
      }
      draw(ctx)
      animationFrame = requestAnimationFrame(loop)
    }

    animationFrame = requestAnimationFrame(loop)

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      observer.disconnect()
    }
  }, [])

  return (
    <div ref={containerRef} className="lobby-background">
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}

