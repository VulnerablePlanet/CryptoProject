/**
 * ============================================================================
 * ROC - Rate of Change (Momentum)
 * ============================================================================
 * Measures the percentage change in price over a specified period.
 */

/**
 * Calculate Rate of Change
 * @param {number[]} prices - Array of close prices
 * @param {number} period - ROC period (default: 12)
 * @returns {(number|null)[]} ROC values (percentage) with nulls for warm-up
 */
const calculateROC = (prices, period = 12) => {
  if (!prices || prices.length <= period) {
    return prices ? prices.map(() => null) : []
  }

  const result = []
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(null)
    } else {
      const previousPrice = prices[i - period]
      if (previousPrice !== 0) {
        result.push(((prices[i] - previousPrice) / previousPrice) * 100)
      } else {
        result.push(null)
      }
    }
  }
  
  return result
}

/**
 * Calculate Momentum (absolute price change)
 * @param {number[]} prices - Array of close prices
 * @param {number} period - Momentum period (default: 10)
 * @returns {(number|null)[]} Momentum values with nulls for warm-up
 */
const calculateMomentum = (prices, period = 10) => {
  if (!prices || prices.length <= period) {
    return prices ? prices.map(() => null) : []
  }

  const result = []
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      result.push(null)
    } else {
      result.push(prices[i] - prices[i - period])
    }
  }
  
  return result
}

/**
 * Calculate Momentum Slope (rate of change of momentum)
 * @param {(number|null)[]} momentum - Momentum values
 * @param {number} period - Slope period (default: 5)
 * @returns {(number|null)[]} Slope values
 */
const calculateMomentumSlope = (momentum, period = 5) => {
  if (!momentum || momentum.length <= period) {
    return momentum ? momentum.map(() => null) : []
  }

  const result = []
  
  for (let i = 0; i < momentum.length; i++) {
    if (i < period || momentum[i] === null || momentum[i - period] === null) {
      result.push(null)
    } else {
      // Simple slope: (current - previous) / period
      result.push((momentum[i] - momentum[i - period]) / period)
    }
  }
  
  return result
}

/**
 * Detect momentum divergence
 * @param {number[]} prices - Close prices
 * @param {number[]} momentum - Momentum values  
 * @returns {string|null} 'bullish', 'bearish', or null
 */
const detectMomentumDivergence = (prices, momentum) => {
  if (!prices || !momentum || prices.length < 10) return null
  
  const recentPrices = prices.slice(-10)
  const recentMomentum = momentum.slice(-10).filter(v => v !== null)
  
  if (recentMomentum.length < 2) return null
  
  const priceTrend = recentPrices[recentPrices.length - 1] > recentPrices[0]
  const momentumTrend = recentMomentum[recentMomentum.length - 1] > recentMomentum[0]
  
  if (priceTrend && !momentumTrend) return 'bearish'
  if (!priceTrend && momentumTrend) return 'bullish'
  
  return null
}

module.exports = {
  calculateROC,
  calculateMomentum,
  calculateMomentumSlope,
  detectMomentumDivergence
}
