/**
 * ============================================================================
 * CCXT Frontend Service
 * ============================================================================
 * Service for calling backend exchange API endpoints.
 */

const API_BASE = 'http://localhost:5000/api/exchange'

/**
 * Fetch list of supported exchanges
 * @returns {Promise<object>} Supported exchanges and timeframes
 */
export const fetchSupportedExchanges = async () => {
  const response = await fetch(`${API_BASE}/supported`)
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch supported exchanges')
  }
  
  return data
}

/**
 * Fetch service status and cache statistics
 * @returns {Promise<object>} Service status
 */
export const fetchStatus = async () => {
  const response = await fetch(`${API_BASE}/status`)
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch status')
  }
  
  return data
}

/**
 * Fetch available markets from an exchange
 * @param {string} exchange - Exchange identifier
 * @param {string} quote - Optional quote currency filter
 * @returns {Promise<object[]>} Array of markets
 */
export const fetchMarkets = async (exchange, quote = null) => {
  let url = `${API_BASE}/${exchange}/markets`
  if (quote) {
    url += `?quote=${quote}`
  }
  
  const response = await fetch(url)
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch markets')
  }
  
  return data.markets
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
  const response = await fetch(
    `${API_BASE}/${exchange}/ohlcv/${base}/${quote}?timeframe=${timeframe}&limit=${limit}`
  )
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch OHLCV data')
  }
  
  return data
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
  const response = await fetch(
    `${API_BASE}/${exchange}/orderbook/${base}/${quote}?limit=${limit}`
  )
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch order book')
  }
  
  return data
}

/**
 * Fetch ticker from an exchange
 * @param {string} exchange - Exchange identifier
 * @param {string} base - Base currency
 * @param {string} quote - Quote currency
 * @returns {Promise<object>} Ticker data
 */
export const fetchTicker = async (exchange, base, quote) => {
  const response = await fetch(
    `${API_BASE}/${exchange}/ticker/${base}/${quote}`
  )
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch ticker')
  }
  
  return data
}

/**
 * Fetch available timeframes for an exchange
 * @param {string} exchange - Exchange identifier
 * @returns {Promise<string[]>} Array of timeframes
 */
export const fetchTimeframes = async (exchange) => {
  const response = await fetch(`${API_BASE}/${exchange}/timeframes`)
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch timeframes')
  }
  
  return data.timeframes
}

/**
 * Clear cache on the server
 * @param {string} exchange - Optional exchange to clear
 * @returns {Promise<object>} Result
 */
export const clearCache = async (exchange = null) => {
  const url = exchange 
    ? `${API_BASE}/cache?exchange=${exchange}` 
    : `${API_BASE}/cache`
    
  const response = await fetch(url, { method: 'DELETE' })
  const data = await response.json()
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to clear cache')
  }
  
  return data
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
