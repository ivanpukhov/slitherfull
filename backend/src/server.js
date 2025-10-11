// src/server.js
require('dotenv').config()
const http = require('http')
const express = require('express')
const cors = require('cors')
const WebSocket = require('ws')
const {
    decode,
    encode,
    MSG_JOIN,
    MSG_INPUT,
    MSG_PING,
    MSG_PONG,
    MSG_SNAPSHOT,
    MSG_WELCOME,
    MSG_SET_BET,
    MSG_RESPAWN,
    MSG_CASHOUT_REQUEST,
    MSG_ERROR
} = require('./protocol')
const { World } = require('./world')
const { KillLogger } = require('./logger')
const { sequelize } = require('./db/sequelize')
const authRouter = require('./routes/auth')
const walletRouter = require('./routes/wallet')
const statsRouter = require('./routes/stats')
const friendsRouter = require('./routes/friends')
const adminRouter = require('./routes/admin')
const { verifyToken } = require('./services/authService')
const accountService = require('./services/accountService')
const walletService = require('./services/walletService')

const cfg = {
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,

    // map dimensions
    width: 2688,
    height: 2688,
    sectorSize: 128,

    // food
    initialFood: 450,
    targetFood: 700,
    foodSpawnChance: 0.55,
    foodPickupRadius: 26,
    deathScatterRadius: 140,
    deathFoodChunkValue: 14,
    bigFoodThreshold: 12,

    // snake
    headRadius: 8,
    bodyRadius: 6,
    baseLength: 100,
    minLength: 80,
    baseSpeed: 160,
    speedMinFactor: 0.42,
    speedLengthSoftCap: 500,
    speedLengthExponent: 0.65,
    boostMultiplier: 2.35,
    boostLengthDrain: 3,
    boostDropIntervalMs: 120,

    // tail
    pathPointSpacing: 6,
    maxPathPoints: 1200,
    segmentSpacing: 6, // ✨ distance between segments
    collisionQueryRadius: 300,
    segmentSampleStep: 3,

    // visibility
    viewRadius: 900,

    // gameplay
    tickRate: 40,
    snapshotRate: 15,
    maxTurn: 0.18,
    maxTurnRate: 7.2,
    inputMinIntervalMs: 10,

    // anti-spam & ping
    maxMsgsPerSec: 60,
    heartbeatIntervalMs: 10000,
    joinThrottleMs: 2000
}

const app = express()
const allowAllOrigins = !process.env.CLIENT_ORIGIN || process.env.CLIENT_ORIGIN === '*'
const allowedOrigins = allowAllOrigins
    ? '*'
    : process.env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)

app.use(cors({ origin: allowedOrigins, credentials: false }))
app.use(express.json())
app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})
app.use('/api/auth', authRouter)
app.use('/api/wallet', walletRouter)
app.use('/api/stats', statsRouter)
app.use('/api/friends', friendsRouter)
app.use('/api/admin', adminRouter)

const server = http.createServer(app)
const wss = new WebSocket.Server({ server })
const kills = new KillLogger()
const world = new World(cfg, kills, accountService)

const sockets = new Map()
const activeUsers = new Map()

function send(ws, obj) {
    if (ws.readyState === WebSocket.OPEN) ws.send(encode(obj))
}

function nowMs() {
    return Date.now()
}

wss.on('connection', (ws) => {
    ws.isAlive = true
    ws.lastJoinTs = 0

    ws.on('pong', () => {
        ws.isAlive = true
    })

    ws.on('message', (data) => {
        const msg = decode(data)
        if (!msg) return

        const entry = sockets.get(ws)

        if (msg.type === MSG_PING) {
            send(ws, { type: MSG_PONG, t: msg.t })
            return
        }

        ;(async () => {
            if (msg.type === MSG_JOIN) {
                const t = nowMs()
                if (t - ws.lastJoinTs < cfg.joinThrottleMs) return
                ws.lastJoinTs = t
                const token = typeof msg.token === 'string' ? msg.token : null
                if (!token) {
                    send(ws, { type: MSG_ERROR, code: 'auth_required' })
                    return
                }
                const authUser = await verifyToken(token)
                if (!authUser) {
                    send(ws, { type: MSG_ERROR, code: 'invalid_token' })
                    try { ws.close(4001, 'unauthorized') } catch (err) { /* ignore */ }
                    return
                }
                const userRecord = await accountService.getUserById(authUser.id)
                if (!userRecord) {
                    send(ws, { type: MSG_ERROR, code: 'auth_required' })
                    try { ws.close(4001, 'unauthorized') } catch (err) { /* ignore */ }
                    return
                }
                await walletService.refreshUserBalance(userRecord).catch(() => null)
                const balance = Math.max(0, Math.floor(userRecord.balance || 0))
                if (balance <= 0) {
                    send(ws, { type: MSG_ERROR, code: 'insufficient_balance' })
                    try { ws.close(4002, 'no_balance') } catch (err) { /* ignore */ }
                    return
                }
                const existingWs = activeUsers.get(userRecord.id)
                if (existingWs && existingWs !== ws) {
                    if (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING) {
                        send(ws, { type: MSG_ERROR, code: 'already_connected' })
                        try { ws.close(4003, 'already_connected') } catch (err) { /* ignore */ }
                        return
                    }
                    activeUsers.delete(userRecord.id)
                }
                const player = world.addPlayer(
                    ws,
                    userRecord.nickname || authUser.nickname || '',
                    msg.skin || '',
                    { userId: userRecord.id, balance, nickname: userRecord.nickname || authUser.nickname || '' }
                )
                sockets.set(ws, { playerId: player.id, userId: userRecord.id })
                activeUsers.set(userRecord.id, ws)
                send(ws, {
                    type: MSG_WELCOME,
                    id: player.id,
                    name: player.name,
                    width: cfg.width,
                    height: cfg.height,
                    radius: world.radius,
                    minLength: cfg.minLength,
                    baseLength: cfg.baseLength,
                    balance: Math.max(0, Math.floor(player.balance || 0)),
                    currentBet: Math.max(0, Math.floor(player.currentBet || 0))
                })
                return
            }

            if (!entry) return
            const { playerId } = entry
            const p = world.players.get(playerId)
            if (!p) return

            const now = nowMs()
            if (now - p.lastMsgWindowTs > 1000) {
                p.lastMsgWindowTs = now
                p.msgCountWindow = 0
            }
            p.msgCountWindow++
            if (p.msgCountWindow > cfg.maxMsgsPerSec) return

            if (msg.type === MSG_INPUT) world.handleInput(p, msg)
            if (msg.type === MSG_SET_BET) {
                const result = await world.placeBet(p, msg.amount)
                if (!result?.ok) {
                    send(ws, { type: MSG_ERROR, code: result?.error || 'bet_failed' })
                }
                return
            }
            if (msg.type === MSG_RESPAWN) {
                world.respawn(p)
                return
            }
            if (msg.type === MSG_CASHOUT_REQUEST) {
                const result = await world.cashOut(p)
                if (!result?.ok) {
                    send(ws, { type: MSG_ERROR, code: result?.error || 'cashout_failed' })
                } else {
                    setTimeout(() => {
                        try { ws.close(1000, 'cashout') } catch (err) { /* ignore */ }
                    }, 100)
                }
                return
            }
        })().catch((err) => {
            console.error('ws message error', err)
            send(ws, { type: MSG_ERROR, code: 'server_error' })
        })
    })

    ws.on('close', () => {
        const entry = sockets.get(ws)
        sockets.delete(ws)
        if (entry) {
            if (entry.playerId) world.removePlayer(entry.playerId)
            const activeWs = activeUsers.get(entry.userId)
            if (activeWs === ws) {
                activeUsers.delete(entry.userId)
            }
        }
    })
})

setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate()
        ws.isAlive = false
        ws.ping()
    })
}, cfg.heartbeatIntervalMs)

let lastTick = nowMs()
setInterval(() => {
    const now = nowMs()
    const dt = (now - lastTick) / 1000
    lastTick = now
    world.tick(dt)
}, Math.floor(1000 / cfg.tickRate))

setInterval(() => {
    // compute leaderboard by length
    const leaderboard = Array.from(world.players.values())
        .filter(p => p.alive)
        .sort((a, b) => b.length - a.length)
        .slice(0, 10)
        .map(p => ({
            name: p.name,
            length: Math.floor(p.length),
            bet: Math.max(0, Math.floor(p.currentBet || 0))
        }))

    for (const p of world.players.values()) {
        const aoi = world.aoiFor(p)
        send(p.ws, {
            type: MSG_SNAPSHOT,
            tick: world.tickId,
            you: {
                id: p.id,
                x: p.x,
                y: p.y,
                angle: p.angle,
                length: p.length,
                alive: p.alive,
                balance: Math.max(0, Math.floor(p.balance || 0)),
                currentBet: Math.max(0, Math.floor(p.currentBet || 0)),
                totalBalance: Math.max(0, Math.floor((p.balance || 0) + (p.currentBet || 0)))
            },
            players: aoi.players,
            foods: aoi.foods,
            leaderboard // 👈 added here
        })
    }
}, Math.floor(1000 / cfg.snapshotRate))


async function start() {
    try {
        await sequelize.sync({ force: false })
        await walletService.ensureGameWallet()
        server.listen(cfg.port)
    } catch (err) {
        console.error('Failed to start server', err)
        process.exit(1)
    }
}

start()
