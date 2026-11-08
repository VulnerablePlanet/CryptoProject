/**
 * Fibonacci Controller
 * Handles HTTP requests for Fibonacci analysis endpoints
 */

const fibonacciService = require('../services/fibonacciService')
const { createLogger } = require('../utils/logger')

const logger = createLogger('fibonacciController')

/**
 * Not enough market data → 422 with an actionable message.
 * Anything else → generic 500 (internal error details stay in the logs).
 */
const sendError = (res, error, context, fallbackMessage) => {
  if (error.code === 'INSUFFICIENT_DATA') {
    return res.status(422).json({ success: false, code: error.code, message: error.message })
  }
  logger.error(context, error)
  return res.status(500).json({ success: false, message: fallbackMessage })
}

/**
 * Get full Fibonacci analysis for a coin
 * GET /api/fibonacci/:coinId
 * 
 * Query params:
 * - timeframe: '5m' | '15m' | '30m' | '1h' | '4h' | '1d' (default: '4h')
 * - lookback: number of candles for pivot detection (default: 5)
 * - threshold: minimum % change for pivots (default: 0.5)
 * - limit: number of candles to analyze (default: 100)
 */
const getAnalysis = async (req, res) => {
  try {
    const { coinId } = req.params
    const {
      timeframe = '4h',
      lookback = 5,
      threshold = 0.5,
      limit = 100
    } = req.query

    // Validate timeframe
    const validTimeframes = ['5m', '15m', '30m', '1h', '4h', '1d']
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        message: `Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`
      })
    }

    // Validate lookback
    const parsedLookback = Math.min(Math.max(parseInt(lookback) || 5, 2), 20)
    
    // Validate threshold
    const parsedThreshold = Math.min(Math.max(parseFloat(threshold) || 0.5, 0.1), 5)
    
    // Validate limit
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 100, 50), 500)

    const analysis = await fibonacciService.analyzeFibonacci(
      coinId.toLowerCase(),
      timeframe,
      {
        lookback: parsedLookback,
        threshold: parsedThreshold,
        limit: parsedLimit
      }
    )

    res.json(analysis)
  } catch (error) {
    sendError(res, error, 'Fibonacci analysis failed', 'Failed to perform Fibonacci analysis')
  }
}

/**
 * Get only pivot points for a coin
 * GET /api/fibonacci/:coinId/pivots
 */
const getPivots = async (req, res) => {
  try {
    const { coinId } = req.params
    const {
      timeframe = '4h',
      lookback = 5,
      threshold = 0.5,
      limit = 100
    } = req.query

    const result = await fibonacciService.getPivots(
      coinId.toLowerCase(),
      timeframe,
      {
        lookback: parseInt(lookback) || 5,
        threshold: parseFloat(threshold) || 0.5,
        limit: parseInt(limit) || 100
      }
    )

    res.json(result)
  } catch (error) {
    sendError(res, error, 'Pivot detection failed', 'Failed to detect pivot points')
  }
}

/**
 * Get Fibonacci ratios configuration
 * GET /api/fibonacci/ratios
 */
const getRatios = async (req, res) => {
  res.json({
    success: true,
    retracement: fibonacciService.RETRACEMENT_RATIOS,
    extensions: fibonacciService.EXTENSION_RATIOS
  })
}

module.exports = {
  getAnalysis,
  getPivots,
  getRatios
}
