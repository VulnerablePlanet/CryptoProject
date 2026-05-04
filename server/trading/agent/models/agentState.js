/**
 * ============================================================================
 * AGENT STATE MODEL - MongoDB Schema
 * ============================================================================
 * Singleton document tracking agent's operational state and capital
 */

const mongoose = require('mongoose')

const agentStateSchema = new mongoose.Schema({
  // Singleton identifier
  agentId: {
    type: String,
    default: 'main',
    unique: true,
    immutable: true
  },

  // Capital tracking
  capital: {
    type: Number,
    default: 10000
  },
  peakCapital: {
    type: Number,
    default: 10000
  },
  dailyStartCapital: {
    type: Number,
    default: 10000
  },

  // Cycle tracking
  cycleCount: {
    type: Number,
    default: 0
  },
  lastCycleAt: Date,

  // State
  state: {
    type: String,
    default: 'IDLE'
  },
  symbols: [String],

  // Positions
  openPositions: [{
    symbol: String,
    positionId: mongoose.Schema.Types.ObjectId,
    side: String,
    entryPrice: Number,
    size: Number,
    openedAt: Date
  }],

  // Trade history (summary)
  tradeHistory: [{
    tradeId: mongoose.Schema.Types.ObjectId,
    symbol: String,
    side: String,
    pnl: Number,
    closedAt: Date
  }],

  // Win/Loss tracking
  consecutiveLosses: {
    type: Number,
    default: 0
  },
  totalTrades: {
    type: Number,
    default: 0
  },
  winningTrades: {
    type: Number,
    default: 0
  },
  losingTrades: {
    type: Number,
    default: 0
  },

  // Kill switch
  killSwitchActive: {
    type: Boolean,
    default: false
  },
  killReason: String,
  killSwitchTriggeredAt: Date,

  // Performance metrics
  performance: {
    dailyPnl: {
      type: Number,
      default: 0
    },
    weeklyPnl: {
      type: Number,
      default: 0
    },
    monthlyPnl: {
      type: Number,
      default: 0
    },
    winRate: {
      type: Number,
      default: 0
    },
    avgWin: {
      type: Number,
      default: 0
    },
    avgLoss: {
      type: Number,
      default: 0
    },
    sharpeRatio: {
      type: Number,
      default: 0
    }
  },

  // Configuration snapshot
  config: {
    cycleInterval: Number,
    riskPerTrade: Number,
    maxPositions: Number
  }
}, {
  timestamps: true
})

// Ensure singleton - only one agent state document
agentStateSchema.pre('save', function(next) {
  if (this.agentId !== 'main') {
    this.agentId = 'main'
  }
  next()
})

// Static method to get or create agent state
agentStateSchema.statics.getOrCreate = async function() {
  let state = await this.findOne({ agentId: 'main' })
  if (!state) {
    state = new this({ agentId: 'main' })
    await state.save()
  }
  return state
}

// Update win/loss stats
agentStateSchema.methods.recordTrade = async function(pnl) {
  this.totalTrades++
  if (pnl > 0) {
    this.winningTrades++
  } else if (pnl < 0) {
    this.losingTrades++
  }

  // Update win rate
  this.performance.winRate = this.winningTrades / this.totalTrades

  // Update averages
  if (pnl > 0) {
    const totalWins = this.performance.avgWin * (this.winningTrades - 1) + pnl
    this.performance.avgWin = totalWins / this.winningTrades
  } else if (pnl < 0) {
    const totalLosses = this.performance.avgLoss * (this.losingTrades - 1) + pnl
    this.performance.avgLoss = totalLosses / this.losingTrades
  }

  await this.save()
}

module.exports = mongoose.model('AgentState', agentStateSchema)