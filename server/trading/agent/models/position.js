/**
 * ============================================================================
 * POSITION MODEL - MongoDB Schema
 * ============================================================================
 * Tracks open and closed trading positions
 */

const mongoose = require('mongoose')

const positionSchema = new mongoose.Schema({
  // Position identification
  symbol: {
    type: String,
    required: true,
    index: true
  },
  side: {
    type: String,
    enum: ['LONG', 'SHORT'],
    required: true
  },

  // Entry
  entryPrice: {
    type: Number,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  openedAt: {
    type: Date,
    default: Date.now
  },

  // Exit (filled when closed)
  exitPrice: Number,
  closedAt: Date,
  exitReason: {
    type: String,
    enum: ['TP', 'SL', 'MANUAL', 'LIQUIDATION', 'UNKNOWN']
  },

  // Risk management
  stopLoss: Number,
  takeProfit: Number,
  riskAmount: Number,
  riskPercent: {
    type: Number,
    default: 0.01
  },

  // OCO order
  ocoGroupId: String,
  orderIds: {
    entry: String,
    stopLoss: String,
    takeProfit: String
  },

  // Status
  status: {
    type: String,
    enum: ['PENDING', 'OPEN', 'CLOSED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },

  // P&L
  realizedPnl: {
    type: Number,
    default: 0
  },
  unrealizedPnl: {
    type: Number,
    default: 0
  },
  pnlPercent: Number,

  // Scoring at entry
  scoring: {
    score: Number,
    decision: String,
    confidence: Number,
    reasons: [String]
  },

  // Exchange
  exchange: {
    type: String,
    default: 'binance'
  },

  // Timestamps
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Indexes for common queries
positionSchema.index({ status: 1, symbol: 1 })
positionSchema.index({ openedAt: -1 })
positionSchema.index({ side: 1, status: 1 })

// Virtual for current P&L calculation
positionSchema.virtual('currentPnl').get(function() {
  return this.realizedPnl + this.unrealizedPnl
})

// Ensure virtuals are included in JSON
positionSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model('Position', positionSchema)