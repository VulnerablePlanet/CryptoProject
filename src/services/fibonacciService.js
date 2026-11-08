/**
 * Fibonacci Service
 * API client for Fibonacci analysis endpoints
 */

import { logger } from '@/utils/logger'
import { createApiClient } from '@/services/api'

// Authenticated client (raw fetch() here sent no token → always 401)
const api = createApiClient('/api/fibonacci')

/** Surface the server's message, like the previous fetch-based code did */
const request = async (path, params, fallbackMessage) => {
  try {
    const { data } = await api.get(path, { params })
    return data
  } catch (error) {
    throw new Error(error.response?.data?.message || fallbackMessage, { cause: error })
  }
}

/**
 * Get full Fibonacci analysis for a coin
 * @param {string} coinId - CoinGecko coin ID
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Analysis result
 */
export const getAnalysis = async (coinId, options = {}) => {
  const {
    timeframe = '4h',
    lookback = 5,
    threshold = 0.5,
    limit = 100
  } = options

  try {
    return await request(`/${coinId}`, { timeframe, lookback, threshold, limit }, 'Failed to fetch Fibonacci analysis')
  } catch (error) {
    logger.error('Fibonacci Service - getAnalysis error:', error)
    throw error
  }
}

/**
 * Get pivot points for a coin
 * @param {string} coinId - CoinGecko coin ID
 * @param {Object} options - Detection options
 * @returns {Promise<Object>} Pivots result
 */
export const getPivots = async (coinId, options = {}) => {
  const {
    timeframe = '4h',
    lookback = 5,
    threshold = 0.5,
    limit = 100
  } = options

  try {
    return await request(`/${coinId}/pivots`, { timeframe, lookback, threshold, limit }, 'Failed to fetch pivot points')
  } catch (error) {
    logger.error('Fibonacci Service - getPivots error:', error)
    throw error
  }
}

/**
 * Get Fibonacci ratios configuration
 * @returns {Promise<Object>} Ratios configuration
 */
export const getRatios = async () => {
  try {
    return await request('/ratios', undefined, 'Failed to fetch ratios')
  } catch (error) {
    logger.error('Fibonacci Service - getRatios error:', error)
    throw error
  }
}

export default {
  getAnalysis,
  getPivots,
  getRatios
}
