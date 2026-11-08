const mongoose = require('mongoose')

const holdingSchema = new mongoose.Schema({
  coinId: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  avgBuyPrice: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, { _id: true })

const portfolioSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  holdings: [holdingSchema],
  totalInvested: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  // Concurrent read-modify-write of `holdings` (two requests for the same
  // user) used to lose updates silently; now the second save fails with a
  // VersionError and ledgerService retries it on fresh data.
  optimisticConcurrency: true
})

// Holding math lives in domain/portfolioLedger.js (single implementation)

const Portfolio = mongoose.model('Portfolio', portfolioSchema)

module.exports = Portfolio
