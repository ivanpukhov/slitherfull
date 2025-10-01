const express = require('express')
const friendService = require('../services/friendService')
const { verifyToken } = require('../services/authService')

const router = express.Router()

router.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const user = await verifyToken(token)
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
})

router.get('/', async (req, res) => {
  try {
    const data = await friendService.getOverview(req.user.id)
    res.json({ status: 'ok', data })
  } catch (err) {
    res.status(500).json({ error: 'friends_unavailable' })
  }
})

router.get('/search', async (req, res) => {
  try {
    const q = typeof req.query.query === 'string' ? req.query.query : ''
    const results = await friendService.searchUsers(q, req.user.id)
    res.json({ status: 'ok', results })
  } catch (err) {
    res.status(500).json({ error: 'search_failed' })
  }
})

router.post('/requests', async (req, res) => {
  try {
    const targetId = Number.parseInt(req.body?.targetId, 10)
    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ error: 'invalid_payload' })
    }
    const result = await friendService.sendRequest(req.user.id, targetId)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'request_failed' })
    }
    const overview = await friendService.getOverview(req.user.id)
    res.json({ status: 'ok', data: overview })
  } catch (err) {
    res.status(500).json({ error: 'request_failed' })
  }
})

router.post('/requests/:id/accept', async (req, res) => {
  try {
    const requestId = Number.parseInt(req.params.id, 10)
    if (!Number.isFinite(requestId)) {
      return res.status(400).json({ error: 'invalid_payload' })
    }
    const result = await friendService.acceptRequest(requestId, req.user.id)
    if (!result.ok) {
      return res.status(400).json({ error: result.error || 'request_failed' })
    }
    const overview = await friendService.getOverview(req.user.id)
    res.json({ status: 'ok', data: overview })
  } catch (err) {
    res.status(500).json({ error: 'request_failed' })
  }
})

module.exports = router
