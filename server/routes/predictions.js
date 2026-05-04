/**
 * ============================================================================
 * Predictions Routes
 * ============================================================================
 * REST API endpoints for cryptocurrency price predictions.
 * 
 * Endpoints:
 * - GET /api/predictions/analyze/:exchange/:base/:quote - Full analysis with Kalman + Transformer
 * - GET /api/predictions/kalman/:exchange/:base/:quote - Kalman filtered data only
 * - GET /api/predictions/forecast/:exchange/:base/:quote - Quick forecast
 * - GET /api/predictions/config - Get prediction configuration
 * ============================================================================
 */

const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')

// All predictions routes require authentication
router.use(auth)

const predictionService = require('../services/predictionService')
const ccxtService = require('../services/ccxtService')

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/predictions/config
 * Get prediction service configuration and supported options
 */
router.get('/config', (req, res) => {
  try {
    const exchanges = ccxtService.getSupportedExchanges()
    const timeframes = Object.keys(ccxtService.TIMEFRAME_MAP)
    
    res.json({
      success: true,
      config: predictionService.PREDICTION_CONFIG,
      exchanges,
      timeframes,
      models: ['kalman', 'transformer', 'combined'],
      predictionHorizons: [1, 3, 5, 10, 20]
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * GET /api/predictions/analyze/:exchange/:base/:quote
 * Full prediction analysis with Kalman filter + Transformer model
 * 
 * Query params:
 * - timeframe: Candle timeframe (default: '1h')
 * - limit: Number of candles to fetch (default: 100)
 * - steps: Prediction horizon (default: 5)
 */
router.get('/analyze/:exchange/:base/:quote', async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    const { timeframe = '1h', limit = 100, steps = 5 } = req.query
    
    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`
    
    const result = await predictionService.getPrediction(
      exchange.toLowerCase(),
      symbol,
      timeframe,
      {
        limit: parseInt(limit),
        predictionSteps: parseInt(steps)
      }
    )
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * GET /api/predictions/kalman/:exchange/:base/:quote
 * Get Kalman-filtered price data (faster, no ML)
 * 
 * Query params:
 * - timeframe: Candle timeframe (default: '1h')
 * - limit: Number of candles to fetch (default: 100)
 */
router.get('/kalman/:exchange/:base/:quote', async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    const { timeframe = '1h', limit = 100 } = req.query
    
    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`
    
    const result = await predictionService.getKalmanFiltered(
      exchange.toLowerCase(),
      symbol,
      timeframe,
      parseInt(limit)
    )
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * GET /api/predictions/forecast/:exchange/:base/:quote
 * Quick price forecast (lightweight)
 * 
 * Query params:
 * - timeframe: Candle timeframe (default: '1h')
 * - steps: Number of candles to predict (default: 3)
 */
router.get('/forecast/:exchange/:base/:quote', async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    const { timeframe = '1h', steps = 3 } = req.query
    
    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`
    
    const result = await predictionService.getQuickForecast(
      exchange.toLowerCase(),
      symbol,
      timeframe,
      parseInt(steps)
    )
    
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * POST /api/predictions/batch
 * Get predictions for multiple symbols at once
 * 
 * Body:
 * {
 *   exchange: 'binance',
 *   symbols: ['BTC/USDT', 'ETH/USDT'],
 *   timeframe: '1h',
 *   steps: 5
 * }
 */
router.post('/batch', async (req, res) => {
  try {
    const { exchange, symbols, timeframe = '1h', steps = 5 } = req.body
    
    if (!exchange || !symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        message: 'Exchange and symbols array are required'
      })
    }
    
    // Limit batch size
    const limitedSymbols = symbols.slice(0, 10)
    
    const results = await Promise.all(
      limitedSymbols.map(symbol =>
        predictionService.getQuickForecast(
          exchange.toLowerCase(),
          symbol,
          timeframe,
          parseInt(steps)
        )
      )
    )
    
    res.json({
      success: true,
      exchange,
      timeframe,
      results,
      requested: symbols.length,
      processed: limitedSymbols.length
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * GET /api/predictions/markets/:exchange
 * Get available markets for prediction from an exchange
 * 
 * Query params:
 * - quote: Filter by quote currency (e.g., 'USDT')
 */
router.get('/markets/:exchange', async (req, res) => {
  try {
    const { exchange } = req.params
    const { quote = 'USDT' } = req.query
    
    let markets = await ccxtService.fetchMarkets(exchange.toLowerCase())
    
    // Filter by quote currency
    if (quote) {
      markets = markets.filter(m => 
        m.quote.toUpperCase() === quote.toUpperCase()
      )
    }
    
    // Sort by common cryptos first
    const commonBases = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'DOT', 'AVAX', 'MATIC']
    markets.sort((a, b) => {
      const aIndex = commonBases.indexOf(a.base)
      const bIndex = commonBases.indexOf(b.base)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.base.localeCompare(b.base)
    })
    
    res.json({
      success: true,
      exchange,
      quote,
      count: markets.length,
      markets: markets.map(m => ({
        symbol: m.symbol,
        base: m.base,
        quote: m.quote
      }))
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router
