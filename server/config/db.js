const mongoose = require('mongoose')
const { createLogger } = require('../utils/logger')
const { isProduction, getMongoUri } = require('./env')

const logger = createLogger('db')

/**
 * Connect to MongoDB.
 *
 * Throws on failure instead of calling process.exit(): the caller owns the
 * process lifecycle and can shut down gracefully (close HTTP/socket first).
 */
const connectDB = async () => {
  const mongoURI = getMongoUri()

  logger.info('Connecting to MongoDB', {
    environment: isProduction() ? 'production' : 'local'
  })

  if (!mongoURI) {
    throw new Error(`MongoDB URI not found for ${process.env.NODE_ENV || 'development'} environment`)
  }

  const conn = await mongoose.connect(mongoURI)

  logger.info('MongoDB connected', { host: conn.connection.host })

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', err)
  })

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected')
  })

  return conn
}

/**
 * Whether the connected deployment supports multi-document transactions
 * (replica set or sharded cluster). Standalone servers do not.
 */
const supportsTransactions = async () => {
  if (mongoose.connection.readyState !== 1) return false
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 })
    return Boolean(hello.setName || hello.msg === 'isdbgrid')
  } catch {
    return false
  }
}

module.exports = connectDB
module.exports.supportsTransactions = supportsTransactions
