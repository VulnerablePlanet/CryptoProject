/**
 * Technical Indicators Utility Functions
 * Calculate common crypto trading indicators from OHLC data
 *
 * @deprecated FRONTEND DUPLICATE. The server now delegates all indicator
 *   calculations to the well-tested `technicalindicators` npm package
 *   (see server/trading/indicators/index.js). This frontend copy exists
 *   because the frontend uses different data shapes (scalar values for
 *   dashboard displays rather than full time series). Keep for now, but
 *   prefer server-side calculations for accuracy.
 */

/**
 * Calculate RSI (Relative Strength Index)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - RSI period (default: 14)
 * @returns {number} RSI value (0-100)
 */
export const calculateRSI = (prices, period = 14) => {
  if (!prices || prices.length < period + 1) return null

  // Calculate price changes
  const changes = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }

  // Get the last 'period' changes
  const recentChanges = changes.slice(-period)

  // Separate gains and losses
  let gains = 0
  let losses = 0

  recentChanges.forEach(change => {
    if (change > 0) {
      gains += change
    } else {
      losses += Math.abs(change)
    }
  })

  // Calculate averages
  const avgGain = gains / period
  const avgLoss = losses / period

  // Avoid division by zero
  if (avgLoss === 0) return 100

  // Calculate RSI
  const rs = avgGain / avgLoss
  const rsi = 100 - (100 / (1 + rs))

  return Math.round(rsi * 100) / 100
}

/**
 * Calculate SMA (Simple Moving Average)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - SMA period
 * @returns {number} SMA value
 */
export const calculateSMA = (prices, period) => {
  if (!prices || prices.length < period) return null

  const recentPrices = prices.slice(-period)
  const sum = recentPrices.reduce((acc, price) => acc + price, 0)
  
  return sum / period
}

/**
 * Calculate EMA (Exponential Moving Average)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - EMA period
 * @returns {number} EMA value
 */
export const calculateEMA = (prices, period) => {
  if (!prices || prices.length < period) return null

  const multiplier = 2 / (period + 1)
  
  // Start with SMA for the first EMA value
  let ema = calculateSMA(prices.slice(0, period), period)
  
  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
  }
  
  return ema
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param {number[]} prices - Array of closing prices
 * @returns {Object} { macd, signal, histogram }
 */
export const calculateMACD = (prices) => {
  if (!prices || prices.length < 26) return null

  const ema12 = calculateEMA(prices, 12)
  const ema26 = calculateEMA(prices, 26)
  
  if (!ema12 || !ema26) return null

  const macd = ema12 - ema26
  
  // For signal line, we need historical MACD values
  // Simplified: just return current MACD
  return {
    macd: Math.round(macd * 100) / 100,
    ema12: Math.round(ema12 * 100) / 100,
    ema26: Math.round(ema26 * 100) / 100
  }
}

/**
 * Get RSI interpretation
 * @param {number} rsi - RSI value
 * @returns {Object} { status, color, description }
 */
export const getRSIInterpretation = (rsi) => {
  if (rsi === null) return { status: 'N/A', color: 'gray', description: 'Insufficient data' }
  
  if (rsi >= 70) {
    return { status: 'Overbought', color: 'danger', description: 'Consider selling' }
  } else if (rsi <= 30) {
    return { status: 'Oversold', color: 'success', description: 'Consider buying' }
  } else if (rsi >= 50) {
    return { status: 'Bullish', color: 'success', description: 'Upward momentum' }
  } else {
    return { status: 'Bearish', color: 'danger', description: 'Downward momentum' }
  }
}

/**
 * Calculate all indicators at once
 * @param {Array} candles - Array of candle objects with 'close' property
 * @returns {Object} All calculated indicators
 */
export const calculateAllIndicators = (candles) => {
  if (!candles || candles.length === 0) {
    return {
      rsi: null,
      sma7: null,
      sma14: null,
      sma30: null,
      ema12: null,
      ema26: null,
      macd: null,
      rsiHistory: [],
      sma7History: [],
      sma14History: [],
      sma30History: [],
      ema12History: [],
      ema26History: [],
      macdHistory: []
    }
  }

  // Extract closing prices
  const closePrices = candles.map(c => c.close)

  return {
    rsi: calculateRSI(closePrices, 14),
    sma7: calculateSMA(closePrices, 7),
    sma14: calculateSMA(closePrices, 14),
    sma30: calculateSMA(closePrices, 30),
    ema12: calculateEMA(closePrices, 12),
    ema26: calculateEMA(closePrices, 26),
    macd: calculateMACD(closePrices),
    // Historical arrays for sparklines
    rsiHistory: calculateRSIHistory(closePrices, 14),
    sma7History: calculateSMAHistory(closePrices, 7),
    sma14History: calculateSMAHistory(closePrices, 14),
    sma30History: calculateSMAHistory(closePrices, 30),
    ema12History: calculateEMAHistory(closePrices, 12),
    ema26History: calculateEMAHistory(closePrices, 26),
    macdHistory: calculateMACDHistory(closePrices)
  }
}

/**
 * Calculate SMA history (array of SMA values over time)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - SMA period
 * @returns {number[]} Array of SMA values
 */
export const calculateSMAHistory = (prices, period) => {
  if (!prices || prices.length < period) return []
  
  const result = []
  // Pad with nulls for the first (period-1) values where SMA can't be calculated
  for (let i = 0; i < period - 1; i++) {
    result.push(null)
  }
  // Calculate SMA for remaining values
  for (let i = period - 1; i < prices.length; i++) {
    const slice = prices.slice(i - period + 1, i + 1)
    const sum = slice.reduce((acc, p) => acc + p, 0)
    result.push(sum / period)
  }
  return result
}

/**
 * Calculate EMA history (array of EMA values over time)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - EMA period
 * @returns {number[]} Array of EMA values
 */
export const calculateEMAHistory = (prices, period) => {
  if (!prices || prices.length < period) return []
  
  const multiplier = 2 / (period + 1)
  const result = []
  
  // Pad with nulls for the first (period-1) values where EMA can't be calculated
  for (let i = 0; i < period - 1; i++) {
    result.push(null)
  }
  
  // First EMA is SMA
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(ema)
  
  // Calculate remaining EMAs
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema
    result.push(ema)
  }
  
  return result
}

/**
 * Calculate MACD history
 * @param {number[]} prices - Array of closing prices
 * @returns {number[]} Array of MACD values (EMA12 - EMA26)
 */
export const calculateMACDHistory = (prices) => {
  if (!prices || prices.length < 26) return []
  
  const ema12History = calculateEMAHistory(prices, 12)
  const ema26History = calculateEMAHistory(prices, 26)
  
  const result = []
  
  // Build MACD array aligned with prices
  for (let i = 0; i < prices.length; i++) {
    const ema12 = ema12History[i]
    const ema26 = ema26History[i]
    
    if (ema12 === null || ema26 === null) {
      result.push(null)
    } else {
      result.push(ema12 - ema26)
    }
  }
  
  return result
}

/**
 * Generate SVG path for sparkline
 * @param {number[]} data - Array of values
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {string} SVG path d attribute
 */
export const generateSparklinePath = (data, width = 80, height = 30) => {
  if (!data || data.length < 2) return ''
  
  // Filter out null, undefined, and NaN values
  const validData = data.filter(value => value !== null && value !== undefined && !isNaN(value))
  
  if (validData.length < 2) return ''
  
  const min = Math.min(...validData)
  const max = Math.max(...validData)
  const range = max - min || 1
  
  const points = validData.map((value, index) => {
    const x = (index / (validData.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })
  
  return `M ${points.join(' L ')}`
}

/**
 * Calculate RSI history (array of RSI values over time)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - RSI period
 * @returns {number[]} Array of RSI values
 */
export const calculateRSIHistory = (prices, period = 14) => {
  if (!prices || prices.length < period + 1) return []
  
  const result = []
  
  // Pad with nulls for the first period values where RSI can't be calculated
  for (let i = 0; i < period; i++) {
    result.push(null)
  }
  
  // Calculate RSI for each point where we have enough data
  for (let i = period; i < prices.length; i++) {
    const slice = prices.slice(0, i + 1)
    const rsi = calculateRSI(slice, period)
    result.push(rsi)
  }
  
  return result
}

export default {
  calculateRSI,
  calculateSMA,
  calculateEMA,
  calculateMACD,
  getRSIInterpretation,
  calculateAllIndicators,
  calculateRSIHistory,
  calculateSMAHistory,
  calculateEMAHistory,
  calculateMACDHistory,
  generateSparklinePath
}
