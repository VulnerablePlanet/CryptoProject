/**
 * TA-Lib API Service
 * Service layer for communicating with TA-Lib backend API.
 * Uses shared createApiClient for automatic JWT auth + token refresh.
 */

import { createApiClient } from '@/services/api'

const api = createApiClient('/api/talib')

/**
 * Detect market regime for a symbol
 * @param {string} symbol - Trading symbol (e.g., 'BTCUSD')
 * @param {Array} candles - OHLCV candle data
 * @returns {Promise<Object>} Regime detection result
 */
export async function detectRegime(symbol, candles) {
  const response = await api.post(`/regime/${symbol}`, { candles })
  return response.data
}

/**
 * Calculate multi-indicator score for a symbol
 * @param {string} symbol - Trading symbol
 * @param {Array} candles - OHLCV candle data
 * @param {string} regime - Market regime (optional)
 * @returns {Promise<Object>} Indicator scoring result
 */
export async function calculateScore(symbol, candles, regime = null) {
  const response = await api.post(`/score/${symbol}`, { candles, regime })
  return response.data
}

/**
 * Perform multi-timeframe analysis
 * @param {string} symbol - Trading symbol
 * @param {Object} candlesByTimeframe - Candles organized by timeframe
 * @returns {Promise<Object>} MTF analysis result
 */
export async function analyzeMTF(symbol, candlesByTimeframe) {
  const response = await api.post(`/mtf/${symbol}`, { candlesByTimeframe })
  return response.data
}

/**
 * Analyze volume profile and patterns
 * @param {string} symbol - Trading symbol
 * @param {Array} candles - OHLCV candle data
 * @param {Array} trades - Trade data (optional)
 * @returns {Promise<Object>} Volume analysis result
 */
export async function analyzeVolume(symbol, candles, trades = null) {
  const response = await api.post(`/volume/${symbol}`, { candles, trades })
  return response.data
}

/**
 * Analyze order book for intelligence
 * @param {string} symbol - Trading symbol
 * @param {Object} orderbook - Current order book data
 * @param {Object} previousOrderbook - Previous order book (optional, for spoofing)
 * @returns {Promise<Object>} Order book analysis result
 */
export async function analyzeOrderBook(symbol, orderbook, previousOrderbook = null) {
  const response = await api.post(`/orderbook/${symbol}`, { orderbook, previousOrderbook })
  return response.data
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
  const response = await api.post(`/analyze/${symbol}`, params)
  return response.data
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache stats
 */
export async function getCacheStats() {
  const response = await api.get('/cache/stats')
  return response.data
}

/**
 * Clear cache
 * @returns {Promise<Object>} Clear result
 */
export async function clearCache() {
  const response = await api.delete('/cache')
  return response.data
}

/**
 * Health check
 * @returns {Promise<Object>} Health status
 */
export async function healthCheck() {
  const response = await api.get('/health')
  return response.data
}

/**
 * Detect candlestick patterns
 * @param {string} symbol - Trading symbol
 * @param {Array} candles - OHLCV candle data
 * @param {number} lookback - Number of recent candles to scan (optional)
 * @returns {Promise<Object>} Pattern detection result
 */
export async function detectPatterns(symbol, candles, lookback = 50) {
  const response = await api.post(`/patterns/${symbol}`, { candles, lookback })
  return response.data
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
  detectPatterns
}
