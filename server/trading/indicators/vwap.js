/**
 * @deprecated Use `const { calculateVWAP, calculateVWAPBands, getVWAPPosition } = require('../indicators')`
 *             instead. The barrel file is the preferred entry point.
 *
 * ============================================================================
 * VWAP - Volume Weighted Average Price
 * ============================================================================
 * Average price weighted by volume, resets at session start.
 */

/**
 * Calculate VWAP for a series of candles
 * @param {object[]} candles - Array of {high, low, close, volume, timestamp}
 * @param {boolean} resetDaily - Reset VWAP at day boundary (default: true)
 * @returns {(number|null)[]} VWAP values
 */
const calculateVWAP = (candles, resetDaily = true) => {
  if (!candles || candles.length === 0) return []

  const result = []
  let cumulativeTPV = 0 // Typical Price * Volume
  let cumulativeVolume = 0
  let currentDay = null
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    const date = new Date(candle.timestamp)
    const day = date.toISOString().split('T')[0]
    
    // Reset at day boundary if enabled
    if (resetDaily && currentDay !== null && day !== currentDay) {
      cumulativeTPV = 0
      cumulativeVolume = 0
    }
    currentDay = day
    
    // Typical Price = (High + Low + Close) / 3
    const typicalPrice = (candle.high + candle.low + candle.close) / 3
    const volume = candle.volume || 0
    
    cumulativeTPV += typicalPrice * volume
    cumulativeVolume += volume
    
    if (cumulativeVolume === 0) {
      result.push(null)
    } else {
      result.push(cumulativeTPV / cumulativeVolume)
    }
  }
  
  return result
}

/**
 * Calculate VWAP bands (standard deviation bands)
 * @param {object[]} candles - Array of candles
 * @param {number[]} vwap - VWAP values
 * @param {number} multiplier - Band multiplier (default: 2)
 * @returns {object} {vwap, upper, lower}
 */
const calculateVWAPBands = (candles, vwap, multiplier = 2) => {
  if (!candles || !vwap || candles.length !== vwap.length) {
    return { vwap: vwap || [], upper: [], lower: [] }
  }

  const upper = []
  const lower = []
  
  let cumulativeVariance = 0
  let count = 0
  let currentDay = null
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i]
    const date = new Date(candle.timestamp)
    const day = date.toISOString().split('T')[0]
    
    // Reset at day boundary
    if (currentDay !== null && day !== currentDay) {
      cumulativeVariance = 0
      count = 0
    }
    currentDay = day
    
    if (vwap[i] === null) {
      upper.push(null)
      lower.push(null)
      continue
    }
    
    const typicalPrice = (candle.high + candle.low + candle.close) / 3
    cumulativeVariance += Math.pow(typicalPrice - vwap[i], 2)
    count++
    
    const stdDev = count > 1 ? Math.sqrt(cumulativeVariance / count) : 0
    
    upper.push(vwap[i] + (multiplier * stdDev))
    lower.push(vwap[i] - (multiplier * stdDev))
  }
  
  return { vwap, upper, lower }
}

/**
 * Get price position relative to VWAP
 * @param {number} price - Current price
 * @param {number} vwap - Current VWAP
 * @returns {string} 'above', 'below', or 'at'
 */
const getVWAPPosition = (price, vwap) => {
  if (price === null || vwap === null) return 'unknown'
  
  const diff = ((price - vwap) / vwap) * 100
  
  if (diff > 0.1) return 'above'
  if (diff < -0.1) return 'below'
  return 'at'
}

module.exports = {
  calculateVWAP,
  calculateVWAPBands,
  getVWAPPosition
}
