import { formatNumber, formatUsdCents, shadeColor, withAlpha } from './helpers'

type SnakePoint = { x: number; y: number }

type SnakeState = {
  id: string
  name?: string
  skin?: string
  renderPath?: SnakePoint[]
  displayLength?: number
  length?: number
  displayX?: number
  displayY?: number
  targetX?: number
  targetY?: number
  displayDir?: number
  targetDir?: number
  alive?: boolean
  speed?: number
  betUsdCents?: number
}

type FoodState = {
  id: string
  displayX?: number
  displayY?: number
  targetX: number
  targetY: number
  color?: string
  pulse?: number
  big?: boolean
  value?: number
  life?: number
}

type WorldState = {
  centerX: number
  centerY: number
  radius: number
}

export function strokeSmoothPath(ctx: CanvasRenderingContext2D, points: SnakePoint[]): void {
  if (!points || points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2
    const midY = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
  }
  const last = points[points.length - 1]
  const penultimate = points[points.length - 2]
  ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y)
  ctx.stroke()
}

interface DrawBackgroundOptions {
  ctx: CanvasRenderingContext2D
  camX: number
  camY: number
  width: number
  height: number
  zoom: number
  pattern: CanvasPattern | null
  world: WorldState | null
}

export function drawBackground({
  ctx,
  camX,
  camY,
  width,
  height,
  zoom,
  pattern,
  world
}: DrawBackgroundOptions): void {
  ctx.save()
  ctx.fillStyle = '#05070d'
  ctx.fillRect(0, 0, width, height)
  const pad = Math.max(width, height)
  ctx.translate(width / 2, height / 2)
  ctx.scale(zoom, zoom)
  ctx.translate(-camX, -camY)
  if (world) {
    ctx.beginPath()
    ctx.arc(world.centerX, world.centerY, world.radius, 0, Math.PI * 2)
    ctx.clip()
  }
  if (pattern) {
    ctx.fillStyle = pattern
    ctx.fillRect(camX - pad, camY - pad, pad * 2, pad * 2)
  }
  ctx.restore()

  const vignette = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.2,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  )
  vignette.addColorStop(0, 'rgba(5, 9, 16, 0)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.65)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, width, height)
}

interface DrawFoodsOptions {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  foods: Map<string, FoodState>
  world: WorldState | null
  camX: number
  camY: number
  zoom: number
  dpr: number
  time: number
  foodPulseSpeed: number
}

export function drawFoods({
  ctx,
  canvas,
  foods,
  world,
  camX,
  camY,
  zoom,
  dpr,
  time,
  foodPulseSpeed
}: DrawFoodsOptions): void {
  ctx.save()
  const halfWidth = canvas.width / dpr / 2
  const halfHeight = canvas.height / dpr / 2
  ctx.translate(halfWidth, halfHeight)
  ctx.scale(zoom, zoom)
  ctx.translate(-camX, -camY)
  if (world) {
    ctx.beginPath()
    ctx.arc(world.centerX, world.centerY, world.radius, 0, Math.PI * 2)
    ctx.clip()
  }
  ctx.globalCompositeOperation = 'lighter'
  for (const food of foods.values()) {
    const color = food.color || '#ffd166'
    const pulse = 1 + Math.sin(time * foodPulseSpeed + (food.pulse || 0)) * 0.16
    const magnitude = Math.pow(Math.max(food.value || 1, 1), 0.6)
    const baseSize = food.big ? 6.6 : 4.8
    const radius = (baseSize + magnitude * (food.big ? 1.45 : 1.1)) * pulse
    const fx = typeof food.displayX === 'number' ? food.displayX : food.targetX
    const fy = typeof food.displayY === 'number' ? food.displayY : food.targetY
    ctx.globalAlpha = (food.big ? 0.95 : 0.88) * (food.life || 1)
    ctx.shadowBlur = food.big ? 38 : 24
    ctx.shadowColor = withAlpha(color, food.big ? 0.75 : 0.5)
    const gradient = ctx.createRadialGradient(fx, fy, radius * 0.22, fx, fy, radius)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.25, shadeColor(color, 0.2))
    gradient.addColorStop(1, shadeColor(color, -0.45))
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(fx, fy, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
  ctx.globalCompositeOperation = 'source-over'
}

interface DrawSnakesOptions {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  snakes: Map<string, SnakeState>
  world: WorldState | null
  camX: number
  camY: number
  zoom: number
  dpr: number
  skins: Record<string, string[]>
  meId: string | null
}

export function drawSnakes({
  ctx,
  canvas,
  snakes,
  world,
  camX,
  camY,
  zoom,
  dpr,
  skins,
  meId
}: DrawSnakesOptions): void {
  const entries = Array.from(snakes.values()).filter((snake) => snake.alive)
  entries.sort((a, b) => (a.displayLength || 0) - (b.displayLength || 0))
  ctx.save()
  const halfWidth = canvas.width / dpr / 2
  const halfHeight = canvas.height / dpr / 2
  ctx.translate(halfWidth, halfHeight)
  ctx.scale(zoom, zoom)
  ctx.translate(-camX, -camY)
  if (world) {
    ctx.beginPath()
    ctx.arc(world.centerX, world.centerY, world.radius, 0, Math.PI * 2)
    ctx.clip()
  }
  for (const snake of entries) {
    const path = snake.renderPath
    if (!path || path.length < 2) continue
    const colors = skins[snake.skin || ''] || skins.default
    const baseColor = colors?.[0] || '#94a3b8'
    const displayLength = snake.displayLength || snake.length || 20
    const bodyRadius = Math.max(7.2, Math.min(30, 6.4 + Math.pow(Math.max(displayLength, 1), 0.42)))
    const headRadius = bodyRadius * 1.02
    const headX = typeof snake.displayX === 'number' ? snake.displayX : snake.targetX || 0
    const headY = typeof snake.displayY === 'number' ? snake.displayY : snake.targetY || 0
    const head = { x: headX, y: headY }
    path[path.length - 1] = { x: head.x, y: head.y }
    const tail = path[0]

    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const gradient = tail
      ? (() => {
          const fade = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
          fade.addColorStop(0, withAlpha(baseColor, 0))
          fade.addColorStop(0.18, withAlpha(baseColor, 0.45))
          fade.addColorStop(0.55, withAlpha(baseColor, 0.85))
          fade.addColorStop(1, baseColor)
          return fade
        })()
      : baseColor

    ctx.strokeStyle = shadeColor(baseColor, -0.55)
    ctx.lineWidth = bodyRadius * 2 + 6
    strokeSmoothPath(ctx, path)

    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = withAlpha(baseColor, 0.18)
    ctx.lineWidth = bodyRadius * 2.6
    strokeSmoothPath(ctx, path)
    ctx.restore()

    const velocityMag = Math.hypot(snake.velocityX || 0, snake.velocityY || 0)
    if (velocityMag > 120) {
      ctx.save()
      ctx.globalAlpha = Math.min(0.4, velocityMag / 720)
      ctx.strokeStyle = withAlpha(baseColor, 0.22)
      ctx.lineWidth = bodyRadius * 2.9
      strokeSmoothPath(ctx, path)
      ctx.restore()
    }

    ctx.strokeStyle = gradient
    ctx.lineWidth = bodyRadius * 2
    ctx.shadowColor = withAlpha(baseColor, 0.45)
    ctx.shadowBlur = bodyRadius * 0.9
    strokeSmoothPath(ctx, path)

    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
    const highlight = path.slice(Math.max(0, path.length - 18))
    if (highlight.length >= 2) {
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = withAlpha('#ffffff', 0.2)
      ctx.lineWidth = bodyRadius * 0.58
      strokeSmoothPath(ctx, highlight)
      ctx.globalAlpha = 1
    }

    const headGradient = ctx.createRadialGradient(head.x, head.y, headRadius * 0.2, head.x, head.y, headRadius * 1.4)
    headGradient.addColorStop(0, '#ffffff')
    headGradient.addColorStop(0.22, baseColor)
    headGradient.addColorStop(1, shadeColor(baseColor, -0.4))
    ctx.fillStyle = headGradient
    ctx.beginPath()
    ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2)
    ctx.fill()

    const dir = typeof snake.displayDir === 'number' ? snake.displayDir : snake.targetDir || 0
    const eyeOffset = headRadius * 0.58
    const sideOffset = headRadius * 0.32
    const pupilOffset = headRadius * 0.18
    const eyeRadius = headRadius * 0.28
    const pupilRadius = headRadius * 0.16
    const ex1 = head.x + Math.cos(dir) * eyeOffset - Math.sin(dir) * sideOffset
    const ey1 = head.y + Math.sin(dir) * eyeOffset + Math.cos(dir) * sideOffset
    const ex2 = head.x + Math.cos(dir) * eyeOffset + Math.sin(dir) * sideOffset
    const ey2 = head.y + Math.sin(dir) * eyeOffset - Math.cos(dir) * sideOffset
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

    if (snake.name) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.9)'
      ctx.font = '600 13px "Inter", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      const labelParts = [snake.name]
      if (typeof snake.betUsdCents === 'number' && snake.betUsdCents > 0) {
        labelParts.push(`ставка ${formatUsdCents(Math.floor(snake.betUsdCents))}`)
      }
      ctx.fillText(labelParts.join(' · '), head.x, head.y - headRadius - 10)
    }
  }
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
  ctx.restore()
}

interface DrawMinimapOptions {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  foods: Map<string, FoodState>
  snakes: Map<string, SnakeState>
  world: WorldState | null
  dpr: number
  skins: Record<string, string[]>
  meId: string | null
}

export function drawMinimap({
  ctx,
  canvas,
  foods,
  snakes,
  world,
  dpr,
  skins,
  meId
}: DrawMinimapOptions): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const width = canvas.width / dpr
  const height = canvas.height / dpr
  ctx.clearRect(0, 0, width, height)
  if (!world) return
  const cx = width / 2
  const cy = height / 2
  const mapRadius = Math.min(width, height) * 0.46
  const scale = mapRadius / world.radius
  const centerX = world.centerX
  const centerY = world.centerY

  ctx.save()
  ctx.fillStyle = 'rgba(11, 18, 30, 0.92)'
  ctx.beginPath()
  ctx.arc(cx, cy, mapRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = Math.max(1.2, mapRadius * 0.05)
  ctx.strokeStyle = 'rgba(94, 117, 151, 0.45)'
  ctx.stroke()
  ctx.lineWidth = Math.max(0.8, mapRadius * 0.02)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)'
  ctx.beginPath()
  ctx.arc(cx, cy, mapRadius - ctx.lineWidth * 1.4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, mapRadius - Math.max(2, mapRadius * 0.08), 0, Math.PI * 2)
  ctx.clip()

  ctx.globalAlpha = 0.9
  for (const food of foods.values()) {
    const fx = cx + (((typeof food.displayX === 'number' ? food.displayX : food.targetX) || centerX) - centerX) * scale
    const fy = cy + (((typeof food.displayY === 'number' ? food.displayY : food.targetY) || centerY) - centerY) * scale
    const radius = Math.max(2.2, 2.3 + Math.pow(Math.max(food.value || 1, 1), 0.32) * (food.big ? 1.5 : 1))
    ctx.fillStyle = food.color || '#ffd166'
    ctx.beginPath()
    ctx.arc(fx, fy, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.globalAlpha = 1
  const entries = Array.from(snakes.values()).filter((snake) => snake.alive)
  entries.sort((a, b) => (a.displayLength || a.length || 0) - (b.displayLength || b.length || 0))
  for (const snake of entries) {
    const colors = skins[snake.skin || ''] || skins.default
    const baseColor = colors?.[0] || '#94a3b8'
    const hx = cx + (((typeof snake.displayX === 'number' ? snake.displayX : snake.targetX) || centerX) - centerX) * scale
    const hy = cy + (((typeof snake.displayY === 'number' ? snake.displayY : snake.targetY) || centerY) - centerY) * scale
    const headSize = Math.max(3, Math.pow(Math.max(snake.displayLength || snake.length || 20, 20), 0.27) * 0.6)
    const path = snake.renderPath
    if (path && path.length > 1) {
      ctx.beginPath()
      const first = path[0]
      ctx.moveTo(cx + (first.x - centerX) * scale, cy + (first.y - centerY) * scale)
      const step = Math.max(1, Math.floor(path.length / 24))
      for (let i = step; i < path.length; i += step) {
        const point = path[i]
        ctx.lineTo(cx + (point.x - centerX) * scale, cy + (point.y - centerY) * scale)
      }
      const tail = path[path.length - 1]
      ctx.lineTo(cx + (tail.x - centerX) * scale, cy + (tail.y - centerY) * scale)
      ctx.lineWidth = Math.max(1.2, headSize * 0.75)
      ctx.strokeStyle = withAlpha(baseColor, snake.id === meId ? 0.95 : 0.6)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()
    }
    ctx.fillStyle = baseColor
    ctx.beginPath()
    ctx.arc(hx, hy, headSize, 0, Math.PI * 2)
    ctx.fill()
    if (snake.id === meId) {
      ctx.lineWidth = Math.max(1.6, headSize * 0.6)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.beginPath()
      ctx.arc(hx, hy, headSize + ctx.lineWidth * 0.4, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.restore()
}
