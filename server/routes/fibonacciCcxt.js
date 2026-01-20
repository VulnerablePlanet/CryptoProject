/**
 * Fibonacci CCXT Routes
 * Express router for CCXT-based Fibonacci analysis endpoints
 */

const express = require('express')
const router = express.Router()
const fibonacciCcxtController = require('../controllers/fibonacciCcxtController')

// ============================================================================
// Static Routes (must come before parameterized routes)
// ============================================================================

// Get Fibonacci ratios configuration
router.get('/ratios', fibonacciCcxtController.getRatios)

// Get supported exchanges and timeframes
router.get('/supported', fibonacciCcxtController.getSupported)

// Multi-exchange comparison
// GET /api/fibonacci-ccxt/compare/BTC/USDT?timeframe=4h&exchanges=binance,kraken
router.get('/compare/:base/:quote', fibonacciCcxtController.compareExchanges)

// ============================================================================
// Parameterized Routes
// ============================================================================

// Full Fibonacci analysis with confluence
// GET /api/fibonacci-ccxt/binance/BTC/USDT?timeframe=4h
router.get('/:exchange/:base/:quote', fibonacciCcxtController.getAnalysis)

// Just Fibonacci levels (lightweight)
// GET /api/fibonacci-ccxt/binance/BTC/USDT/levels
router.get('/:exchange/:base/:quote/levels', fibonacciCcxtController.getLevels)

// Just confluence indicators
// GET /api/fibonacci-ccxt/binance/BTC/USDT/confluence
router.get('/:exchange/:base/:quote/confluence', fibonacciCcxtController.getConfluence)

module.exports = router
