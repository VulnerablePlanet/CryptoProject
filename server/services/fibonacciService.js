/**
 * ============================================================================
 * FIBONACCI ANALYSIS SERVICE
 * ============================================================================
 * Provides automatic Fibonacci retracement and extension calculations
 * with pivot point detection using ZigZag algorithm.
 * 
 * Features:
 * - ZigZag pivot detection (Swing High/Low)
 * - Automatic trend detection
 * - Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%)
 * - Fibonacci extensions for Take Profit (127.2%, 161.8%, 261.8%)
 * ============================================================================
 */

const ohlcService = require('./ohlcService')

// ============================================================================
// Fibonacci Ratios
// ============================================================================

const RETRACEMENT_RATIOS = [
  { ratio: 0, label: '0%' },
  { ratio: 0.236, label: '23.6%' },
  { ratio: 0.382, label: '38.2%' },
  { ratio: 0.5, label: '50%' },
  { ratio: 0.618, label: '61.8% (Golden Pocket)' },
  { ratio: 0.786, label: '78.6%' },
  { ratio: 1, label: '100%' }
]

const EXTENSION_RATIOS = [
  { ratio: 1.272, label: 'TP1 - 127.2% (Conservador)' },
  { ratio: 1.618, label: 'TP2 - 161.8% (Golden Extension)' },
  { ratio: 2.618, label: 'TP3 - 261.8% (Extended)' }
]

// ============================================================================
// ZigZag Pivot Detection Algorithm
// ============================================================================

/**
 * Find pivot points (Swing High and Swing Low) using ZigZag algorithm
 * 
 * @param {Array} candles - Array of OHLC candle objects
 * @param {number} lookback - Number of candles to look back/forward for confirmation
 * @param {number} threshold - Minimum % price change to consider (noise filter)
 * @returns {Array} Array of pivot objects { type, price, timestamp, index }
 */
const findPivots = (candles, lookback = 5, threshold = 0.5) => {
  if (!candles || candles.length < lookback * 2 + 1) {
    return []
  }

  const pivots = []
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i]
    let isSwingHigh = true
    let isSwingLow = true
    
    // Compare with surrounding candles
    for (let j = 1; j <= lookback; j++) {
      const leftCandle = candles[i - j]
      const rightCandle = candles[i + j]
      
      // Check for Swing High
      if (leftCandle.high >= current.high || rightCandle.high >= current.high) {
        isSwingHigh = false
      }
      
      // Check for Swing Low
      if (leftCandle.low <= current.low || rightCandle.low <= current.low) {
        isSwingLow = false
      }
    }
    
    if (isSwingHigh) {
      pivots.push({
        type: 'high',
        price: current.high,
        timestamp: current.timestamp,
        index: i
      })
    }
    
    if (isSwingLow) {
      pivots.push({
        type: 'low',
        price: current.low,
        timestamp: current.timestamp,
        index: i
      })
    }
  }
  
  // Sort pivots by index (chronological order)
  pivots.sort((a, b) => a.index - b.index)
  
  // Filter alternating pivots (remove consecutive same-type pivots)
  const filteredPivots = filterAlternatingPivots(pivots, threshold)
  
  return filteredPivots
}

/**
 * Filter pivots to ensure alternating High-Low pattern
 * Keep the most significant pivot when there are consecutive same-type
 * 
 * @param {Array} pivots - Raw pivot array
 * @param {number} threshold - Minimum % change threshold
 * @returns {Array} Filtered pivot array
 */
const filterAlternatingPivots = (pivots, threshold) => {
  if (pivots.length < 2) return pivots
  
  const filtered = [pivots[0]]
  
  for (let i = 1; i < pivots.length; i++) {
    const current = pivots[i]
    const last = filtered[filtered.length - 1]
    
    if (current.type !== last.type) {
      // Different type - check threshold
      const percentChange = Math.abs((current.price - last.price) / last.price * 100)
      if (percentChange >= threshold) {
        filtered.push(current)
      }
    } else {
      // Same type - keep the more extreme one
      if (current.type === 'high' && current.price > last.price) {
        filtered[filtered.length - 1] = current
      } else if (current.type === 'low' && current.price < last.price) {
        filtered[filtered.length - 1] = current
      }
    }
  }
  
  return filtered
}

/**
 * Get the most recent significant swing high and low
 * 
 * @param {Array} pivots - Array of pivot points
 * @returns {Object} { swingHigh, swingLow }
 */
const getRecentSwings = (pivots) => {
  if (pivots.length < 2) {
    return { swingHigh: null, swingLow: null }
  }
  
  // Get last two different-type pivots
  const lastPivot = pivots[pivots.length - 1]
  const secondLastPivot = pivots[pivots.length - 2]
  
  let swingHigh, swingLow
  
  if (lastPivot.type === 'high') {
    swingHigh = lastPivot
    swingLow = secondLastPivot
  } else {
    swingHigh = secondLastPivot
    swingLow = lastPivot
  }
  
  return { swingHigh, swingLow }
}

// ============================================================================
// Trend Detection
// ============================================================================

/**
 * Detect the current trend based on pivot sequence
 * 
 * @param {Array} pivots - Array of pivot points
 * @param {Array} candles - Original candle array
 * @returns {string} 'bullish' | 'bearish' | 'neutral'
 */
const detectTrend = (pivots, candles) => {
  if (pivots.length < 2) return 'neutral'
  
  const lastPivot = pivots[pivots.length - 1]
  const currentPrice = candles[candles.length - 1].close
  
  // Get recent swings
  const { swingHigh, swingLow } = getRecentSwings(pivots)
  
  if (!swingHigh || !swingLow) return 'neutral'
  
  // If last pivot was a low and price is moving up = bullish
  // If last pivot was a high and price is moving down = bearish
  if (lastPivot.type === 'low' && currentPrice > lastPivot.price) {
    return 'bullish'
  } else if (lastPivot.type === 'high' && currentPrice < lastPivot.price) {
    return 'bearish'
  }
  
  // Check higher highs / lower lows pattern
  const highs = pivots.filter(p => p.type === 'high')
  const lows = pivots.filter(p => p.type === 'low')
  
  if (highs.length >= 2 && lows.length >= 2) {
    const lastHigh = highs[highs.length - 1]
    const prevHigh = highs[highs.length - 2]
    const lastLow = lows[lows.length - 1]
    const prevLow = lows[lows.length - 2]
    
    // Higher highs and higher lows = bullish
    if (lastHigh.price > prevHigh.price && lastLow.price > prevLow.price) {
      return 'bullish'
    }
    
    // Lower highs and lower lows = bearish
    if (lastHigh.price < prevHigh.price && lastLow.price < prevLow.price) {
      return 'bearish'
    }
  }
  
  return 'neutral'
}

// ============================================================================
// Fibonacci Calculations
// ============================================================================

/**
 * Calculate Fibonacci retracement levels
 * 
 * @param {number} swingHigh - Swing high price
 * @param {number} swingLow - Swing low price
 * @param {string} trend - 'bullish' or 'bearish'
 * @returns {Object} Retracement levels with prices
 */
const calculateRetracementLevels = (swingHigh, swingLow, trend) => {
  const priceRange = swingHigh - swingLow
  const levels = {}
  
  RETRACEMENT_RATIOS.forEach(({ ratio, label }) => {
    let price
    
    if (trend === 'bullish') {
      // Bullish: draw from Low (0%) to High (100%)
      price = swingLow + (priceRange * ratio)
    } else {
      // Bearish: draw from High (0%) to Low (100%)
      price = swingHigh - (priceRange * ratio)
    }
    
    const key = (ratio * 100).toFixed(1).replace('.0', '')
    levels[key] = {
      ratio,
      price: Math.round(price * 100) / 100,
      label,
      isGoldenPocket: ratio === 0.618
    }
  })
  
  return levels
}

/**
 * Calculate Fibonacci extension levels (Take Profits)
 * 
 * @param {number} swingHigh - Swing high price
 * @param {number} swingLow - Swing low price
 * @param {string} trend - 'bullish' or 'bearish'
 * @returns {Object} Extension levels with prices
 */
const calculateExtensionLevels = (swingHigh, swingLow, trend) => {
  const priceRange = swingHigh - swingLow
  const levels = {}
  
  EXTENSION_RATIOS.forEach(({ ratio, label }) => {
    let price
    
    if (trend === 'bullish') {
      // Bullish: extensions go above swing high
      price = swingLow + (priceRange * ratio)
    } else {
      // Bearish: extensions go below swing low
      price = swingHigh - (priceRange * ratio)
    }
    
    const key = (ratio * 100).toFixed(1).replace('.0', '')
    levels[key] = {
      ratio,
      price: Math.round(price * 100) / 100,
      label,
      isGoldenExtension: ratio === 1.618
    }
  })
  
  return levels
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Perform complete Fibonacci analysis for a cryptocurrency
 * 
 * @param {string} coinId - CoinGecko coin ID (e.g., 'bitcoin')
 * @param {string} timeframe - Timeframe for analysis (e.g., '4h', '1d')
 * @param {Object} options - Additional options
 * @returns {Object} Complete Fibonacci analysis result
 */
const analyzeFibonacci = async (coinId, timeframe = '4h', options = {}) => {
  const { lookback = 5, threshold = 0.5, limit = 100 } = options
  
  console.log(`📐 [Fibonacci] Analyzing ${coinId} on ${timeframe} timeframe...`)
  
  try {
    // Get candle data using rate-limited OHLC service
    const candles = await ohlcService.getCandles(
      coinId.toLowerCase(),
      timeframe,
      'usd',
      { limit, autoSync: true }
    )
    
    if (!candles || candles.length < lookback * 2 + 1) {
      throw new Error(`Insufficient candle data. Need at least ${lookback * 2 + 1} candles, got ${candles?.length || 0}`)
    }
    
    // Find pivot points
    const allPivots = findPivots(candles, lookback, threshold)
    
    if (allPivots.length < 2) {
      throw new Error('Could not detect enough pivot points for Fibonacci analysis')
    }
    
    // Get most recent swings
    const { swingHigh, swingLow } = getRecentSwings(allPivots)
    
    if (!swingHigh || !swingLow) {
      throw new Error('Could not identify swing high and swing low')
    }
    
    // Detect trend
    const trend = detectTrend(allPivots, candles)
    
    // Calculate Fibonacci levels
    const retracement = calculateRetracementLevels(swingHigh.price, swingLow.price, trend)
    const extensions = calculateExtensionLevels(swingHigh.price, swingLow.price, trend)
    
    // Current price info
    const currentCandle = candles[candles.length - 1]
    const currentPrice = currentCandle.close
    
    // Determine which level price is near
    const nearestLevel = findNearestLevel(currentPrice, retracement, extensions)
    
    console.log(`📐 [Fibonacci] Analysis complete: ${trend} trend, ${allPivots.length} pivots detected`)
    
    return {
      success: true,
      coinId,
      timeframe,
      trend,
      currentPrice,
      pivots: {
        swingHigh: {
          price: swingHigh.price,
          timestamp: swingHigh.timestamp,
          index: swingHigh.index
        },
        swingLow: {
          price: swingLow.price,
          timestamp: swingLow.timestamp,
          index: swingLow.index
        },
        all: allPivots.slice(-10) // Last 10 pivots for visualization
      },
      levels: {
        retracement,
        extensions
      },
      nearestLevel,
      meta: {
        priceRange: Math.round((swingHigh.price - swingLow.price) * 100) / 100,
        analyzedCandles: candles.length,
        pivotCount: allPivots.length,
        lookback,
        threshold,
        calculatedAt: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error(`📐 [Fibonacci] Error analyzing ${coinId}:`, error.message)
    throw error
  }
}

/**
 * Find which Fibonacci level the current price is nearest to
 * 
 * @param {number} currentPrice - Current price
 * @param {Object} retracement - Retracement levels
 * @param {Object} extensions - Extension levels
 * @returns {Object} Nearest level info
 */
const findNearestLevel = (currentPrice, retracement, extensions) => {
  let nearest = null
  let minDistance = Infinity
  
  // Check retracement levels
  Object.entries(retracement).forEach(([key, level]) => {
    const distance = Math.abs(currentPrice - level.price)
    const percentDistance = (distance / currentPrice) * 100
    
    if (distance < minDistance) {
      minDistance = distance
      nearest = {
        level: key + '%',
        price: level.price,
        distance: Math.round(distance * 100) / 100,
        percentDistance: Math.round(percentDistance * 100) / 100,
        type: 'retracement',
        label: level.label
      }
    }
  })
  
  // Check extension levels
  Object.entries(extensions).forEach(([key, level]) => {
    const distance = Math.abs(currentPrice - level.price)
    const percentDistance = (distance / currentPrice) * 100
    
    if (distance < minDistance) {
      minDistance = distance
      nearest = {
        level: key + '%',
        price: level.price,
        distance: Math.round(distance * 100) / 100,
        percentDistance: Math.round(percentDistance * 100) / 100,
        type: 'extension',
        label: level.label
      }
    }
  })
  
  return nearest
}

/**
 * Get just the pivots for visualization
 * 
 * @param {string} coinId - CoinGecko coin ID
 * @param {string} timeframe - Timeframe
 * @param {Object} options - Options
 * @returns {Object} Pivot points
 */
const getPivots = async (coinId, timeframe = '4h', options = {}) => {
  const { lookback = 5, threshold = 0.5, limit = 100 } = options
  
  const candles = await ohlcService.getCandles(
    coinId.toLowerCase(),
    timeframe,
    'usd',
    { limit, autoSync: true }
  )
  
  const pivots = findPivots(candles, lookback, threshold)
  const trend = detectTrend(pivots, candles)
  
  return {
    success: true,
    coinId,
    timeframe,
    trend,
    pivots,
    candleCount: candles.length
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  findPivots,
  filterAlternatingPivots,
  getRecentSwings,
  detectTrend,
  calculateRetracementLevels,
  calculateExtensionLevels,
  analyzeFibonacci,
  getPivots,
  findNearestLevel,
  RETRACEMENT_RATIOS,
  EXTENSION_RATIOS
}
