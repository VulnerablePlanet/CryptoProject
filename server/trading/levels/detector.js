/**
 * ============================================================================
 * SUPPORT & RESISTANCE - Phase 5
 * ============================================================================
 * Detect support and resistance levels using swing points and clustering.
 */

/**
 * Find swing highs (local maxima)
 * @param {object[]} candles - Array of OHLC candles
 * @param {number} lookback - Periods to look back/forward
 * @returns {object[]} Swing high points
 */
const findSwingHighs = (candles, lookback = 5) => {
  const swingHighs = []
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentHigh = candles[i].high
    let isSwingHigh = true
    
    // Check if current high is higher than all surrounding candles
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].high >= currentHigh) {
        isSwingHigh = false
        break
      }
    }
    
    if (isSwingHigh) {
      swingHighs.push({
        index: i,
        price: currentHigh,
        timestamp: candles[i].timestamp,
        type: 'resistance',
        strength: 1, // Will be updated by clustering
        touches: 1
      })
    }
  }
  
  return swingHighs
}

/**
 * Find swing lows (local minima)
 * @param {object[]} candles - Array of OHLC candles
 * @param {number} lookback - Periods to look back/forward
 * @returns {object[]} Swing low points
 */
const findSwingLows = (candles, lookback = 5) => {
  const swingLows = []
  
  for (let i = lookback; i < candles.length - lookback; i++) {
    const currentLow = candles[i].low
    let isSwingLow = true
    
    // Check if current low is lower than all surrounding candles
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].low <= currentLow) {
        isSwingLow = false
        break
      }
    }
    
    if (isSwingLow) {
      swingLows.push({
        index: i,
        price: currentLow,
        timestamp: candles[i].timestamp,
        type: 'support',
        strength: 1,
        touches: 1
      })
    }
  }
  
  return swingLows
}

/**
 * Cluster nearby levels together
 * @param {object[]} levels - Array of price levels
 * @param {number} threshold - Percentage threshold for clustering (0.5 = 0.5%)
 * @returns {object[]} Clustered levels
 */
const clusterLevels = (levels, threshold = 0.5) => {
  if (levels.length === 0) return []
  
  // Sort by price
  const sorted = [...levels].sort((a, b) => a.price - b.price)
  const clusters = []
  let currentCluster = [sorted[0]]
  
  for (let i = 1; i < sorted.length; i++) {
    const level = sorted[i]
    const clusterAvg = currentCluster.reduce((sum, l) => sum + l.price, 0) / currentCluster.length
    const percentDiff = Math.abs(level.price - clusterAvg) / clusterAvg * 100
    
    if (percentDiff <= threshold) {
      // Add to current cluster
      currentCluster.push(level)
    } else {
      // Finalize current cluster and start new one
      if (currentCluster.length > 0) {
        clusters.push(mergeCluster(currentCluster))
      }
      currentCluster = [level]
    }
  }
  
  // Don't forget the last cluster
  if (currentCluster.length > 0) {
    clusters.push(mergeCluster(currentCluster))
  }
  
  return clusters
}

/**
 * Merge a cluster of levels into one
 * @param {object[]} cluster - Array of levels in the cluster
 * @returns {object} Merged level
 */
const mergeCluster = (cluster) => {
  const avgPrice = cluster.reduce((sum, l) => sum + l.price, 0) / cluster.length
  const strength = cluster.length // More touches = stronger level
  const types = new Set(cluster.map(l => l.type))
  
  return {
    price: avgPrice,
    type: types.size > 1 ? 'pivot' : cluster[0].type,
    strength,
    touches: cluster.length,
    timestamps: cluster.map(l => l.timestamp)
  }
}

/**
 * Calculate level strength based on various factors
 * @param {object} level - Price level
 * @param {object[]} candles - Recent candles for context
 * @returns {number} Strength score 0-1
 */
const calculateLevelStrength = (level, candles) => {
  let score = 0
  
  // Base score from touches (more touches = stronger)
  score += Math.min(level.touches / 5, 0.4) // Max 0.4 from touches
  
  // Recent activity bonus
  const now = Date.now()
  const lastTouch = Math.max(...level.timestamps.map(t => new Date(t).getTime()))
  const daysSinceTouch = (now - lastTouch) / (1000 * 60 * 60 * 24)
  if (daysSinceTouch < 7) score += 0.3
  else if (daysSinceTouch < 30) score += 0.15
  
  // Round number bonus (psychological levels)
  const roundness = getRoundnessScore(level.price)
  score += roundness * 0.3
  
  return Math.min(score, 1)
}

/**
 * Check if price is a round/psychological number
 * @param {number} price - Price to check
 * @returns {number} Roundness score 0-1
 */
const getRoundnessScore = (price) => {
  // Check different levels of roundness
  if (price >= 10000) {
    // For BTC-level prices
    if (price % 10000 === 0) return 1
    if (price % 5000 === 0) return 0.8
    if (price % 1000 === 0) return 0.6
    if (price % 500 === 0) return 0.3
    return 0
  } else if (price >= 100) {
    if (price % 100 === 0) return 1
    if (price % 50 === 0) return 0.7
    if (price % 10 === 0) return 0.4
    return 0
  } else {
    if (price % 1 === 0) return 1
    if (price % 0.5 === 0) return 0.5
    return 0
  }
}

/**
 * Detect all support and resistance levels
 * @param {object[]} candles - Array of OHLC candles
 * @param {object} options - Configuration options
 * @returns {object} { supports: [], resistances: [], pivots: [] }
 */
const detectLevels = (candles, options = {}) => {
  const {
    lookback = 5,
    clusterThreshold = 0.5,
    maxLevels = 10
  } = options
  
  if (!candles || candles.length < lookback * 2) {
    return { supports: [], resistances: [], pivots: [] }
  }
  
  // Find swing points
  const swingHighs = findSwingHighs(candles, lookback)
  const swingLows = findSwingLows(candles, lookback)
  
  // Combine and cluster
  const allLevels = [...swingHighs, ...swingLows]
  const clustered = clusterLevels(allLevels, clusterThreshold)
  
  // Calculate strength and add current price context
  const currentPrice = candles[candles.length - 1].close
  const levelsWithStrength = clustered.map(level => ({
    ...level,
    strength: calculateLevelStrength(level, candles),
    distanceFromPrice: ((level.price - currentPrice) / currentPrice) * 100,
    isAbovePrice: level.price > currentPrice
  }))
  
  // Sort by strength and take top levels
  const sorted = levelsWithStrength.sort((a, b) => b.strength - a.strength)
  const topLevels = sorted.slice(0, maxLevels)
  
  // Separate into categories
  return {
    supports: topLevels.filter(l => l.type === 'support' || (!l.isAbovePrice && l.type === 'pivot')),
    resistances: topLevels.filter(l => l.type === 'resistance' || (l.isAbovePrice && l.type === 'pivot')),
    pivots: topLevels.filter(l => l.type === 'pivot'),
    all: topLevels,
    currentPrice
  }
}

/**
 * Find nearest support and resistance
 * @param {object[]} candles - Recent candles
 * @returns {object} { nearestSupport, nearestResistance }
 */
const findNearestLevels = (candles) => {
  const levels = detectLevels(candles)
  const { currentPrice, supports, resistances } = levels
  
  // Find nearest support (below current price)
  const nearestSupport = supports
    .filter(s => s.price < currentPrice)
    .sort((a, b) => b.price - a.price)[0] || null
  
  // Find nearest resistance (above current price)
  const nearestResistance = resistances
    .filter(r => r.price > currentPrice)
    .sort((a, b) => a.price - b.price)[0] || null
  
  return {
    nearestSupport,
    nearestResistance,
    currentPrice,
    supportDistance: nearestSupport 
      ? ((currentPrice - nearestSupport.price) / currentPrice * 100).toFixed(2) + '%'
      : null,
    resistanceDistance: nearestResistance
      ? ((nearestResistance.price - currentPrice) / currentPrice * 100).toFixed(2) + '%'
      : null
  }
}

module.exports = {
  findSwingHighs,
  findSwingLows,
  clusterLevels,
  calculateLevelStrength,
  getRoundnessScore,
  detectLevels,
  findNearestLevels
}
