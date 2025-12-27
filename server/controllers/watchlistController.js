const { validationResult } = require('express-validator')
const Watchlist = require('../models/Watchlist')

/**
 * @desc    Get user's watchlist
 * @route   GET /api/watchlist
 * @access  Private
 */
const getWatchlist = async (req, res) => {
  try {
    let watchlist = await Watchlist.findOne({ user: req.user._id })
    
    if (!watchlist) {
      watchlist = await Watchlist.create({
        user: req.user._id,
        coins: [],
        alerts: []
      })
    }
    
    res.json({
      success: true,
      watchlist
    })
  } catch (error) {
    console.error('Get watchlist error:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching watchlist'
    })
  }
}

/**
 * @desc    Add coin to watchlist
 * @route   POST /api/watchlist/coins
 * @access  Private
 */
const addCoin = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { coinId, symbol, name, notes } = req.body

    let watchlist = await Watchlist.findOne({ user: req.user._id })
    
    if (!watchlist) {
      watchlist = new Watchlist({
        user: req.user._id,
        coins: [],
        alerts: []
      })
    }

    // Check if coin already exists
    if (watchlist.hasCoin(coinId)) {
      return res.status(400).json({
        success: false,
        message: 'Coin already in watchlist'
      })
    }

    watchlist.coins.push({
      coinId,
      symbol: symbol.toUpperCase(),
      name,
      notes: notes || ''
    })

    await watchlist.save()

    res.status(201).json({
      success: true,
      message: 'Coin added to watchlist',
      watchlist
    })
  } catch (error) {
    console.error('Add coin error:', error)
    res.status(500).json({
      success: false,
      message: 'Error adding coin to watchlist'
    })
  }
}

/**
 * @desc    Remove coin from watchlist
 * @route   DELETE /api/watchlist/coins/:coinId
 * @access  Private
 */
const removeCoin = async (req, res) => {
  try {
    const { coinId } = req.params

    const watchlist = await Watchlist.findOne({ user: req.user._id })
    
    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      })
    }

    const coinIndex = watchlist.coins.findIndex(c => c.coinId === coinId)
    
    if (coinIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Coin not in watchlist'
      })
    }

    watchlist.coins.splice(coinIndex, 1)
    
    // Also remove any alerts for this coin
    watchlist.alerts = watchlist.alerts.filter(a => a.coinId !== coinId)

    await watchlist.save()

    res.json({
      success: true,
      message: 'Coin removed from watchlist',
      watchlist
    })
  } catch (error) {
    console.error('Remove coin error:', error)
    res.status(500).json({
      success: false,
      message: 'Error removing coin from watchlist'
    })
  }
}

/**
 * @desc    Create price alert
 * @route   POST /api/watchlist/alerts
 * @access  Private
 */
const createAlert = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }

    const { coinId, symbol, targetPrice, condition } = req.body

    let watchlist = await Watchlist.findOne({ user: req.user._id })
    
    if (!watchlist) {
      watchlist = new Watchlist({
        user: req.user._id,
        coins: [],
        alerts: []
      })
    }

    watchlist.alerts.push({
      coinId,
      symbol: symbol.toUpperCase(),
      targetPrice,
      condition,
      active: true,
      triggered: false
    })

    await watchlist.save()

    // Emit to socket for realtime alert checking
    const socketHelpers = req.app.get('socketHelpers')
    if (socketHelpers) {
      socketHelpers.emitToUser(req.user._id.toString(), 'alertCreated', {
        coinId,
        targetPrice,
        condition
      })
    }

    res.status(201).json({
      success: true,
      message: 'Price alert created',
      watchlist
    })
  } catch (error) {
    console.error('Create alert error:', error)
    res.status(500).json({
      success: false,
      message: 'Error creating alert'
    })
  }
}

/**
 * @desc    Delete alert
 * @route   DELETE /api/watchlist/alerts/:alertId
 * @access  Private
 */
const deleteAlert = async (req, res) => {
  try {
    const { alertId } = req.params

    const watchlist = await Watchlist.findOne({ user: req.user._id })
    
    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      })
    }

    const alertIndex = watchlist.alerts.findIndex(a => a._id.toString() === alertId)
    
    if (alertIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      })
    }

    watchlist.alerts.splice(alertIndex, 1)
    await watchlist.save()

    res.json({
      success: true,
      message: 'Alert deleted',
      watchlist
    })
  } catch (error) {
    console.error('Delete alert error:', error)
    res.status(500).json({
      success: false,
      message: 'Error deleting alert'
    })
  }
}

/**
 * @desc    Get all active alerts
 * @route   GET /api/watchlist/alerts
 * @access  Private
 */
const getAlerts = async (req, res) => {
  try {
    const watchlist = await Watchlist.findOne({ user: req.user._id })
    
    if (!watchlist) {
      return res.json({
        success: true,
        alerts: []
      })
    }

    res.json({
      success: true,
      alerts: watchlist.alerts
    })
  } catch (error) {
    console.error('Get alerts error:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching alerts'
    })
  }
}

/**
 * @desc    Toggle alert active status
 * @route   PATCH /api/watchlist/alerts/:alertId/toggle
 * @access  Private
 */
const toggleAlert = async (req, res) => {
  try {
    const { alertId } = req.params

    const watchlist = await Watchlist.findOne({ user: req.user._id })
    
    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      })
    }

    const alert = watchlist.alerts.id(alertId)
    
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      })
    }

    alert.active = !alert.active
    await watchlist.save()

    res.json({
      success: true,
      message: `Alert ${alert.active ? 'activated' : 'deactivated'}`,
      alert
    })
  } catch (error) {
    console.error('Toggle alert error:', error)
    res.status(500).json({
      success: false,
      message: 'Error toggling alert'
    })
  }
}

module.exports = {
  getWatchlist,
  addCoin,
  removeCoin,
  createAlert,
  deleteAlert,
  getAlerts,
  toggleAlert
}
