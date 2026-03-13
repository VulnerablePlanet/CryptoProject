const jwt = require('jsonwebtoken')
const User = require('../models/User')

const MAX_SUBSCRIPTIONS_PER_SOCKET = 100

const initializeSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication required'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)

      if (!user) {
        return next(new Error('Invalid token'))
      }

      socket.user = user
      next()
    } catch (error) {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id} (User: ${socket.user.email})`)

    socket.join(`user:${socket.user._id}`)

    socket.on('subscribe:prices', (coinIds) => {
      if (!Array.isArray(coinIds)) return

      const normalized = coinIds
        .filter(c => typeof c === 'string')
        .map(c => c.trim())
        .filter(Boolean)
        .slice(0, MAX_SUBSCRIPTIONS_PER_SOCKET)

      normalized.forEach((coinId) => {
        socket.join(`coin:${coinId}`)
      })

      console.log(`📊 ${socket.id} subscribed to prices (${normalized.length})`)
    })

    socket.on('unsubscribe:prices', (coinIds) => {
      if (!Array.isArray(coinIds)) return

      coinIds
        .filter(c => typeof c === 'string')
        .map(c => c.trim())
        .filter(Boolean)
        .forEach((coinId) => {
          socket.leave(`coin:${coinId}`)
        })
    })

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} (${reason})`)
    })

    socket.emit('connected', {
      message: 'Connected to CoinGecko server',
      authenticated: true,
      userId: socket.user._id
    })
  })

  return {
    emitPriceUpdate: (prices) => {
      io.emit('priceUpdate', prices)
    },

    emitCoinPrice: (coinId, data) => {
      io.to(`coin:${coinId}`).emit('coinPrice', { coinId, ...data })
    },

    emitToUser: (userId, event, data) => {
      io.to(`user:${userId}`).emit(event, data)
    },

    emitPortfolioUpdate: (userId, portfolio) => {
      io.to(`user:${userId}`).emit('portfolioUpdate', portfolio)
    }
  }
}

module.exports = initializeSocket
