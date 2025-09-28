const express = require('express')
const walletService = require('../services/walletService')

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@tend.kz'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pia753!!'

const router = express.Router()

router.use((req, res, next) => {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Area"')
    return res.status(401).json({ error: 'unauthorized' })
  }
  const encoded = header.slice(6)
  let decoded = ''
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8')
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const [email, password] = decoded.split(':')
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  next()
})

router.get('/overview', async (req, res) => {
  try {
    const data = await walletService.getAdminOverview()
    res.json({ status: 'ok', data })
  } catch (err) {
    res.status(500).json({ error: 'admin_overview_failed' })
  }
})

router.post('/transfer', async (req, res) => {
  const { fromType, toType, fromUserId, toUserId, amount } = req.body || {}
  const normalizedAmount = Number(amount)
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    return res.status(400).json({ error: 'invalid_amount' })
  }
  try {
    let result = null
    if (fromType === 'game' && toType === 'user') {
      if (!toUserId) return res.status(400).json({ error: 'missing_destination_user_id' })
      result = await walletService.transferGameToUser(toUserId, normalizedAmount)
    } else if (fromType === 'user' && toType === 'game') {
      if (!fromUserId) return res.status(400).json({ error: 'missing_source_user_id' })
      result = await walletService.transferUserToGame(fromUserId, normalizedAmount)
    } else if (fromType === 'user' && toType === 'user') {
      if (!fromUserId || !toUserId) {
        return res.status(400).json({ error: 'missing_user_id' })
      }
      result = await walletService.transferUserToUser(fromUserId, toUserId, normalizedAmount)
    } else {
      return res.status(400).json({ error: 'unsupported_transfer_type' })
    }
    res.json({ status: 'ok', result })
  } catch (err) {
    const message = err?.message || 'transfer_failed'
    const status =
      message === 'insufficient_funds' || message.endsWith('_not_found') || message.startsWith('missing_') ||
      message === 'same_user_transfer'
        ? 400
        : 500
    res.status(status).json({ error: message })
  }
})

module.exports = router
