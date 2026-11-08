const { validationResult } = require('express-validator')
const Transaction = require('../models/Transaction')
const ledgerService = require('../services/ledgerService')
const { LedgerError } = require('../domain/portfolioLedger')
const Notification = require('../models/Notification')
const { createLogger } = require('../utils/logger')

const logger = createLogger('transactionController')

/**
 * Map ledger rule violations to client errors:
 *  - REVERT_CONFLICT → 409 (the request conflicts with later history)
 *  - anything else (oversell, invalid amount/price/type) → 400
 */
const sendLedgerError = (res, error) => {
  const status = error.code === 'REVERT_CONFLICT' ? 409 : 400
  return res.status(status).json({
    success: false,
    code: error.code,
    message: error.message,
    details: error.details
  })
}

/**
 * @desc    Get user's transactions
 * @route   GET /api/transactions
 * @access  Private
 */
const getTransactions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      coinId,
      startDate,
      endDate 
    } = req.query

    // Build query
    const query = { user: req.user._id }
    
    if (type) {
      query.type = type
    }
    
    if (coinId) {
      query.coinId = coinId
    }
    
    if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Transaction.countDocuments(query)
    ])

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    logger.error('Failed to fetch transactions', { error, userId: req.user?._id?.toString() })
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions'
    })
  }
}

/**
 * @desc    Get single transaction
 * @route   GET /api/transactions/:id
 * @access  Private
 */
const getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      })
    }

    res.json({
      success: true,
      transaction
    })
  } catch (error) {
    logger.error('Failed to fetch transaction', {
      error,
      userId: req.user?._id?.toString(),
      transactionId: req.params?.id
    })
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction'
    })
  }
}

/**
 * @desc    Create a new transaction (buy/sell)
 * @route   POST /api/transactions
 * @access  Private
 */
const createTransaction = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { 
      type, 
      coinId, 
      symbol, 
      coinName, 
      amount, 
      priceAtTransaction, 
      fee = 0,
      notes,
      fromAddress,
      toAddress,
      txHash,
      exchange,
      tradingPair
    } = req.body

    const totalValue = amount * priceAtTransaction

    // Transaction + portfolio update as one consistent ledger operation
    const { transaction, portfolio } = await ledgerService.recordTransaction(req.user._id, {
      type,
      coinId,
      symbol: symbol.toUpperCase(),
      coinName,
      amount,
      priceAtTransaction,
      totalValue,
      fee,
      notes,
      fromAddress,
      toAddress,
      txHash,
      exchange: exchange || 'binance',
      tradingPair: tradingPair || `${symbol.toUpperCase()}/USDT`,
      status: 'completed'
    })

    // Emit realtime update via Socket.io
    const socketHelpers = req.app.get('socketHelpers')
    
    // Create notification
    const typeLabels = { buy: 'bought', sell: 'sold', transfer_in: 'received', transfer_out: 'sent' }
    const notification = await Notification.createAndEmit(
      req.user._id,
      {
        type: 'transaction',
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${symbol.toUpperCase()}`,
        message: `You ${typeLabels[type] || type} ${amount} ${symbol.toUpperCase()} for $${totalValue.toLocaleString()}`,
        icon: type === 'buy' || type === 'transfer_in' ? 'arrow_downward' : 'arrow_upward',
        data: {
          coinId,
          symbol: symbol.toUpperCase(),
          price: priceAtTransaction,
          transactionId: transaction._id
        }
      },
      socketHelpers
    )
    void notification
    
    if (socketHelpers) {
      socketHelpers.emitPortfolioUpdate(req.user._id.toString(), portfolio)
      socketHelpers.emitToUser(req.user._id.toString(), 'newTransaction', transaction)
    }

    res.status(201).json({
      success: true,
      message: 'Transaction recorded',
      transaction,
      portfolio
    })
  } catch (error) {
    if (error instanceof LedgerError) {
      return sendLedgerError(res, error)
    }
    logger.error('Failed to create transaction', {
      error,
      userId: req.user?._id?.toString(),
      coinId: req.body?.coinId,
      type: req.body?.type
    })
    res.status(500).json({
      success: false,
      message: 'Error creating transaction'
    })
  }
}

/**
 * @desc    Delete a transaction
 * @route   DELETE /api/transactions/:id
 * @access  Private
 */
const deleteTransaction = async (req, res) => {
  try {
    const result = await ledgerService.deleteTransaction(req.user._id, req.params.id)

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      })
    }

    const { portfolio } = result
    const socketHelpers = req.app.get('socketHelpers')
    if (portfolio && socketHelpers) {
      socketHelpers.emitPortfolioUpdate(req.user._id.toString(), portfolio)
    }

    res.json({
      success: true,
      message: 'Transaction deleted',
      portfolio
    })
  } catch (error) {
    if (error instanceof LedgerError) {
      return sendLedgerError(res, error)
    }
    logger.error('Failed to delete transaction', {
      error,
      userId: req.user?._id?.toString(),
      transactionId: req.params?.id
    })
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction'
    })
  }
}

/**
 * @desc    Get transaction summary/stats
 * @route   GET /api/transactions/stats
 * @access  Private
 */
const getTransactionStats = async (req, res) => {
  try {
    const stats = await Transaction.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalValue' },
          totalFees: { $sum: '$fee' }
        }
      }
    ])

    const totalTransactions = await Transaction.countDocuments({ user: req.user._id })
    
    // Get recent activity
    const recentTransactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)

    res.json({
      success: true,
      stats: {
        byType: stats,
        totalTransactions,
        recentTransactions
      }
    })
  } catch (error) {
    logger.error('Failed to fetch transaction stats', { error, userId: req.user?._id?.toString() })
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction stats'
    })
  }
}

module.exports = {
  getTransactions,
  getTransaction,
  createTransaction,
  deleteTransaction,
  getTransactionStats
}
