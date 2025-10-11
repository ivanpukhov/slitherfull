const express = require('express')
const { verifyToken, sanitizeUser } = require('../services/authService')
const accountService = require('../services/accountService')

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
    const user = await accountService.getUserById(payload.id)
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
})

router.patch('/nickname', async (req, res) => {
  try {
    const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname : ''
    const updated = await accountService.updateNickname(req.user.id, nickname)
    if (!updated) {
      return res.status(404).json({ error: 'user_not_found' })
    }
    res.json({ status: 'ok', user: sanitizeUser(updated) })
  } catch (err) {
    const message = err?.message || 'nickname_update_failed'
    if (message === 'invalid_nickname') {
      return res.status(400).json({ error: 'invalid_nickname' })
    }
    if (message === 'nickname_taken') {
      return res.status(409).json({ error: 'nickname_taken' })
    }
    if (message === 'missing_user_id') {
      return res.status(401).json({ error: 'unauthorized' })
    }
    res.status(500).json({ error: 'nickname_update_failed' })
  }
})

module.exports = router
