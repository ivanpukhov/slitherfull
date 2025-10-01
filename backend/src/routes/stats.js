const express = require('express')
const statsService = require('../services/statsService')
const { verifyToken, sanitizeUser } = require('../services/authService')
const { User } = require('../models/User')

const router = express.Router()

router.get('/leaderboard', async (req, res) => {
  try {
    const data = await statsService.getWinningsLeaderboard()
    res.json({ status: 'ok', data })
  } catch (err) {
    res.status(500).json({ error: 'leaderboard_unavailable' })
  }
})

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
    const daysParam = Number.parseInt(req.query.days, 10)
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 180) : 30
    const stats = await statsService.getUserPayoutHistory(req.user.id, days)
    res.json({ status: 'ok', data: stats, user: sanitizeUser(req.user) })
  } catch (err) {
    res.status(500).json({ error: 'player_stats_failed' })
  }
})

module.exports = router
