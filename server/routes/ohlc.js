const express = require('express')
const router = express.Router()
const ohlcController = require('../controllers/ohlcController')
const { auth } = require('../middleware/auth')
const requireRole = require('../middleware/requireRole')
const { heavyOpsRateLimiter } = require('../middleware/rateLimit')

/**
 * @route   GET /api/ohlc/coins
 * @desc    Get list of supported coins
 * @access  Public
 */
router.get('/coins', ohlcController.getSupportedCoins)

/**
 * @route   GET /api/ohlc/status
 * @desc    Get OHLC service status
 * @access  Public
 */
router.get('/status', ohlcController.getStatus)

/**
 * @route   GET /api/ohlc/:coinId/candles
 * @desc    Get OHLC candles for a coin
 * @query   timeframe - 5m, 15m, 30m, 1h, 4h, 1d (default: 1h)
 * @query   vs_currency - usd, eur, etc (default: usd)
 * @query   limit - max candles to return (default: 100, max: 500)
 * @query   from - start timestamp (optional)
 * @query   to - end timestamp (optional)
 * @access  Public
 */
router.get('/:coinId/candles', ohlcController.getCandles)

/**
 * @route   POST /api/ohlc/:coinId/sync
 * @desc    Sync candles for a coin (force update)
 * @body    timeframe - timeframe to sync
 * @body    vs_currency - quote currency
 * @access  Public
 */
router.post('/:coinId/sync', auth, requireRole('admin'), heavyOpsRateLimiter, ohlcController.syncCoin)

/**
 * @route   POST /api/ohlc/:coinId/sync-all
 * @desc    Sync all timeframes for a coin
 * @body    vs_currency - quote currency
 * @access  Public
 */
router.post('/:coinId/sync-all', auth, requireRole('admin'), heavyOpsRateLimiter, ohlcController.syncAllTimeframes)

module.exports = router
