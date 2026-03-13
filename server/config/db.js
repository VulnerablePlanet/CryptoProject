const mongoose = require('mongoose')

mongoose.set('sanitizeFilter', true)

const connectDB = async () => {
  try {
    const isProduction = process.env.NODE_ENV === 'production'
    const mongoURI = isProduction ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_LOCAL
    
    console.log(`🔌 Connecting to MongoDB (${isProduction ? 'Production' : 'Local'})...`)

    if (!mongoURI) {
        throw new Error(`MongoDB URI not found for ${process.env.NODE_ENV} environment`)
    }

    const conn = await mongoose.connect(mongoURI)
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err)
    })
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected')
    })
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      console.log('MongoDB connection closed through app termination')
      process.exit(0)
    })
    
    return conn
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message)
    process.exit(1)
  }
}

module.exports = connectDB
