/**
 * Technical Indicators Utility Functions
 * Calculate common crypto trading indicators from OHLC data
 *
 * Client-side copy used for chart overlays (Pro Trading) so charts do not
 * need a server round trip per redraw. It MUST produce the same values as
 * the server's `technicalindicators`-based implementation:
 * test/utils/technicalIndicatorsParity.test.js enforces that parity.
 */

/**
 * Wilder's RSI series (the standard definition, and the one the server and
 * the trading agent use via `technicalindicators`).
 *
 * Seed: simple average of the first `period` gains/losses; then Wilder
 * smoothing avg = (prev * (period - 1) + current) / period.
 * The previous implementation averaged only the last `period` changes
 * (Cutler's RSI), so the same chart showed a different RSI here than in
 * TA-Lib, signals and the agent (e.g. 46.03 vs 60.88).
 *
 * @param {number[]} prices - Closing prices
 * @param {number} period
 * @returns {(number|null)[]} RSI per price index (null until enough data)
 */
const wilderRSISeries = (prices, period) => {
  const result = new Array(prices.length).fill(null)
  if (!prices || prices.length < period + 1) return result

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) avgGain += change
    else avgLoss -= change
  }
  avgGain /= period
  avgLoss /= period

  const toRSI = () => (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  result[period] = toRSI()

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result[i] = toRSI()
  }
  return result
}

const round2 = (value) => (value === null ? null : Math.round(value * 100) / 100)

/**
 * Calculate RSI (Relative Strength Index, Wilder)
 * @param {number[]} prices - Array of closing prices
 * @param {number} period - RSI period (default: 14)
 * @returns {number|null} RSI value (0-100)
 */
export const calculateRSI = (prices, period = 14) => {
  if (!prices || prices.length < period + 1) return null
  const series = wilderRSISeries(prices, period)
  return round2(series[series.length - 1])
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
  // Single O(n) pass (was O(n²): one full RSI per slice)
  return wilderRSISeries(prices, period).map(round2)
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
