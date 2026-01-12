const { validationResult } = require('express-validator')
const Transaction = require('../models/Transaction')
const Portfolio = require('../models/Portfolio')
const Notification = require('../models/Notification')

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
        .limit(parseInt(limit)),
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
    console.error('Get transactions error:', error)
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
    console.error('Get transaction error:', error)
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
      txHash
    } = req.body

    const totalValue = amount * priceAtTransaction

    // Create transaction
    const transaction = await Transaction.create({
      user: req.user._id,
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
      status: 'completed'
    })

    // Update portfolio based on transaction type
    let portfolio = await Portfolio.findOne({ user: req.user._id })
    
    if (!portfolio) {
      portfolio = new Portfolio({
        user: req.user._id,
        holdings: [],
        totalInvested: 0
      })
    }

    const holdingIndex = portfolio.holdings.findIndex(h => h.coinId === coinId)

    if (type === 'buy' || type === 'transfer_in' || type === 'deposit') {
      // Add to holdings
      if (holdingIndex >= 0) {
        const existing = portfolio.holdings[holdingIndex]
        const totalCost = (existing.amount * existing.avgBuyPrice) + (amount * priceAtTransaction)
        const newAmount = existing.amount + amount
        existing.avgBuyPrice = newAmount > 0 ? totalCost / newAmount : 0
        existing.amount = newAmount
      } else {
        portfolio.holdings.push({
          coinId,
          symbol: symbol.toUpperCase(),
          name: coinName,
          amount,
          avgBuyPrice: priceAtTransaction
        })
      }
      portfolio.totalInvested += totalValue
    } else if (type === 'sell' || type === 'transfer_out' || type === 'withdraw') {
      // Remove from holdings
      if (holdingIndex >= 0) {
        const existing = portfolio.holdings[holdingIndex]
        existing.amount = Math.max(0, existing.amount - amount)
        
        // Remove holding if amount is 0
        if (existing.amount === 0) {
          portfolio.holdings.splice(holdingIndex, 1)
        }
        
        // Reduce total invested proportionally
        const soldValue = amount * existing.avgBuyPrice
        portfolio.totalInvested = Math.max(0, portfolio.totalInvested - soldValue)
      }
    }

    await portfolio.save()

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
    console.error('Create transaction error:', error)
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
    // First, find the transaction to get its details before deleting
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

    console.log('Deleting transaction:', transaction._id, 'Type:', transaction.type, 'Amount:', transaction.amount)

    // Revert the portfolio changes
    let portfolio = await Portfolio.findOne({ user: req.user._id })
    
    if (portfolio) {
      const { type, coinId, symbol, coinName, amount, priceAtTransaction, totalValue } = transaction
      const holdingIndex = portfolio.holdings.findIndex(h => h.coinId === coinId)

      console.log('Before update - Holdings:', portfolio.holdings.length, 'TotalInvested:', portfolio.totalInvested)
      console.log('Transaction details - CoinId:', coinId, 'Amount:', amount, 'TotalValue:', totalValue)

      // Reverse the original transaction effect
      if (type === 'buy' || type === 'transfer_in' || type === 'deposit') {
        // Original was adding, so now we subtract
        if (holdingIndex >= 0) {
          const existing = portfolio.holdings[holdingIndex]
          console.log('Found holding at index', holdingIndex, '- Current amount:', existing.amount)
          existing.amount = Math.max(0, existing.amount - amount)
          console.log('New amount:', existing.amount)
          
          // Remove holding if amount becomes 0
          if (existing.amount === 0) {
            portfolio.holdings.splice(holdingIndex, 1)
            console.log('Removed holding (amount was 0)')
          }
        }
        portfolio.totalInvested = Math.max(0, portfolio.totalInvested - totalValue)
      } else if (type === 'sell' || type === 'transfer_out' || type === 'withdraw') {
        // Original was removing, so now we add back
        if (holdingIndex >= 0) {
          const existing = portfolio.holdings[holdingIndex]
          existing.amount += amount
        } else {
          // Re-create the holding if it was removed
          portfolio.holdings.push({
            coinId,
            symbol: symbol.toUpperCase(),
            name: coinName,
            amount,
            avgBuyPrice: priceAtTransaction
          })
        }
        // Add back to total invested
        portfolio.totalInvested += amount * priceAtTransaction
      }

      console.log('After update - Holdings:', portfolio.holdings.length, 'TotalInvested:', portfolio.totalInvested)

      // Mark holdings array as modified for Mongoose to detect changes
      portfolio.markModified('holdings')
      await portfolio.save()
      
      console.log('Portfolio saved successfully')

      // Emit realtime portfolio update
      const socketHelpers = req.app.get('socketHelpers')
      if (socketHelpers) {
        socketHelpers.emitPortfolioUpdate(req.user._id.toString(), portfolio)
      }
    }

    // Now delete the transaction
    await Transaction.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: 'Transaction deleted',
      portfolio
    })
  } catch (error) {
    console.error('Delete transaction error:', error)
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
    console.error('Get transaction stats error:', error)
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
