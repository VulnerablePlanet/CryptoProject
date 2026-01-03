/**
 * Fibonacci Service
 * API client for Fibonacci analysis endpoints
 */

const API_BASE = 'http://localhost:5000/api/fibonacci'

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
    const params = new URLSearchParams({
      timeframe,
      lookback: lookback.toString(),
      threshold: threshold.toString(),
      limit: limit.toString()
    })

    const response = await fetch(`${API_BASE}/${coinId}?${params}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch Fibonacci analysis')
    }

    return data
  } catch (error) {
    console.error('Fibonacci Service - getAnalysis error:', error)
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
    const params = new URLSearchParams({
      timeframe,
      lookback: lookback.toString(),
      threshold: threshold.toString(),
      limit: limit.toString()
    })

    const response = await fetch(`${API_BASE}/${coinId}/pivots?${params}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch pivot points')
    }

    return data
  } catch (error) {
    console.error('Fibonacci Service - getPivots error:', error)
    throw error
  }
}

/**
 * Get Fibonacci ratios configuration
 * @returns {Promise<Object>} Ratios configuration
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
    console.error('Fibonacci Service - getRatios error:', error)
    throw error
  }
}

export default {
  getAnalysis,
  getPivots,
  getRatios
}
