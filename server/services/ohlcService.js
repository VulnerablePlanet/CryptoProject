const Candle = require('../models/Candle')
const coingeckoRateLimiter = require('./coingeckoRateLimiter')

// In-memory cache for reducing API calls
const cache = new Map()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes (CoinGecko cache time)

// Timeframe configurations (in milliseconds)
const TIMEFRAME_MS = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
}

// Days to fetch based on timeframe (for optimal granularity)
const TIMEFRAME_DAYS = {
  '5m': 1,    // 5-minute intervals for 1 day
  '15m': 2,   // 5-minute intervals for 2 days
  '30m': 7,   // ~30 min intervals
  '1h': 14,   // ~1h intervals
  '4h': 30,   // ~4h intervals
  '1d': 90    // Daily intervals
}

/**
 * Get cached data or null if expired
 */
const getCached = (key) => {
  const cached = cache.get(key)
  if (!cached) return null
  
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  
  return cached.data
}

/**
 * Set cache data
 */
const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Fetch market chart data from CoinGecko using centralized rate-limiter
 */
const fetchMarketChart = async (coinId, vsCurrency = 'usd', days = 1) => {
  const cacheKey = `market_chart_${coinId}_${vsCurrency}_${days}`
  const cached = getCached(cacheKey)
  
  if (cached) {
    console.log(`📦 Cache hit for ${coinId} (${days} days)`)
    return cached
  }
  
  console.log(`🌐 Fetching market chart for ${coinId} (${days} days)...`)
  
  try {
    const responseData = await coingeckoRateLimiter.get(`/coins/${coinId}/market_chart`, {
      vs_currency: vsCurrency,
      days: days
      // Note: 'interval' parameter is Pro-only, free tier auto-adjusts granularity
    })
    
    const data = {
      prices: responseData.prices || [],
      volumes: responseData.total_volumes || [],
      marketCaps: responseData.market_caps || []
    }
    
    setCache(cacheKey, data)
    console.log(`✅ Fetched ${data.prices.length} price points for ${coinId}`)
    
    return data
  } catch (error) {
    console.error(`❌ Error fetching market chart for ${coinId}:`, error.message)
    throw error
  }
}

/**
 * Calculate OHLCV candles from price data
 */
const calculateCandles = (prices, volumes, timeframeMs, coinId, vsCurrency, timeframe) => {
  if (!prices || prices.length === 0) return []
  
  const candles = []
  const sortedPrices = [...prices].sort((a, b) => a[0] - b[0])
  
  // Create volume map for quick lookup
  const volumeMap = new Map()
  if (volumes && volumes.length > 0) {
    volumes.forEach(([ts, vol]) => {
      const candleStart = Math.floor(ts / timeframeMs) * timeframeMs
      const current = volumeMap.get(candleStart) || 0
      volumeMap.set(candleStart, current + vol)
    })
  }
  
  // Group prices by candle period
  const candleGroups = new Map()
  
  sortedPrices.forEach(([timestamp, price]) => {
    const candleStart = Math.floor(timestamp / timeframeMs) * timeframeMs
    
    if (!candleGroups.has(candleStart)) {
      candleGroups.set(candleStart, [])
    }
    candleGroups.get(candleStart).push({ timestamp, price })
  })
  
  // Convert groups to OHLCV candles
  candleGroups.forEach((pricePoints, candleStart) => {
    if (pricePoints.length === 0) return
    
    // Sort by timestamp within the candle
    pricePoints.sort((a, b) => a.timestamp - b.timestamp)
    
    const open = pricePoints[0].price
    const close = pricePoints[pricePoints.length - 1].price
    const high = Math.max(...pricePoints.map(p => p.price))
    const low = Math.min(...pricePoints.map(p => p.price))
    const volume = volumeMap.get(candleStart) || 0
    
    const priceChange = close - open
    const priceChangePercent = open !== 0 ? ((close - open) / open) * 100 : 0
    
    candles.push({
      coinId,
      vsCurrency,
      timeframe,
      timestamp: new Date(candleStart),
      open,
      high,
      low,
      close,
      volume,
      priceChange,
      priceChangePercent
    })
  })
  
  // Sort candles by timestamp (oldest first)
  return candles.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Sync candles for a coin - incremental update
 */
const syncCandles = async (coinId, timeframe = '1h', vsCurrency = 'usd') => {
  console.log(`🔄 Syncing ${coinId}/${vsCurrency} ${timeframe} candles...`)
  
  const timeframeMs = TIMEFRAME_MS[timeframe]
  const days = TIMEFRAME_DAYS[timeframe]
  
  if (!timeframeMs) {
    throw new Error(`Unsupported timeframe: ${timeframe}`)
  }
  
  try {
    // Get the latest candle we have
    const latestCandle = await Candle.getLatestCandle(coinId, timeframe, vsCurrency)
    
    // Fetch market chart data
    const { prices, volumes } = await fetchMarketChart(coinId, vsCurrency, days)
    
    if (!prices || prices.length === 0) {
      console.log(`⚠️ No price data received for ${coinId}`)
      return { success: false, message: 'No price data available' }
    }
    
    // Calculate candles from price data
    const candles = calculateCandles(prices, volumes, timeframeMs, coinId, vsCurrency, timeframe)
    
    if (candles.length === 0) {
      console.log(`⚠️ No candles calculated for ${coinId}`)
      return { success: false, message: 'Could not calculate candles' }
    }
    
    // Filter to only new candles if we have existing data
    let candlesToInsert = candles
    if (latestCandle) {
      candlesToInsert = candles.filter(c => c.timestamp > latestCandle.timestamp)
      // Also include the last candle to update it (it might be incomplete)
      const lastExistingCandle = candles.find(
        c => c.timestamp.getTime() === latestCandle.timestamp.getTime()
      )
      if (lastExistingCandle) {
        candlesToInsert.unshift(lastExistingCandle)
      }
    }
    
    // Upsert candles to database
    const result = await Candle.upsertCandles(candlesToInsert)
    
    console.log(`✅ Sync complete: ${result.inserted} new, ${result.modified} updated`)
    
    return {
      success: true,
      coinId,
      timeframe,
      vsCurrency,
      totalCandles: candles.length,
      inserted: result.inserted,
      modified: result.modified,
      latestTimestamp: candles[candles.length - 1]?.timestamp
    }
  } catch (error) {
    console.error(`❌ Sync error for ${coinId}:`, error.message)
    throw error
  }
}

/**
 * Get candles from database
 */
const getCandles = async (coinId, timeframe = '1h', vsCurrency = 'usd', options = {}) => {
  const { limit = 100, from = null, to = null, autoSync = true } = options
  
  // Check if we have recent data, if not trigger sync
  if (autoSync) {
    const latestCandle = await Candle.getLatestCandle(coinId, timeframe, vsCurrency)
    const now = Date.now()
    const timeframeMs = TIMEFRAME_MS[timeframe]
    
    // Sync if no data or data is older than 2 candle periods
    if (!latestCandle || (now - new Date(latestCandle.timestamp).getTime()) > timeframeMs * 2) {
      try {
        await syncCandles(coinId, timeframe, vsCurrency)
      } catch (error) {
        console.warn(`⚠️ Auto-sync failed: ${error.message}`)
      }
    }
  }
  
  // Fetch candles from database
  const candles = await Candle.getCandlesInRange(coinId, timeframe, vsCurrency, from, to, limit)
  
  // Return in ascending order (oldest first) for charting
  return candles.reverse()
}

/**
 * Get supported coins list using centralized rate-limiter
 */
const getSupportedCoins = async () => {
  const cacheKey = 'supported_coins'
  const cached = getCached(cacheKey)
  
  if (cached) return cached
  
  try {
    const data = await coingeckoRateLimiter.get('/coins/markets', {
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: 100,
      page: 1
    })
    
    const coins = data.map(coin => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      image: coin.image,
      marketCapRank: coin.market_cap_rank
    }))
    
    setCache(cacheKey, coins)
    return coins
  } catch (error) {
    console.error('❌ Error fetching supported coins:', error.message)
    throw error
  }
}

/**
 * Get service status (uses centralized rate-limiter metrics)
 */
const getServiceStatus = () => ({
  ...coingeckoRateLimiter.getServiceStatus(),
  cacheSize: cache.size,
  supportedTimeframes: Object.keys(TIMEFRAME_MS)
})

module.exports = {
  fetchMarketChart,
  calculateCandles,
  syncCandles,
  getCandles,
  getSupportedCoins,
  getServiceStatus,
  getRateLimitMetrics: coingeckoRateLimiter.getRateLimitMetrics,
  TIMEFRAME_MS,
  TIMEFRAME_DAYS
}
