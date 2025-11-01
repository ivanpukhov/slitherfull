import { useEffect, useMemo, useState } from 'react'
import {
  formatNumber,
  sanitizeBetValue,
  lerp,
  lerpAngle,
  formatUsd,
  centsToUsdInput,
  BET_AMOUNTS_CENTS
} from '../utils/helpers'
import { HEX_PATTERN_TILE_WIDTH } from '../utils/hexTheme'
import { drawBackground, drawFoods, drawSnakes } from '../utils/drawing'
import { translate, useTranslation } from '../hooks/useTranslation'

export const SKINS: Record<string, string[]> = {
  default: ['#facc15'],
  emerald: ['#34d399'],
  crimson: ['#ef4444'],
  amber: ['#f59e0b'],
  violet: ['#a855f7'],
  obsidian: ['#475569'],
  mint: ['#14b8a6']
}

export const SKIN_LABELS: Record<string, string> = {
  default: 'game.skins.sky',
  emerald: 'game.skins.emerald',
  crimson: 'game.skins.crimson',
  amber: 'game.skins.amber',
  violet: 'game.skins.violet',
  obsidian: 'game.skins.obsidian',
  mint: 'game.skins.mint'
}

export const FOOD_PULSE_SPEED = 4.4
export const CAMERA_SMOOTH = 5.2
export const POSITION_SMOOTH = 14.5
export const ANGLE_SMOOTH = 11.5
export const CAMERA_ZOOM = 1.2
export const MAX_PREDICTION_SECONDS = 0.28
export const SEGMENT_SPACING = 4.6
export const LENGTH_EPS = 1e-3
export const CASHOUT_HOLD_MS = 2000
export const RENDER_PATH_BLEND = 0.26
const LOBBY_BACKGROUND_SPEED = 42
const LOBBY_BACKGROUND_RETURN_SPEED = 3.2

export interface AccountState {
  balance: number
  currentBet: number
  total: number
  cashedOut: boolean
}

export interface LeaderboardEntry {
  id?: string
  name: string
  length: number
  bet?: number
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
  balanceCents: number
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

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  ping: number
  jitter: number
  lowFps: boolean
  lastFrameAt: number
  lastBroadcast: number
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
  transfer: {
    pending: boolean
    message: string
  }
}

interface InternalState {
  snakes: Map<string, SnakeState>
  foods: Map<string, FoodState>
  leaderboard: LeaderboardEntry[]
  activePlayers: number
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
  cashoutHold: {
    start: number | null
    frame: number | null
    triggered: boolean
    source: 'pointer' | 'keyboard' | null
  }
  ui: GameUIState
  backgroundOffset: { x: number; y: number }
  performance: PerformanceMetrics
}

const initialAccount: AccountState = {
  balance: 0,
  currentBet: 0,
  total: 0,
  cashedOut: false
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
  scoreMeta: translate('game.score.defaultMeta'),
  cashout: {
    label: translate('game.cashout.label'),
    hint: translate('game.cashout.hint'),
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
    canRetry: false,
    balanceCents: 0
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
  betValue: '1',
  retryBetValue: '',
  transfer: {
    pending: false,
    message: ''
  }
}

const initialPerformance: PerformanceMetrics = {
  fps: 0,
  frameTime: 0,
  ping: 0,
  jitter: 0,
  lowFps: false,
  lastFrameAt: 0,
  lastBroadcast: 0
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
      activePlayers: 0,
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
      cashoutHold: { start: null, frame: null, triggered: false, source: null },
      ui: { ...initialUI },
      backgroundOffset: { x: 0, y: 0 },
      performance: { ...initialPerformance }
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

  setActivePlayers(count: number) {
    const sanitized = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
    if (sanitized === this.state.activePlayers) return
    this.state.activePlayers = sanitized
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

  setTransferState(pending: boolean, message?: string) {
    this.state.ui.transfer = {
      pending,
      message: message ?? (pending ? translate('game.transfer.pendingMessage') : '')
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
    if (typeof payload.cashedOut === 'boolean') next.cashedOut = payload.cashedOut
    this.state.account = next
    this.refreshCashoutState()
    this.notify()
  }

  sanitizeBet(value: string | number, max?: number) {
    return sanitizeBetValue(value, max ?? this.state.account.balance)
  }

  private refreshCashoutState(options?: Partial<CashoutControlState>) {
    const total = Math.max(0, this.state.account.total)
    const canCashOut =
      !this.state.account.cashedOut && !this.state.ui.cashout.pending && total > 0 && this.state.alive
    this.state.ui.cashout = {
      label:
        options?.label ??
        (this.state.account.cashedOut
          ? translate('game.cashout.cashedOutLabel')
          : this.state.ui.cashout.label || translate('game.cashout.label')),
      hint: this.state.account.cashedOut
        ? translate('game.cashout.cashedOutHint')
        : this.state.ui.cashout.pending
          ? translate('game.cashout.requestHint')
          : options?.hint ?? translate('game.cashout.hint'),
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
        remaining > 0
          ? translate('game.cashout.countdown', { seconds: (remaining / 1000).toFixed(1) })
          : translate('game.cashout.requestLabel')
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
      label: options?.preserveLabel
        ? this.state.ui.cashout.label
        : translate('game.cashout.label')
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
    this.state.alive = false
    this.state.ui.nicknameVisible = true
    this.state.ui.cashout = {
      label: translate('game.cashout.requestLabel'),
      hint: translate('game.cashout.requestHint'),
      disabled: true,
      holding: false,
      pending: true
    }
    this.state.ui.transfer = {
      pending: true,
      message: translate('game.cashout.transferMessage')
    }
    this.state.ui.lastResult = {
      title: translate('game.cashout.result.title'),
      details: [
        translate('game.cashout.result.line1'),
        translate('game.cashout.result.line2')
      ],
      showRetryControls: false,
      retryBalance: formatUsd(pendingBalance),
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

  getActivePlayers() {
    return this.state.activePlayers
  }

  getAccount() {
    return this.state.account
  }

  getUI() {
    return this.state.ui
  }

  getPerformance() {
    return this.state.performance
  }

  getMeSnake() {
    return this.state.meId ? this.state.snakes.get(this.state.meId) || null : null
  }

  updateScoreHUD(score: number) {
    const meSnake = this.getMeSnake()
    const speed = meSnake && meSnake.speed ? Math.max(0, Math.round(meSnake.speed)) : null
    const boostStatus = this.refreshBoostState()
    const boostLabel = boostStatus.allowed
      ? boostStatus.active
        ? translate('game.boost.on')
        : translate('game.boost.ready')
      : translate('game.boost.off')
    const rank = this.getRank()
    this.state.ui.score = score
    this.state.ui.scoreMeta = speed
      ? translate('game.score.metaWithSpeed', { rank, speed, boost: boostLabel })
      : translate('game.score.meta', { rank, boost: boostLabel })
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
    const killerName = payload?.killerName ? payload.killerName : translate('game.death.unknown')
    const score = typeof payload?.yourScore === 'number' ? payload.yourScore : 0
    const balance = Math.max(0, Math.floor(this.state.account.balance || 0))
    const betValue = balance > 0 ? this.sanitizeBet(this.state.ui.retryBetValue || balance, balance) : 0
    const details: string[] = [translate('game.death.scoreLine', { score: formatNumber(score) })]
    details.push(
      balance > 0
        ? translate('game.death.balanceRemaining', { amount: formatUsd(balance) })
        : translate('game.death.balanceDepleted')
    )
    this.state.ui.death = {
      visible: false,
      summary: translate('game.death.summary', { name: killerName }),
      score: translate('game.death.scoreLine', { score: formatNumber(score) }),
      balance:
        balance > 0
          ? translate('game.death.balanceRemaining', { amount: formatUsd(balance) })
          : translate('game.death.balanceDepleted'),
      showBetControl: balance > 0,
      betValue: balance > 0 ? centsToUsdInput(betValue) : '',
      betBalance: formatUsd(balance),
      canRetry: balance > 0,
      balanceCents: balance
    }
    this.state.ui.retryBetValue = balance > 0 ? centsToUsdInput(betValue) : ''
    this.state.ui.lastResult = {
      title: translate('game.death.summary', { name: killerName }),
      details,
      showRetryControls: balance > 0,
      retryBalance: formatUsd(balance),
      variant: 'death'
    }
    this.updateScoreHUD(0)
    this.refreshCashoutState({ label: translate('game.cashout.label'), pending: false, holding: false })
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
      label: translate('game.cashout.cashedOutLabel'),
      hint: translate('game.cashout.cashedOutHint'),
      disabled: true,
      holding: false,
      pending: false
    }
    this.state.ui.cashoutScreen = {
      visible: false,
      summary: translate('game.cashout.balanceSummary', { amount: formatUsd(safeBalance) })
    }
    this.state.ui.death.visible = false
    this.state.ui.retryBetValue = ''
    this.state.ui.lastResult = {
      title: translate('game.cashout.cashedOutLabel'),
      details: [translate('game.cashout.balanceSummary', { amount: formatUsd(safeBalance) })],
      showRetryControls: false,
      retryBalance: formatUsd(safeBalance),
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
        const bet = typeof entry.bet === 'number' ? Math.max(0, Math.floor(entry.bet)) : undefined
        entries.push({
          id: entry.id ? String(entry.id) : `${name}-${idx}`,
          name,
          length,
          bet
        })
      })
      this.state.leaderboard = entries
    }

    if (snapshot.you && typeof snapshot.you.length === 'number') {
      this.updateScoreHUD(Math.floor(snapshot.you.length))
    }

    if (typeof snapshot.activePlayers === 'number') {
      this.setActivePlayers(snapshot.activePlayers)
    }

    if (snapshot.you && typeof snapshot.you.alive === 'boolean') {
      const nextAlive = Boolean(snapshot.you.alive)
      if (nextAlive !== this.state.alive) {
        this.state.alive = nextAlive
        this.refreshCashoutState()
      }
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
          name: payload.name || existing?.name || translate('game.snake.anonymous'),
          alive: Boolean(payload.alive ?? existing?.alive ?? true),
          length: payload.length || existing?.length || 20,
          displayLength: existing?.displayLength || payload.length || 20,
          targetX: payload.x || existing?.targetX || 0,
          targetY: payload.y || existing?.targetY || 0,
          skin: payload.skin || existing?.skin || 'default',
          segments: segments.length ? segments : [{ x: payload.x || 0, y: payload.y || 0 }],
          renderPath: segments.length ? segments.slice() : [{ x: payload.x || 0, y: payload.y || 0 }],
          bet: typeof payload.bet === 'number' ? payload.bet : existing?.bet
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
    snake.targetX = payload.x ?? snake.targetX
    snake.targetY = payload.y ?? snake.targetY
    snake.targetDir = typeof payload.angle === 'number' ? payload.angle : snake.targetDir
    snake.speed = typeof payload.speed === 'number' ? payload.speed : snake.speed
    if (typeof payload.bet === 'number') {
      snake.bet = payload.bet
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
    const baseBlend = RENDER_PATH_BLEND
    const limit = Math.min(prev.length, targetPath.length)
    const blended: SnakePoint[] = []
    for (let i = 0; i < limit; i++) {
      const point = prev[i]
      const target = targetPath[i]
      const mix = limit > 1 ? i / (limit - 1) : 0
      const headBias = 1 - mix
      const dynamicBlend = Math.min(0.65, baseBlend + headBias * 0.32 + mix * 0.08)
      blended.push({
        x: lerp(point.x, target.x, dynamicBlend),
        y: lerp(point.y, target.y, dynamicBlend)
      })
    }
    for (let i = limit; i < targetPath.length; i++) {
      blended.push(targetPath[i])
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
      smoothed[smoothed.length - 1] = {
        x: targetPath[targetPath.length - 1].x,
        y: targetPath[targetPath.length - 1].y
      }
    } else if (targetPath.length && !smoothed.length) {
      const fallback = targetPath[targetPath.length - 1]
      smoothed.push({ x: fallback.x, y: fallback.y })
    }
    snake.renderPath = smoothed
    this.fitPathLength(snake.renderPath, Math.max(SEGMENT_SPACING * 2, snake.length || 0), SEGMENT_SPACING)
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
      this.trimPathFront(points, total - safeTarget)
    }
  }

  update(dt: number) {
    const smoothPos = 1 - Math.exp(-dt * POSITION_SMOOTH)
    const smoothAngle = 1 - Math.exp(-dt * ANGLE_SMOOTH)
    const now = performance.now()
    const background = this.state.backgroundOffset
    const tileWidth = Math.max(1, HEX_PATTERN_TILE_WIDTH)

    if (this.state.ui.nicknameVisible) {
      background.x = (background.x + LOBBY_BACKGROUND_SPEED * dt) % tileWidth
    } else if (Math.abs(background.x) > 1e-2) {
      const decay = Math.min(1, dt * LOBBY_BACKGROUND_RETURN_SPEED)
      background.x = lerp(background.x, 0, decay)
      if (Math.abs(background.x) < 0.1) {
        background.x = 0
      }
    } else {
      background.x = 0
    }
    background.y = 0

    for (const snake of this.state.snakes.values()) {
      // --- predict head position ---
      if (typeof snake.serverX === 'number' && typeof snake.serverY === 'number') {
        const elapsed = Math.max(
            0,
            Math.min(MAX_PREDICTION_SECONDS, (now - (snake.lastServerAt || now)) / 1000)
        )
        const vx = snake.velocityX || 0
        const vy = snake.velocityY || 0
        const predictedX = snake.serverX + vx * elapsed
        const predictedY = snake.serverY + vy * elapsed
        snake.targetX = predictedX
        snake.targetY = predictedY
        if (vx || vy) {
          const heading = Math.atan2(vy, vx)
          if (Number.isFinite(heading)) {
            snake.targetDir = heading
          }
        }
      }

      // --- smooth head position ---
      if (typeof snake.targetX === 'number' && typeof snake.targetY === 'number') {
        snake.displayX =
            typeof snake.displayX === 'number'
                ? lerp(snake.displayX, snake.targetX, smoothPos)
                : snake.targetX
        snake.displayY =
            typeof snake.displayY === 'number'
                ? lerp(snake.displayY, snake.targetY, smoothPos)
                : snake.targetY
      }

      // --- smooth heading ---
      if (typeof snake.targetDir === 'number') {
        snake.displayDir =
            typeof snake.displayDir === 'number'
                ? lerpAngle(snake.displayDir, snake.targetDir, smoothAngle)
                : snake.targetDir
      }

      // --- smooth length ---
      snake.displayLength = lerp(
          snake.displayLength || snake.length || 20,
          snake.length || 20,
          smoothPos
      )

      // --- record head history ---
      const headX = typeof snake.displayX === 'number' ? snake.displayX : snake.targetX
      const headY = typeof snake.displayY === 'number' ? snake.displayY : snake.targetY
      if (Number.isFinite(headX) && Number.isFinite(headY)) {
        if (!snake.headHistory) snake.headHistory = []
        snake.headHistory.push({ x: headX, y: headY })
        if (snake.headHistory.length > 600) {
          snake.headHistory.shift()
        }
      }

      // --- build tail from history ---
      if (snake.headHistory && snake.headHistory.length > 1) {
        const output: SnakePoint[] = []
        let remaining = Math.max(SEGMENT_SPACING * 2, snake.length || 0)
        let prev = snake.headHistory[snake.headHistory.length - 1]
        output.push(prev)

        for (let i = snake.headHistory.length - 2; i >= 0 && remaining > 0; i--) {
          const curr = snake.headHistory[i]
          const dx = prev.x - curr.x
          const dy = prev.y - curr.y
          const dist = Math.hypot(dx, dy)

          if (dist >= SEGMENT_SPACING) {
            output.push(curr)
            remaining -= dist
            prev = curr
          }
        }

        snake.renderPath = output.reverse()
      }
    }

    // --- food ---
    for (const food of this.state.foods.values()) {
      food.displayX =
          typeof food.displayX === 'number'
              ? lerp(food.displayX, food.targetX, smoothPos)
              : food.targetX
      food.displayY =
          typeof food.displayY === 'number'
              ? lerp(food.displayY, food.targetY, smoothPos)
              : food.targetY
    }

    // --- camera ---
    if (this.state.alive) {
      const me = this.getMeSnake()
      if (me && typeof me.displayX === 'number' && typeof me.displayY === 'number') {
        this.state.camera.targetX = me.displayX
        this.state.camera.targetY = me.displayY
      }
    }
    const cameraSmooth = 1 - Math.exp(-dt * CAMERA_SMOOTH)
    this.state.camera.x = lerp(this.state.camera.x, this.state.camera.targetX, cameraSmooth)
    this.state.camera.y = lerp(this.state.camera.y, this.state.camera.targetY, cameraSmooth)
  }

  updateFrameMetrics(frameSeconds: number) {
    if (!Number.isFinite(frameSeconds) || frameSeconds <= 0) return
    const stats = this.state.performance
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const frameMs = frameSeconds * 1000
    const fpsInstant = 1 / frameSeconds
    const smoothing = 1 - Math.exp(-Math.min(frameSeconds * 6, 4))
    stats.frameTime = stats.frameTime > 0 ? lerp(stats.frameTime, frameMs, smoothing) : frameMs
    stats.fps = stats.fps > 0 ? lerp(stats.fps, fpsInstant, smoothing) : fpsInstant
    stats.lowFps = stats.fps < 50
    stats.lastFrameAt = now
    if (!stats.lastBroadcast || now - stats.lastBroadcast >= 180) {
      stats.lastBroadcast = now
      this.notify()
    }
  }

  updateNetworkLatency(rttMs: number) {
    if (!Number.isFinite(rttMs) || rttMs <= 0) return
    const stats = this.state.performance
    const pingMs = rttMs / 2
    const smoothing = 0.25
    stats.ping = stats.ping > 0 ? lerp(stats.ping, pingMs, smoothing) : pingMs
    const deviation = Math.abs(pingMs - stats.ping)
    stats.jitter = stats.jitter > 0 ? lerp(stats.jitter, deviation, 0.2) : deviation
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (!stats.lastBroadcast || now - stats.lastBroadcast >= 150) {
      stats.lastBroadcast = now
      this.notify()
    }
  }

  resetNetworkLatency() {
    this.state.performance.ping = 0
    this.state.performance.jitter = 0
    this.state.performance.lastBroadcast = 0
    this.notify()
  }

  draw(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, time: number, dpr: number) {
    const { camera, world } = this.state
    const width = canvas.width / dpr
    const height = canvas.height / dpr
    const zoom = camera.zoom
    drawBackground({
      ctx,
      camX: camera.x,
      camY: camera.y,
      width,
      height,
      zoom,
      pattern: this.hexPattern,
      world,
      backgroundOffset: this.state.backgroundOffset
    })
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

}

const controller = new GameController()

export function useGame() {
  const { t } = useTranslation()
  const [account, setAccount] = useState<AccountState>({ ...controller.getAccount() })
  const [snakes, setSnakes] = useState<Map<string, SnakeState>>(new Map(controller.getSnakes()))
  const [foods, setFoods] = useState<Map<string, FoodState>>(new Map(controller.getFoods()))
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([...controller.getLeaderboard()])
  const [activePlayers, setActivePlayers] = useState<number>(controller.getActivePlayers())
  const [ui, setUI] = useState<GameUIState>({ ...controller.getUI() })
  const [performance, setPerformance] = useState<PerformanceMetrics>({ ...controller.getPerformance() })

  useEffect(() => {
    return controller.subscribe(() => {
      setAccount({ ...controller.getAccount() })
      setSnakes(new Map(controller.getSnakes()))
      setFoods(new Map(controller.getFoods()))
      setLeaderboard([...controller.getLeaderboard()])
      setActivePlayers(controller.getActivePlayers())
      setUI({ ...controller.getUI() })
      setPerformance({ ...controller.getPerformance() })
    })
  }, [])

  const skinName = useMemo(
    () => t(SKIN_LABELS[ui.selectedSkin] || 'game.skins.sky'),
    [t, ui.selectedSkin]
  )

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
    performance,
    activePlayers,
    setNickname: (value: string) => controller.setNickname(value),
    setSelectedSkin: (skin: string) => controller.setSelectedSkin(skin),
    setBetValue: (value: string) => controller.setBetValue(value),
    setRetryBetValue: (value: string) => controller.setRetryBetValue(value),
    setNicknameVisible: (visible: boolean) => controller.setNicknameVisible(visible),
    clearLastResult: () => controller.clearLastResult()
  }
}
