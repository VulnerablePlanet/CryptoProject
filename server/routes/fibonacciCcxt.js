/**
 * Fibonacci CCXT Routes
 * Express router for CCXT-based Fibonacci analysis endpoints
 */

const express = require('express')
const router = express.Router()
const { query, param, validationResult } = require('express-validator')
const fibonacciCcxtController = require('../controllers/fibonacciCcxtController')
const { auth } = require('../middleware/auth')

// All Fibonacci CCXT routes require authentication
router.use(auth)

// Validation check middleware
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() })
  }
  next()
}

// Valid timeframes
const VALID_TIMEFRAMES = ['1m','5m','15m','30m','1h','4h','1d','1w','1M']

// ============================================================================
// Static Routes (must come before parameterized routes)
// ============================================================================

// Get Fibonacci ratios configuration
router.get('/ratios', fibonacciCcxtController.getRatios)

// Get supported exchanges and timeframes
router.get('/supported', fibonacciCcxtController.getSupported)

// Multi-exchange comparison
// GET /api/fibonacci-ccxt/compare/BTC/USDT?timeframe=4h&exchanges=binance,kraken
router.get('/compare/:base/:quote',
  param('base').trim().notEmpty().withMessage('Base currency is required'),
  param('quote').trim().notEmpty().withMessage('Quote currency is required'),
  query('timeframe').optional().isIn(VALID_TIMEFRAMES).withMessage('Invalid timeframe'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('lookback').optional().isInt({ min: 2, max: 20 }).withMessage('Lookback must be between 2 and 20'),
  validate,
  fibonacciCcxtController.compareExchanges
)

// ============================================================================
// Parameterized Routes
// ============================================================================

// Full Fibonacci analysis with confluence
// GET /api/fibonacci-ccxt/binance/BTC/USDT?timeframe=4h
router.get('/:exchange/:base/:quote',
  param('exchange').trim().notEmpty().withMessage('Exchange is required'),
  param('base').trim().notEmpty().withMessage('Base currency is required'),
  param('quote').trim().notEmpty().withMessage('Quote currency is required'),
  query('timeframe').optional().isIn(VALID_TIMEFRAMES).withMessage('Invalid timeframe'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('lookback').optional().isInt({ min: 2, max: 20 }).withMessage('Lookback must be between 2 and 20'),
  query('threshold').optional().isFloat({ min: 0.1, max: 5 }).withMessage('Threshold must be between 0.1 and 5'),
  validate,
  fibonacciCcxtController.getAnalysis
)

// Just Fibonacci levels (lightweight)
// GET /api/fibonacci-ccxt/binance/BTC/USDT/levels
router.get('/:exchange/:base/:quote/levels',
  param('exchange').trim().notEmpty().withMessage('Exchange is required'),
  param('base').trim().notEmpty().withMessage('Base currency is required'),
  param('quote').trim().notEmpty().withMessage('Quote currency is required'),
  query('timeframe').optional().isIn(VALID_TIMEFRAMES).withMessage('Invalid timeframe'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('lookback').optional().isInt({ min: 2, max: 20 }).withMessage('Lookback must be between 2 and 20'),
  validate,
  fibonacciCcxtController.getLevels
)

// Just confluence indicators
// GET /api/fibonacci-ccxt/binance/BTC/USDT/confluence
router.get('/:exchange/:base/:quote/confluence',
  param('exchange').trim().notEmpty().withMessage('Exchange is required'),
  param('base').trim().notEmpty().withMessage('Base currency is required'),
  param('quote').trim().notEmpty().withMessage('Quote currency is required'),
  query('timeframe').optional().isIn(VALID_TIMEFRAMES).withMessage('Invalid timeframe'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validate,
  fibonacciCcxtController.getConfluence
)

module.exports = router
