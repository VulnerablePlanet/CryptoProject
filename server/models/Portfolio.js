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
  timestamps: true
})

// Method to add or update a holding
portfolioSchema.methods.addHolding = function(coinData, amount, buyPrice) {
  const existingIndex = this.holdings.findIndex(h => h.coinId === coinData.id)
  
  if (existingIndex >= 0) {
    // Update existing holding
    const existing = this.holdings[existingIndex]
    const totalCost = (existing.amount * existing.avgBuyPrice) + (amount * buyPrice)
    const newAmount = existing.amount + amount
    existing.avgBuyPrice = totalCost / newAmount
    existing.amount = newAmount
  } else {
    // Add new holding
    this.holdings.push({
      coinId: coinData.id,
      symbol: coinData.symbol,
      name: coinData.name,
      amount: amount,
      avgBuyPrice: buyPrice
    })
  }
  
  // Update total invested
  this.totalInvested += amount * buyPrice
  
  return this.save()
}

const Portfolio = mongoose.model('Portfolio', portfolioSchema)

module.exports = Portfolio
