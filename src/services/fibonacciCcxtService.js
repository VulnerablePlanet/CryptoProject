/**
 * Fibonacci CCXT Service
 * API client for CCXT-based Fibonacci analysis endpoints
 */

const API_BASE = import.meta.env.PROD 
  ? '/api/fibonacci-ccxt' 
  : 'http://localhost:5000/api/fibonacci-ccxt'

/**
 * Get full Fibonacci analysis with confluence for a trading pair
 * @param {string} exchange - Exchange ID (binance, kraken, etc.)
 * @param {string} symbol - Trading pair (e.g., 'BTC/USDT')
 * @param {string} timeframe - Timeframe (e.g., '4h')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Analysis result
 */
export const getAnalysis = async (exchange, symbol, timeframe = '4h', options = {}) => {
  try {
    const [base, quote] = symbol.split('/')
    const params = new URLSearchParams({
      timeframe,
      lookback: options.lookback || 5,
      threshold: options.threshold || 0.5,
      limit: options.limit || 100
    })

    const response = await fetch(
      `${API_BASE}/${exchange}/${base}/${quote}?${params}`
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch Fibonacci analysis')
    }

    return data
  } catch (error) {
    console.error('FibonacciCCXT Service - getAnalysis error:', error)
    throw error
  }
}

/**
 * Get just Fibonacci levels (lightweight)
 */
export const getLevels = async (exchange, symbol, timeframe = '4h') => {
  try {
    const [base, quote] = symbol.split('/')
    const response = await fetch(
      `${API_BASE}/${exchange}/${base}/${quote}/levels?timeframe=${timeframe}`
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch Fibonacci levels')
    }

    return data
  } catch (error) {
    console.error('FibonacciCCXT Service - getLevels error:', error)
    throw error
  }
}

/**
 * Get confluence indicators only
 */
export const getConfluence = async (exchange, symbol, timeframe = '4h') => {
  try {
    const [base, quote] = symbol.split('/')
    const response = await fetch(
      `${API_BASE}/${exchange}/${base}/${quote}/confluence?timeframe=${timeframe}`
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch confluence data')
    }

    return data
  } catch (error) {
    console.error('FibonacciCCXT Service - getConfluence error:', error)
    throw error
  }
}

/**
 * Compare Fibonacci levels across multiple exchanges
 */
export const compareExchanges = async (symbol, timeframe = '4h', exchanges = null) => {
  try {
    const [base, quote] = symbol.split('/')
    const params = new URLSearchParams({ timeframe })
    if (exchanges) {
      params.append('exchanges', exchanges.join(','))
    }

    const response = await fetch(
      `${API_BASE}/compare/${base}/${quote}?${params}`
    )

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to compare exchanges')
    }

    return data
  } catch (error) {
    console.error('FibonacciCCXT Service - compareExchanges error:', error)
    throw error
  }
}

/**
 * Get Fibonacci ratios configuration
 */
export const getRatios = async () => {
  try {
    const response = await fetch(`${API_BASE}/ratios`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch ratios')
    }

    return data
  } catch (error) {
    console.error('FibonacciCCXT Service - getRatios error:', error)
    throw error
  }
}

/**
 * Get supported exchanges and timeframes
 */
export const getSupported = async () => {
  try {
    const response = await fetch(`${API_BASE}/supported`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch supported data')
    }

    return data
  } catch (error) {
    console.error('FibonacciCCXT Service - getSupported error:', error)
    throw error
  }
}

export default {
  getAnalysis,
  getLevels,
  getConfluence,
  compareExchanges,
  getRatios,
  getSupported
}
