/**
 * ============================================================================
 * MOVING AVERAGES - SMA & EMA
 * ============================================================================
 * Pure mathematical calculations with proper warm-up periods.
 * Aligned by timestamp for consistent analysis.
 */

/**
 * Calculate Simple Moving Average
 * @param {number[]} prices - Array of close prices
 * @param {number} period - Number of periods for SMA
 * @returns {(number|null)[]} SMA values with nulls for warm-up period
 */
const calculateSMA = (prices, period) => {
  if (!prices || prices.length < period) {
    return prices ? prices.map(() => null) : []
  }

  const result = []
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      // Warm-up period - not enough data
      result.push(null)
    } else {
      // Calculate average of last 'period' prices
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += prices[i - j]
      }
      result.push(sum / period)
    }
  }
  
  return result
}

/**
 * Calculate Exponential Moving Average
 * @param {number[]} prices - Array of close prices
 * @param {number} period - Number of periods for EMA
 * @returns {(number|null)[]} EMA values with nulls for warm-up period
 */
const calculateEMA = (prices, period) => {
  if (!prices || prices.length < period) {
    return prices ? prices.map(() => null) : []
  }

  const result = []
  const multiplier = 2 / (period + 1)
  
  // First EMA value is an SMA
  let ema = null
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      // Warm-up period
      result.push(null)
    } else if (i === period - 1) {
      // First EMA = SMA of first 'period' prices
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += prices[i - j]
      }
      ema = sum / period
      result.push(ema)
    } else {
      // EMA = Price(today) * multiplier + EMA(yesterday) * (1 - multiplier)
      ema = prices[i] * multiplier + ema * (1 - multiplier)
      result.push(ema)
    }
  }
  
  return result
}

/**
 * Calculate Weighted Moving Average
 * @param {number[]} prices - Array of close prices
 * @param {number} period - Number of periods for WMA
 * @returns {(number|null)[]} WMA values with nulls for warm-up period
 */
const calculateWMA = (prices, period) => {
  if (!prices || prices.length < period) {
    return prices ? prices.map(() => null) : []
  }

  const result = []
  const weightSum = (period * (period + 1)) / 2
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      let weightedSum = 0
      for (let j = 0; j < period; j++) {
        weightedSum += prices[i - j] * (period - j)
      }
      result.push(weightedSum / weightSum)
    }
  }
  
  return result
}

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateWMA
}
