export interface HexPatternOptions {
  radius?: number
  variant?: 'game' | 'lobby'
}

export function createHexPattern(
  ctx: CanvasRenderingContext2D,
  { radius = 35, variant = 'game' }: HexPatternOptions = {}
) {
  const r = Math.max(12, Math.floor(radius))
  const W = Math.round(3 * r)
  const H = Math.round(Math.sqrt(3) * r)
  const off = document.createElement('canvas')
  off.width = W
  off.height = H
  const c = off.getContext('2d')
  if (!c) return null

  const palette =
    variant === 'lobby'
      ? {
          baseStart: '#040405',
          baseEnd: '#070708',
          fill: '#090b11',
          inner0: '#0f1218',
          inner1: '#050608',
          inner2: '#020203',
          rim0: '#1b1f28',
          rim1: '#11141c',
          rim2: '#07080c',
          glow0: 'rgba(59,130,246,0.12)',
          glow1: 'rgba(15,23,42,0.6)',
          stroke: '#010102'
        }
      : {
          baseStart: '#0b0f16',
          baseEnd: '#151a24',
          fill: '#111722',
          inner0: '#131a26',
          inner1: '#0e1420',
          inner2: '#0a0f18',
          rim0: '#27384f',
          rim1: '#1d2735',
          rim2: '#121925',
          glow0: 'rgba(59,130,246,0.24)',
          glow1: 'rgba(12,23,38,0.42)',
          stroke: '#0a0e14'
        }

  const base = c.createLinearGradient(0, 0, W, H)
  base.addColorStop(0, palette.baseStart)
  base.addColorStop(1, palette.baseEnd)
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
    c.fillStyle = palette.fill
    c.fill(path)

    c.save()
    c.clip(path)
    const inner = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
    inner.addColorStop(0, palette.inner0)
    inner.addColorStop(0.65, palette.inner1)
    inner.addColorStop(1, palette.inner2)
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
    rim.addColorStop(0, palette.rim0)
    rim.addColorStop(0.5, palette.rim1)
    rim.addColorStop(1, palette.rim2)
    c.strokeStyle = rim
    c.stroke(path)

    c.save()
    c.clip(path)
    c.lineWidth = Math.max(1.2, r * 0.06)
    const innerRim = c.createLinearGradient(cx + r, cy - r, cx - r, cy + r)
    innerRim.addColorStop(0, palette.glow0)
    innerRim.addColorStop(1, palette.glow1)
    c.strokeStyle = innerRim
    c.stroke(path)
    c.restore()

    c.lineWidth = Math.max(8, r * 0.28)
    c.strokeStyle = palette.stroke
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
