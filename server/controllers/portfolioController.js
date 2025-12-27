const { validationResult, body } = require('express-validator')
const Portfolio = require('../models/Portfolio')

/**
 * @desc    Get user's portfolio
 * @route   GET /api/portfolio
 * @access  Private
 */
const getPortfolio = async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ user: req.user._id })
    
    // Create portfolio if doesn't exist
    if (!portfolio) {
      portfolio = await Portfolio.create({
        user: req.user._id,
        holdings: [],
        totalInvested: 0
      })
    }
    
    res.json({
      success: true,
      portfolio
    })
  } catch (error) {
    console.error('Get portfolio error:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching portfolio'
    })
  }
}

/**
 * @desc    Add holding to portfolio
 * @route   POST /api/portfolio/holdings
 * @access  Private
 */
const addHolding = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { coinId, symbol, name, amount, buyPrice, notes } = req.body

    let portfolio = await Portfolio.findOne({ user: req.user._id })
    
    if (!portfolio) {
      portfolio = new Portfolio({
        user: req.user._id,
        holdings: [],
        totalInvested: 0
      })
    }

    // Check if holding already exists
    const existingIndex = portfolio.holdings.findIndex(h => h.coinId === coinId)
    
    if (existingIndex >= 0) {
      // Update existing holding (average buy price calculation)
      const existing = portfolio.holdings[existingIndex]
      const totalCost = (existing.amount * existing.avgBuyPrice) + (amount * buyPrice)
      const newAmount = existing.amount + amount
      existing.avgBuyPrice = newAmount > 0 ? totalCost / newAmount : 0
      existing.amount = newAmount
      if (notes) existing.notes = notes
    } else {
      // Add new holding
      portfolio.holdings.push({
        coinId,
        symbol: symbol.toUpperCase(),
        name,
        amount,
        avgBuyPrice: buyPrice,
        notes: notes || ''
      })
    }

    // Update total invested
    portfolio.totalInvested += amount * buyPrice

    await portfolio.save()

    res.status(201).json({
      success: true,
      message: existingIndex >= 0 ? 'Holding updated' : 'Holding added',
      portfolio
    })
  } catch (error) {
    console.error('Add holding error:', error)
    res.status(500).json({
      success: false,
      message: 'Error adding holding'
    })
  }
}

/**
 * @desc    Update a specific holding
 * @route   PUT /api/portfolio/holdings/:holdingId
 * @access  Private
 */
const updateHolding = async (req, res) => {
  try {
    const { holdingId } = req.params
    const { amount, avgBuyPrice, notes } = req.body

    const portfolio = await Portfolio.findOne({ user: req.user._id })
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      })
    }

    const holding = portfolio.holdings.id(holdingId)
    
    if (!holding) {
      return res.status(404).json({
        success: false,
        message: 'Holding not found'
      })
    }

    // Calculate investment difference for totalInvested update
    const oldInvestment = holding.amount * holding.avgBuyPrice
    const newInvestment = (amount ?? holding.amount) * (avgBuyPrice ?? holding.avgBuyPrice)

    // Update fields
    if (amount !== undefined) holding.amount = amount
    if (avgBuyPrice !== undefined) holding.avgBuyPrice = avgBuyPrice
    if (notes !== undefined) holding.notes = notes

    // Update total invested
    portfolio.totalInvested = portfolio.totalInvested - oldInvestment + newInvestment

    await portfolio.save()

    res.json({
      success: true,
      message: 'Holding updated',
      portfolio
    })
  } catch (error) {
    console.error('Update holding error:', error)
    res.status(500).json({
      success: false,
      message: 'Error updating holding'
    })
  }
}

/**
 * @desc    Delete a holding from portfolio
 * @route   DELETE /api/portfolio/holdings/:holdingId
 * @access  Private
 */
const deleteHolding = async (req, res) => {
  try {
    const { holdingId } = req.params

    const portfolio = await Portfolio.findOne({ user: req.user._id })
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      })
    }

    const holding = portfolio.holdings.id(holdingId)
    
    if (!holding) {
      return res.status(404).json({
        success: false,
        message: 'Holding not found'
      })
    }

    // Update total invested before removing
    const investment = holding.amount * holding.avgBuyPrice
    portfolio.totalInvested = Math.max(0, portfolio.totalInvested - investment)

    // Remove holding
    portfolio.holdings.pull(holdingId)

    await portfolio.save()

    res.json({
      success: true,
      message: 'Holding deleted',
      portfolio
    })
  } catch (error) {
    console.error('Delete holding error:', error)
    res.status(500).json({
      success: false,
      message: 'Error deleting holding'
    })
  }
}

/**
 * @desc    Clear all holdings
 * @route   DELETE /api/portfolio/holdings
 * @access  Private
 */
const clearPortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findOne({ user: req.user._id })
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        message: 'Portfolio not found'
      })
    }

    portfolio.holdings = []
    portfolio.totalInvested = 0

    await portfolio.save()

    res.json({
      success: true,
      message: 'Portfolio cleared',
      portfolio
    })
  } catch (error) {
    console.error('Clear portfolio error:', error)
    res.status(500).json({
      success: false,
      message: 'Error clearing portfolio'
    })
  }
}

module.exports = {
  getPortfolio,
  addHolding,
  updateHolding,
  deleteHolding,
  clearPortfolio
}
