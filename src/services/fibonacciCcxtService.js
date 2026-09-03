/**
 * Fibonacci CCXT Service
 * API client for CCXT-based Fibonacci analysis endpoints.
 * Uses shared createApiClient for automatic JWT auth + token refresh.
 */

import { createApiClient } from '@/services/api'
import { logger } from '@/utils/logger'

const api = createApiClient('/api/fibonacci-ccxt')

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
    const response = await api.get(`/${exchange}/${base}/${quote}`, {
      params: {
        timeframe,
        lookback: options.lookback || 5,
        threshold: options.threshold || 0.5,
        limit: options.limit || 100
      }
    })
    return response.data
  } catch (error) {
    logger.error('FibonacciCCXT Service - getAnalysis error:', error)
    throw error
  }
}

/**
 * Get just Fibonacci levels (lightweight)
 */
export const getLevels = async (exchange, symbol, timeframe = '4h') => {
  try {
    const [base, quote] = symbol.split('/')
    const response = await api.get(`/${exchange}/${base}/${quote}/levels`, {
      params: { timeframe }
    })
    return response.data
  } catch (error) {
    logger.error('FibonacciCCXT Service - getLevels error:', error)
    throw error
  }
}

/**
 * Get confluence indicators only
 */
export const getConfluence = async (exchange, symbol, timeframe = '4h') => {
  try {
    const [base, quote] = symbol.split('/')
    const response = await api.get(`/${exchange}/${base}/${quote}/confluence`, {
      params: { timeframe }
    })
    return response.data
  } catch (error) {
    logger.error('FibonacciCCXT Service - getConfluence error:', error)
    throw error
  }
}

/**
 * Compare Fibonacci levels across multiple exchanges
 */
export const compareExchanges = async (symbol, timeframe = '4h', exchanges = null) => {
  try {
    const [base, quote] = symbol.split('/')
    const params = { timeframe }
    if (exchanges && exchanges.length > 0) {
      params.exchanges = exchanges.join(',')
    }
    const response = await api.get(`/compare/${base}/${quote}`, { params })
    return response.data
  } catch (error) {
    logger.error('FibonacciCCXT Service - compareExchanges error:', error)
    throw error
  }
}

/**
 * Get Fibonacci ratios configuration
 */
export const getRatios = async () => {
  try {
    const response = await api.get('/ratios')
    return response.data
  } catch (error) {
    logger.error('FibonacciCCXT Service - getRatios error:', error)
    throw error
  }
}

/**
 * Get supported exchanges and timeframes
 */
export const getSupported = async () => {
  try {
    const response = await api.get('/supported')
    return response.data
  } catch (error) {
    logger.error('FibonacciCCXT Service - getSupported error:', error)
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
