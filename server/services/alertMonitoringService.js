/**
 * ============================================================================
 * Alert Monitoring Service
 * ============================================================================
 * Monitors price updates and checks for triggered alerts.
 * When an alert condition is met, sends notifications to users.
 */

const Watchlist = require('../models/Watchlist')
const Notification = require('../models/Notification')
const ccxtPriceService = require('./ccxtPriceService')

let socketHelpers = null
let isMonitoring = false

/**
 * Initialize the monitoring service with socket helpers
 * @param {Object} helpers - Socket helpers from socket initialization
 */
const initialize = (helpers) => {
  socketHelpers = helpers
  isMonitoring = true
  console.log('🔔 Alert monitoring service initialized')
}

/**
 * Stop the monitoring service
 */
const stop = () => {
  isMonitoring = false
  socketHelpers = null
  console.log('🛑 Alert monitoring service stopped')
}

/**
 * Check all active alerts against current prices
 * Called after each price update from the price service
 * @param {Array} prices - Array of price data from CoinGecko
 */
const checkAlerts = async (prices) => {
  if (!isMonitoring || !prices || prices.length === 0) return

  try {
    // Build price lookup map by coin ID
    const priceMap = new Map()
    prices.forEach(coin => {
      priceMap.set(coin.id, coin.current_price)
      priceMap.set(coin.symbol.toLowerCase(), coin.current_price)
    })

    // Get all watchlists with active alerts
    const watchlists = await Watchlist.find({
      'alerts.active': true,
      'alerts.triggered': false
    }).populate('user', '_id email name')

    let triggeredCount = 0

    for (const watchlist of watchlists) {
      const activeAlerts = watchlist.alerts.filter(a => a.active && !a.triggered)
      
      for (const alert of activeAlerts) {
        // Try to find price by coinId or symbol
        const currentPrice = priceMap.get(alert.coinId) || 
                            priceMap.get(alert.symbol.toLowerCase())
        
        if (!currentPrice) continue
        
        const shouldTrigger = checkAlertCondition(alert, currentPrice)
        
        if (shouldTrigger) {
          await triggerAlert(watchlist, alert, currentPrice)
          triggeredCount++
        }
      }
    }

    if (triggeredCount > 0) {
      console.log(`🔔 Triggered ${triggeredCount} price alerts`)
    }
  } catch (error) {
    console.error('Alert monitoring error:', error.message)
  }
}

/**
 * Check if an alert condition is met
 * @param {Object} alert - Alert object
 * @param {number} currentPrice - Current price of the coin
 * @returns {boolean} Whether the alert should trigger
 */
const checkAlertCondition = (alert, currentPrice) => {
  if (alert.condition === 'above') {
    return currentPrice >= alert.targetPrice
  } else if (alert.condition === 'below') {
    return currentPrice <= alert.targetPrice
  }
  return false
}

/**
 * Trigger an alert - mark as triggered and send notification
 * @param {Object} watchlist - Watchlist document
 * @param {Object} alert - Alert object
 * @param {number} currentPrice - Current price when triggered
 */
const triggerAlert = async (watchlist, alert, currentPrice) => {
  try {
    // Mark alert as triggered
    const alertDoc = watchlist.alerts.id(alert._id)
    if (alertDoc) {
      alertDoc.triggered = true
      alertDoc.triggeredAt = new Date()
      await watchlist.save()
    }

    const userId = watchlist.user._id || watchlist.user
    const conditionText = alert.condition === 'above' ? 'rose above' : 'fell below'
    
    console.log(`🔔 Alert triggered: ${alert.symbol} ${conditionText} $${alert.targetPrice} (current: $${currentPrice.toFixed(2)})`)

    // Create notification
    const notificationData = {
      type: 'price_alert',
      title: `🔔 ${alert.symbol} Price Alert`,
      message: `${alert.symbol} has ${conditionText} your target of $${alert.targetPrice.toLocaleString()}. Current price: $${currentPrice.toLocaleString()}`,
      data: {
        coinId: alert.coinId,
        symbol: alert.symbol,
        targetPrice: alert.targetPrice,
        currentPrice: currentPrice,
        condition: alert.condition,
        alertId: alert._id.toString()
      }
    }

    // Save notification to database
    const notification = await Notification.create({
      user: userId,
      ...notificationData
    })

    // Emit realtime notification via socket
    if (socketHelpers) {
      socketHelpers.emitToUser(userId.toString(), 'notification', {
        ...notification.toObject(),
        ...notificationData
      })
      
      // Also emit specific alert triggered event
      socketHelpers.emitToUser(userId.toString(), 'alertTriggered', {
        alertId: alert._id.toString(),
        coinId: alert.coinId,
        symbol: alert.symbol,
        targetPrice: alert.targetPrice,
        currentPrice: currentPrice,
        condition: alert.condition
      })
    }

    return notification
  } catch (error) {
    console.error(`Error triggering alert for ${alert.symbol}:`, error.message)
  }
}

/**
 * Manually check alerts for a specific user (useful for testing)
 * @param {string} userId - User ID to check alerts for
 */
const checkUserAlerts = async (userId) => {
  const watchlist = await Watchlist.findOne({ user: userId })
  if (!watchlist) return []

  const activeAlerts = watchlist.getActiveAlerts()
  const results = []

  for (const alert of activeAlerts) {
    try {
      // Get price from CCXT
      const priceData = await ccxtPriceService.getPriceByCoinId(alert.coinId)
      results.push({
        alert,
        currentPrice: priceData.price,
        wouldTrigger: checkAlertCondition(alert, priceData.price)
      })
    } catch (error) {
      results.push({
        alert,
        error: error.message
      })
    }
  }

  return results
}

/**
 * Get monitoring status
 */
const getStatus = () => ({
  isMonitoring,
  hasSocketHelpers: !!socketHelpers
})

module.exports = {
  initialize,
  stop,
  checkAlerts,
  checkAlertCondition,
  triggerAlert,
  checkUserAlerts,
  getStatus
}
