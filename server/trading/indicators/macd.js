/**
 * @deprecated Use `const { calculateMACD, detectMACDCrossover } = require('../indicators')`
 *             instead. The barrel file now delegates to the `technicalindicators` npm package.
 *
 * ============================================================================
 * MACD - Moving Average Convergence Divergence
 * ============================================================================
 * Trend-following momentum indicator showing relationship between two EMAs.
 * Default: Fast(12), Slow(26), Signal(9)
 */

const { calculateEMA } = require('./movingAverages')

/**
 * Calculate MACD
 * @param {number[]} prices - Array of close prices
 * @param {number} fastPeriod - Fast EMA period (default: 12)
 * @param {number} slowPeriod - Slow EMA period (default: 26)
 * @param {number} signalPeriod - Signal line period (default: 9)
 * @returns {object} { macd: [], signal: [], histogram: [] }
 */
const calculateMACD = (prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (!prices || prices.length < slowPeriod) {
    const empty = prices ? prices.map(() => null) : []
    return { macd: empty, signal: empty, histogram: empty }
  }

  // Calculate fast and slow EMAs
  const fastEMA = calculateEMA(prices, fastPeriod)
  const slowEMA = calculateEMA(prices, slowPeriod)
  
  // Calculate MACD line (fast EMA - slow EMA)
  const macdLine = []
  for (let i = 0; i < prices.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null)
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i])
    }
  }
  
  // Calculate Signal line (EMA of MACD line)
  // Only consider non-null MACD values
  const nonNullMACD = macdLine.filter(v => v !== null)
  const signalRaw = calculateEMA(nonNullMACD, signalPeriod)
  
  // Map signal back to original indices
  const signalLine = []
  let signalIdx = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null)
    } else {
      signalLine.push(signalRaw[signalIdx] ?? null)
      signalIdx++
    }
  }
  
  // Calculate histogram (MACD - Signal)
  const histogram = []
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null)
    } else {
      histogram.push(macdLine[i] - signalLine[i])
    }
  }
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  }
}

/**
 * Detect MACD crossover
 * @param {number[]} macd - MACD line values
 * @param {number[]} signal - Signal line values
 * @returns {string|null} 'bullish_cross', 'bearish_cross', or null
 */
const detectMACDCrossover = (macd, signal) => {
  if (!macd || !signal || macd.length < 2) return null
  
  const len = macd.length
  const curr = { macd: macd[len - 1], signal: signal[len - 1] }
  const prev = { macd: macd[len - 2], signal: signal[len - 2] }
  
  if (curr.macd === null || curr.signal === null || 
      prev.macd === null || prev.signal === null) {
    return null
  }
  
  // Bullish cross: MACD crosses above Signal
  if (prev.macd <= prev.signal && curr.macd > curr.signal) {
    return 'bullish_cross'
  }
  
  // Bearish cross: MACD crosses below Signal
  if (prev.macd >= prev.signal && curr.macd < curr.signal) {
    return 'bearish_cross'
  }
  
  return null
}

module.exports = {
  calculateMACD,
  detectMACDCrossover
}
