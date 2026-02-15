const coingeckoRateLimiter = require('./coingeckoRateLimiter')
const alertMonitoringService = require('./alertMonitoringService')

// Price service configuration
const UPDATE_INTERVAL = 30000 // 30 seconds (respecting rate limits)
const TOP_COINS_COUNT = 50

let priceInterval = null
let socketHelpers = null

/**
 * Fetch prices from CoinGecko API using centralized rate-limiter
 * This ensures all CoinGecko calls share the same queue and rate limits
 */
const fetchPrices = async () => {
  try {
    const data = await coingeckoRateLimiter.get('/coins/markets', {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: TOP_COINS_COUNT,
      page: 1,
      sparkline: false,
      price_change_percentage: '1h,24h,7d'
    })

    return data.map(coin => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      current_price: coin.current_price,
      market_cap: coin.market_cap,
      market_cap_rank: coin.market_cap_rank,
      total_volume: coin.total_volume,
      high_24h: coin.high_24h,
      low_24h: coin.low_24h,
      price_change_24h: coin.price_change_24h,
      price_change_percentage_24h: coin.price_change_percentage_24h,
      price_change_percentage_1h_in_currency: coin.price_change_percentage_1h_in_currency,
      price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency,
      last_updated: coin.last_updated
    }))
  } catch (error) {
    console.error('❌ Error fetching prices from CoinGecko:', error.message)
    return null
  }
}

/**
 * Broadcast prices to all connected clients
 */
const broadcastPrices = async () => {
  if (!socketHelpers) {
    console.warn('Socket helpers not initialized')
    return
  }

  const prices = await fetchPrices()
  
  if (prices) {
    console.log(`📊 Broadcasting prices for ${prices.length} coins`)
    socketHelpers.emitPriceUpdate({
      prices,
      timestamp: new Date().toISOString()
    })

    // Also emit individual coin prices for subscribers
    prices.forEach(coin => {
      socketHelpers.emitCoinPrice(coin.id, {
        price: coin.current_price,
        change_24h: coin.price_change_percentage_24h,
        change_1h: coin.price_change_percentage_1h_in_currency,
        volume: coin.total_volume,
        timestamp: new Date().toISOString()
      })
    })

    // Check price alerts after each price update
    await alertMonitoringService.checkAlerts(prices)
  }
}

/**
 * Start the price update service
 * @param {Object} helpers - Socket helpers from initializeSocket
 */
const startPriceService = (helpers) => {
  socketHelpers = helpers
  
  // Initialize alert monitoring service
  alertMonitoringService.initialize(helpers)
  
  // Fetch immediately on start
  console.log('🚀 Starting price service...')
  broadcastPrices()
  
  // Then fetch at regular intervals
  priceInterval = setInterval(broadcastPrices, UPDATE_INTERVAL)
  
  console.log(`⏰ Price updates scheduled every ${UPDATE_INTERVAL / 1000} seconds`)
}

/**
 * Stop the price update service
 */
const stopPriceService = () => {
  if (priceInterval) {
    clearInterval(priceInterval)
    priceInterval = null
    alertMonitoringService.stop()
    console.log('🛑 Price service stopped')
  }
}

/**
 * Get current interval status
 */
const getServiceStatus = () => ({
  running: !!priceInterval,
  interval: UPDATE_INTERVAL,
  coinsTracked: TOP_COINS_COUNT
})

module.exports = {
  startPriceService,
  stopPriceService,
  getServiceStatus,
  fetchPrices,
  broadcastPrices
}
