import { formatNumber, shadeColor, withAlpha } from './helpers'

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
  headHistory?: SnakePoint[]
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

interface DrawBackgroundOptions {
  ctx: CanvasRenderingContext2D
  camX: number
  camY: number
  width: number
  height: number
  zoom: number
  pattern: CanvasPattern | null
  world: WorldState | null
  backgroundOffset?: { x: number; y: number }
}

export function drawBackground({
  ctx,
  camX,
  camY,
  width,
  height,
  zoom,
  pattern,
  world,
  backgroundOffset
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
  const offsetX = backgroundOffset?.x ?? 0
  const offsetY = backgroundOffset?.y ?? 0
  if (pattern) {
    ctx.fillStyle = pattern
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.fillRect(camX - pad - offsetX, camY - pad - offsetY, pad * 2, pad * 2)
    ctx.restore()
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

    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = shadeColor(baseColor, -0.55)
    ctx.lineWidth = bodyRadius * 2 + 6
    strokeSmoothPath(ctx, path)

    ctx.strokeStyle = baseColor
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
      if (typeof snake.bet === 'number' && snake.bet > 0) {
        labelParts.push(`ставка ${formatNumber(Math.floor(snake.bet))}`)
      }
      ctx.fillText(labelParts.join(' · '), head.x, head.y - headRadius - 10)
    }
  }
  ctx.shadowBlur = 0
  ctx.shadowColor = 'transparent'
  ctx.restore()
}


