/**
 * Fibonacci CCXT Controller
 * Handles HTTP requests for CCXT-based Fibonacci analysis endpoints
 */

const fibonacciCcxtService = require('../services/fibonacciCcxtService')
const confluenceService = require('../services/confluenceService')
const ccxtService = require('../services/ccxtService')

/**
 * GET /api/fibonacci-ccxt/:exchange/:base/:quote
 * Full Fibonacci analysis with confluence for a trading pair
 * 
 * Query params:
 * - timeframe: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w' (default: '4h')
 * - lookback: number of candles for pivot detection (default: 5)
 * - threshold: minimum % change for pivots (default: 0.5)
 * - limit: number of candles to analyze (default: 100)
 */
const getAnalysis = async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    const {
      timeframe = '4h',
      lookback = 5,
      threshold = 0.5,
      limit = 100
    } = req.query

    // Validate exchange
    if (!ccxtService.SUPPORTED_EXCHANGES[exchange.toLowerCase()]) {
      return res.status(400).json({
        success: false,
        message: `Exchange ${exchange} is not supported. Supported: ${Object.keys(ccxtService.SUPPORTED_EXCHANGES).join(', ')}`
      })
    }

    // Validate timeframe
    const validTimeframes = Object.keys(ccxtService.TIMEFRAME_MAP)
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        message: `Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`
      })
    }

    // Build symbol
    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`

    // Validate params
    const parsedLookback = Math.min(Math.max(parseInt(lookback) || 5, 2), 20)
    const parsedThreshold = Math.min(Math.max(parseFloat(threshold) || 0.5, 0.1), 5)
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 100, 50), 500)

    // Get Fibonacci analysis
    const fibAnalysis = await fibonacciCcxtService.analyzeFibonacci(
      exchange.toLowerCase(),
      symbol,
      timeframe,
      {
        lookback: parsedLookback,
        threshold: parsedThreshold,
        limit: parsedLimit
      }
    )

    // Calculate confluence indicators
    const confluence = confluenceService.calculateConfluence(
      fibAnalysis.candles,
      fibAnalysis.levels,
      fibAnalysis.currentPrice,
      fibAnalysis.trend
    )

    // Generate trade signals
    const signals = confluenceService.generateTradeSignals(fibAnalysis, confluence)

    // Combine results
    res.json({
      success: true,
      data: {
        ...fibAnalysis,
        confluence,
        signals
      }
    })
  } catch (error) {
    console.error('Fibonacci CCXT analysis error:', error.message)
    res.status(500).json({
      success: false,
      message: 'Failed to perform Fibonacci analysis'
    })
  }
}

/**
 * GET /api/fibonacci-ccxt/:exchange/:base/:quote/levels
 * Get just the Fibonacci levels (lightweight endpoint)
 */
const getLevels = async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    const { timeframe = '4h', lookback = 5, threshold = 0.5, limit = 100 } = req.query

    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`

    const analysis = await fibonacciCcxtService.analyzeFibonacci(
      exchange.toLowerCase(),
      symbol,
      timeframe,
      {
        lookback: parseInt(lookback) || 5,
        threshold: parseFloat(threshold) || 0.5,
        limit: parseInt(limit) || 100
      }
    )

    // Return only levels data
    res.json({
      success: true,
      exchange: analysis.exchange,
      symbol: analysis.symbol,
      timeframe: analysis.timeframe,
      trend: analysis.trend,
      currentPrice: analysis.currentPrice,
      levels: analysis.levels,
      nearestLevel: analysis.nearestLevel,
      goldenPocket: analysis.goldenPocket,
      pivots: {
        swingHigh: analysis.pivots.swingHigh,
        swingLow: analysis.pivots.swingLow
      },
      meta: analysis.meta
    })
  } catch (error) {
    console.error('Fibonacci levels error:', error.message)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Fibonacci levels'
    })
  }
}

/**
 * GET /api/fibonacci-ccxt/:exchange/:base/:quote/confluence
 * Get technical indicator confluence data only
 */
const getConfluence = async (req, res) => {
  try {
    const { exchange, base, quote } = req.params
    const { timeframe = '4h', limit = 100 } = req.query

    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`

    // Fetch candles
    const result = await ccxtService.fetchOHLCV(
      exchange.toLowerCase(),
      symbol,
      timeframe,
      parseInt(limit) || 100
    )

    const candles = result.candles
    const currentPrice = candles[candles.length - 1].close

    // Get quick trend from price action
    const trend = currentPrice > candles[0].close ? 'bullish' : 'bearish'

    // Calculate confluence without full Fib analysis
    const closes = candles.map(c => c.close)
    const volumes = candles.map(c => c.volume)

    const rsi = confluenceService.calculateRSI(closes)
    const macd = confluenceService.calculateMACD(closes)
    const bb = confluenceService.calculateBollingerBands(closes)
    const volume = confluenceService.analyzeVolume(volumes)

    const currentRSI = rsi[rsi.length - 1]

    res.json({
      success: true,
      exchange: exchange.toLowerCase(),
      symbol,
      timeframe,
      currentPrice,
      trend,
      indicators: {
        rsi: {
          value: currentRSI,
          ...confluenceService.getRSICondition(currentRSI)
        },
        macd: {
          line: macd.macd[macd.macd.length - 1],
          signal: macd.signal[macd.signal.length - 1],
          histogram: macd.histogram[macd.histogram.length - 1],
          ...confluenceService.getMACDCondition(macd)
        },
        bollingerBands: confluenceService.getBBCondition(currentPrice, bb),
        volume
      },
      fromCache: result.fromCache
    })
  } catch (error) {
    console.error('Confluence analysis error:', error.message)
    res.status(500).json({
      success: false,
      message: 'Failed to calculate confluence indicators'
    })
  }
}

/**
 * GET /api/fibonacci-ccxt/compare/:base/:quote
 * Multi-exchange Fibonacci level comparison
 */
const compareExchanges = async (req, res) => {
  try {
    const { base, quote } = req.params
    const { 
      timeframe = '4h', 
      exchanges = null,
      lookback = 5,
      threshold = 0.5,
      limit = 100 
    } = req.query

    const symbol = `${base.toUpperCase()}/${quote.toUpperCase()}`
    
    // Parse exchanges if provided
    const exchangeList = exchanges ? exchanges.split(',').map(e => e.trim().toLowerCase()) : null

    const comparison = await fibonacciCcxtService.compareExchanges(
      symbol,
      timeframe,
      exchangeList,
      {
        lookback: parseInt(lookback) || 5,
        threshold: parseFloat(threshold) || 0.5,
        limit: parseInt(limit) || 100
      }
    )

    res.json(comparison)
  } catch (error) {
    console.error('Exchange comparison error:', error.message)
    res.status(500).json({
      success: false,
      message: 'Failed to compare exchanges'
    })
  }
}

/**
 * GET /api/fibonacci-ccxt/ratios
 * Get Fibonacci ratios configuration
 */
const getRatios = (req, res) => {
  res.json({
    success: true,
    retracement: fibonacciCcxtService.RETRACEMENT_RATIOS,
    extensions: fibonacciCcxtService.EXTENSION_RATIOS,
    config: fibonacciCcxtService.DEFAULT_CONFIG
  })
}

/**
 * GET /api/fibonacci-ccxt/supported
 * Get supported exchanges and timeframes
 */
const getSupported = (req, res) => {
  res.json({
    success: true,
    exchanges: ccxtService.getSupportedExchanges(),
    timeframes: Object.keys(ccxtService.TIMEFRAME_MAP)
  })
}

module.exports = {
  getAnalysis,
  getLevels,
  getConfluence,
  compareExchanges,
  getRatios,
  getSupported
}
