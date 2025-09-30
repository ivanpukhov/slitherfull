import { useEffect, useMemo, useState } from 'react'
import { formatNumber, sanitizeBetValue, lerp, lerpAngle, formatUsdCents, BET_OPTIONS_USD } from '../utils/helpers'
import { drawBackground, drawFoods, drawSnakes, drawMinimap as renderMinimap } from '../utils/drawing'

export const SKINS: Record<string, string[]> = {
  default: ['#38bdf8'],
  emerald: ['#34d399'],
  crimson: ['#ef4444'],
  amber: ['#f59e0b'],
  violet: ['#a855f7'],
  obsidian: ['#475569'],
  mint: ['#14b8a6']
}

export const SKIN_LABELS: Record<string, string> = {
  default: 'Sky',
  emerald: 'Emerald',
  crimson: 'Crimson',
  amber: 'Amber',
  violet: 'Violet',
  obsidian: 'Obsidian',
  mint: 'Mint'
}

export const FOOD_PULSE_SPEED = 4.4
export const CAMERA_SMOOTH = 4.8
export const POSITION_SMOOTH = 11.5
export const ANGLE_SMOOTH = 9.8
export const CAMERA_ZOOM = 1.2
export const MAX_PREDICTION_SECONDS = 0.34
export const PREDICTION_CORRECTION = 5.2
export const PREDICTION_SNAP_DISTANCE = 220
export const SEGMENT_SPACING = 6
export const LENGTH_EPS = 1e-3
export const MINIMAP_SIZE = 188
export const CASHOUT_HOLD_MS = 2000
export const RENDER_PATH_BLEND = 0.18
const RENDER_PATH_HEAD_WEIGHT = 0.38
const RENDER_PATH_TAIL_WEIGHT = 0.12

export interface AccountState {
  balance: number
  currentBet: number
  total: number
  cashedOut: boolean
  balanceUsdCents: number
  currentBetUsdCents: number
  totalUsdCents: number
}

export interface LeaderboardEntry {
  id?: string
  name: string
  length: number
  betUsdCents?: number
}

export interface SnakePoint {
  x: number
  y: number
}

export interface SnakeState {
  id: string
  name?: string
  alive: boolean
  length: number
  displayLength: number
  serverX?: number
  serverY?: number
  velocityX?: number
  velocityY?: number
  lastServerAt?: number
  predictedX?: number
  predictedY?: number
  targetX: number
  targetY: number
  displayX?: number
  displayY?: number
  targetDir?: number
  displayDir?: number
  speed?: number
  skin: string
  segments: SnakePoint[]
  renderPath: SnakePoint[]
  bet?: number
  betUsdCents?: number
}

export interface FoodState {
  id: string
  targetX: number
  targetY: number
  displayX?: number
  displayY?: number
  color?: string
  big?: boolean
  value?: number
  pulse?: number
  life?: number
}

interface CameraState {
  x: number
  y: number
  targetX: number
  targetY: number
  zoom: number
  initialized: boolean
}

interface WorldState {
  width: number
  height: number
  radius: number
  centerX: number
  centerY: number
}

export interface CashoutControlState {
  label: string
  hint: string
  disabled: boolean
  holding: boolean
  pending: boolean
}

export interface BoostState {
  allowed: boolean
  active: boolean
}

export interface DeathScreenState {
  visible: boolean
  summary: string
  score: string
  balance: string
  showBetControl: boolean
  betValue: string
  betBalance: string
  canRetry: boolean
}

export interface CashoutScreenState {
  visible: boolean
  summary: string
}

export interface LastResultState {
  title: string
  details: string[]
  showRetryControls: boolean
  retryBalance: string
  variant: 'death' | 'cashout'
}

interface GameUIState {
  score: number
  scoreMeta: string
  cashout: CashoutControlState
  boost: BoostState
  death: DeathScreenState
  cashoutScreen: CashoutScreenState
  lastResult: LastResultState | null
  nicknameVisible: boolean
  nickname: string
  nicknameLocked: boolean
  selectedSkin: string
  betValue: string
  retryBetValue: string
  touchControlsEnabled: boolean
  transfer: {
    pending: boolean
    message: string
  }
}

interface InternalState {
  snakes: Map<string, SnakeState>
  foods: Map<string, FoodState>
  leaderboard: LeaderboardEntry[]
  meId: string | null
  meName: string
  alive: boolean
  world: WorldState | null
  camera: CameraState
  pointerAngle: number | null
  boostIntent: boolean
  boostActive: boolean
  limits: { minLength: number; baseLength: number; boostMinLength: number }
  lastInputSent: number
  lastSnapshotAt: number
  account: AccountState
  pendingBet: number | null
  usdPrice: number | null
  cashoutHold: {
    start: number | null
    frame: number | null
    triggered: boolean
    source: 'pointer' | 'keyboard' | null
  }
  ui: GameUIState
}

const initialAccount: AccountState = {
  balance: 0,
  currentBet: 0,
  total: 0,
  cashedOut: false,
  balanceUsdCents: 0,
  currentBetUsdCents: 0,
  totalUsdCents: 0
}

const initialCamera: CameraState = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  zoom: CAMERA_ZOOM,
  initialized: false
}

const initialUI: GameUIState = {
  score: 0,
  scoreMeta: 'Ранг: —',
  cashout: {
    label: 'Вывод',
    hint: 'Удерживайте кнопку 2 секунды или нажмите Q',
    disabled: true,
    holding: false,
    pending: false
  },
  boost: { allowed: false, active: false },
  death: {
    visible: false,
    summary: '',
    score: '',
    balance: '',
    showBetControl: false,
    betValue: '',
    betBalance: '0',
    canRetry: false
  },
  cashoutScreen: {
    visible: false,
    summary: ''
  },
  lastResult: null,
  nicknameVisible: true,
  nickname: '',
  nicknameLocked: false,
  selectedSkin: 'default',
  betValue: String(BET_OPTIONS_USD[0]),
  retryBetValue: '',
  touchControlsEnabled: false,
  transfer: {
    pending: false,
    message: ''
  }
}

export class GameController {
  public state: InternalState
  private listeners: Set<() => void> = new Set()
  public hexPattern: CanvasPattern | null = null
  private cashoutRequest: (() => void) | null = null

  constructor() {
    this.state = {
      snakes: new Map(),
      foods: new Map(),
      leaderboard: [],
      meId: null,
      meName: '',
      alive: false,
      world: null,
      camera: { ...initialCamera },
      pointerAngle: null,
      boostIntent: false,
      boostActive: false,
      limits: { minLength: 0, baseLength: 0, boostMinLength: 0 },
      lastInputSent: 0,
      lastSnapshotAt: 0,
      account: { ...initialAccount },
      pendingBet: null,
      usdPrice: null,
      cashoutHold: { start: null, frame: null, triggered: false, source: null },
      ui: { ...initialUI }
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener()
    }
  }

  setNickname(name: string) {
    this.state.ui.nickname = name
    this.notify()
  }

  setNicknameVisible(visible: boolean) {
    this.state.ui.nicknameVisible = visible
    this.notify()
  }

  setNicknameLock(locked: boolean) {
    this.state.ui.nicknameLocked = locked
    this.notify()
  }

  setSelectedSkin(skin: string) {
    this.state.ui.selectedSkin = skin
    this.notify()
  }

  setUsdPrice(value: number | null) {
    const normalized = Number.isFinite(value) && value && value > 0 ? Number(value) : null
    this.state.usdPrice = normalized
    this.notify()
  }

  setCashoutRequestHandler(handler: (() => void) | null) {
    this.cashoutRequest = handler
  }

  setBetValue(value: string) {
    this.state.ui.betValue = value
    this.notify()
  }

  setRetryBetValue(value: string) {
    this.state.ui.retryBetValue = value
    this.notify()
  }

  setTouchControlsEnabled(enabled: boolean) {
    this.state.ui.touchControlsEnabled = enabled
    this.notify()
  }

  setTransferState(pending: boolean, message?: string) {
    this.state.ui.transfer = {
      pending,
      message: message ?? (pending ? 'Перевод средств…' : '')
    }
    this.notify()
  }

  applyBalanceUpdate(payload: Partial<AccountState> & { cashedOut?: boolean }) {
    const next = { ...this.state.account }
    if (typeof payload.balance === 'number') next.balance = Math.max(0, Math.floor(payload.balance))
    if (typeof payload.currentBet === 'number') next.currentBet = Math.max(0, Math.floor(payload.currentBet))
    if (typeof payload.total === 'number') {
      next.total = Math.max(0, Math.floor(payload.total))
    } else {
      next.total = Math.max(0, next.balance + next.currentBet)
    }
    if (typeof payload.balanceUsdCents === 'number') {
      next.balanceUsdCents = Math.max(0, Math.floor(payload.balanceUsdCents))
    }
    if (typeof payload.currentBetUsdCents === 'number') {
      next.currentBetUsdCents = Math.max(0, Math.floor(payload.currentBetUsdCents))
    }
    if (typeof payload.totalUsdCents === 'number') {
      next.totalUsdCents = Math.max(0, Math.floor(payload.totalUsdCents))
    } else {
      next.totalUsdCents = Math.max(0, next.balanceUsdCents + next.currentBetUsdCents)
    }
    if (typeof payload.cashedOut === 'boolean') {
      next.cashedOut = payload.cashedOut
      if (payload.cashedOut) {
        this.state.ui.cashout.pending = false
      }
    }
    this.state.account = next
    if (this.state.ui.transfer.pending) {
      this.state.ui.transfer = { pending: false, message: '' }
    }
    this.refreshCashoutState()
    this.notify()
  }

  setAccountState(payload: Partial<AccountState>) {
    const next = { ...this.state.account }
    if (typeof payload.balance === 'number') next.balance = Math.max(0, Math.floor(payload.balance))
    if (typeof payload.currentBet === 'number') next.currentBet = Math.max(0, Math.floor(payload.currentBet))
    if (typeof payload.total === 'number') {
      next.total = Math.max(0, Math.floor(payload.total))
    } else {
      next.total = Math.max(0, next.balance + next.currentBet)
    }
    if (typeof payload.balanceUsdCents === 'number') {
      next.balanceUsdCents = Math.max(0, Math.floor(payload.balanceUsdCents))
    }
    if (typeof payload.currentBetUsdCents === 'number') {
      next.currentBetUsdCents = Math.max(0, Math.floor(payload.currentBetUsdCents))
    }
    if (typeof payload.totalUsdCents === 'number') {
      next.totalUsdCents = Math.max(0, Math.floor(payload.totalUsdCents))
    } else {
      next.totalUsdCents = Math.max(0, next.balanceUsdCents + next.currentBetUsdCents)
    }
    if (typeof payload.cashedOut === 'boolean') next.cashedOut = payload.cashedOut
    this.state.account = next
    this.refreshCashoutState()
    this.notify()
  }

  sanitizeBet(value: string | number) {
    return sanitizeBetValue(value)
  }

  private refreshCashoutState(options?: Partial<CashoutControlState>) {
    const total = Math.max(0, this.state.account.total)
    const canCashOut =
      !this.state.account.cashedOut && !this.state.ui.cashout.pending && total > 0 && this.state.alive
    this.state.ui.cashout = {
      label: options?.label ?? (this.state.account.cashedOut ? 'Баланс выведен' : this.state.ui.cashout.label),
      hint: this.state.account.cashedOut
        ? 'Баланс зафиксирован'
        : this.state.ui.cashout.pending
          ? 'Запрос обрабатывается'
          : options?.hint ?? 'Удерживайте кнопку 2 секунды или нажмите Q',
      disabled: options?.disabled ?? !canCashOut,
      holding: options?.holding ?? this.state.ui.cashout.holding,
      pending: options?.pending ?? this.state.ui.cashout.pending
    }
  }

  startCashoutHold(source: 'pointer' | 'keyboard') {
    if (this.state.cashoutHold.triggered) return
    const canCashOut =
      !this.state.account.cashedOut && !this.state.ui.cashout.pending && this.state.account.total > 0 && this.state.alive
    if (!canCashOut) return
    this.state.cashoutHold = {
      start: performance.now(),
      frame: requestAnimationFrame(this.updateCashoutCountdown),
      triggered: false,
      source
    }
    this.state.ui.cashout = { ...this.state.ui.cashout, holding: true }
    this.notify()
  }

  private updateCashoutCountdown = (now: number) => {
    const hold = this.state.cashoutHold
    if (!hold.start) return
    const elapsed = now - hold.start
    const remaining = Math.max(0, CASHOUT_HOLD_MS - elapsed)
    if (!this.state.account.cashedOut) {
      this.state.ui.cashout.label =
        remaining > 0 ? `Удерживайте ещё ${(remaining / 1000).toFixed(1)} с` : 'Запрос вывода...'
      this.notify()
    }
    if (elapsed >= CASHOUT_HOLD_MS && !hold.triggered) {
      hold.triggered = true
      hold.frame = null
      this.triggerCashout()
      return
    }
    hold.frame = requestAnimationFrame(this.updateCashoutCountdown)
  }

  resetCashoutHold(options?: { preserveLabel?: boolean }) {
    const hold = this.state.cashoutHold
    if (hold.frame) cancelAnimationFrame(hold.frame)
    this.state.cashoutHold = { start: null, frame: null, triggered: false, source: null }
    this.state.ui.cashout = {
      ...this.state.ui.cashout,
      holding: false,
      label: options?.preserveLabel ? this.state.ui.cashout.label : 'Вывод'
    }
    this.refreshCashoutState()
    this.notify()
  }

  setCashoutPending(pending: boolean) {
    this.state.ui.cashout.pending = pending
    this.refreshCashoutState()
    this.notify()
  }

  triggerCashout() {
    if (!this.canRequestCashout()) return
    const pendingBalance = Math.max(0, this.state.account.total)
    const pendingBalanceUsd = Math.max(0, this.state.account.totalUsdCents)
    this.state.alive = false
    this.state.ui.nicknameVisible = true
    this.state.ui.cashout = {
      label: 'Запрос вывода...',
      hint: 'Запрос обрабатывается',
      disabled: true,
      holding: false,
      pending: true
    }
    this.state.ui.transfer = {
      pending: true,
      message: 'Вывод средств обрабатывается...'
    }
    this.state.ui.lastResult = {
      title: 'Запрос на вывод отправлен',
      details: [
        'Вы возвращены в лобби, игра завершена.',
        'Мы зафиксировали ваш баланс и завершим перевод автоматически.'
      ],
      showRetryControls: false,
      retryBalance: formatUsdCents(pendingBalanceUsd),
      variant: 'cashout'
    }
    this.state.cashoutHold = { start: null, frame: null, triggered: true, source: null }
    this.notify()
    if (this.cashoutRequest) {
      this.cashoutRequest()
    }
  }

  canRequestCashout() {
    return !this.state.account.cashedOut && !this.state.ui.cashout.pending && this.state.account.total > 0 && this.state.alive
  }

  setBoostIntent(active: boolean) {
    const desired = Boolean(active)
    if (this.state.boostIntent === desired) {
      if (!desired) this.refreshBoostState()
      return
    }
    this.state.boostIntent = desired
    this.refreshBoostState()
    this.notify()
  }

  resetBoostIntent() {
    this.state.boostIntent = false
    this.refreshBoostState()
    this.notify()
  }

  refreshBoostState(force = false) {
    const allowed = this.canBoost()
    const active = allowed && this.state.boostIntent
    if (force || allowed !== this.state.ui.boost.allowed || active !== this.state.ui.boost.active) {
      this.state.ui.boost = { allowed, active }
    }
    return { allowed, active }
  }

  private canBoost() {
    const me = this.getMeSnake()
    if (!me || !me.alive || !this.state.alive) return false
    const min = this.state.limits.boostMinLength || this.state.limits.minLength || 0
    return typeof me.length === 'number' && me.length > min + 1e-3
  }

  setTouchPointerAngle(angle: number | null) {
    this.state.pointerAngle = angle
  }

  getInputPayload(now: number) {
    const boostStatus = this.refreshBoostState()
    const angle = this.state.pointerAngle
    return {
      angle: typeof angle === 'number' && !Number.isNaN(angle) ? angle : undefined,
      boost: boostStatus.active,
      timestamp: now
    }
  }

  markInputSent(now: number) {
    this.state.lastInputSent = now
  }

  getLastInputSent() {
    return this.state.lastInputSent
  }

  setAlive(alive: boolean) {
    this.state.alive = alive
    this.refreshCashoutState()
    this.notify()
  }

  setPendingBet(amount: number | null) {
    this.state.pendingBet = amount
  }

  getPendingBet() {
    return this.state.pendingBet
  }

  setMe(id: string, name: string) {
    this.state.meId = id
    this.state.meName = name
  }

  setLimits(limits: Partial<InternalState['limits']>) {
    this.state.limits = { ...this.state.limits, ...limits }
  }

  setWorld(world: WorldState) {
    this.state.world = world
    if (!this.state.camera.initialized) {
      this.state.camera.x = world.centerX
      this.state.camera.y = world.centerY
      this.state.camera.targetX = world.centerX
      this.state.camera.targetY = world.centerY
      this.state.camera.initialized = true
    }
  }

  setCamera(updater: (camera: CameraState) => void) {
    updater(this.state.camera)
  }

  getCamera() {
    return this.state.camera
  }

  getWorld() {
    return this.state.world
  }

  getSnakes() {
    return this.state.snakes
  }

  getFoods() {
    return this.state.foods
  }

  getLeaderboard() {
    return this.state.leaderboard
  }

  getAccount() {
    return this.state.account
  }

  getUI() {
    return this.state.ui
  }

  getMeSnake() {
    return this.state.meId ? this.state.snakes.get(this.state.meId) || null : null
  }

  updateScoreHUD(score: number) {
    const meSnake = this.getMeSnake()
    const speed = meSnake && meSnake.speed ? Math.max(0, Math.round(meSnake.speed)) : null
    const boostStatus = this.refreshBoostState()
    const boostLabel = boostStatus.allowed ? (boostStatus.active ? 'Буст: вкл.' : 'Буст: готов') : 'Буст: нет'
    const rank = this.getRank()
    this.state.ui.score = score
    this.state.ui.scoreMeta = speed
      ? `Ранг: ${rank} · Скорость: ${speed} · ${boostLabel}`
      : `Ранг: ${rank} · ${boostLabel}`
    this.notify()
  }

  private getRank() {
    if (!this.state.leaderboard.length || !this.state.meName) return '—'
    const index = this.state.leaderboard.findIndex((entry) => entry && entry.name === this.state.meName)
    if (index === -1) return this.state.leaderboard.length >= 10 ? '10+' : '—'
    return (index + 1).toString()
  }

  showDeath(payload: any) {
    this.state.alive = false
    this.state.ui.cashout.pending = false
    this.resetBoostIntent()
    this.resetCashoutHold()
    const killerName = payload?.killerName ? payload.killerName : 'неизвестный'
    const score = typeof payload?.yourScore === 'number' ? payload.yourScore : 0
    const balance = Math.max(0, this.state.account.balance || 0)
    const balanceUsd = Math.max(0, this.state.account.balanceUsdCents || 0)
    const betValue = balanceUsd > 0 ? this.sanitizeBet(this.state.ui.retryBetValue || this.state.ui.betValue || BET_OPTIONS_USD[0]) : 0
    const details: string[] = [`Счёт: ${formatNumber(score)}`]
    details.push(balanceUsd > 0 ? `На счету осталось ${formatUsdCents(balanceUsd)}` : 'Баланс обнулён')
    this.state.ui.death = {
      visible: false,
      summary: `Вас победил ${killerName}`,
      score: `Счёт: ${formatNumber(score)}`,
      balance: balanceUsd > 0 ? `На счету осталось ${formatUsdCents(balanceUsd)}` : 'Баланс обнулён',
      showBetControl: balanceUsd > 0,
      betValue: balanceUsd > 0 ? String(betValue || BET_OPTIONS_USD[0]) : '',
      betBalance: formatUsdCents(balanceUsd),
      canRetry: balanceUsd > 0
    }
    this.state.ui.retryBetValue = balanceUsd > 0 ? String(betValue || BET_OPTIONS_USD[0]) : ''
    this.state.ui.lastResult = {
      title: `Вас победил ${killerName}`,
      details,
      showRetryControls: balanceUsd > 0,
      retryBalance: formatUsdCents(balanceUsd),
      variant: 'death'
    }
    this.updateScoreHUD(0)
    this.refreshCashoutState({ label: 'Вывод', pending: false, holding: false })
    this.setNicknameVisible(true)
    this.notify()
  }

  showCashout(finalBalance?: number) {
    this.state.alive = false
    this.state.ui.cashout.pending = false
    this.resetBoostIntent()
    this.resetCashoutHold()
    const safeBalance = Math.max(0, Math.floor(typeof finalBalance === 'number' ? finalBalance : this.state.account.total))
    this.applyBalanceUpdate({ balance: safeBalance, currentBet: 0, total: safeBalance, cashedOut: true })
    this.state.ui.cashout = {
      label: 'Баланс выведен',
      hint: 'Баланс зафиксирован',
      disabled: true,
      holding: false,
      pending: false
    }
    const safeBalanceUsd = Math.max(0, Math.floor(this.state.account.balanceUsdCents || 0))
    this.state.ui.cashoutScreen = {
      visible: false,
      summary: `Ваш баланс теперь ${formatUsdCents(safeBalanceUsd)}.`
    }
    this.state.ui.death.visible = false
    this.state.ui.retryBetValue = ''
    this.state.ui.lastResult = {
      title: 'Баланс выведен',
      details: [`Ваш баланс теперь ${formatUsdCents(safeBalanceUsd)}.`],
      showRetryControls: false,
      retryBalance: formatUsdCents(safeBalanceUsd),
      variant: 'cashout'
    }
    this.updateScoreHUD(0)
    this.setNicknameVisible(true)
    this.notify()
  }

  hideDeath() {
    this.state.ui.death.visible = false
    this.notify()
  }

  hideCashoutScreen() {
    this.state.ui.cashoutScreen.visible = false
    this.notify()
  }

  clearLastResult() {
    this.state.ui.lastResult = null
    this.notify()
  }

  applySnapshot(snapshot: any) {
    const seen = new Set<string>()
    if (Array.isArray(snapshot.players)) {
      snapshot.players.forEach((payload: any) => {
        if (!payload || !payload.id) return
        seen.add(payload.id)
        this.upsertSnake(payload)
      })
    }
    if (snapshot.you && snapshot.you.id) {
      seen.add(snapshot.you.id)
    }
    for (const id of Array.from(this.state.snakes.keys())) {
      if (!seen.has(id)) {
        this.state.snakes.delete(id)
      }
    }

    if (Array.isArray(snapshot.foods)) {
      const newFoods = new Map<string, FoodState>()
      snapshot.foods.forEach((food: any) => {
        if (!food || !food.id) return
        const existing = this.state.foods.get(food.id) || {
          id: food.id,
          targetX: food.x || 0,
          targetY: food.y || 0
        }
        newFoods.set(food.id, {
          ...existing,
          targetX: food.x || existing.targetX,
          targetY: food.y || existing.targetY,
          color: food.color || existing.color || this.randomFoodColor(food.id),
          big: Boolean(food.big),
          value: typeof food.value === 'number' ? food.value : existing.value || 1,
          life: 1
        })
      })
      this.state.foods = newFoods
    }

    if (Array.isArray(snapshot.leaderboard)) {
      const entries: LeaderboardEntry[] = []
      snapshot.leaderboard.forEach((entry: any, idx: number) => {
        if (!entry) return
        const name = typeof entry.name === 'string' ? entry.name : null
        const length = typeof entry.length === 'number' ? Math.max(0, Math.floor(entry.length)) : null
        if (!name || length === null) return
        const betUsdCents = typeof entry.betUsdCents === 'number' ? Math.max(0, Math.floor(entry.betUsdCents)) : undefined
        entries.push({
          id: entry.id ? String(entry.id) : `${name}-${idx}`,
          name,
          length,
          betUsdCents
        })
      })
      this.state.leaderboard = entries
    }

    if (snapshot.you && typeof snapshot.you.length === 'number') {
      this.updateScoreHUD(Math.floor(snapshot.you.length))
    }
    this.refreshBoostState()
    this.state.lastSnapshotAt = performance.now()
    this.notify()
  }

  randomFoodColor(seed: string) {
    const colors = ['#f97316', '#f59e0b', '#38bdf8', '#34d399', '#a855f7', '#ef4444']
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff
    }
    return colors[Math.abs(hash) % colors.length]
  }

  upsertSnake(payload: any) {
    const id = payload.id
    const existing = this.state.snakes.get(id)
    const segments = Array.isArray(payload.path)
      ? payload.path.map((point: any) => ({ x: point.x || 0, y: point.y || 0 }))
      : existing?.segments || []
    const snake: SnakeState = existing
      ? { ...existing }
      : {
          id,
          name: payload.name || existing?.name || 'Anon',
          alive: Boolean(payload.alive ?? existing?.alive ?? true),
          length: payload.length || existing?.length || 20,
          displayLength: existing?.displayLength || payload.length || 20,
          targetX: typeof payload.x === 'number' ? payload.x : existing?.targetX || 0,
          targetY: typeof payload.y === 'number' ? payload.y : existing?.targetY || 0,
          predictedX:
            typeof payload.x === 'number'
              ? payload.x
              : existing?.predictedX ?? existing?.targetX ?? existing?.serverX ?? 0,
          predictedY:
            typeof payload.y === 'number'
              ? payload.y
              : existing?.predictedY ?? existing?.targetY ?? existing?.serverY ?? 0,
          skin: payload.skin || existing?.skin || 'default',
          segments: segments.length ? segments : [{ x: payload.x || 0, y: payload.y || 0 }],
          renderPath: segments.length ? segments.slice() : [{ x: payload.x || 0, y: payload.y || 0 }],
          bet: typeof payload.bet === 'number' ? payload.bet : existing?.bet,
          betUsdCents:
            typeof payload.betUsdCents === 'number' ? Math.max(0, Math.floor(payload.betUsdCents)) : existing?.betUsdCents
        }
    snake.name = payload.name || snake.name
    snake.alive = payload.alive !== undefined ? payload.alive : true
    snake.length = payload.length || snake.length
    snake.displayLength = existing?.displayLength ?? snake.length
    snake.skin = payload.skin || snake.skin || 'default'
    snake.serverX = payload.x ?? snake.serverX
    snake.serverY = payload.y ?? snake.serverY
    snake.velocityX = payload.vx ?? payload.velocityX ?? snake.velocityX ?? 0
    snake.velocityY = payload.vy ?? payload.velocityY ?? snake.velocityY ?? 0
    snake.lastServerAt = performance.now()
    if (typeof payload.x === 'number') {
      snake.predictedX = payload.x
    }
    if (typeof payload.y === 'number') {
      snake.predictedY = payload.y
    }
    snake.targetX = payload.x ?? snake.targetX
    snake.targetY = payload.y ?? snake.targetY
    snake.targetDir = typeof payload.angle === 'number' ? payload.angle : snake.targetDir
    snake.speed = typeof payload.speed === 'number' ? payload.speed : snake.speed
    if (typeof payload.bet === 'number') {
      snake.bet = payload.bet
    }
    if (typeof payload.betUsdCents === 'number') {
      snake.betUsdCents = Math.max(0, Math.floor(payload.betUsdCents))
    }
    if (segments.length) {
      snake.segments = segments
      this.smoothAssignPath(snake, segments)
    }
    this.state.snakes.set(id, snake)
  }

  rebuildPath(points: SnakePoint[], headX: number, headY: number, length: number, angle: number) {
    if (!Array.isArray(points) || points.length === 0) {
      return [{ x: headX, y: headY }]
    }
    const output: SnakePoint[] = []
    let remaining = length
    let prev = { x: headX, y: headY }
    for (let i = points.length - 1; i >= 0 && remaining > 0; i--) {
      const current = points[i]
      const dx = prev.x - current.x
      const dy = prev.y - current.y
      const segLen = Math.hypot(dx, dy)
      if (segLen <= LENGTH_EPS) continue
      if (remaining >= segLen) {
        output.push({ x: current.x, y: current.y })
        remaining -= segLen
        prev = current
      } else {
        const t = remaining / segLen
        output.push({ x: prev.x - dx * t, y: prev.y - dy * t })
        remaining = 0
        break
      }
    }
    output.push({ x: headX, y: headY })
    output.reverse()
    if (output.length < 2) {
      const offset = SEGMENT_SPACING
      output.unshift({ x: headX - Math.cos(angle) * offset, y: headY - Math.sin(angle) * offset })
    }
    return output
  }

  smoothAssignPath(snake: SnakeState, targetPath: SnakePoint[]) {
    const prev = snake.renderPath || []
    if (!prev.length) {
      snake.renderPath = targetPath.slice()
      return
    }
    const overlap = Math.min(prev.length, targetPath.length)
    const prevOffset = Math.max(0, prev.length - overlap)
    const targetOffset = Math.max(0, targetPath.length - overlap)
    const blended: SnakePoint[] = []

    for (let i = 0; i < targetOffset; i++) {
      const point = targetPath[i]
      blended.push({ x: point.x, y: point.y })
    }

    for (let i = 0; i < overlap; i++) {
      const prevPoint = prev[prevOffset + i]
      const targetPoint = targetPath[targetOffset + i]
      if (!prevPoint || !targetPoint) continue
      const mix = overlap > 1 ? i / (overlap - 1) : 1
      const headWeight = mix
      const tailWeight = 1 - headWeight
      const dynamicBlend = Math.min(
        0.72,
        RENDER_PATH_BLEND + headWeight * RENDER_PATH_HEAD_WEIGHT + tailWeight * RENDER_PATH_TAIL_WEIGHT
      )
      blended.push({
        x: lerp(prevPoint.x, targetPoint.x, dynamicBlend),
        y: lerp(prevPoint.y, targetPoint.y, dynamicBlend)
      })
    }

    const smoothed: SnakePoint[] = blended.map((point, index, array) => {
      if (index === 0 || index === array.length - 1) {
        return point
      }
      const prevPoint = array[index - 1]
      const nextPoint = array[index + 1]
      return {
        x: (prevPoint.x + point.x * 2 + nextPoint.x) / 4,
        y: (prevPoint.y + point.y * 2 + nextPoint.y) / 4
      }
    })

    if (targetPath.length && smoothed.length) {
      const head = targetPath[targetPath.length - 1]
      smoothed[smoothed.length - 1] = { x: head.x, y: head.y }
    } else if (targetPath.length && !smoothed.length) {
      const fallback = targetPath[targetPath.length - 1]
      smoothed.push({ x: fallback.x, y: fallback.y })
    }

    snake.renderPath = smoothed
    this.fitPathLength(snake.renderPath, Math.max(SEGMENT_SPACING * 2, snake.length || 0), SEGMENT_SPACING)
  }

  updateRenderHeadPosition(snake: SnakeState) {
    const path = snake.renderPath
    if (!Array.isArray(path) || path.length === 0) return
    const targetX = typeof snake.targetX === 'number' ? snake.targetX : path[path.length - 1]?.x
    const targetY = typeof snake.targetY === 'number' ? snake.targetY : path[path.length - 1]?.y
    if (typeof targetX !== 'number' || typeof targetY !== 'number') return
    const lastPoint = path[path.length - 1]
    if (!lastPoint) return
    const startX = lastPoint.x
    const startY = lastPoint.y
    const dx = targetX - startX
    const dy = targetY - startY
    const dist = Math.hypot(dx, dy)
    if (dist <= LENGTH_EPS) {
      lastPoint.x = targetX
      lastPoint.y = targetY
      this.fitPathLength(path, Math.max(SEGMENT_SPACING * 2, snake.length || 0), SEGMENT_SPACING)
      return
    }
    const maxSegments = 6
    const baseSpacing = Math.max(SEGMENT_SPACING * 0.7, LENGTH_EPS)
    const steps = Math.max(1, Math.min(maxSegments, Math.round(dist / baseSpacing)))
    if (dist <= baseSpacing) {
      lastPoint.x = targetX
      lastPoint.y = targetY
    } else {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        path.push({
          x: startX + dx * t,
          y: startY + dy * t
        })
      }
      const head = path[path.length - 1]
      head.x = targetX
      head.y = targetY
    }
    this.fitPathLength(path, Math.max(SEGMENT_SPACING * 2, snake.length || 0), SEGMENT_SPACING)
  }

  resamplePath(points: SnakePoint[], spacing: number) {
    if (!points || points.length < 2) return points || []
    const output = [{ x: points[0].x, y: points[0].y }]
    let prev = points[0]
    let carry = 0
    for (let i = 1; i < points.length; i++) {
      const current = points[i]
      let dx = current.x - prev.x
      let dy = current.y - prev.y
      let segLength = Math.hypot(dx, dy)
      if (segLength === 0) continue
      while (carry + segLength >= spacing) {
        const remain = spacing - carry
        const t = remain / segLength
        const nx = prev.x + dx * t
        const ny = prev.y + dy * t
        output.push({ x: nx, y: ny })
        prev = { x: nx, y: ny }
        dx = current.x - prev.x
        dy = current.y - prev.y
        segLength = Math.hypot(dx, dy)
        carry = 0
      }
      carry += segLength
      prev = current
    }
    const last = points[points.length - 1]
    if (output.length === 0 || output[output.length - 1].x !== last.x || output[output.length - 1].y !== last.y) {
      output.push({ x: last.x, y: last.y })
    }
    return output
  }

  normalizePathStart(points: SnakePoint[]) {
    if (!points) return
    while (points.length > 1) {
      const first = points[0]
      const second = points[1]
      if (!first || !second) break
      const segLen = Math.hypot(second.x - first.x, second.y - first.y)
      if (segLen <= LENGTH_EPS) {
        points.shift()
      } else {
        break
      }
    }
  }

  pathLength(points: SnakePoint[]) {
    if (!Array.isArray(points) || points.length < 2) return 0
    let total = 0
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const cur = points[i]
      total += Math.hypot(cur.x - prev.x, cur.y - prev.y)
    }
    return total
  }

  trimPathFront(points: SnakePoint[], amount: number) {
    if (!Array.isArray(points) || points.length < 2) return
    let remaining = amount
    while (remaining > LENGTH_EPS && points.length > 1) {
      this.normalizePathStart(points)
      if (points.length <= 1) break
      const first = points[0]
      const second = points[1]
      const dx = second.x - first.x
      const dy = second.y - first.y
      const segLen = Math.hypot(dx, dy)
      if (segLen <= LENGTH_EPS) {
        points.shift()
        continue
      }
      if (segLen <= remaining) {
        points.shift()
        remaining -= segLen
      } else {
        const ratio = remaining / segLen
        points[0] = {
          x: first.x + dx * ratio,
          y: first.y + dy * ratio
        }
        remaining = 0
      }
    }
  }

  fitPathLength(points: SnakePoint[], targetLength: number, spacing: number) {
    if (!Array.isArray(points) || points.length < 2) return
    const safeTarget = Math.max(targetLength || 0, SEGMENT_SPACING * 2)
    let total = this.pathLength(points)
    if (!Number.isFinite(total)) return
    if (total > safeTarget + SEGMENT_SPACING * 0.25) {
      const excess = total - safeTarget
      const trimStep = spacing * 6
      this.trimPathFront(points, Math.min(excess, trimStep))
    }
  }

  update(dt: number) {
    const smoothPos = Math.min(1, dt * POSITION_SMOOTH)
    const smoothAngle = Math.min(1, dt * ANGLE_SMOOTH)
    const now = performance.now()
    for (const snake of this.state.snakes.values()) {
      const vx = snake.velocityX || 0
      const vy = snake.velocityY || 0
      const dtSeconds = Math.max(0, dt)
      if (!Number.isFinite(snake.predictedX)) {
        snake.predictedX =
          (typeof snake.targetX === 'number' && Number.isFinite(snake.targetX))
            ? snake.targetX
            : typeof snake.serverX === 'number'
              ? snake.serverX
              : snake.displayX ?? 0
      }
      if (!Number.isFinite(snake.predictedY)) {
        snake.predictedY =
          (typeof snake.targetY === 'number' && Number.isFinite(snake.targetY))
            ? snake.targetY
            : typeof snake.serverY === 'number'
              ? snake.serverY
              : snake.displayY ?? 0
      }
      if (dtSeconds > 0 && (vx || vy)) {
        snake.predictedX += vx * dtSeconds
        snake.predictedY += vy * dtSeconds
      }
      if (typeof snake.serverX === 'number' && typeof snake.serverY === 'number') {
        const elapsed = Math.max(0, (now - (snake.lastServerAt || now)) / 1000)
        const projectionTime = Math.min(MAX_PREDICTION_SECONDS, elapsed)
        const projectedX = snake.serverX + vx * projectionTime
        const projectedY = snake.serverY + vy * projectionTime
        const drift = Math.hypot(projectedX - (snake.predictedX ?? 0), projectedY - (snake.predictedY ?? 0))
        if (drift > PREDICTION_SNAP_DISTANCE) {
          snake.predictedX = projectedX
          snake.predictedY = projectedY
        } else {
          const correctionStrength = 1 - Math.exp(-dtSeconds * PREDICTION_CORRECTION)
          if (correctionStrength > 0) {
            snake.predictedX = lerp(snake.predictedX ?? 0, projectedX, correctionStrength)
            snake.predictedY = lerp(snake.predictedY ?? 0, projectedY, correctionStrength)
          }
        }
        if (vx || vy) {
          const heading = Math.atan2(vy, vx)
          if (Number.isFinite(heading)) {
            snake.targetDir = heading
          }
        }
      }
      snake.targetX = snake.predictedX ?? snake.targetX
      snake.targetY = snake.predictedY ?? snake.targetY
      if (typeof snake.targetX === 'number' && typeof snake.targetY === 'number') {
        snake.displayX = typeof snake.displayX === 'number' ? lerp(snake.displayX, snake.targetX, smoothPos) : snake.targetX
        snake.displayY = typeof snake.displayY === 'number' ? lerp(snake.displayY, snake.targetY, smoothPos) : snake.targetY
      }
      if (typeof snake.targetDir === 'number') {
        snake.displayDir = typeof snake.displayDir === 'number'
          ? lerpAngle(snake.displayDir, snake.targetDir, smoothAngle)
          : snake.targetDir
      }
      snake.displayLength = lerp(snake.displayLength || snake.length || 20, snake.length || 20, smoothPos)
      if (Array.isArray(snake.segments) && snake.segments.length > 1) {
        const resampled = this.resamplePath(snake.segments, SEGMENT_SPACING)
        this.smoothAssignPath(snake, resampled)
      }
      this.updateRenderHeadPosition(snake)
    }
    for (const food of this.state.foods.values()) {
      food.displayX = typeof food.displayX === 'number' ? lerp(food.displayX, food.targetX, smoothPos) : food.targetX
      food.displayY = typeof food.displayY === 'number' ? lerp(food.displayY, food.targetY, smoothPos) : food.targetY
    }
    if (this.state.alive) {
      const me = this.getMeSnake()
      if (me && typeof me.displayX === 'number' && typeof me.displayY === 'number') {
        this.state.camera.targetX = me.displayX
        this.state.camera.targetY = me.displayY
      }
    }
    this.state.camera.x = lerp(this.state.camera.x, this.state.camera.targetX, Math.min(1, dt * CAMERA_SMOOTH))
    this.state.camera.y = lerp(this.state.camera.y, this.state.camera.targetY, Math.min(1, dt * CAMERA_SMOOTH))
  }

  draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, time: number, dpr: number) {
    const { camera, world } = this.state
    const width = canvas.width / dpr
    const height = canvas.height / dpr
    const zoom = camera.zoom
    drawBackground({ ctx, camX: camera.x, camY: camera.y, width, height, zoom, pattern: this.hexPattern, world })
    drawFoods({
      ctx,
      canvas,
      foods: this.state.foods,
      world,
      camX: camera.x,
      camY: camera.y,
      zoom,
      dpr,
      time,
      foodPulseSpeed: FOOD_PULSE_SPEED
    })
    drawSnakes({
      ctx,
      canvas,
      snakes: this.state.snakes,
      world,
      camX: camera.x,
      camY: camera.y,
      zoom,
      dpr,
      skins: SKINS,
      meId: this.state.meId
    })
  }

  drawMinimap(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dpr: number) {
    renderMinimap({
      ctx,
      canvas,
      foods: this.state.foods,
      snakes: this.state.snakes,
      world: this.state.world,
      dpr,
      skins: SKINS,
      meId: this.state.meId
    })
  }
}

const controller = new GameController()

export function useGame() {
  const [account, setAccount] = useState<AccountState>({ ...controller.getAccount() })
  const [snakes, setSnakes] = useState<Map<string, SnakeState>>(new Map(controller.getSnakes()))
  const [foods, setFoods] = useState<Map<string, FoodState>>(new Map(controller.getFoods()))
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([...controller.getLeaderboard()])
  const [ui, setUI] = useState<GameUIState>({ ...controller.getUI() })

  useEffect(() => {
    return controller.subscribe(() => {
      setAccount({ ...controller.getAccount() })
      setSnakes(new Map(controller.getSnakes()))
      setFoods(new Map(controller.getFoods()))
      setLeaderboard([...controller.getLeaderboard()])
      setUI({ ...controller.getUI() })
    })
  }, [])

  const skinName = useMemo(() => SKIN_LABELS[ui.selectedSkin] || ui.selectedSkin, [ui.selectedSkin])

  return {
    controller,
    account,
    snakes,
    foods,
    leaderboard,
    score: ui.score,
    scoreMeta: ui.scoreMeta,
    cashout: ui.cashout,
    boost: ui.boost,
    deathScreen: ui.death,
    cashoutScreen: ui.cashoutScreen,
    lastResult: ui.lastResult,
    transfer: ui.transfer,
    nicknameScreenVisible: ui.nicknameVisible,
    nickname: ui.nickname,
    nicknameLocked: ui.nicknameLocked,
    selectedSkin: ui.selectedSkin,
    skinName,
    betValue: ui.betValue,
    retryBetValue: ui.retryBetValue,
    touchControlsEnabled: ui.touchControlsEnabled,
    setNickname: (value: string) => controller.setNickname(value),
    setSelectedSkin: (skin: string) => controller.setSelectedSkin(skin),
    setBetValue: (value: string) => controller.setBetValue(value),
    setRetryBetValue: (value: string) => controller.setRetryBetValue(value),
    setNicknameVisible: (visible: boolean) => controller.setNicknameVisible(visible),
    clearLastResult: () => controller.clearLastResult()
  }
}
