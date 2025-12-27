const mongoose = require('mongoose')

/**
 * Candle Schema - Optimized for time series data
 * Stores OHLCV (Open, High, Low, Close, Volume) candlestick data
 */
const candleSchema = new mongoose.Schema({
  // Coin identifier from CoinGecko (e.g., 'bitcoin', 'ethereum')
  coinId: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Quote currency (e.g., 'usd', 'eur')
  vsCurrency: {
    type: String,
    required: true,
    lowercase: true,
    default: 'usd'
  },
  
  // Timeframe of the candle
  timeframe: {
    type: String,
    required: true,
    enum: ['5m', '15m', '30m', '1h', '4h', '1d'],
    index: true
  },
  
  // Candle open timestamp (UTC)
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  
  // OHLCV data
  open: {
    type: Number,
    required: true
  },
  high: {
    type: Number,
    required: true
  },
  low: {
    type: Number,
    required: true
  },
  close: {
    type: Number,
    required: true
  },
  volume: {
    type: Number,
    default: 0
  },
  
  // Metadata
  priceChange: {
    type: Number,
    default: 0
  },
  priceChangePercent: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
})

// Compound unique index to prevent duplicate candles
candleSchema.index(
  { coinId: 1, vsCurrency: 1, timeframe: 1, timestamp: 1 },
  { unique: true }
)

// Index for efficient range queries
candleSchema.index({ coinId: 1, timeframe: 1, timestamp: -1 })

/**
 * Get the latest candle for a coin/timeframe combination
 */
candleSchema.statics.getLatestCandle = async function(coinId, timeframe, vsCurrency = 'usd') {
  return this.findOne({ coinId, timeframe, vsCurrency })
    .sort({ timestamp: -1 })
    .lean()
}

/**
 * Get candles within a time range
 */
candleSchema.statics.getCandlesInRange = async function(
  coinId,
  timeframe,
  vsCurrency = 'usd',
  from = null,
  to = null,
  limit = 100
) {
  const query = { coinId, timeframe, vsCurrency }
  
  if (from || to) {
    query.timestamp = {}
    if (from) query.timestamp.$gte = new Date(from)
    if (to) query.timestamp.$lte = new Date(to)
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
}

/**
 * Upsert multiple candles (prevents duplicates)
 */
candleSchema.statics.upsertCandles = async function(candles) {
  if (!candles || candles.length === 0) return { inserted: 0, modified: 0 }
  
  const operations = candles.map(candle => ({
    updateOne: {
      filter: {
        coinId: candle.coinId,
        vsCurrency: candle.vsCurrency,
        timeframe: candle.timeframe,
        timestamp: candle.timestamp
      },
      update: { $set: candle },
      upsert: true
    }
  }))
  
  const result = await this.bulkWrite(operations, { ordered: false })
  
  return {
    inserted: result.upsertedCount,
    modified: result.modifiedCount,
    total: candles.length
  }
}

/**
 * Get candle count for a coin
 */
candleSchema.statics.getCandleCount = async function(coinId, timeframe, vsCurrency = 'usd') {
  return this.countDocuments({ coinId, timeframe, vsCurrency })
}

const Candle = mongoose.model('Candle', candleSchema)

module.exports = Candle
