/**
 * TRADE LOG MODEL - immutable record of every closed position.
 *
 * Referenced by phases/monitoring.js (processClosedPosition) but previously
 * had no schema, so `mongoose.model('TradeLog')` threw and no closed trade was
 * ever recorded.
 */

const mongoose = require('mongoose')

const tradeLogSchema = new mongoose.Schema({
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', index: true },
  symbol: { type: String, required: true, index: true },
  side: { type: String, enum: ['LONG', 'SHORT'], required: true },
  entryPrice: { type: Number, required: true },
  exitPrice: Number,
  size: { type: Number, required: true },
  realizedPnl: { type: Number, default: 0 },
  realizedPnlPct: { type: Number, default: 0 },
  exitReason: {
    type: String,
    enum: ['TP', 'SL', 'MANUAL', 'LIQUIDATION', 'KILL_SWITCH', 'UNKNOWN'],
    default: 'UNKNOWN'
  },
  status: { type: String, enum: ['WIN', 'LOSS', 'BREAKEVEN'], required: true },
  openedAt: Date,
  closedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

tradeLogSchema.index({ closedAt: -1 })

module.exports = mongoose.models.TradeLog || mongoose.model('TradeLog', tradeLogSchema)
