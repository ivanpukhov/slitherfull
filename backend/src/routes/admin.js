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

module.exports = router
