/**
 * Crypto Market Anomaly Detector — Backend Server
 * Copyright (C) 2026 VulnerablePlanet
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const cors = require('cors')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')
const { createLogger } = require('./utils/logger')

const mongoose = require('mongoose')
const connectDB = require('./config/db')
const { validateConfig, getUploadsRoot, isProduction } = require('./config/env')
const authRoutes = require('./routes/auth')
const portfolioRoutes = require('./routes/portfolio')
const transactionRoutes = require('./routes/transactions')
const watchlistRoutes = require('./routes/watchlist')
const notificationRoutes = require('./routes/notifications')
const ohlcRoutes = require('./routes/ohlc')
const tradingRoutes = require('./routes/trading')
const fibonacciRoutes = require('./routes/fibonacci')
const exchangeRoutes = require('./routes/exchange')
const apikeysRoutes = require('./routes/apikeys')
const initializeSocket = require('./socket')
const { startPriceService, stopPriceService } = require('./services/priceService')
const { shutdownAgent } = require('./trading/agent/runtime')
const talibRoutes = require('./routes/talib')
const predictionsRoutes = require('./routes/predictions')
const fibonacciCcxtRoutes = require('./routes/fibonacciCcxt')
const agentRoutes = require('./routes/agent')
const coingeckoRoutes = require('./routes/coingecko')

const app = express()
const server = http.createServer(app)
const logger = createLogger('server')

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Fail fast on missing/invalid configuration (JWT secret, DB URI, CORS…)
const { errors: configErrors, warnings: configWarnings } = validateConfig()
configWarnings.forEach((warning) => logger.warn(warning))
if (configErrors.length > 0) {
  configErrors.forEach((error) => logger.error(`Invalid configuration: ${error}`))
  logger.error('Refusing to start with invalid configuration')
  process.exit(1)
}

// Helmet: sets 7+ security headers (X-Frame-Options, CSP, HSTS, etc.)
// CSP allows the CoinGecko image CDNs (coin logos come from API responses)
// and Google Fonts, which the SPA loads from index.html.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'img-src': ["'self'", 'data:', 'https://assets.coingecko.com', 'https://coin-images.coingecko.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com']
    }
  }
}))

// CORS — explicit origin in production (validated above); any localhost
// port in development.
const corsOrigin = process.env.CORS_ORIGIN || /^http:\/\/localhost:\d+$/

// Global rate limiter — 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
})
app.use(globalLimiter)

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// Standard middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true
}))

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Serve user uploads (UPLOADS_DIR, see config/env.js)
app.use('/uploads', express.static(getUploadsRoot()))

// Initialize Socket.io
const socketHelpers = initializeSocket(io)
app.set('socketHelpers', socketHelpers)

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/watchlist', watchlistRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/ohlc', ohlcRoutes)
app.use('/api/trading', tradingRoutes)
app.use('/api/fibonacci', fibonacciRoutes)
app.use('/api/exchange', exchangeRoutes)
app.use('/api/apikeys', apikeysRoutes)
app.use('/api/talib', talibRoutes)
app.use('/api/predictions', predictionsRoutes)
app.use('/api/fibonacci-ccxt', fibonacciCcxtRoutes)
app.use('/api/agent', agentRoutes)
app.use('/api/coingecko', coingeckoRoutes)

// Health checks — registered BEFORE the SPA fallback so they are never shadowed.
// Liveness: the process is up.
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  })
})

// Readiness: dependencies needed to serve traffic are available.
app.get('/api/health/ready', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1
  res.status(dbReady ? 200 : 503).json({
    success: dbReady,
    checks: { db: dbReady ? 'ok' : 'unavailable' },
    timestamp: new Date().toISOString()
  })
})

// Serve frontend in production
if (isProduction()) {
  const distDir = path.join(__dirname, '../dist')
  app.use(express.static(distDir))

  // SPA fallback for client-side routes. Express 5 (path-to-regexp v8) no
  // longer accepts the bare '*' wildcard — it threw at startup. API paths
  // fall through to the JSON 404 below instead of returning index.html.
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  })
})

// Error handler (sanitized — no stack traces in production)
app.use((err, req, res, _next) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.error('Server error', err)
  }
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  })
})

// Start server
const PORT = process.env.PORT || 5000

let shuttingDown = false

/**
 * Graceful shutdown: stop background work, close sockets/HTTP, then MongoDB.
 * (Mongoose 9's connection.close() no longer accepts a callback; the old
 * callback-style call rejected and the process exited with code 1.)
 */
const gracefulShutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return
  shuttingDown = true
  logger.info('Shutdown signal received', { signal })

  // Force exit if shutdown hangs
  const forceTimer = setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down')
    process.exit(1)
  }, 10000)
  forceTimer.unref()

  try {
    stopPriceService()
    await shutdownAgent()
    await new Promise((resolve) => io.close(() => resolve()))
    await new Promise((resolve) => {
      if (!server.listening) return resolve()
      server.close(() => resolve())
    })
    logger.info('HTTP server and Socket.io closed')
    await mongoose.connection.close()
    logger.info('MongoDB connection closed')
    logger.info('Server shutdown complete')
    process.exit(exitCode)
  } catch (error) {
    logger.error('Error during shutdown', error)
    process.exit(1)
  }
}

const startServer = async () => {
  // Start listening immediately so the Vite proxy doesn't get ECONNREFUSED
  server.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      socket: 'ready',
      corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
    })
  })

  try {
    await connectDB()
    // Start price update service (requires DB)
    startPriceService(socketHelpers)
  } catch (error) {
    logger.error('Failed to start server', error)
    await gracefulShutdown('startup-failure', 1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

startServer()
