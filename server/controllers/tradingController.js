/**
 * ============================================================================
 * TRADING API CONTROLLER
 * ============================================================================
 * Exposes endpoints for technical analysis.
 */

const { calculateAllIndicators, getCurrentValues, detectSignals, calculateATRStops } = require('../trading/indicators')
const { markDataQuality, getDataQualitySummary, filterCleanData } = require('../trading/data/dataCleaner')
const { analyzePatterns, getPatternSummary } = require('../trading/priceAction')
const { detectLevels, findNearestLevels } = require('../trading/levels')
const { getCurrentHourContext, calculateHourlyATR, getActiveSessions } = require('../trading/context')
const { analyzeMTF, detectTrend, detectRange } = require('../trading/mtf')
const { generateSignal, explainSignal } = require('../trading/signals')
const { runBacktest, getEquityCurve } = require('../trading/backtesting')
const ohlcService = require('../services/ohlcService')

/**
 * GET /api/trading/:symbol/indicators
 * Calculate and return technical indicators for a symbol
 */
const getIndicators = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 100 } = req.query
    
    // Get candles from database
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!candles || candles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found. Run sync first.' })
    }
    
    // Calculate all indicators
    const indicators = calculateAllIndicators(candles)
    const currentValues = getCurrentValues(indicators)
    const signals = detectSignals(indicators, candles.map(c => c.close))
    
    res.json({
      symbol,
      timeframe,
      candleCount: candles.length,
      lastCandle: candles[candles.length - 1],
      currentValues,
      signals,
      full: indicators // Full arrays for charting
    })
  } catch (error) {
    console.error('[TradingController] getIndicators error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/analysis
 * Full analysis including data quality, indicators, and signals
 */
const getAnalysis = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 100 } = req.query
    
    // Get candles
    const rawCandles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!rawCandles || rawCandles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found' })
    }
    
    // Mark data quality
    const markedCandles = markDataQuality(rawCandles)
    const qualitySummary = getDataQualitySummary(markedCandles)
    
    // Use clean data for analysis
    const cleanCandles = filterCleanData(markedCandles)
    
    // Calculate indicators on clean data
    const indicators = calculateAllIndicators(cleanCandles)
    const currentValues = getCurrentValues(indicators)
    const signals = detectSignals(indicators, cleanCandles.map(c => c.close))
    
    // Calculate suggested stops based on ATR
    const latestATR = currentValues.atr
    const latestPrice = cleanCandles[cleanCandles.length - 1]?.close
    const suggestedStops = latestATR && latestPrice
      ? {
          long: calculateATRStops(latestPrice, latestATR, 2, 'LONG'),
          short: calculateATRStops(latestPrice, latestATR, 2, 'SHORT')
        }
      : null
    
    res.json({
      symbol,
      timeframe,
      timestamp: new Date().toISOString(),
      dataQuality: qualitySummary,
      price: {
        current: latestPrice,
        change24h: cleanCandles.length > 24 
          ? ((latestPrice - cleanCandles[cleanCandles.length - 25].close) / cleanCandles[cleanCandles.length - 25].close * 100).toFixed(2)
          : null
      },
      indicators: currentValues,
      signals,
      suggestedStops,
      candles: markedCandles.slice(-50) // Last 50 with quality marks
    })
  } catch (error) {
    console.error('[TradingController] getAnalysis error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/signals
 * Get only trading signals
 */
const getSignals = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h' } = req.query
    
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: 100 }
    )
    
    if (!candles || candles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found' })
    }
    
    const cleanCandles = filterCleanData(markDataQuality(candles))
    const indicators = calculateAllIndicators(cleanCandles)
    const signals = detectSignals(indicators, cleanCandles.map(c => c.close))
    
    // Calculate stops for each signal
    const latestATR = indicators.atr.filter(v => v !== null).pop()
    const latestPrice = cleanCandles[cleanCandles.length - 1]?.close
    
    const enrichedSignals = signals.map(signal => ({
      ...signal,
      entry: latestPrice,
      stops: latestATR 
        ? calculateATRStops(latestPrice, latestATR, 2, signal.direction)
        : null,
      timestamp: new Date().toISOString()
    }))
    
    res.json({
      symbol,
      timeframe,
      signalCount: enrichedSignals.length,
      signals: enrichedSignals
    })
  } catch (error) {
    console.error('[TradingController] getSignals error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/quality
 * Get data quality report
 */
const getDataQuality = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 200 } = req.query
    
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!candles || candles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found' })
    }
    
    const markedCandles = markDataQuality(candles)
    const summary = getDataQualitySummary(markedCandles)
    
    // Get problematic candles
    const problematic = markedCandles.filter(c => !c.usableForAnalysis)
    
    res.json({
      symbol,
      timeframe,
      summary,
      problematicCandles: problematic.slice(-20)
    })
  } catch (error) {
    console.error('[TradingController] getDataQuality error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/patterns
 * Get price action patterns
 */
const getPatterns = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 100 } = req.query
    
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!candles || candles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found' })
    }
    
    const patterns = analyzePatterns(candles)
    const summary = getPatternSummary(candles)
    
    res.json({
      symbol,
      timeframe,
      candleCount: candles.length,
      ...summary
    })
  } catch (error) {
    console.error('[TradingController] getPatterns error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/levels
 * Get support and resistance levels
 */
const getLevels = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 200 } = req.query
    
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!candles || candles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found' })
    }
    
    const levels = detectLevels(candles)
    const nearest = findNearestLevels(candles)
    
    res.json({
      symbol,
      timeframe,
      candleCount: candles.length,
      levels,
      nearest
    })
  } catch (error) {
    console.error('[TradingController] getLevels error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/context
 * Get hourly context and session analysis
 */
const getContext = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 200 } = req.query
    
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!candles || candles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found' })
    }
    
    const hourContext = getCurrentHourContext(candles)
    const hourlyATR = calculateHourlyATR(candles)
    const sessions = getActiveSessions()
    
    res.json({
      symbol,
      timeframe,
      candleCount: candles.length,
      currentContext: hourContext,
      hourlyProfile: hourlyATR,
      activeSessions: sessions,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[TradingController] getContext error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/mtf
 * Get multi-timeframe analysis
 */
const getMTF = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 100 } = req.query
    
    // Get current timeframe candles
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!candles || candles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found' })
    }
    
    // Perform MTF analysis
    const mtfAnalysis = analyzeMTF(candles)
    const prices = candles.map(c => c.close)
    const trend = detectTrend(prices)
    const range = detectRange(candles)
    
    res.json({
      symbol,
      timeframe,
      candleCount: candles.length,
      trend,
      range,
      analysis: mtfAnalysis,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[TradingController] getMTF error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/signal
 * Get complete trading signal with entry/SL/TP
 */
const getCompleteSignal = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 100 } = req.query
    
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!candles || candles.length === 0) {
      return res.status(404).json({ success: false, message: 'No candle data found' })
    }
    
    const signal = generateSignal(candles)
    const explanation = explainSignal(signal)
    
    res.json({
      symbol,
      timeframe,
      candleCount: candles.length,
      signal,
      explanation,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[TradingController] getCompleteSignal error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

/**
 * GET /api/trading/:symbol/backtest
 * Run backtest on historical data
 */
const getBacktest = async (req, res) => {
  try {
    const { symbol } = req.params
    const { timeframe = '1h', periods = 300, capital = 10000, riskPerTrade = 2 } = req.query
    
    const candles = await ohlcService.getCandles(
      symbol.toLowerCase(),
      timeframe,
      'usd',
      { limit: parseInt(periods) }
    )
    
    if (!candles || candles.length < 150) {
      return res.status(400).json({ success: false, message: 'Insufficient data for backtesting (need at least 150 candles)' })
    }
    
    const results = runBacktest(candles, {
      capital: parseFloat(capital),
      riskPerTrade: parseFloat(riskPerTrade) / 100
    })
    
    const equityCurve = getEquityCurve(results.trades, parseFloat(capital))
    
    res.json({
      symbol,
      timeframe,
      candleCount: candles.length,
      summary: results.summary,
      metrics: results.metrics,
      equityCurve,
      recentTrades: results.trades.slice(-10)
    })
  } catch (error) {
    console.error('[TradingController] getBacktest error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

module.exports = {
  getIndicators,
  getAnalysis,
  getSignals,
  getDataQuality,
  getPatterns,
  getLevels,
  getContext,
  getMTF,
  getCompleteSignal,
  getBacktest
}
