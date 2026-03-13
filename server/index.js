require('dotenv').config()

const express = require('express')
const cors = require('cors')
const http = require('http')
const path = require('path')
const { Server } = require('socket.io')

const connectDB = require('./config/db')
const authRoutes = require('./routes/auth')
const portfolioRoutes = require('./routes/portfolio')
const transactionRoutes = require('./routes/transactions')
const watchlistRoutes = require('./routes/watchlist')
const notificationRoutes = require('./routes/notifications')
const pokemonRoutes = require('./routes/pokemon')
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

const app = express()
const server = http.createServer(app)

const parseAllowedOrigins = () => {
  const fromEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN
  if (!fromEnv) return ['http://localhost:5173']

  return fromEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
}

const allowedOrigins = parseAllowedOrigins()

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true
}

const io = new Server(server, {
  cors: corsOptions
})

app.use(cors(corsOptions))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
  }

  next()
})

app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:;")
  }
}))

const socketHelpers = initializeSocket(io)
app.set('socketHelpers', socketHelpers)

app.use('/api/auth', authRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/watchlist', watchlistRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/pokemon', pokemonRoutes)
app.use('/api/ohlc', ohlcRoutes)
app.use('/api/trading', tradingRoutes)
app.use('/api/fibonacci', fibonacciRoutes)
app.use('/api/exchange', exchangeRoutes)
app.use('/api/apikeys', apikeysRoutes)
app.use('/api/talib', talibRoutes)
app.use('/api/predictions', predictionsRoutes)
app.use('/api/fibonacci-ccxt', fibonacciCcxtRoutes)

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist', 'index.html'))
  })
}

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  })
})

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  })
})

app.use((err, req, res, next) => {
  console.error('Server error:', err)
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: err.message })
  }
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  })
})

const PORT = process.env.PORT || 5000

const startServer = async () => {
  try {
    await connectDB()

    server.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}\n📡 Socket.io ready\n🌐 CORS allowed origins: ${allowedOrigins.join(', ')}\n      `)
      startPriceService(socketHelpers)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`)

  server.close(() => {
    console.log('✅ HTTP server closed')

    io.close(() => {
      console.log('✅ Socket.io connections closed')

      const mongoose = require('mongoose')
      mongoose.connection.close(false, () => {
        console.log('✅ MongoDB connection closed')
        console.log('👋 Goodbye!')
        process.exit(0)
      })
    })
  })

  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down')
    process.exit(1)
  }, 10000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

startServer()
