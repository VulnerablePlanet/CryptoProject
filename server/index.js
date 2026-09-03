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

const connectDB = require('./config/db')
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
const { startPriceService } = require('./services/priceService')
const talibRoutes = require('./routes/talib')
const predictionsRoutes = require('./routes/predictions')
const fibonacciCcxtRoutes = require('./routes/fibonacciCcxt')
const agentRoutes = require('./routes/agent')

const app = express()
const server = http.createServer(app)
const logger = createLogger('server')

// ============================================================================
// SECURITY MIDDLEWARE
// ============================================================================

// Helmet: sets 7+ security headers (X-Frame-Options, CSP, HSTS, etc.)
app.use(helmet())

// CORS configuration — require an explicit origin in production.
// In development, fall back to allowing any localhost port.
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  logger.error('CORS_ORIGIN must be set explicitly in production. Refusing to start.')
  process.exit(1)
}
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

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')))

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

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist', 'index.html'))
  })
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  })
})

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

const startServer = async () => {
  try {
    // Start listening immediately so Vite proxy doesn't get ECONNREFUSED
    server.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        socket: 'ready',
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
      })
    })
    
    // Connect to MongoDB (non-blocking for server startup)
    await connectDB()
    
    // Start price update service (requires DB)
    startPriceService(socketHelpers)
  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info('Shutdown signal received', { signal })
  
  server.close(() => {
    logger.info('HTTP server closed')
    
    // Close Socket.io connections
    io.close(() => {
      logger.info('Socket.io connections closed')
      
      // Close MongoDB connection
      const mongoose = require('mongoose')
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed')
        logger.info('Server shutdown complete')
        process.exit(0)
      })
    })
  })
  
  // Force close after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down')
    process.exit(1)
  }, 10000)
}

// Listen for termination signals (single handler — db.js duplicate removed)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

startServer()
