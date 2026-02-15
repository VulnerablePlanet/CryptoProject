/**
 * TA-Lib API Service
 * Service layer for communicating with TA-Lib backend API
 */

const API_BASE = import.meta.env.PROD 
  ? '/api/talib' 
  : 'http://localhost:5000/api/talib'

/**
 * Detect market regime for a symbol
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSD')
 * @param {Array} candles - OHLCV candle data
 * @returns {Promise<Object>} Regime detection result
 */
export async function detectRegime(symbol, candles) {
  const response = await fetch(`${API_BASE}/regime/${symbol}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candles })
  })
  return response.json()
}

/**
 * Calculate multi-indicator score for a symbol
 * @param {string} symbol - Trading symbol
 * @param {Array} candles - OHLCV candle data
 * @param {string} regime - Market regime (optional)
 * @returns {Promise<Object>} Indicator scoring result
 */
export async function calculateScore(symbol, candles, regime = null) {
  const response = await fetch(`${API_BASE}/score/${symbol}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candles, regime })
  })
  return response.json()
}

/**
 * Perform multi-timeframe analysis
 * @param {string} symbol - Trading symbol
 * @param {Object} candlesByTimeframe - Candles organized by timeframe
 * @returns {Promise<Object>} MTF analysis result
 */
export async function analyzeMTF(symbol, candlesByTimeframe) {
  const response = await fetch(`${API_BASE}/mtf/${symbol}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candlesByTimeframe })
  })
  return response.json()
}

/**
 * Analyze volume profile and patterns
 * @param {string} symbol - Trading symbol
 * @param {Array} candles - OHLCV candle data
 * @param {Array} trades - Trade data (optional)
 * @returns {Promise<Object>} Volume analysis result
 */
export async function analyzeVolume(symbol, candles, trades = null) {
  const response = await fetch(`${API_BASE}/volume/${symbol}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candles, trades })
  })
  return response.json()
}

/**
 * Analyze order book for intelligence
 * @param {string} symbol - Trading symbol
 * @param {Object} orderbook - Current order book data
 * @param {Object} previousOrderbook - Previous order book (optional, for spoofing)
 * @returns {Promise<Object>} Order book analysis result
 */
export async function analyzeOrderBook(symbol, orderbook, previousOrderbook = null) {
  const response = await fetch(`${API_BASE}/orderbook/${symbol}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderbook, previousOrderbook })
  })
  return response.json()
}

/**
 * Perform complete analysis with all features
 * @param {string} symbol - Trading symbol
 * @param {Object} params - Analysis parameters
 * @param {Array} params.candles - OHLCV candle data
 * @param {Object} params.candlesByTimeframe - Multi-timeframe candles (optional)
 * @param {Object} params.orderbook - Order book data (optional)
 * @param {Object} params.previousOrderbook - Previous order book (optional)
 * @param {Array} params.trades - Trade data (optional)
 * @returns {Promise<Object>} Complete analysis result
 */
export async function analyzeComplete(symbol, params) {
  const response = await fetch(`${API_BASE}/analyze/${symbol}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  return response.json()
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache stats
 */
export async function getCacheStats() {
  const response = await fetch(`${API_BASE}/cache/stats`)
  return response.json()
}

/**
 * Clear cache
 * @returns {Promise<Object>} Clear result
 */
export async function clearCache() {
  const response = await fetch(`${API_BASE}/cache`, {
    method: 'DELETE'
  })
  return response.json()
}

/**
 * Health check
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
  const response = await fetch(`${API_BASE}/health`)
  return response.json()
}

/**
 * Detect candlestick patterns
 * @param {string} symbol - Trading symbol
 * @param {Array} candles - OHLCV candle data
 * @param {number} lookback - Number of recent candles to scan (optional)
 * @returns {Promise<Object>} Pattern detection result
 */
export async function detectPatterns(symbol, candles, lookback = 50) {
  const response = await fetch(`${API_BASE}/patterns/${symbol}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candles, lookback })
  })
  return response.json()
}

// Export as default object
export default {
  detectRegime,
  calculateScore,
  analyzeMTF,
  analyzeVolume,
  analyzeOrderBook,
  analyzeComplete,
  getCacheStats,
  clearCache,
  healthCheck,
  detectPatterns  // NEW
}
