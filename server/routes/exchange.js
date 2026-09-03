/**
 * ============================================================================
 * Exchange Routes - CCXT API Endpoints
 * ============================================================================
 * REST API endpoints for cryptocurrency exchange data via CCXT.
 */

const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const ccxtService = require('../services/ccxtService')
const ccxtPriceService = require('../services/ccxtPriceService')
const { auth } = require('../middleware/auth')
const { createLogger } = require('../utils/logger')

const logger = createLogger('routes:exchange')

// Validation check middleware
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() })
  }
  next()
}

// All exchange routes require authentication
router.use(auth)

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/exchange/supported
 * Get list of supported exchanges
 */
router.get('/supported', (req, res) => {
  try {
    const exchanges = ccxtService.getSupportedExchanges()
    res.json({
      success: true,
      exchanges,
      timeframes: Object.keys(ccxtService.TIMEFRAME_MAP)
    })
  } catch (error) {
    logger.error('Failed to fetch supported exchanges', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supported exchanges'
    })
  }
})

/**
 * GET /api/exchange/status
 * Get service status and cache stats
 */
router.get('/status', (req, res) => {
  try {
    const stats = ccxtService.getCacheStats()
    res.json({
      success: true,
      status: 'operational',
      cache: stats
    })
  } catch (error) {
    logger.error('Failed to fetch exchange status', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch status'
    })
  }
})

/**
 * GET /api/exchange/:exchange/markets
 * Get available markets from an exchange
 */
router.get('/:exchange/markets', async (req, res) => {
  try {
    const { exchange } = req.params
    const { quote } = req.query // Optional filter by quote currency
    
    let markets = await ccxtService.fetchMarkets(exchange)
    
    // Filter by quote currency if provided
    if (quote) {
      markets = markets.filter(m => m.quote.toUpperCase() === quote.toUpperCase())
    }
    
    res.json({
      success: true,
      exchange,
      count: markets.length,
      markets
    })
  } catch (error) {
    logger.error('Failed to fetch exchange markets', {
      error,
      exchange: req.params.exchange
    })
    // "not supported" is a controlled validation message from ccxtService
    // (the supported list is public via GET /supported) — safe to return.
    const isUnsupported = error.message?.includes('not supported')
    const status = isUnsupported ? 400 : 502
    res.status(status).json({
      success: false,
      message: isUnsupported ? error.message : 'Failed to fetch markets',
      exchange: req.params.exchange
    })
  }
})

/**
 * GET /api/exchange/:exchange/ohlcv/:base/:quote
 * Fetch OHLCV candles for a trading pair
 */
router.get('/:exchange/ohlcv/:base/:quote', async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    const { timeframe = '1h', limit = 100 } = req.query
    
    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`
    const safeLimit = Math.min(parseInt(limit) || 100, 1000)
    const result = await ccxtService.fetchOHLCV(exchange, symbol, timeframe, safeLimit)
    
    res.json({
      success: true,
      exchange,
      symbol,
      timeframe,
      count: result.candles.length,
      fromCache: result.fromCache,
      candles: result.candles
    })
  } catch (error) {
    logger.error('Failed to fetch OHLCV data', {
      error,
      exchange: req.params.exchange
    })
    // "not supported" is a controlled validation message from ccxtService
    // (the supported list is public via GET /supported) — safe to return.
    const isUnsupported = error.message?.includes('not supported')
    const status = isUnsupported ? 400 : 502
    res.status(status).json({
      success: false,
      message: isUnsupported ? error.message : 'Failed to fetch OHLCV data',
      exchange: req.params.exchange
    })
  }
})

/**
 * GET /api/exchange/:exchange/orderbook/:base/:quote
 * Fetch order book for a trading pair
 */
router.get('/:exchange/orderbook/:base/:quote', async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    const { limit = 50 } = req.query
    
    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`
    const safeLimit = Math.min(parseInt(limit) || 50, 500)
    const result = await ccxtService.fetchOrderBook(exchange, symbol, safeLimit)
    
    res.json({
      success: true,
      exchange,
      symbol,
      fromCache: result.fromCache,
      orderBook: result.orderBook
    })
  } catch (error) {
    logger.error('Failed to fetch order book', {
      error,
      exchange: req.params.exchange
    })
    // "not supported" is a controlled validation message from ccxtService
    // (the supported list is public via GET /supported) — safe to return.
    const isUnsupported = error.message?.includes('not supported')
    const status = isUnsupported ? 400 : 502
    res.status(status).json({
      success: false,
      message: isUnsupported ? error.message : 'Failed to fetch order book',
      exchange: req.params.exchange
    })
  }
})

/**
 * GET /api/exchange/:exchange/ticker/:base/:quote
 * Fetch ticker for a trading pair
 */
router.get('/:exchange/ticker/:base/:quote', async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    
    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`
    const result = await ccxtService.fetchTicker(exchange, symbol)
    
    res.json({
      success: true,
      exchange,
      symbol,
      fromCache: result.fromCache,
      ticker: result.ticker
    })
  } catch (error) {
    logger.error('Failed to fetch ticker', {
      error,
      exchange: req.params.exchange
    })
    // "not supported" is a controlled validation message from ccxtService
    // (the supported list is public via GET /supported) — safe to return.
    const isUnsupported = error.message?.includes('not supported')
    const status = isUnsupported ? 400 : 502
    res.status(status).json({
      success: false,
      message: isUnsupported ? error.message : 'Failed to fetch ticker',
      exchange: req.params.exchange
    })
  }
})

/**
 * GET /api/exchange/:exchange/timeframes
 * Get available timeframes for an exchange
 */
router.get('/:exchange/timeframes', (req, res) => {
  try {
    const { exchange } = req.params
    const timeframes = ccxtService.getTimeframes(exchange)
    
    res.json({
      success: true,
      exchange,
      timeframes
    })
  } catch (error) {
    logger.error('Failed to fetch timeframes', {
      error,
      exchange: req.params.exchange
    })
    // "not supported" is a controlled validation message from ccxtService
    // (the supported list is public via GET /supported) — safe to return.
    const isUnsupported = error.message?.includes('not supported')
    res.status(isUnsupported ? 400 : 500).json({
      success: false,
      message: isUnsupported ? error.message : 'Failed to fetch timeframes',
      exchange: req.params.exchange
    })
  }
})

/**
 * DELETE /api/exchange/cache
 * Clear cache (optionally for specific exchange)
 */
router.delete('/cache', (req, res) => {
  try {
    const { exchange } = req.query
    ccxtService.clearCache(exchange)
    
    res.json({
      success: true,
      message: exchange ? `Cache cleared for ${exchange}` : 'All cache cleared'
    })
  } catch (error) {
    logger.error('Failed to clear exchange cache', error)
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    })
  }
})

// ============================================================================
// Price Endpoints (using ccxtPriceService)
// ============================================================================

/**
 * GET /api/exchange/:exchange/price/:base/:quote
 * Get price for a trading pair from an exchange
 */
router.get('/:exchange/price/:base/:quote', async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    
    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`
    const priceData = await ccxtPriceService.getPrice(exchange, symbol)
    
    res.json({
      success: true,
      ...priceData
    })
  } catch (error) {
    logger.error('Failed to fetch exchange price', {
      error,
      exchange: req.params.exchange
    })
    // "not supported" is a controlled validation message from ccxtService
    // (the supported list is public via GET /supported) — safe to return.
    const isUnsupported = error.message?.includes('not supported')
    const status = isUnsupported ? 400 : 502
    res.status(status).json({
      success: false,
      message: isUnsupported ? error.message : 'Failed to fetch price',
      exchange: req.params.exchange
    })
  }
})

/**
 * POST /api/exchange/prices
 * Get multiple prices from different exchanges
 * Body: { coins: [{ exchange, symbol }] }
 */
router.post('/prices', 
  body('coins').isArray({ min: 1 }).withMessage('coins must be a non-empty array'),
  body('coins.*.exchange').optional().trim().notEmpty().withMessage('each coin must have an exchange'),
  body('coins.*.symbol').optional().trim().notEmpty().withMessage('each coin must have a symbol'),
  validate,
  async (req, res) => {
  try {
    const { coins } = req.body
    
    if (!Array.isArray(coins) || coins.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'coins array is required'
      })
    }
    
    const { results, errors } = await ccxtPriceService.getMultiplePrices(coins)
    
    res.json({
      success: true,
      count: Object.keys(results).length,
      results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    logger.error('Failed to fetch multiple exchange prices', error)
    res.status(502).json({
      success: false,
      message: 'Failed to fetch prices'
    })
  }
})

/**
 * GET /api/exchange/coin-symbols
 * Get the CoinGecko to CCXT symbol mapping
 */
router.get('/coin-symbols', (req, res) => {
  res.json({
    success: true,
    symbols: ccxtPriceService.COINGECKO_TO_SYMBOL
  })
})

module.exports = router
