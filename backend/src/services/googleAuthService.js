const { OAuth2Client } = require('google-auth-library')
const fetch = require('node-fetch')
const { URLSearchParams } = require('url')
const { User } = require('../models/User')
const walletService = require('./walletService')
const { issueAuthResponse } = require('./authService')

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_AUTH_URI = process.env.GOOGLE_AUTH_URI
const GOOGLE_TOKEN_URI = process.env.GOOGLE_TOKEN_URI

const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID)

class GoogleAuthError extends Error {
  constructor(code, message) {
    super(message || code)
    this.name = 'GoogleAuthError'
    this.code = code
  }
}

function isConfigured() {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
}

function buildAuthorizationUrl({ state, redirectUri, loginHint }) {
  if (!isConfigured()) {
    throw new GoogleAuthError('google_not_configured')
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'offline',
    state
  })
  if (loginHint) {
    params.set('login_hint', loginHint)
  }
  return `${GOOGLE_AUTH_URI}?${params.toString()}`
}

async function exchangeCodeForTokens(code, redirectUri) {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  })
  const response = await fetch(GOOGLE_TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })
  if (!response.ok) {
    throw new GoogleAuthError('google_auth_failed', `Token exchange failed: ${response.status}`)
  }
  return response.json()
}

async function verifyIdToken(idToken) {
  try {
    const ticket = await oauthClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
    return ticket.getPayload()
  } catch (err) {
    throw new GoogleAuthError('google_auth_failed', err.message)
  }
}

function normalizeProfile(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new GoogleAuthError('google_auth_failed', 'Invalid token payload')
  }
  const sub = payload.sub
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null
  const emailVerified = payload.email_verified !== false
  if (!sub) {
    throw new GoogleAuthError('google_auth_failed', 'Missing Google user identifier')
  }
  if (!email || !emailVerified) {
    throw new GoogleAuthError('google_email_not_verified')
  }
  return {
    id: sub,
    email,
    name: payload.name || null,
    givenName: payload.given_name || null
  }
}

function sanitizeNicknameSource(value) {
  if (!value || typeof value !== 'string') return null
  const compact = value.trim().toLowerCase()
  if (!compact) return null
  const normalized = compact
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16)
  return normalized || null
}

async function generateNickname(profile) {
  const candidates = []
  const parts = [profile.givenName, profile.name]
  for (const part of parts) {
    const cleaned = sanitizeNicknameSource(part)
    if (cleaned) {
      candidates.push(cleaned)
    }
  }
  if (profile.email) {
    const localPart = profile.email.split('@')[0]
    const cleaned = sanitizeNicknameSource(localPart)
    if (cleaned) {
      candidates.push(cleaned)
    }
  }
  if (candidates.length === 0) {
    candidates.push('player')
  }
  const base = candidates[0]
  let attempt = 0
  while (attempt < 100) {
    const suffix = attempt === 0 ? '' : String(attempt + 1)
    const nickname = `${base}${suffix}`.slice(0, 16)
    const existing = await User.findOne({ where: { nickname } })
    if (!existing) {
      return nickname
    }
    attempt += 1
  }
  return `${base}${Date.now().toString().slice(-4)}`.slice(0, 16)
}

async function findOrCreateUser(profile) {
  let user = await User.findOne({ where: { googleId: profile.id } })
  if (!user && profile.email) {
    user = await User.findOne({ where: { email: profile.email } })
  }
  if (user) {
    let updated = false
    if (!user.googleId) {
      user.googleId = profile.id
      updated = true
    }
    if (!user.email && profile.email) {
      user.email = profile.email
      updated = true
    }
    if (updated) {
      await user.save({ fields: ['googleId', 'email'] })
    }
    await walletService.refreshUserBalance(user).catch(() => null)
    await user.reload()
    return user
  }
  const nickname = await generateNickname(profile)
  const wallet = await walletService.createUserWallet()
  const created = await User.create({
    email: profile.email,
    passwordHash: null,
    nickname,
    balance: 0,
    walletPublicKey: wallet.publicKey,
    walletSecretKey: wallet.secretKey,
    googleId: profile.id
  })
  await walletService.requestInitialAirdrop(created)
  await walletService.refreshUserBalance(created).catch(() => null)
  await created.reload()
  return created
}

async function authenticateWithGoogle(code, redirectUri) {
  if (!isConfigured()) {
    return { ok: false, error: 'google_not_configured' }
  }
  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri)
    if (!tokens || typeof tokens !== 'object' || !tokens.id_token) {
      throw new GoogleAuthError('google_auth_failed', 'Missing id_token')
    }
    const payload = await verifyIdToken(tokens.id_token)
    const profile = normalizeProfile(payload)
    const user = await findOrCreateUser(profile)
    const { token, user: sanitized } = issueAuthResponse(user)
    return { ok: true, token, user: sanitized }
  } catch (err) {
    const code = err instanceof GoogleAuthError && err.code ? err.code : 'google_auth_failed'
    if (code === 'google_auth_failed') {
      console.error('Google authentication failed', err)
    } else {
      console.warn('Google authentication error', err)
    }
    return { ok: false, error: code }
  }
}

module.exports = {
  isConfigured,
  buildAuthorizationUrl,
  authenticateWithGoogle
}
