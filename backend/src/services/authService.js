const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { User } = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

function sanitizeUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    balance: user.balance
  }
}

function createToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

async function registerUser({ email, password, nickname }) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const normalizedNickname = typeof nickname === 'string' ? nickname.trim() : ''
  if (!normalizedEmail || !normalizedNickname || typeof password !== 'string' || password.length < 6) {
    return { ok: false, error: 'invalid_payload' }
  }
  const existingEmail = await User.findOne({ where: { email: normalizedEmail } })
  if (existingEmail) {
    return { ok: false, error: 'email_taken' }
  }
  const existingNickname = await User.findOne({ where: { nickname: normalizedNickname } })
  if (existingNickname) {
    return { ok: false, error: 'nickname_taken' }
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    nickname: normalizedNickname,
    balance: 10
  })
  const token = createToken(user)
  return { ok: true, user: sanitizeUser(user), token }
}

async function loginUser({ email, password }) {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail || typeof password !== 'string' || password.length < 1) {
    return { ok: false, error: 'invalid_payload' }
  }
  const user = await User.findOne({ where: { email: normalizedEmail } })
  if (!user) {
    return { ok: false, error: 'invalid_credentials' }
  }
  const match = await bcrypt.compare(password, user.passwordHash)
  if (!match) {
    return { ok: false, error: 'invalid_credentials' }
  }
  const token = createToken(user)
  return { ok: true, user: sanitizeUser(user), token }
}

async function verifyToken(token) {
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    if (!payload?.id) return null
    const user = await User.findByPk(payload.id)
    return user ? sanitizeUser(user) : null
  } catch (err) {
    return null
  }
}

module.exports = {
  registerUser,
  loginUser,
  verifyToken,
  sanitizeUser
}
