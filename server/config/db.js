const mongoose = require('mongoose')
const { createLogger } = require('../utils/logger')

const logger = createLogger('db')

const connectDB = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production'
    const mongoURI = isProduction ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_LOCAL
    
    logger.info('Connecting to MongoDB', {
      environment: isProduction ? 'production' : 'local'
    })

    if (!mongoURI) {
        throw new Error(`MongoDB URI not found for ${process.env.NODE_ENV} environment`)
    }

    const conn = await mongoose.connect(mongoURI)
    
    logger.info('MongoDB connected', { host: conn.connection.host })
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', err)
    })
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected')
    })
    
    return conn
  } catch (error) {
    logger.error('Error connecting to MongoDB', error)
    process.exit(1)
  }
}

module.exports = connectDB
