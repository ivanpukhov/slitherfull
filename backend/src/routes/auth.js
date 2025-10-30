const express = require('express')
const { registerUser, loginUser, verifyToken, sanitizeUser, changeNickname } = require('../services/authService')
const { getUserById } = require('../services/accountService')
const router = express.Router()

router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body || {}
    const result = await registerUser({ email, password, nickname })
    if (!result.ok) {
      return res.status(400).json({ error: result.error })
    }
    res.json({ token: result.token, user: result.user })
  } catch (err) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const result = await loginUser({ email, password })
    if (!result.ok) {
      return res.status(400).json({ error: result.error })
    }
    res.json({ token: result.token, user: result.user })
  } catch (err) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const user = await verifyToken(token)
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const freshUser = await getUserById(user.id)
    res.json({ user: sanitizeUser(freshUser || user) })
  } catch (err) {
    res.status(500).json({ error: 'server_error' })
  }
})

router.put('/nickname', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    const user = await verifyToken(token)
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const { nickname } = req.body || {}
    const result = await changeNickname(user.id, nickname)
    if (!result.ok) {
      const status = result.error === 'unauthorized' ? 401 : result.error === 'user_not_found' ? 404 : 400
      return res.status(status).json({ error: result.error })
    }
    const world = req.app.get('world')
    if (world && typeof world.updatePlayerNicknameByUserId === 'function') {
      try {
        world.updatePlayerNicknameByUserId(user.id, result.user.nickname)
      } catch (err) {
        console.warn('Failed to sync nickname with active players', err)
      }
    }
    res.json({ user: result.user })
  } catch (err) {
    res.status(500).json({ error: 'server_error' })
  }
})

module.exports = router
