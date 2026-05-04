/**
 * ============================================================================
 * TRADING API ROUTES
 * ============================================================================
 * Routes for technical analysis endpoints.
 */

const express = require('express')
const router = express.Router()
const tradingController = require('../controllers/tradingController')
const { auth } = require('../middleware/auth')

// All trading routes require authentication
router.use(auth)

// GET /api/trading/:symbol/indicators - Calculate indicators
router.get('/:symbol/indicators', tradingController.getIndicators)

// GET /api/trading/:symbol/analysis - Full analysis
router.get('/:symbol/analysis', tradingController.getAnalysis)

// GET /api/trading/:symbol/signals - Trading signals only
router.get('/:symbol/signals', tradingController.getSignals)

// GET /api/trading/:symbol/quality - Data quality report
router.get('/:symbol/quality', tradingController.getDataQuality)

// GET /api/trading/:symbol/patterns - Price action patterns
router.get('/:symbol/patterns', tradingController.getPatterns)

// GET /api/trading/:symbol/levels - Support/resistance levels
router.get('/:symbol/levels', tradingController.getLevels)

// GET /api/trading/:symbol/context - Hourly context and sessions
router.get('/:symbol/context', tradingController.getContext)

// GET /api/trading/:symbol/mtf - Multi-timeframe analysis
router.get('/:symbol/mtf', tradingController.getMTF)

// GET /api/trading/:symbol/signal - Complete trading signal
router.get('/:symbol/signal', tradingController.getCompleteSignal)

// GET /api/trading/:symbol/backtest - Run backtest
router.get('/:symbol/backtest', tradingController.getBacktest)

module.exports = router
