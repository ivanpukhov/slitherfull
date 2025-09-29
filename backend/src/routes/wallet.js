const express = require('express')
const { verifyToken, sanitizeUser } = require('../services/authService')
const walletService = require('../services/walletService')
const { User } = require('../models/User')

const router = express.Router()

router.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const payload = await verifyToken(token)
    if (!payload) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const user = await User.findByPk(payload.id)
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
})

router.get('/me', async (req, res) => {
  try {
    const profile = await walletService.getWalletProfile(req.user.id)
    const sanitized = sanitizeUser(req.user)
    res.json({ ...profile, user: sanitized })
  } catch (err) {
    res.status(500).json({ error: 'wallet_profile_failed' })
  }
})

router.post('/airdrop', async (req, res) => {
  try {
    const amount = Number(req.body?.amountSol || 0)
    const info = await walletService.requestUserAirdrop(req.user.id, amount > 0 ? amount : 1)
    const profile = await walletService.getWalletProfile(req.user.id)
    res.json({ status: 'ok', balance: profile, info })
  } catch (err) {
    if (err.message === 'invalid_amount') {
      res.status(400).json({ error: 'invalid_amount' })
    } else {
      res.status(500).json({ error: 'airdrop_failed' })
    }
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const profile = await walletService.getWalletProfile(req.user.id)
    res.json({ status: 'ok', balance: profile })
  } catch (err) {
    res.status(500).json({ error: 'wallet_refresh_failed' })
  }
})

router.post('/withdraw', async (req, res) => {
  try {
    const destination = typeof req.body?.destination === 'string' ? req.body.destination.trim() : ''
    if (!destination) {
      return res.status(400).json({ error: 'invalid_destination' })
    }
    const result = await walletService.transferUserToAddress(req.user.id, destination)
    const profile = await walletService.getWalletProfile(req.user.id)
    const solAmount = result?.sol ? Number(result.sol) : 0
    const message = Number.isFinite(solAmount) && solAmount > 0
      ? `Отправлено ${solAmount.toFixed(4)} SOL`
      : 'Вывод выполнен успешно'
    res.json({ status: 'ok', result: { ...result, message }, balance: profile })
  } catch (err) {
    const message = err?.message || 'withdraw_failed'
    const badRequestErrors = new Set(['invalid_destination', 'insufficient_funds'])
    const notFoundErrors = new Set(['user_not_found'])
    const status = badRequestErrors.has(message)
      ? 400
      : notFoundErrors.has(message)
        ? 404
        : 500
    res.status(status).json({ error: message === 'missing_user_id' ? 'unauthorized' : message || 'withdraw_failed' })
  }
})

module.exports = router
