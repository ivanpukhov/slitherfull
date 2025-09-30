// src/world.js
const { SpatialHash } = require('./spatial')
const { v4: randomUUID } = require('uuid')
const walletService = require('./services/walletService')
const solanaService = require('./services/solanaService')

const {
    MSG_BALANCE,
    MSG_CASHOUT_CONFIRMED,
    encode
} = require('./protocol')

const BET_ALLOWED_USD_CENTS = [100, 500, 2000]
const BET_CHUNK_USD_CENTS = 20
const PRICE_CACHE_TTL = 60_000

const SKIN_PRESETS = {
    default: ['#38bdf8'],
    emerald: ['#34d399'],
    crimson: ['#ef4444'],
    amber: ['#f59e0b'],
    violet: ['#a855f7'],
    obsidian: ['#475569'],
    mint: ['#14b8a6']
}

function rnd(a, b) { return a + Math.random() * (b - a) }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy }
function normalizeAngle(a) {
    let angle = a
    while (angle <= -Math.PI) angle += Math.PI * 2
    while (angle > Math.PI) angle -= Math.PI * 2
    return angle
}

function projectToCircle(cx, cy, radius, x, y) {
    const dx = x - cx
    const dy = y - cy
    const dist = Math.hypot(dx, dy)
    if (dist === 0) return { x: cx, y: cy }
    if (dist <= radius) return { x, y }
    const scale = radius / dist
    return {
        x: cx + dx * scale,
        y: cy + dy * scale
    }
}

function randomPointInCircle(cx, cy, radius) {
    const t = Math.random() * Math.PI * 2
    const r = radius * Math.sqrt(Math.random())
    return {
        x: cx + Math.cos(t) * r,
        y: cy + Math.sin(t) * r
    }
}

function resamplePath(points, spacing) {
    if (!points || points.length === 0) return []
    if (points.length === 1) return [{ x: points[0].x, y: points[0].y }]
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
    const tail = output[output.length - 1]
    if (!tail || tail.x !== last.x || tail.y !== last.y) {
        output.push({ x: last.x, y: last.y })
    }
    return output
}

function computePathLength(points) {
    let sum = 0
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const cur = points[i]
        sum += Math.hypot(cur.x - prev.x, cur.y - prev.y)
    }
    return sum
}

function ensurePathSeqCounter(player) {
    if (typeof player.pathSeqCounter !== 'number') {
        player.pathSeqCounter = -1
    }
    return player.pathSeqCounter
}

function makeSegment(player, x, y) {
    ensurePathSeqCounter(player)
    player.pathSeqCounter += 1
    return { x, y, seq: player.pathSeqCounter }
}

function trimPathToLength(player, maxLength) {
    if (!player.path || player.path.length === 0) return
    const target = Math.max(0, maxLength)
    while (player.path.length > 1 && player.pathLen > target) {
        const first = player.path[0]
        const second = player.path[1]
        const segLen = Math.hypot(second.x - first.x, second.y - first.y)
        if (!Number.isFinite(segLen) || segLen === 0) {
            player.path.shift()
            continue
        }
        const excess = player.pathLen - target
        if (excess >= segLen - 1e-6) {
            player.path.shift()
            player.pathLen -= segLen
            if (player.pathLen < 0) player.pathLen = 0
            continue
        }
        const ratio = excess / segLen
        const nx = first.x + (second.x - first.x) * ratio
        const ny = first.y + (second.y - first.y) * ratio
        player.path[0] = makeSegment(player, nx, ny)
        player.pathLen -= excess
        if (player.pathLen < 0) player.pathLen = 0
        break
    }
    const tail = player.path[0]
    player.tailSeq = tail ? tail.seq : player.pathSeqCounter
    player.tailX = tail ? tail.x : player.x
    player.tailY = tail ? tail.y : player.y
}

class World {
    constructor(cfg, killLogger, accountStore) {
        this.cfg = cfg
        this.killLogger = killLogger
        this.accountStore = accountStore
        this.players = new Map()
        this.foods = new Map()
        this.playerCells = new Map()
        this.foodCells = new Map()
        this.playerSpatial = new SpatialHash(cfg.sectorSize)
        this.foodSpatial = new SpatialHash(cfg.sectorSize)
        this.foodPalette = [
            '#ffd166', '#fca311', '#ff5e57', '#4cd137', '#00e5ff', '#7d5fff',
            '#ff8bd2', '#b7fbff', '#caffbf', '#fdffb6', '#ffd6a5', '#bdb2ff'
        ]
        this.nextFoodId = 1
        this.tickId = 0
        this.centerX = cfg.width / 2
        this.centerY = cfg.height / 2
        this.radius = Math.min(cfg.width, cfg.height) / 2
        this.maxTurnRate = typeof cfg.maxTurnRate === 'number'
            ? cfg.maxTurnRate
            : cfg.maxTurn * cfg.tickRate
        this.cachedUsdPrice = null
        this.cachedUsdPriceAt = 0
        this.history = []
        this.historyLimit = typeof cfg.historyLimit === 'number' ? cfg.historyLimit : 120

        for (let i = 0; i < cfg.initialFood; i++) this.spawnFood()
    }

    send(ws, payload) {
        if (!ws || ws.readyState !== 1) return
        try {
            ws.send(encode(payload))
        } catch (err) {
            // ignore send errors
        }
    }

    async ensureUsdPrice(force = false) {
        const now = Date.now()
        if (!force && this.cachedUsdPrice && now - this.cachedUsdPriceAt < PRICE_CACHE_TTL) {
            return this.cachedUsdPrice
        }
        try {
            const price = await solanaService.fetchSolPriceUsd()
            if (Number.isFinite(price) && price > 0) {
                this.cachedUsdPrice = price
                this.cachedUsdPriceAt = now
                return price
            }
        } catch (err) {
            // ignore fetch errors but keep previous cache if exists
        }
        return this.cachedUsdPrice
    }

    unitsToUsdCents(units) {
        const price = this.cachedUsdPrice
        if (!price || !Number.isFinite(price)) return null
        const lamports = Math.max(0, Math.floor(units || 0)) * walletService.LAMPORTS_PER_UNIT
        const usd = (lamports / solanaService.LAMPORTS_PER_SOL) * price
        if (!Number.isFinite(usd)) return null
        return Math.round(usd * 100)
    }

    notifyBalance(p) {
        if (!p || !p.ws) return
        const balance = Math.max(0, Math.floor(p.balance || 0))
        const currentBet = Math.max(0, Math.floor(p.currentBet || 0))
        const total = balance + currentBet
        const currentBetUsdCents = Math.max(0, Math.floor(p.currentBetUsdCents || 0))
        const balanceUsdCents = this.unitsToUsdCents(balance)
        const totalUsdCents = balanceUsdCents !== null ? balanceUsdCents + currentBetUsdCents : null
        this.send(p.ws, {
            type: MSG_BALANCE,
            balance,
            currentBet,
            total,
            balanceUsdCents,
            currentBetUsdCents,
            totalUsdCents
        })
    }

    skinPalette(skin) {
        return SKIN_PRESETS[skin] || SKIN_PRESETS.default
    }

    spawnFoodAt(x, y, value = 1, options = {}) {
        const pos = projectToCircle(this.centerX, this.centerY, this.radius, x, y)
        const id = "f" + (this.nextFoodId++)
        const palette = options.palette || this.foodPalette
        const color = options.color || palette[Math.floor(Math.random() * palette.length)]
        const big = Boolean(options.big)
        const createdAt = Date.now()
        const pulse = typeof options.pulse === 'number' ? options.pulse : Math.random() * Math.PI * 2
        const wagerUnits = Math.max(0, Math.floor(options.wagerUnits || 0))
        const wagerUsdCents = Math.max(0, Math.floor(options.wagerUsdCents || 0))
        const f = {
            id,
            x: pos.x,
            y: pos.y,
            v: value,
            color,
            big,
            pulse,
            createdAt,
            wagerUnits: wagerUnits > 0 ? wagerUnits : 0,
            wagerUsdCents: wagerUsdCents > 0 ? wagerUsdCents : 0
        }
        this.foods.set(id, f)
        const key = this.foodSpatial.add(id, f.x, f.y)
        this.foodCells.set(id, key)
    }

    spawnFood() {
        const p = randomPointInCircle(this.centerX, this.centerY, this.radius)
        this.spawnFoodAt(p.x, p.y, 1)
    }

    addPlayer(ws, name, skin, context = {}) {
        const id = randomUUID()
        const spawn = randomPointInCircle(this.centerX, this.centerY, this.radius * 0.95)
        const balance = Math.max(0, Math.floor(Number(context.balance ?? 0)))
        const nickname = typeof context.nickname === 'string' && context.nickname.trim()
            ? context.nickname.trim()
            : (typeof name === 'string' ? name : '')
        const p = {
            id,
            ws,
            name: nickname || "",
            skin: skin || "default",
            x: spawn.x,
            y: spawn.y,
            angle: rnd(0, Math.PI * 2),
            speed: this.cfg.baseSpeed,
            length: this.cfg.baseLength,
            alive: true,
            boost: false,
            pathSeqCounter: -1,
            path: [],
            pathLen: 0,
            pathCarry: 0,
            lastDrop: 0,
            lastSeenTick: 0,
            lastInputTs: 0,
            msgCountWindow: 0,
            lastMsgWindowTs: Date.now(),
            r: this.cfg.headRadius,
            balance,
            currentBet: 0,
            currentBetUsdCents: 0,
            cashedOut: false,
            userId: context.userId || null,
            pendingPathReset: true,
            pathRevision: 0,
            lastBroadcastSeq: -1,
            tailSeq: 0,
            tailX: spawn.x,
            tailY: spawn.y,
            vx: 0,
            vy: 0,
            lastClientTs: 0
        }
        const startSegment = makeSegment(p, spawn.x, spawn.y)
        p.path.push(startSegment)
        p.tailSeq = startSegment.seq
        p.lastBroadcastSeq = startSegment.seq
        p.dir = p.angle
        p.targetAngle = p.angle
        this.players.set(id, p)
        const key = this.playerSpatial.add(id, p.x, p.y)
        this.playerCells.set(id, key)
        return p
    }

    removePlayer(id) {
        const p = this.players.get(id)
        if (!p) return
        this.playerSpatial.removeKey(id, this.playerCells.get(id))
        this.playerCells.delete(id)
        this.players.delete(id)
    }

    respawn(p) {
        if (!p || p.cashedOut || p.alive) return
        const spawn = randomPointInCircle(this.centerX, this.centerY, this.radius * 0.95)
        p.x = spawn.x
        p.y = spawn.y
        p.angle = rnd(0, Math.PI * 2)
        p.targetAngle = p.angle
        p.dir = p.angle
        p.length = this.cfg.baseLength
        p.alive = true
        p.boost = false
        p.pathSeqCounter = -1
        p.path = []
        p.pathLen = 0
        p.pathCarry = 0
        const start = makeSegment(p, p.x, p.y)
        p.path.push(start)
        p.tailSeq = start.seq
        p.tailX = start.x
        p.tailY = start.y
        p.pendingPathReset = true
        p.pathRevision = (p.pathRevision || 0) + 1
        p.lastBroadcastSeq = start.seq
        p.r = this.cfg.headRadius
        const key = this.playerSpatial.add(p.id, p.x, p.y)
        this.playerCells.set(p.id, key)
    }

    handleInput(p, data) {
        if (!p || !p.alive || p.cashedOut) return
        const now = Date.now()
        if (now - p.lastInputTs < this.cfg.inputMinIntervalMs) return
        p.lastInputTs = now
        if (typeof data.angle === 'number') {
            const desired = normalizeAngle(data.angle)
            if (Number.isFinite(desired)) {
                p.targetAngle = desired
            }
        }
        if (typeof data.boost === 'boolean') {
            const canBoost = p.length > this.cfg.minLength + 1e-6
            p.boost = data.boost && canBoost
        }
        if (typeof data.timestamp === 'number' && Number.isFinite(data.timestamp)) {
            p.lastClientTs = data.timestamp
        }
    }

    stepMovement(dt) {
        for (const p of this.players.values()) {
            if (!p.alive) continue

            const prevX = p.x
            const prevY = p.y
            const desiredAngle = typeof p.targetAngle === 'number' ? p.targetAngle : p.angle
            const diff = normalizeAngle(desiredAngle - p.angle)
            const maxTurn = this.maxTurnRate * dt
            const turn = clamp(diff, -maxTurn, maxTurn)
            p.angle = normalizeAngle(p.angle + turn)

            // скорость
            const growth = Math.max(0, p.length - this.cfg.baseLength)
            const slowRatio = Math.pow(
                1 / (1 + growth / this.cfg.speedLengthSoftCap),
                this.cfg.speedLengthExponent
            )
            const lengthFactor = this.cfg.speedMinFactor + (1 - this.cfg.speedMinFactor) * slowRatio
            const baseSpeed = this.cfg.baseSpeed * lengthFactor
            const speed = p.boost ? baseSpeed * this.cfg.boostMultiplier : baseSpeed
            p.speed = speed

            // обновляем позицию головы
            p.x += Math.cos(p.angle) * speed * dt
            p.y += Math.sin(p.angle) * speed * dt
            p.dir = p.angle

            if (dt > 0) {
                p.vx = (p.x - prevX) / dt
                p.vy = (p.y - prevY) / dt
            } else {
                p.vx = 0
                p.vy = 0
            }

            // границы карты (круглый мир)
            const border = projectToCircle(this.centerX, this.centerY, Math.max(0, this.radius - p.r), p.x, p.y)
            p.x = border.x
            p.y = border.y

            // обновляем полилинию хвоста
            const spacing = this.cfg.segmentSpacing
            if (!Array.isArray(p.path) || p.path.length === 0) {
                const start = makeSegment(p, p.x, p.y)
                p.path = [start]
                p.pathLen = 0
                p.pathCarry = 0
                p.tailSeq = start.seq
                p.tailX = start.x
                p.tailY = start.y
            } else {
                const previousHead = p.path[p.path.length - 1]
                const dx = p.x - previousHead.x
                const dy = p.y - previousHead.y
                const distance = Math.hypot(dx, dy)
                if (distance > 0) {
                    let consumed = 0
                    while (p.pathCarry + (distance - consumed) >= spacing) {
                        const step = spacing - p.pathCarry
                        consumed += step
                        const t = consumed / distance
                        const nx = previousHead.x + dx * t
                        const ny = previousHead.y + dy * t
                        const seg = makeSegment(p, nx, ny)
                        p.path.push(seg)
                        p.pathLen += step
                        p.pathCarry = 0
                    }
                    const remainder = distance - consumed
                    if (remainder > 1e-6) {
                        p.pathCarry += remainder
                        p.pathLen += remainder
                    } else {
                        p.pathCarry = 0
                    }
                    const lastPoint = p.path[p.path.length - 1]
                    if (lastPoint) {
                        lastPoint.x = p.x
                        lastPoint.y = p.y
                    } else {
                        const seg = makeSegment(p, p.x, p.y)
                        p.path.push(seg)
                    }
                } else {
                    const headPoint = p.path[p.path.length - 1]
                    if (headPoint) {
                        headPoint.x = p.x
                        headPoint.y = p.y
                    } else {
                        const seg = makeSegment(p, p.x, p.y)
                        p.path.push(seg)
                    }
                }
            }

            // обрезаем хвост по целевой длине
            const desiredPathLength = Math.max(spacing * 2, p.length)
            trimPathToLength(p, desiredPathLength)

            // ограничитель (безопасность, если что-то пошло не так)
            if (p.path.length > this.cfg.maxPathPoints) {
                p.path = p.path.slice(p.path.length - this.cfg.maxPathPoints)
                p.pathLen = computePathLength(p.path)
                const tail = p.path[0]
                if (tail) {
                    p.tailSeq = tail.seq
                    p.tailX = tail.x
                    p.tailY = tail.y
                }
            }

            // буст — только ускоряет змею, без потери длины и выброса еды
            if (p.boost && p.length <= this.cfg.minLength + 1e-3) {
                p.boost = false
            }

            // радиус головы
            p.r =
                this.cfg.headRadius +
                Math.min(12, Math.sqrt(p.length) * 0.3)
        }
    }

    rebuildSpatial() {
        for (const [id, key] of this.playerCells) this.playerSpatial.removeKey(id, key)
        this.playerCells.clear()
        for (const p of this.players.values()) {
            const key = this.playerSpatial.add(p.id, p.x, p.y)
            this.playerCells.set(p.id, key)
        }
    }

    stepFoodPickup() {
        for (const p of this.players.values()) {
            if (!p.alive) continue
            const near = this.foodSpatial.query(p.x, p.y, this.cfg.foodPickupRadius)
            for (const id of near) {
                const f = this.foods.get(id)
                if (!f) continue
                if (dist2(p.x, p.y, f.x, f.y) <= this.cfg.foodPickupRadius * this.cfg.foodPickupRadius) {
                    this.foodSpatial.removeKey(id, this.foodCells.get(id))
                    this.foodCells.delete(id)
                    this.foods.delete(id)
                    p.length += f.v
                    if (f.wagerUnits > 0) {
                        const rewardUnits = Math.max(0, Math.floor(f.wagerUnits))
                        const rewardUsdCents = Math.max(0, Math.floor(f.wagerUsdCents || 0))
                        p.currentBet = Math.max(0, Math.floor(p.currentBet || 0)) + rewardUnits
                        p.currentBetUsdCents = Math.max(0, Math.floor(p.currentBetUsdCents || 0)) + rewardUsdCents
                        this.notifyBalance(p)
                    }
                    if (this.foods.size < this.cfg.targetFood) this.spawnFood()
                }
            }
        }
    }

    stepCollisions() {
        const candidates = []
        for (const p of this.players.values()) {
            if (!p.alive) continue
            const set = this.playerSpatial.query(p.x, p.y, this.cfg.collisionQueryRadius)
            candidates.length = 0
            for (const id of set) {
                if (id === p.id) continue
                const q = this.players.get(id)
                if (!q || !q.alive) continue
                candidates.push(q)
            }
            for (const q of candidates) {
                const step = this.cfg.segmentSampleStep
                for (let i = 0; i < q.path.length; i += step) {
                    const seg = q.path[i]
                    if (!seg) continue
                    const r = this.cfg.bodyRadius + Math.min(10, Math.sqrt(q.length) * 0.2)
                    if (dist2(p.x, p.y, seg.x, seg.y) <= (p.r + r) * (p.r + r)) {
                        this.kill(p, q)
                        break
                    }
                }
            }
        }
    }



    kill(victim, killer) {
        if (!victim.alive) return
        victim.alive = false
        victim.boost = false

        const dropPath = victim.path.slice()
        victim.path = []
        victim.pathLen = 0
        victim.pathCarry = 0
        victim.tailSeq = victim.pathSeqCounter
        victim.tailX = victim.x
        victim.tailY = victim.y

        const bountyUnits = Math.max(0, Math.floor(victim.currentBet || 0))
        const bountyUsdCents = Math.max(0, Math.floor(victim.currentBetUsdCents || 0))
        victim.currentBet = 0
        victim.currentBetUsdCents = 0

        const cellKey = this.playerCells.get(victim.id)
        this.playerSpatial.removeKey(victim.id, cellKey)
        this.playerCells.delete(victim.id)

        this.notifyBalance(victim)

        const totalValue = Math.max(1, Math.floor(victim.length))
        const palette = this.skinPalette(victim.skin)
        const anchors = dropPath.length ? dropPath : [{ x: victim.x, y: victim.y }]
        const spacing = Math.max(6, this.cfg.segmentSpacing * 1.1)
        const sampled = resamplePath(anchors, spacing)
        const points = sampled.length ? sampled : anchors
        const pieces = Math.max(1, Math.ceil(totalValue / this.cfg.deathFoodChunkValue))
        const stride = Math.max(1, Math.floor(points.length / pieces))

        let remaining = totalValue
        for (let i = points.length - 1; i >= 0 && remaining > 0; i -= stride) {
            const target = points[i]
            const base = Math.max(3, Math.round(totalValue / pieces))
            const value = Math.min(remaining, Math.round(base * rnd(0.8, 1.3)))
            const clamped = projectToCircle(this.centerX, this.centerY, this.radius, target.x, target.y)
            this.spawnFoodAt(clamped.x, clamped.y, value, {
                palette,
                big: value >= this.cfg.bigFoodThreshold
            })
            remaining -= value
        }

        let index = points.length - 1
        while (remaining > 0 && points.length) {
            const target = points[index]
            const clamped = projectToCircle(this.centerX, this.centerY, this.radius, target.x, target.y)
            const value = Math.min(remaining, 2)
            this.spawnFoodAt(clamped.x, clamped.y, value, { palette })
            remaining -= value
            index = (index - 1 + points.length) % points.length
        }

        if (bountyUnits > 0 && bountyUsdCents > 0) {
            this.scatterWagerFoods(points, bountyUnits, bountyUsdCents, palette)
        }

        this.killLogger.log({
            killer: killer ? killer.id : null,
            victim: victim.id,
            x: victim.x,
            y: victim.y,
            tick: this.tickId,
            victimLength: Math.floor(victim.length),
            killerLength: killer ? Math.floor(killer.length) : 0,
            reason: 'head_vs_body',
            bounty: bountyUnits,
            bountyUsdCents
        })

        if (victim.ws && victim.ws.readyState === 1) {
            this.send(victim.ws, {
                type: "death",
                killerName: killer ? killer.name : "",
                yourScore: Math.floor(victim.length)
            })
        }
    }

    scatterWagerFoods(points, totalUnits, totalUsdCents, palette) {
        const safeUnits = Math.max(0, Math.floor(totalUnits || 0))
        const safeUsd = Math.max(0, Math.floor(totalUsdCents || 0))
        if (safeUnits <= 0 || safeUsd <= 0) return
        const anchors = Array.isArray(points) && points.length
            ? points
            : [{ x: this.centerX, y: this.centerY }]
        const chunkCount = Math.max(1, Math.floor(safeUsd / BET_CHUNK_USD_CENTS))
        const sampled = anchors.length ? resamplePath(anchors, Math.max(6, this.cfg.segmentSpacing)) : anchors
        const distributionPoints = sampled.length ? sampled : anchors
        if (!distributionPoints.length) return
        const stride = Math.max(1, Math.floor(distributionPoints.length / chunkCount))
        const baseUnits = Math.floor(safeUnits / chunkCount)
        let remainderUnits = safeUnits - baseUnits * chunkCount
        let remainingUnits = safeUnits
        let remainingUsd = safeUsd
        let index = distributionPoints.length - 1
        for (let i = 0; i < chunkCount; i++) {
            const target = distributionPoints[index]
            const clamped = projectToCircle(this.centerX, this.centerY, this.radius, target.x, target.y)
            let unitsForPiece = baseUnits + (remainderUnits > 0 ? 1 : 0)
            if (remainderUnits > 0) remainderUnits--
            if (unitsForPiece <= 0) unitsForPiece = 1
            if (unitsForPiece > remainingUnits) unitsForPiece = remainingUnits
            const usdForPiece = i === chunkCount - 1
                ? remainingUsd
                : Math.min(BET_CHUNK_USD_CENTS, remainingUsd)
            remainingUsd = Math.max(0, remainingUsd - usdForPiece)
            const value = Math.max(4, Math.round(unitsForPiece * 1.5))
            this.spawnFoodAt(clamped.x, clamped.y, value, {
                palette,
                color: '#ffd700',
                big: true,
                wagerUnits: unitsForPiece,
                wagerUsdCents: usdForPiece
            })
            remainingUnits -= unitsForPiece
            index = (index - stride + distributionPoints.length) % distributionPoints.length
        }
    }

    async placeBet(p, amount) {
        if (!p || p.cashedOut) {
            return { ok: false, error: 'cashout' }
        }
        const raw = Number(amount)
        if (!Number.isFinite(raw)) {
            return { ok: false, error: 'invalid_amount' }
        }
        const usdCents = Math.round(raw * 100)
        if (!BET_ALLOWED_USD_CENTS.includes(usdCents)) {
            return { ok: false, error: 'invalid_amount' }
        }
        if (p.currentBet > 0) {
            return { ok: false, error: 'bet_exists' }
        }
        const price = await this.ensureUsdPrice()
        if (!price || !Number.isFinite(price) || price <= 0) {
            return { ok: false, error: 'price_unavailable' }
        }
        const solAmount = (usdCents / 100) / price
        const lamports = Math.max(1, Math.round(solanaService.LAMPORTS_PER_SOL * solAmount))
        const piecesRequired = Math.max(1, Math.round(usdCents / BET_CHUNK_USD_CENTS))
        const normalizedUsdCents = piecesRequired * BET_CHUNK_USD_CENTS
        const desiredUnitsRaw = Math.ceil(lamports / walletService.LAMPORTS_PER_UNIT)
        const desiredUnits = Math.max(piecesRequired, desiredUnitsRaw)
        const balance = Math.max(0, Math.floor(p.balance || 0))
        const finalBet = Math.min(desiredUnits, balance)
        if (finalBet <= 0) {
            return { ok: false, error: 'insufficient_balance' }
        }
        try {
            if (p.userId) {
                const refreshed = await walletService.transferUserToGame(p.userId, finalBet)
                if (refreshed && typeof refreshed.units === 'number') {
                    p.balance = Math.max(0, Math.floor(refreshed.units))
                } else {
                    p.balance = Math.max(0, balance - finalBet)
                }
            } else {
                p.balance = balance - finalBet
            }
        } catch (err) {
            return { ok: false, error: err.message === 'insufficient_funds' ? 'insufficient_balance' : 'transfer_failed' }
        }
        p.currentBet = finalBet
        p.currentBetUsdCents = normalizedUsdCents
        try {
            if (this.accountStore && p.userId) {
                await this.accountStore.updateBalance(p.userId, Math.max(0, Math.floor(p.balance)))
            }
        } catch (err) {
            if (p.userId) {
                try {
                    await walletService.transferGameToUser(p.userId, finalBet)
                } catch (transferErr) {
                    console.error('Failed to revert bet transfer', transferErr)
                }
            }
            p.balance = balance
            p.currentBet = 0
            return { ok: false, error: 'balance_persist_failed' }
        }
        await this.ensureUsdPrice(true)
        this.notifyBalance(p)
        return {
            ok: true,
            balance: Math.max(0, Math.floor(p.balance)),
            currentBet: Math.max(0, Math.floor(p.currentBet)),
            total: Math.max(0, Math.floor(p.balance + p.currentBet)),
            balanceUsdCents: this.unitsToUsdCents(p.balance),
            currentBetUsdCents: Math.max(0, Math.floor(p.currentBetUsdCents || 0))
        }
    }

    async cashOut(p) {
        if (!p || p.cashedOut) {
            return { ok: false, error: 'cashout' }
        }
        const refund = Math.max(0, Math.floor(p.currentBet || 0))
        const refundUsdCents = Math.max(0, Math.floor(p.currentBetUsdCents || 0))
        const prevBalance = Math.max(0, Math.floor(p.balance || 0))
        let finalBalance = refund > 0 ? prevBalance + refund : prevBalance
        try {
            if (p.userId && refund > 0) {
                const refreshed = await walletService.transferGameToUser(p.userId, refund, {
                    recordPayout: true,
                    metadata: { type: 'cashout', playerId: p.id }
                })
                if (refreshed && typeof refreshed.units === 'number') {
                    finalBalance = Math.max(0, Math.floor(refreshed.units))
                }
            }
        } catch (err) {
            return { ok: false, error: 'cashout_transfer_failed' }
        }
        p.balance = finalBalance
        try {
            if (this.accountStore && p.userId) {
                await this.accountStore.updateBalance(p.userId, Math.max(0, Math.floor(p.balance)))
            }
        } catch (err) {
            return { ok: false, error: 'balance_persist_failed' }
        }
        p.currentBet = 0
        p.currentBetUsdCents = 0
        p.cashedOut = true
        p.alive = false
        p.boost = false
        p.path = []
        p.pathLen = 0
        p.pathCarry = 0
        const cellKey = this.playerCells.get(p.id)
        this.playerSpatial.removeKey(p.id, cellKey)
        this.playerCells.delete(p.id)
        this.players.delete(p.id)
        await this.ensureUsdPrice(true)
        this.notifyBalance(p)
        if (p.ws) {
            this.send(p.ws, {
                type: MSG_CASHOUT_CONFIRMED,
                balance: finalBalance,
                balanceUsdCents: this.unitsToUsdCents(finalBalance),
                refundedUsdCents: refundUsdCents
            })
        }
        return {
            ok: true,
            balance: finalBalance,
            balanceUsdCents: this.unitsToUsdCents(finalBalance),
            refundedUsdCents: refundUsdCents
        }
    }

    tick(dt) {
        this.tickId++
        if (this.foods.size < this.cfg.targetFood && Math.random() < this.cfg.foodSpawnChance) this.spawnFood()
        this.stepMovement(dt)
        this.rebuildSpatial()
        this.stepFoodPickup()
        this.stepCollisions()
        this.recordHistory()
    }

    collectPathUpdates() {
        const updates = new Map()
        for (const p of this.players.values()) {
            if (!Array.isArray(p.path)) continue
            const lastSeq = typeof p.lastBroadcastSeq === 'number' ? p.lastBroadcastSeq : -1
            const pathSegments = []
            if (p.pendingPathReset) {
                for (const point of p.path) {
                    if (!point) continue
                    pathSegments.push({ x: point.x, y: point.y, seq: point.seq })
                }
            } else {
                for (const point of p.path) {
                    if (!point) continue
                    if (typeof point.seq === 'number' && point.seq > lastSeq) {
                        pathSegments.push({ x: point.x, y: point.y, seq: point.seq })
                    }
                }
            }
            const tail = p.path[0]
            const head = p.path[p.path.length - 1]
            const tailSeq = typeof p.tailSeq === 'number' ? p.tailSeq : tail ? tail.seq : p.pathSeqCounter
            const tailX = typeof p.tailX === 'number' ? p.tailX : tail ? tail.x : p.x
            const tailY = typeof p.tailY === 'number' ? p.tailY : tail ? tail.y : p.y
            const headSeq = head && typeof head.seq === 'number' ? head.seq : lastSeq
            updates.set(p.id, {
                path: {
                    segments: pathSegments,
                    tailSeq,
                    tailX,
                    tailY,
                    headSeq,
                    length: p.length,
                    revision: p.pathRevision || 0,
                    reset: Boolean(p.pendingPathReset)
                },
                velocityX: Number.isFinite(p.vx) ? p.vx : 0,
                velocityY: Number.isFinite(p.vy) ? p.vy : 0,
                speed: Number.isFinite(p.speed) ? p.speed : this.cfg.baseSpeed
            })
            if (head && typeof head.seq === 'number') {
                p.lastBroadcastSeq = head.seq
            }
            p.pendingPathReset = false
        }
        return updates
    }

    recordHistory() {
        if (!Array.isArray(this.history)) this.history = []
        const snapshot = {
            tick: this.tickId,
            time: Date.now(),
            players: []
        }
        for (const p of this.players.values()) {
            snapshot.players.push({
                id: p.id,
                x: p.x,
                y: p.y,
                angle: p.angle,
                length: p.length,
                alive: p.alive,
                tailSeq: p.tailSeq,
                headSeq: p.path && p.path.length ? p.path[p.path.length - 1].seq : p.lastBroadcastSeq,
                speed: p.speed
            })
        }
        this.history.push(snapshot)
        const limit = typeof this.historyLimit === 'number' ? this.historyLimit : 120
        while (this.history.length > limit) this.history.shift()
    }

    aoiFor(p, cache = null) {
        const r = this.cfg.viewRadius
        const px = p.x
        const py = p.y
        const players = []
        const foods = []
        const ps = this.playerSpatial.query(px, py, r)
        for (const id of ps) {
            const o = this.players.get(id)
            if (!o) continue
            if (!o.alive) continue
            if (dist2(px, py, o.x, o.y) <= r * r) {
                const cached = cache ? cache.get(o.id) : null
                const pathPayload = cached?.path || {
                    segments: [],
                    tailSeq: o.tailSeq,
                    tailX: o.tailX,
                    tailY: o.tailY,
                    headSeq: o.path && o.path.length ? o.path[o.path.length - 1].seq : o.lastBroadcastSeq,
                    length: o.length,
                    revision: o.pathRevision || 0,
                    reset: Boolean(o.pendingPathReset)
                }
                const velocityX = cached && Number.isFinite(cached.velocityX)
                    ? cached.velocityX
                    : Number.isFinite(o.vx)
                        ? o.vx
                        : Math.cos(o.dir || o.angle) * (o.speed || this.cfg.baseSpeed)
                const velocityY = cached && Number.isFinite(cached.velocityY)
                    ? cached.velocityY
                    : Number.isFinite(o.vy)
                        ? o.vy
                        : Math.sin(o.dir || o.angle) * (o.speed || this.cfg.baseSpeed)
                players.push({
                    id: o.id,
                    x: o.x,
                    y: o.y,
                    angle: o.angle,
                    length: o.length,
                    alive: o.alive,
                    name: o.name,
                    skin: o.skin,
                    path: pathPayload,
                    dir: o.dir || o.angle,
                    speed: cached?.speed || o.speed || this.cfg.baseSpeed,
                    velocityX,
                    velocityY,
                    bet: Math.max(0, Math.floor(o.currentBet || 0)),
                    betUsdCents: Math.max(0, Math.floor(o.currentBetUsdCents || 0))
                })
            }
        }
        const fs = this.foodSpatial.query(px, py, r)
        for (const id of fs) {
            const f = this.foods.get(id)
            if (!f) continue
            if (dist2(px, py, f.x, f.y) <= r * r) foods.push({
                id: f.id,
                x: f.x,
                y: f.y,
                v: f.v,
                color: f.color,
                big: f.big,
                pulse: f.pulse,
                createdAt: f.createdAt
            })
        }
        return { players, foods }
    }
}

module.exports = { World }
