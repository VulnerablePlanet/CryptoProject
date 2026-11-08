const { validationResult } = require('express-validator')
const Portfolio = require('../models/Portfolio')
const ledgerService = require('../services/ledgerService')
const ledger = require('../domain/portfolioLedger')
const { createLogger } = require('../utils/logger')

const logger = createLogger('portfolioController')

/**
 * @desc    Get user's portfolio
 * @route   GET /api/portfolio
 * @access  Private
 */
const getPortfolio = async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne({ user: req.user._id })
    
    // Create portfolio if doesn't exist (a concurrent request may create it
    // first: the unique index rejects the duplicate, so read it back)
    if (!portfolio) {
      try {
        portfolio = await Portfolio.create({
          user: req.user._id,
          holdings: [],
          totalInvested: 0
        })
      } catch (error) {
        if (error?.code !== 11000) throw error
        portfolio = await Portfolio.findOne({ user: req.user._id })
      }
    }
    
    res.json({
      success: true,
      portfolio
    })
  } catch (error) {
    logger.error('Failed to fetch portfolio', { error, userId: req.user?._id?.toString() })
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

    const { portfolio, result: existed } = await ledgerService.updatePortfolio(
      req.user._id,
      (p) => {
        const existed = p.holdings.some((h) => h.coinId === coinId)
        ledger.addLot(p, { coinId, symbol, name, amount, price: buyPrice, notes })
        return existed
      },
      { create: true }
    )

    res.status(201).json({
      success: true,
      message: existed ? 'Holding updated' : 'Holding added',
      portfolio
    })
  } catch (error) {
    if (error instanceof ledger.LedgerError) {
      return res.status(400).json({ success: false, code: error.code, message: error.message })
    }
    logger.error('Failed to add holding', {
      error,
      userId: req.user?._id?.toString(),
      coinId: req.body?.coinId
    })
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

    const outcome = await ledgerService.updatePortfolio(req.user._id, (portfolio) => {
      const holding = portfolio.holdings.id(holdingId)
      if (!holding) return false
      ledger.updateHoldingValues(portfolio, holding, { amount, avgBuyPrice, notes })
      return true
    })

    if (!outcome) {
      return res.status(404).json({ success: false, message: 'Portfolio not found' })
    }
    if (!outcome.result) {
      return res.status(404).json({ success: false, message: 'Holding not found' })
    }

    res.json({
      success: true,
      message: 'Holding updated',
      portfolio: outcome.portfolio
    })
  } catch (error) {
    if (error instanceof ledger.LedgerError) {
      return res.status(400).json({ success: false, code: error.code, message: error.message })
    }
    logger.error('Failed to update holding', {
      error,
      userId: req.user?._id?.toString(),
      holdingId: req.params?.holdingId
    })
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

    const outcome = await ledgerService.updatePortfolio(req.user._id, (portfolio) =>
      ledger.removeHolding(portfolio, holdingId)
    )

    if (!outcome) {
      return res.status(404).json({ success: false, message: 'Portfolio not found' })
    }
    if (!outcome.result) {
      return res.status(404).json({ success: false, message: 'Holding not found' })
    }

    res.json({
      success: true,
      message: 'Holding deleted',
      portfolio: outcome.portfolio
    })
  } catch (error) {
    logger.error('Failed to delete holding', {
      error,
      userId: req.user?._id?.toString(),
      holdingId: req.params?.holdingId
    })
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
    const outcome = await ledgerService.updatePortfolio(req.user._id, (portfolio) => {
      portfolio.holdings = []
      portfolio.totalInvested = 0
    })

    if (!outcome) {
      return res.status(404).json({ success: false, message: 'Portfolio not found' })
    }

    res.json({
      success: true,
      message: 'Portfolio cleared',
      portfolio: outcome.portfolio
    })
  } catch (error) {
    logger.error('Failed to clear portfolio', { error, userId: req.user?._id?.toString() })
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
