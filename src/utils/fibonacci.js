/**
 * Fibonacci Utility Functions
 * Client-side calculations and helpers for Fibonacci analysis
 */

// ============================================================================
// Fibonacci Ratios
// ============================================================================

export const RETRACEMENT_RATIOS = [
  { ratio: 0, label: '0%', color: '#6b7280' },
  { ratio: 0.236, label: '23.6%', color: '#10b981' },
  { ratio: 0.382, label: '38.2%', color: '#22c55e' },
  { ratio: 0.5, label: '50%', color: '#84cc16' },
  { ratio: 0.618, label: '61.8%', color: '#eab308', isGolden: true },
  { ratio: 0.786, label: '78.6%', color: '#f97316' },
  { ratio: 1, label: '100%', color: '#ef4444' }
]

export const EXTENSION_RATIOS = [
  { ratio: 1.272, label: 'TP1 - 127.2%', color: '#8b5cf6' },
  { ratio: 1.618, label: 'TP2 - 161.8%', color: '#a855f7', isGolden: true },
  { ratio: 2.618, label: 'TP3 - 261.8%', color: '#d946ef' }
]

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * Calculate Fibonacci level price
 * @param {number} swingLow - Swing low price
 * @param {number} swingHigh - Swing high price
 * @param {number} ratio - Fibonacci ratio
 * @param {string} trend - 'bullish' or 'bearish'
 * @returns {number} Calculated price level
 */
export const calculateFibLevel = (swingLow, swingHigh, ratio, trend = 'bullish') => {
  const range = swingHigh - swingLow
  
  if (trend === 'bullish') {
    return swingLow + (range * ratio)
  } else {
    return swingHigh - (range * ratio)
  }
}

/**
 * Calculate all Fibonacci levels from swing points
 * @param {number} swingLow - Swing low price
 * @param {number} swingHigh - Swing high price
 * @param {string} trend - Market trend
 * @returns {Object} All calculated levels
 */
export const calculateAllLevels = (swingLow, swingHigh, trend = 'bullish') => {
  const retracement = {}
  const extensions = {}
  
  RETRACEMENT_RATIOS.forEach(({ ratio, label, color, isGolden }) => {
    const key = (ratio * 100).toString().replace('.0', '')
    retracement[key] = {
      ratio,
      price: calculateFibLevel(swingLow, swingHigh, ratio, trend),
      label,
      color,
      isGolden: !!isGolden
    }
  })
  
  EXTENSION_RATIOS.forEach(({ ratio, label, color, isGolden }) => {
    const key = (ratio * 100).toString()
    extensions[key] = {
      ratio,
      price: calculateFibLevel(swingLow, swingHigh, ratio, trend),
      label,
      color,
      isGolden: !!isGolden
    }
  })
  
  return { retracement, extensions }
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format price with appropriate decimals
 * @param {number} price - Price to format
 * @returns {string} Formatted price
 */
export const formatFibPrice = (price) => {
  if (!price && price !== 0) return '-'
  
  if (price >= 1000) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  } else if (price >= 1) {
    return price.toFixed(2)
  } else {
    return price.toFixed(6)
  }
}

/**
 * Format percentage with sign
 * @param {number} percent - Percentage value
 * @returns {string} Formatted percentage
 */
export const formatPercent = (percent) => {
  if (!percent && percent !== 0) return '-'
  const sign = percent >= 0 ? '+' : ''
  return `${sign}${percent.toFixed(2)}%`
}

/**
 * Get color based on trend
 * @param {string} trend - 'bullish' | 'bearish' | 'neutral'
 * @returns {string} CSS color class
 */
export const getTrendColor = (trend) => {
  switch (trend) {
    case 'bullish':
      return 'text-success'
    case 'bearish':
      return 'text-danger'
    default:
      return 'text-text-secondary'
  }
}

/**
 * Get trend icon
 * @param {string} trend - Market trend
 * @returns {string} Material icon name
 */
export const getTrendIcon = (trend) => {
  switch (trend) {
    case 'bullish':
      return 'trending_up'
    case 'bearish':
      return 'trending_down'
    default:
      return 'trending_flat'
  }
}

/**
 * Get level type badge class
 * @param {Object} level - Level object
 * @returns {string} CSS class
 */
export const getLevelBadgeClass = (level) => {
  if (level.isGolden) {
    return 'bg-warning/20 text-warning border-warning/30'
  }
  if (level.ratio >= 1) {
    return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  }
  return 'bg-primary/20 text-primary border-primary/30'
}

// ============================================================================
// Price Zone Functions
// ============================================================================

/**
 * Determine which zone the current price is in
 * @param {number} currentPrice - Current market price
 * @param {Object} levels - Fibonacci levels
 * @returns {Object} Zone information
 */
export const getPriceZone = (currentPrice, levels) => {
  if (!levels?.retracement) return null
  
  const allLevels = [
    ...Object.values(levels.retracement),
    ...Object.values(levels.extensions || {})
  ].sort((a, b) => a.price - b.price)
  
  // Find which levels the price is between
  for (let i = 0; i < allLevels.length - 1; i++) {
    const lower = allLevels[i]
    const upper = allLevels[i + 1]
    
    if (currentPrice >= lower.price && currentPrice <= upper.price) {
      const zoneRange = upper.price - lower.price
      const positionInZone = (currentPrice - lower.price) / zoneRange
      
      return {
        lower,
        upper,
        position: positionInZone,
        percentFromLower: ((currentPrice - lower.price) / lower.price * 100).toFixed(2),
        percentFromUpper: ((upper.price - currentPrice) / currentPrice * 100).toFixed(2)
      }
    }
  }
  
  // Price is outside the range
  const lowestLevel = allLevels[0]
  const highestLevel = allLevels[allLevels.length - 1]
  
  if (currentPrice < lowestLevel.price) {
    return {
      lower: null,
      upper: lowestLevel,
      position: -1,
      message: 'Below all Fibonacci levels'
    }
  }
  
  return {
    lower: highestLevel,
    upper: null,
    position: 2,
    message: 'Above all Fibonacci levels (Breakout zone)'
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  RETRACEMENT_RATIOS,
  EXTENSION_RATIOS,
  calculateFibLevel,
  calculateAllLevels,
  formatFibPrice,
  formatPercent,
  getTrendColor,
  getTrendIcon,
  getLevelBadgeClass,
  getPriceZone
}
