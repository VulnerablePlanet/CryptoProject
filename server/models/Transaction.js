const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['buy', 'sell', 'transfer_in', 'transfer_out', 'deposit', 'withdraw'],
    required: true
  },
  coinId: {
    type: String,
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  coinName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  priceAtTransaction: {
    type: Number,
    required: true,
    min: 0
  },
  totalValue: {
    type: Number,
    required: true
  },
  fee: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  // For transfers
  fromAddress: {
    type: String,
    default: null
  },
  toAddress: {
    type: String,
    default: null
  },
  txHash: {
    type: String,
    default: null
  }
}, {
  timestamps: true
})

// Indexes for common queries
transactionSchema.index({ user: 1, createdAt: -1 })
transactionSchema.index({ user: 1, coinId: 1 })
transactionSchema.index({ user: 1, type: 1 })

// Virtual for displaying type as readable text
transactionSchema.virtual('typeLabel').get(function() {
  const labels = {
    buy: 'Buy',
    sell: 'Sell',
    transfer_in: 'Received',
    transfer_out: 'Sent',
    deposit: 'Deposit',
    withdraw: 'Withdrawal'
  }
  return labels[this.type] || this.type
})

// Include virtuals in JSON output
transactionSchema.set('toJSON', { virtuals: true })
transactionSchema.set('toObject', { virtuals: true })

const Transaction = mongoose.model('Transaction', transactionSchema)

module.exports = Transaction
