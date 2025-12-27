const jwt = require('jsonwebtoken')
const User = require('../models/User')

/**
 * Initialize Socket.io with authentication
 * @param {Object} io - Socket.io server instance
 */
const initializeSocket = (io) => {
  // Authentication middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token
      
      if (!token) {
        // Allow connection without auth for public data
        socket.user = null
        return next()
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      
      if (user) {
        socket.user = user
      }
      
      next()
    } catch (error) {
      // Allow connection but without user
      socket.user = null
      next()
    }
  })

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}${socket.user ? ` (User: ${socket.user.email})` : ' (Guest)'}`)
    
    // Join user's personal room if authenticated
    if (socket.user) {
      socket.join(`user:${socket.user._id}`)
    }
    
    // Subscribe to coin price updates
    socket.on('subscribe:prices', (coinIds) => {
      if (Array.isArray(coinIds)) {
        coinIds.forEach(coinId => {
          socket.join(`coin:${coinId}`)
        })
        console.log(`📊 ${socket.id} subscribed to prices:`, coinIds)
      }
    })
    
    // Unsubscribe from coin prices
    socket.on('unsubscribe:prices', (coinIds) => {
      if (Array.isArray(coinIds)) {
        coinIds.forEach(coinId => {
          socket.leave(`coin:${coinId}`)
        })
      }
    })
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`)
    })
    
    // Send initial connection success
    socket.emit('connected', {
      message: 'Connected to CoinGecko server',
      authenticated: !!socket.user,
      userId: socket.user?._id
    })
  })

  // Return helper functions for emitting events
  return {
    // Emit to all connected clients
    emitPriceUpdate: (prices) => {
      io.emit('priceUpdate', prices)
    },
    
    // Emit to specific coin subscribers
    emitCoinPrice: (coinId, data) => {
      io.to(`coin:${coinId}`).emit('coinPrice', { coinId, ...data })
    },
    
    // Emit to specific user
    emitToUser: (userId, event, data) => {
      io.to(`user:${userId}`).emit(event, data)
    },
    
    // Emit portfolio update to user
    emitPortfolioUpdate: (userId, portfolio) => {
      io.to(`user:${userId}`).emit('portfolioUpdate', portfolio)
    }
  }
}

module.exports = initializeSocket
