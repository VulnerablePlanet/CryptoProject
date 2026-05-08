/**
 * @deprecated Use `const { calculateATR, calculateTrueRange, calculateATRStops, calculateATRPercent } = require('../indicators')`
 *             instead. The barrel file now delegates to the `technicalindicators` npm package.
 *
 * ============================================================================
 * ATR - Average True Range
 * ============================================================================
 * Volatility indicator measuring the degree of price movement.
 * Used for stop-loss placement and position sizing.
 */

/**
 * Calculate True Range for a candle
 * @param {object} current - Current candle {high, low, close}
 * @param {object} previous - Previous candle {close}
 * @returns {number} True Range value
 */
const calculateTrueRange = (current, previous) => {
  const highLow = current.high - current.low
  const highPrevClose = previous ? Math.abs(current.high - previous.close) : 0
  const lowPrevClose = previous ? Math.abs(current.low - previous.close) : 0
  
  return Math.max(highLow, highPrevClose, lowPrevClose)
}

/**
 * Calculate ATR (Average True Range)
 * @param {object[]} candles - Array of {high, low, close} objects
 * @param {number} period - ATR period (default: 14)
 * @returns {(number|null)[]} ATR values with nulls for warm-up
 */
const calculateATR = (candles, period = 14) => {
  if (!candles || candles.length < period) {
    return candles ? candles.map(() => null) : []
  }

  const result = []
  const trueRanges = []
  
  // Calculate True Range for each candle
  for (let i = 0; i < candles.length; i++) {
    const tr = calculateTrueRange(candles[i], i > 0 ? candles[i - 1] : null)
    trueRanges.push(tr)
  }
  
  let atr = null
  
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      // Warm-up period
      result.push(null)
    } else if (i === period - 1) {
      // First ATR is simple average
      let sum = 0
      for (let j = 0; j <= i; j++) {
        sum += trueRanges[j]
      }
      atr = sum / period
      result.push(atr)
    } else {
      // Subsequent ATR uses Wilder's smoothing
      atr = ((atr * (period - 1)) + trueRanges[i]) / period
      result.push(atr)
    }
  }
  
  return result
}

/**
 * Calculate ATR-based stop loss levels
 * @param {number} entryPrice - Entry price
 * @param {number} atr - Current ATR value
 * @param {number} multiplier - ATR multiplier (default: 2)
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {object} {stopLoss, takeProfit} at 1:2 R:R
 */
const calculateATRStops = (entryPrice, atr, multiplier = 2, direction = 'LONG') => {
  const atrDistance = atr * multiplier
  
  if (direction === 'LONG') {
    return {
      stopLoss: entryPrice - atrDistance,
      takeProfit: entryPrice + (atrDistance * 2), // 1:2 R:R
      riskAmount: atrDistance,
      rewardAmount: atrDistance * 2
    }
  } else {
    return {
      stopLoss: entryPrice + atrDistance,
      takeProfit: entryPrice - (atrDistance * 2),
      riskAmount: atrDistance,
      rewardAmount: atrDistance * 2
    }
  }
}

/**
 * Calculate ATR percentage (relative to price)
 * @param {number} atr - ATR value
 * @param {number} price - Current price
 * @returns {number} ATR as percentage of price
 */
const calculateATRPercent = (atr, price) => {
  if (!atr || !price || price === 0) return 0
  return (atr / price) * 100
}

module.exports = {
  calculateTrueRange,
  calculateATR,
  calculateATRStops,
  calculateATRPercent
}
