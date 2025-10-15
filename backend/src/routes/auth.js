const express = require('express')
const crypto = require('crypto')
const { registerUser, loginUser, verifyToken, sanitizeUser } = require('../services/authService')
const { getUserById } = require('../services/accountService')
const {
  buildAuthorizationUrl,
  authenticateWithGoogle,
  isConfigured: isGoogleConfigured
} = require('../services/googleAuthService')

const GOOGLE_STATE_TTL_MS = 5 * 60 * 1000
const pendingGoogleStates = new Map()

const router = express.Router()

function cleanupGoogleStates() {
  const now = Date.now()
  for (const [state, entry] of pendingGoogleStates.entries()) {
    if (!entry || now - entry.createdAt > GOOGLE_STATE_TTL_MS) {
      pendingGoogleStates.delete(state)
    }
  }
}

function rememberGoogleState(state, meta) {
  cleanupGoogleStates()
  pendingGoogleStates.set(state, {
    createdAt: Date.now(),
    ...meta
  })
}

function consumeGoogleState(state) {
  if (!state) return null
  const entry = pendingGoogleStates.get(state)
  pendingGoogleStates.delete(state)
  return entry || null
}

function resolveBaseUrl(req) {
  const protoHeader = req.headers['x-forwarded-proto']
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : (protoHeader || req.protocol || 'http')
  const hostHeader = req.headers['x-forwarded-host']
  const host = Array.isArray(hostHeader) ? hostHeader[0] : (hostHeader || req.headers.host)
  return `${proto}://${host}`
}

function resolveRedirectUri(req) {
  const baseUrl = resolveBaseUrl(req)
  const basePath = `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+$/, '')
  if (basePath.endsWith('/callback')) {
    return `${baseUrl}${basePath}`
  }
  return `${baseUrl}${basePath}/callback`
}

function normalizeReturnOrigin(value) {
  if (!value || typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null
    }
    return `${url.protocol}//${url.host}`
  } catch (err) {
    return null
  }
}

function renderPopupResponse(res, targetOrigin, payload) {
  const safeOrigin = targetOrigin || '*'
  const message = JSON.stringify({ type: 'google-auth', ...payload })
  const originLiteral = JSON.stringify(safeOrigin)
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Authentication complete</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; text-align: center; }
      h1 { font-size: 20px; margin-bottom: 12px; }
      p { color: #555; }
    </style>
  </head>
  <body>
    <h1>Authentication complete</h1>
    <p>You can close this window.</p>
    <script>
      (function() {
        const payload = ${message};
        const targetOrigin = ${originLiteral};
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, targetOrigin === '*' ? '*' : targetOrigin);
            window.close();
          }
        } catch (err) {
          console.error('Failed to notify opener', err);
        }
      })();
    </script>
  </body>
</html>`
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(200).send(html)
}

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

function startGoogleAuth(req, res) {
  if (!isGoogleConfigured()) {
    return res.status(500).json({ error: 'google_not_configured' })
  }
  try {
    const state = crypto.randomBytes(16).toString('hex')
    const redirectUri = resolveRedirectUri(req)
    const returnTo = normalizeReturnOrigin(req.query.return_to)
    const loginHint = typeof req.query.login_hint === 'string' ? req.query.login_hint : undefined
    rememberGoogleState(state, { returnTo })
    const url = buildAuthorizationUrl({ state, redirectUri, loginHint })
    res.redirect(url)
  } catch (err) {
    console.error('Failed to initiate Google auth', err)
    res.status(500).json({ error: 'google_auth_failed' })
  }
}

async function completeGoogleAuth(req, res) {
  const state = typeof req.query.state === 'string' ? req.query.state : null
  const code = typeof req.query.code === 'string' ? req.query.code : null
  const error = typeof req.query.error === 'string' ? req.query.error : null
  const stored = consumeGoogleState(state)
  const redirectUri = resolveRedirectUri(req)
  const targetOrigin = stored?.returnTo || null
  if (!stored) {
    return renderPopupResponse(res, targetOrigin, { ok: false, error: 'google_state_invalid' })
  }
  if (error) {
    return renderPopupResponse(res, targetOrigin, { ok: false, error: 'google_auth_failed' })
  }
  if (!code) {
    return renderPopupResponse(res, targetOrigin, { ok: false, error: 'google_auth_failed' })
  }
  const result = await authenticateWithGoogle(code, redirectUri)
  if (!result.ok) {
    return renderPopupResponse(res, targetOrigin, { ok: false, error: result.error || 'google_auth_failed' })
  }
  return renderPopupResponse(res, targetOrigin, {
    ok: true,
    token: result.token,
    user: result.user
  })
}

router.get('/google', startGoogleAuth)
router.get('/google/callback', completeGoogleAuth)

// Alternate paths for deployments where /api/auth/google is intercepted before
// it reaches the backend (e.g. custom nginx rules).
router.get('/oauth/google', startGoogleAuth)
router.get('/oauth/google/callback', completeGoogleAuth)

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

module.exports = router
