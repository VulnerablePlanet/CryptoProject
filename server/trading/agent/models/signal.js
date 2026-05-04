/**
 * ============================================================================
 * SIGNAL MODEL - MongoDB Schema
 * ============================================================================
 * Records generated trading signals for auditing and backtesting
 */

const mongoose = require('mongoose')

const signalSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Signal type
  type: {
    type: String,
    enum: ['LONG', 'SHORT', 'NO_TRADE'],
    required: true
  },

  // Confidence score (0-100)
  confidence: {
    type: Number,
    min: 0,
    max: 100
  },

  // Decision made
  decision: {
    type: String,
    enum: ['NO_TRADE', 'LIMIT_ORDER', 'MARKET_ORDER']
  },

  // Scoring breakdown
  scoring: {
    technical: Number,
    regime: Number,
    sentiment: Number,
    orderBook: Number,
    onChain: Number,
    total: Number
  },

  // Technical indicators at signal time
  indicators: {
    rsi: Number,
    macdHistogram: Number,
    atr: Number,
    bbPercentB: Number,
    cci: Number,
    ema50: Number,
    ema200: Number
  },

  // Context
  context: {
    regime: String, // TRENDING_UP, TRENDING_DOWN, RANGING, HIGH_VOLATILITY
    mtfTrend: String,
    session: String,
    volatility: String
  },

  // Reasons/Explanation
  reasons: [{
    type: String
  }],

  // Price targets
  recommendedEntry: Number,
  recommendedSL: Number,
  recommendedTP: Number,

  // Research data snapshot
  research: {
    fearGreedValue: Number,
    fearGreedClassification: String,
    sentimentScore: Number,
    socialMetrics: mongoose.Schema.Types.Mixed
  },

  // Analysis data snapshot
  analysis: {
    levels: mongoose.Schema.Types.Mixed,
    patterns: mongoose.Schema.Types.Mixed
  },

  // If executed
  execution: {
    executed: Boolean,
    orderId: String,
    executedAt: Date,
    filledPrice: Number,
    filledAmount: Number
  },

  // Metadata
  cycleCount: Number,
  phase: String
}, {
  timestamps: true
})

// Compound index for queries
signalSchema.index({ symbol: 1, timestamp: -1 })
signalSchema.index({ type: 1, timestamp: -1 })
signalSchema.index({ decision: 1, timestamp: -1 })

module.exports = mongoose.model('Signal', signalSchema)