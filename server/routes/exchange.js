/**
 * ============================================================================
 * Exchange Routes - CCXT API Endpoints
 * ============================================================================
 * REST API endpoints for cryptocurrency exchange data via CCXT.
 */

const express = require('express')
const router = express.Router()
const ccxtService = require('../services/ccxtService')
const ccxtPriceService = require('../services/ccxtPriceService')
const { auth } = require('../middleware/auth')

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
    res.status(500).json({
      success: false,
      message: error.message
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
    res.status(500).json({
      success: false,
      message: error.message
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
    res.status(500).json({
      success: false,
      message: error.message
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
    const result = await ccxtService.fetchOHLCV(exchange, symbol, timeframe, parseInt(limit))
    
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
    res.status(500).json({
      success: false,
      message: error.message
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
    const result = await ccxtService.fetchOrderBook(exchange, symbol, parseInt(limit))
    
    res.json({
      success: true,
      exchange,
      symbol,
      fromCache: result.fromCache,
      orderBook: result.orderBook
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
    res.status(500).json({
      success: false,
      message: error.message
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
    res.status(500).json({
      success: false,
      message: error.message
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
    res.status(500).json({
      success: false,
      message: error.message
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
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * POST /api/exchange/prices
 * Get multiple prices from different exchanges
 * Body: { coins: [{ exchange, symbol }] }
 */
router.post('/prices', async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: error.message
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
