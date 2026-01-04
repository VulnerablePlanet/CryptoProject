/**
 * ============================================================================
 * Exchange Routes - CCXT API Endpoints
 * ============================================================================
 * REST API endpoints for cryptocurrency exchange data via CCXT.
 */

const express = require('express')
const router = express.Router()
const ccxtService = require('../services/ccxtService')

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

module.exports = router
