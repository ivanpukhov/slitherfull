export function formatNumber(value: number | null | undefined): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(value as number) ? (value as number) : 0))
  return safe.toLocaleString('ru-RU')
}

export const BET_OPTIONS_USD = [1, 5, 20] as const

export function sanitizeBetValue(value: number | string | null | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return BET_OPTIONS_USD.includes(parsed as (typeof BET_OPTIONS_USD)[number]) ? parsed : 0
}

const usdFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
  minimumFractionDigits: 2
})

export function formatUsdCents(value: number | null | undefined): string {
  const cents = Math.max(0, Math.floor(Number(value) || 0))
  return usdFormatter.format(cents / 100)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpAngle(a: number, b: number, t: number): number {
  const shortest = ((((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI
  return a + shortest * t
}

export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const value = parseInt(clean, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export function shadeColor(hex: string, amt: number): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const value = parseInt(clean, 16)
  let r = (value >> 16) & 255
  let g = (value >> 8) & 255
  let b = value & 255
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt)
    g = Math.round(g + (255 - g) * amt)
    b = Math.round(b + (255 - b) * amt)
  } else {
    const t = -amt
    r = Math.round(r * (1 - t))
    g = Math.round(g * (1 - t))
    b = Math.round(b * (1 - t))
  }
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

export function safeParse<T = any>(data: string): T | null {
  try {
    return JSON.parse(data) as T
  } catch (err) {
    return null
  }
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}
