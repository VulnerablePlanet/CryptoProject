/**
 * @deprecated Use `const { calculateBollingerBands, detectBBSqueeze, detectBBBreakout } = require('../indicators')`
 *             instead. The barrel file now delegates to the `technicalindicators` npm package.
 *
 * ============================================================================
 * BOLLINGER BANDS
 * ============================================================================
 * Volatility bands placed above and below a moving average.
 * Default: 20-period SMA with 2 standard deviations.
 */

const { calculateSMA } = require('./movingAverages')

/**
 * Calculate Bollinger Bands
 * @param {number[]} prices - Array of close prices
 * @param {number} period - SMA period (default: 20)
 * @param {number} stdDev - Number of standard deviations (default: 2)
 * @returns {object} { upper: [], middle: [], lower: [], bandwidth: [], %b: [] }
 */
const calculateBollingerBands = (prices, period = 20, stdDev = 2) => {
  if (!prices || prices.length < period) {
    const empty = prices ? prices.map(() => null) : []
    return { upper: empty, middle: empty, lower: empty, bandwidth: empty, percentB: empty }
  }

  const middle = calculateSMA(prices, period)
  const upper = []
  const lower = []
  const bandwidth = []
  const percentB = []
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(null)
      lower.push(null)
      bandwidth.push(null)
      percentB.push(null)
    } else {
      // Calculate standard deviation
      const slice = prices.slice(i - period + 1, i + 1)
      const mean = middle[i]
      
      let sumSquaredDiff = 0
      for (let j = 0; j < slice.length; j++) {
        sumSquaredDiff += Math.pow(slice[j] - mean, 2)
      }
      const std = Math.sqrt(sumSquaredDiff / period)
      
      const upperBand = mean + (stdDev * std)
      const lowerBand = mean - (stdDev * std)
      
      upper.push(upperBand)
      lower.push(lowerBand)
      
      // Bandwidth: (Upper - Lower) / Middle * 100
      bandwidth.push(((upperBand - lowerBand) / mean) * 100)
      
      // %B: (Price - Lower) / (Upper - Lower)
      const range = upperBand - lowerBand
      percentB.push(range !== 0 ? (prices[i] - lowerBand) / range : 0.5)
    }
  }
  
  return {
    upper,
    middle,
    lower,
    bandwidth,
    percentB
  }
}

/**
 * Detect Bollinger Band squeeze (low volatility)
 * @param {number[]} bandwidth - Bandwidth values
 * @param {number} threshold - Squeeze threshold (default: 5)
 * @returns {boolean} True if in squeeze
 */
const detectBBSqueeze = (bandwidth, threshold = 5) => {
  if (!bandwidth || bandwidth.length === 0) return false
  
  const recent = bandwidth.filter(v => v !== null).slice(-10)
  if (recent.length === 0) return false
  
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length
  return avg < threshold
}

/**
 * Detect BB breakout
 * @param {number} price - Current price
 * @param {number} upper - Upper band
 * @param {number} lower - Lower band
 * @returns {string|null} 'upper_breakout', 'lower_breakout', or null
 */
const detectBBBreakout = (price, upper, lower) => {
  if (price === null || upper === null || lower === null) return null
  
  if (price > upper) return 'upper_breakout'
  if (price < lower) return 'lower_breakout'
  return null
}

module.exports = {
  calculateBollingerBands,
  detectBBSqueeze,
  detectBBBreakout
}
