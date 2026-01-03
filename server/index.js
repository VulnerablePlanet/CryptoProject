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
const initializeSocket = require('./socket')
const { startPriceService } = require('./services/priceService')

const app = express()
const server = http.createServer(app)

// Socket.io setup with CORS// CORS configuration - allow any localhost port in development
const corsOrigin = process.env.CORS_ORIGIN || /^http:\/\/localhost:\d+$/

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// Middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true
}))
app.use(express.json())
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
app.use('/api/pokemon', pokemonRoutes)
app.use('/api/ohlc', ohlcRoutes)
app.use('/api/trading', tradingRoutes)
app.use('/api/fibonacci', fibonacciRoutes)

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

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  })
})

// Start server
const PORT = process.env.PORT || 5000

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB()
    
    // Start listening
    server.listen(PORT, () => {
      console.log(`
🚀 Server running on port ${PORT}
📡 Socket.io ready
🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}
      `)
      
      // Start price update service
      startPriceService(socketHelpers)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
