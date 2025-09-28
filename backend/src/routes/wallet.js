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

module.exports = router
