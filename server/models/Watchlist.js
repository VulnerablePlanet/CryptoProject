const mongoose = require('mongoose')

const watchlistItemSchema = new mongoose.Schema({
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
  addedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  }
}, { _id: true })

const watchlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  coins: [watchlistItemSchema],
  // Price alerts associated with this watchlist
  alerts: [{
    coinId: {
      type: String,
      required: true
    },
    symbol: {
      type: String,
      required: true
    },
    targetPrice: {
      type: Number,
      required: true
    },
    condition: {
      type: String,
      enum: ['above', 'below'],
      required: true
    },
    active: {
      type: Boolean,
      default: true
    },
    triggered: {
      type: Boolean,
      default: false
    },
    triggeredAt: {
      type: Date,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
})

// Method to check if coin is in watchlist
watchlistSchema.methods.hasCoin = function(coinId) {
  return this.coins.some(c => c.coinId === coinId)
}

// Method to get active alerts
watchlistSchema.methods.getActiveAlerts = function() {
  return this.alerts.filter(a => a.active && !a.triggered)
}

const Watchlist = mongoose.model('Watchlist', watchlistSchema)

module.exports = Watchlist
