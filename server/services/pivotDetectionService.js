/**
 * ============================================================================
 * PIVOT DETECTION SERVICE
 * ============================================================================
 * Shared Fibonacci pivot detection and calculation algorithms.
 * 
 * Extracted from fibonacciService.js and fibonacciCcxtService.js to eliminate
 * ~400 lines of duplicated algorithm code.
 * 
 * Functions:
 * - findPivots: ZigZag pivot detection
 * - filterAlternatingPivots: Ensure alternating High-Low pattern
 * - getRecentSwings: Get most recent swing high and low
 * - detectTrend: Determine market trend from pivot sequence
 * - calculateRetracementLevels: Fibonacci retracement computation
 * - calculateExtensionLevels: Fibonacci extension computation
 * - findNearestLevel: Find nearest Fibonacci level to current price
 * ============================================================================
 */

// ============================================================================
// ZigZag Pivot Detection Algorithm
// ============================================================================

/**
 * Find pivot points (Swing High and Swing Low) using ZigZag algorithm
 * 
 * @param {Array} candles - Array of OHLCV candle objects
 * @param {number} lookback - Number of candles to look back/forward for confirmation
 * @param {number} threshold - Minimum % price change to consider (noise filter)
 * @returns {Array} Array of pivot objects { type, price, timestamp, time, index }
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
        time: current.time,
        index: i
      })
    }
    
    if (isSwingLow) {
      pivots.push({
        type: 'low',
        price: current.low,
        timestamp: current.timestamp,
        time: current.time,
        index: i
      })
    }
  }
  
  // Sort pivots by index (chronological order)
  pivots.sort((a, b) => a.index - b.index)
  
  // Filter alternating pivots (remove consecutive same-type pivots)
  return filterAlternatingPivots(pivots, threshold)
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
 * @param {Array} ratios - Array of { ratio, label, description? } objects
 * @param {Object} config - Optional config (goldenPocketStart, goldenPocketEnd)
 * @returns {Object} Retracement levels with prices
 */
const calculateRetracementLevels = (swingHigh, swingLow, trend, ratios, config = {}) => {
  const priceRange = swingHigh - swingLow
  const { goldenPocketStart = 0.618, goldenPocketEnd = 0.618 } = config
  const levels = {}
  
  ratios.forEach(({ ratio, label, description }) => {
    let price
    
    if (trend === 'bullish') {
      // Bullish: draw from Low (0%) to High (100%)
      price = swingLow + (priceRange * ratio)
    } else {
      // Bearish: draw from High (0%) to Low (100%)
      price = swingHigh - (priceRange * ratio)
    }
    
    const key = (ratio * 100).toFixed(1).replace('.0', '')
    const isGoldenPocket = ratio >= goldenPocketStart && ratio <= goldenPocketEnd
    
    levels[key] = {
      ratio,
      price: Math.round(price * 100) / 100,
      label,
      description: description || label,
      isGoldenPocket,
      isGoldenRatio: ratio === 0.618
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
 * @param {Array} ratios - Array of { ratio, label, description? } objects
 * @returns {Object} Extension levels with prices
 */
const calculateExtensionLevels = (swingHigh, swingLow, trend, ratios) => {
  const priceRange = swingHigh - swingLow
  const levels = {}
  
  ratios.forEach(({ ratio, label, description }) => {
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
      description: description || label,
      isGoldenExtension: ratio === 1.618
    }
  })
  
  return levels
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
        label: level.label,
        isGoldenPocket: level.isGoldenPocket
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
        label: level.label,
        isGoldenExtension: level.isGoldenExtension
      }
    }
  })
  
  return nearest
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
  findNearestLevel
}
