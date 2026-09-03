/**
 * ============================================================================
 * CCXT Frontend Service
 * ============================================================================
 * Service for calling backend exchange API endpoints.
 * Uses shared createApiClient for automatic JWT auth + token refresh.
 */

import { createApiClient } from '@/services/api'

const api = createApiClient('/api/exchange')

/**
 * Fetch list of supported exchanges
 * @returns {Promise<object>} Supported exchanges and timeframes
 */
export const fetchSupportedExchanges = async () => {
  const response = await api.get('/supported')
  return response.data
}

/**
 * Fetch service status and cache statistics
 * @returns {Promise<object>} Service status
 */
export const fetchStatus = async () => {
  const response = await api.get('/status')
  return response.data
}

/**
 * Fetch available markets from an exchange
 * @param {string} exchange - Exchange identifier
 * @param {string} quote - Optional quote currency filter
 * @returns {Promise<object[]>} Array of markets
 */
export const fetchMarkets = async (exchange, quote = null) => {
  const params = quote ? { quote } : {}
  const response = await api.get(`/${exchange}/markets`, { params })
  return response.data.markets
}

/**
 * Fetch OHLCV candles from an exchange
 * @param {string} exchange - Exchange identifier
 * @param {string} base - Base currency (e.g., 'BTC')
 * @param {string} quote - Quote currency (e.g., 'USDT')
 * @param {string} timeframe - Candle timeframe
 * @param {number} limit - Number of candles
 * @returns {Promise<object>} Candle data response
 */
export const fetchOHLCV = async (exchange, base, quote, timeframe = '1h', limit = 100) => {
  const response = await api.get(
    `/${exchange}/ohlcv/${base}/${quote}`,
    { params: { timeframe, limit } }
  )
  return response.data
}

/**
 * Fetch order book from an exchange
 * @param {string} exchange - Exchange identifier
 * @param {string} base - Base currency
 * @param {string} quote - Quote currency
 * @param {number} limit - Depth limit
 * @returns {Promise<object>} Order book data
 */
export const fetchOrderBook = async (exchange, base, quote, limit = 50) => {
  const response = await api.get(
    `/${exchange}/orderbook/${base}/${quote}`,
    { params: { limit } }
  )
  return response.data
}

/**
 * Fetch ticker from an exchange
 * @param {string} exchange - Exchange identifier
 * @param {string} base - Base currency
 * @param {string} quote - Quote currency
 * @returns {Promise<object>} Ticker data
 */
export const fetchTicker = async (exchange, base, quote) => {
  const response = await api.get(`/${exchange}/ticker/${base}/${quote}`)
  return response.data
}

/**
 * Fetch available timeframes for an exchange
 * @param {string} exchange - Exchange identifier
 * @returns {Promise<string[]>} Array of timeframes
 */
export const fetchTimeframes = async (exchange) => {
  const response = await api.get(`/${exchange}/timeframes`)
  return response.data.timeframes
}

/**
 * Clear cache on the server
 * @param {string} exchange - Optional exchange to clear
 * @returns {Promise<object>} Result
 */
export const clearCache = async (exchange = null) => {
  const params = exchange ? { exchange } : {}
  const response = await api.delete('/cache', { params })
  return response.data
}

export default {
  fetchSupportedExchanges,
  fetchStatus,
  fetchMarkets,
  fetchOHLCV,
  fetchOrderBook,
  fetchTicker,
  fetchTimeframes,
  clearCache
}
