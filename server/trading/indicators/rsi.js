/**
 * @deprecated Use `const { calculateRSI, detectRSIDivergence } = require('../indicators')`
 *             instead. The barrel file now delegates to the `technicalindicators` npm package.
 *
 * ============================================================================
 * RELATIVE STRENGTH INDEX (RSI)
 * ============================================================================
 * Momentum oscillator measuring speed and magnitude of price changes.
 * Range: 0-100, typically oversold < 30, overbought > 70
 */

/**
 * Calculate RSI using Wilder's smoothing method
 * @param {number[]} prices - Array of close prices
 * @param {number} period - RSI period (default: 14)
 * @returns {(number|null)[]} RSI values (0-100) with nulls for warm-up
 */
const calculateRSI = (prices, period = 14) => {
  if (!prices || prices.length < period + 1) {
    return prices ? prices.map(() => null) : []
  }

  const result = []
  const gains = []
  const losses = []
  
  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }
  
  // First value is null (no change calculated)
  result.push(null)
  
  let avgGain = null
  let avgLoss = null
  
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      // Warm-up period
      result.push(null)
    } else if (i === period - 1) {
      // First RSI uses SMA
      let gainSum = 0
      let lossSum = 0
      for (let j = 0; j <= i; j++) {
        gainSum += gains[j]
        lossSum += losses[j]
      }
      avgGain = gainSum / period
      avgLoss = lossSum / period
      
      if (avgLoss === 0) {
        result.push(100) // No losses = RSI 100
      } else {
        const rs = avgGain / avgLoss
        result.push(100 - (100 / (1 + rs)))
      }
    } else {
      // Subsequent RSI uses Wilder's smoothing
      avgGain = (avgGain * (period - 1) + gains[i]) / period
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period
      
      if (avgLoss === 0) {
        result.push(100)
      } else {
        const rs = avgGain / avgLoss
        result.push(100 - (100 / (1 + rs)))
      }
    }
  }
  
  return result
}

/**
 * Detect RSI divergence (simplified)
 * @param {number[]} prices - Close prices
 * @param {number[]} rsi - RSI values
 * @param {number} lookback - Periods to look back for divergence
 * @returns {object|null} Divergence info or null
 */
const detectRSIDivergence = (prices, rsi, lookback = 10) => {
  if (!prices || !rsi || prices.length < lookback) return null
  
  const recentPrices = prices.slice(-lookback)
  const recentRSI = rsi.slice(-lookback).filter(v => v !== null)
  
  if (recentRSI.length < 2) return null
  
  const priceDirection = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'UP' : 'DOWN'
  const rsiDirection = recentRSI[recentRSI.length - 1] > recentRSI[0] ? 'UP' : 'DOWN'
  
  if (priceDirection !== rsiDirection) {
    return {
      type: priceDirection === 'UP' ? 'bearish' : 'bullish',
      price_direction: priceDirection,
      rsi_direction: rsiDirection
    }
  }
  
  return null
}

module.exports = {
  calculateRSI,
  detectRSIDivergence
}
