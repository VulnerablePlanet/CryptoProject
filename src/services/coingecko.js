import axios from 'axios'

// Use Vite proxy to avoid CORS issues during development
// The proxy is configured in vite.config.js to forward to api.coingecko.com
const BASE_URL = '/api/coingecko'

// Create axios instance with default config
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
  }
})


// Rate limiting helper (30 calls/min for free tier, using 5 sec minimum to be safe)
let lastCallTime = 0
const MIN_CALL_INTERVAL = 5000 // 5 seconds between calls to be safe

const rateLimitedCall = async (requestFn) => {
  const now = Date.now()
  const timeSinceLastCall = now - lastCallTime
  
  if (timeSinceLastCall < MIN_CALL_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_CALL_INTERVAL - timeSinceLastCall))
  }
  
  lastCallTime = Date.now()
  return requestFn()
}

/**
 * Get list of coins with market data
 * @param {Object} params - Query parameters
 * @param {string} params.vs_currency - Target currency (default: 'usd')
 * @param {number} params.per_page - Results per page (default: 100)
 * @param {number} params.page - Page number (default: 1)
 * @param {string} params.order - Sort order (default: 'market_cap_desc')
 * @param {boolean} params.sparkline - Include 7d sparkline (default: true)
 * @param {string} params.price_change_percentage - Price change intervals (default: '24h,7d')
 */
export const getCoinsMarkets = async (params = {}) => {
  const defaults = {
    vs_currency: 'usd',
    per_page: 50,
    page: 1,
    order: 'market_cap_desc',
    sparkline: true,
    price_change_percentage: '24h,7d'
  }
  
  return rateLimitedCall(async () => {
    const response = await api.get('/coins/markets', { params: { ...defaults, ...params } })
    return response.data
  })
}

/**
 * Get detailed data for a single coin
 * @param {string} id - Coin ID (e.g., 'bitcoin')
 */
export const getCoinDetails = async (id) => {
  return rateLimitedCall(async () => {
    const response = await api.get(`/coins/${id}`, {
      params: {
        localization: false,
        tickers: false,
        community_data: false,
        developer_data: false,
        sparkline: true
      }
    })
    return response.data
  })
}

/**
 * Get historical market chart data
 * @param {string} id - Coin ID
 * @param {Object} params - Query parameters
 * @param {string} params.vs_currency - Target currency (default: 'usd')
 * @param {string} params.days - Data days back (1, 7, 14, 30, 90, 180, 365, max)
 */
export const getCoinMarketChart = async (id, params = {}) => {
  const defaults = {
    vs_currency: 'usd',
    days: '7'
  }
  
  return rateLimitedCall(async () => {
    const response = await api.get(`/coins/${id}/market_chart`, { params: { ...defaults, ...params } })
    return response.data
  })
}

/**
 * Get trending coins
 */
export const getTrendingCoins = async () => {
  return rateLimitedCall(async () => {
    const response = await api.get('/search/trending')
    return response.data
  })
}

/**
 * Get global crypto market stats
 */
export const getGlobalStats = async () => {
  return rateLimitedCall(async () => {
    const response = await api.get('/global')
    return response.data
  })
}

/**
 * Simple price lookup for multiple coins
 * @param {string} ids - Comma-separated coin IDs
 * @param {string} vs_currencies - Comma-separated currencies
 */
export const getSimplePrice = async (ids, vs_currencies = 'usd') => {
  return rateLimitedCall(async () => {
    const response = await api.get('/simple/price', {
      params: {
        ids,
        vs_currencies,
        include_24hr_change: true,
        include_market_cap: true
      }
    })
    return response.data
  })
}

export default {
  getCoinsMarkets,
  getCoinDetails,
  getCoinMarketChart,
  getTrendingCoins,
  getGlobalStats,
  getSimplePrice
}
