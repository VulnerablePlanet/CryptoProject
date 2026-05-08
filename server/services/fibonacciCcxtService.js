/**
 * ============================================================================
 * FIBONACCI CCXT ANALYSIS SERVICE
 * ============================================================================
 * Provides Fibonacci analysis using CCXT for multi-exchange data ingestion.
 * 
 * Features:
 * - Real-time OHLCV data from multiple exchanges via CCXT
 * - ZigZag pivot detection algorithm (Swing High/Low)
 * - Automatic trend detection (bullish/bearish/neutral)
 * - Fibonacci retracement levels (0%, 23.6%, 38.2%, 50%, 61.8%, 65%, 78.6%, 100%)
 * - Fibonacci extensions (127.2%, 161.8%, 261.8%)
 * - Golden Pocket zone detection (61.8% - 65%)
 * ============================================================================
 */

const ccxtService = require('./ccxtService')
const { findPivots, filterAlternatingPivots, getRecentSwings, detectTrend, calculateRetracementLevels, calculateExtensionLevels, findNearestLevel } = require('./pivotDetectionService')

// ============================================================================
// Configuration
// ============================================================================

/**
 * Fibonacci Ratios
 */
const RETRACEMENT_RATIOS = [
  { ratio: 0, label: '0%', description: 'Swing Start' },
  { ratio: 0.236, label: '23.6%', description: 'Shallow Retracement' },
  { ratio: 0.382, label: '38.2%', description: 'Moderate Retracement' },
  { ratio: 0.5, label: '50%', description: 'Gann Level (Psychological)' },
  { ratio: 0.618, label: '61.8%', description: 'Golden Ratio' },
  { ratio: 0.65, label: '65%', description: 'Golden Pocket End' },
  { ratio: 0.786, label: '78.6%', description: 'Deep Retracement' },
  { ratio: 1, label: '100%', description: 'Full Retracement' }
]

const EXTENSION_RATIOS = [
  { ratio: 1.272, label: '127.2%', description: 'TP1 - Conservative' },
  { ratio: 1.618, label: '161.8%', description: 'TP2 - Golden Extension' },
  { ratio: 2.618, label: '261.8%', description: 'TP3 - Extended Target' }
]

/**
 * Default Analysis Configuration
 */
const DEFAULT_CONFIG = {
  lookback: 5,          // Candles to look forward/backward for pivot confirmation
  threshold: 0.5,       // Minimum % price change for pivot detection
  limit: 100,           // Number of candles to fetch
  goldenPocketStart: 0.618,
  goldenPocketEnd: 0.65
}

// ============================================================================
// Golden Pocket Detection (CCXT-specific)
// ============================================================================

/**
 * Detect if price is in the Golden Pocket zone (61.8% - 65%)
 * 
 * @param {number} currentPrice - Current price
 * @param {Object} retracementLevels - Retracement levels object
 * @returns {Object|null} Golden pocket info or null
 */
const detectGoldenPocket = (currentPrice, retracementLevels) => {
  const goldenLevel = retracementLevels['61.8']
  const pocketEnd = retracementLevels['65']
  
  if (!goldenLevel || !pocketEnd) return null
  
  const low = Math.min(goldenLevel.price, pocketEnd.price)
  const high = Math.max(goldenLevel.price, pocketEnd.price)
  
  const isInZone = currentPrice >= low && currentPrice <= high
  const distanceToZone = isInZone ? 0 : Math.min(
    Math.abs(currentPrice - low),
    Math.abs(currentPrice - high)
  )
  
  return {
    inZone: isInZone,
    zoneLow: low,
    zoneHigh: high,
    distanceToZone,
    percentToZone: (distanceToZone / currentPrice) * 100
  }
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Perform complete Fibonacci analysis using CCXT exchange data
 * 
 * @param {string} exchangeId - Exchange ID (binance, kraken, etc.)
 * @param {string} symbol - Trading pair symbol (e.g., 'BTC/USDT')
 * @param {string} timeframe - Timeframe for analysis (e.g., '4h', '1d')
 * @param {Object} options - Additional options
 * @returns {Object} Complete Fibonacci analysis result
 */
const analyzeFibonacci = async (exchangeId, symbol, timeframe = '4h', options = {}) => {
  const { 
    lookback = DEFAULT_CONFIG.lookback, 
    threshold = DEFAULT_CONFIG.threshold, 
    limit = DEFAULT_CONFIG.limit 
  } = options
  
  console.log(`📐 [FibonacciCCXT] Analyzing ${symbol} on ${exchangeId} (${timeframe})...`)
  
  try {
    // Fetch OHLCV data from exchange via CCXT
    const result = await ccxtService.fetchOHLCV(exchangeId, symbol, timeframe, limit)
    const candles = result.candles
    
    if (!candles || candles.length < lookback * 2 + 1) {
      throw new Error(`Insufficient candle data. Need at least ${lookback * 2 + 1} candles, got ${candles?.length || 0}`)
    }
    
    // Find pivot points using ZigZag
    const allPivots = findPivots(candles, lookback, threshold)
    
    if (allPivots.length < 2) {
      throw new Error('Could not detect enough pivot points for Fibonacci analysis')
    }
    
    // Get most recent swings
    const { swingHigh, swingLow } = getRecentSwings(allPivots)
    
    if (!swingHigh || !swingLow) {
      throw new Error('Could not identify swing high and swing low')
    }
    
    // Detect trend
    const trend = detectTrend(allPivots, candles)
    
    // Calculate Fibonacci levels
    const retracement = calculateRetracementLevels(swingHigh.price, swingLow.price, trend, RETRACEMENT_RATIOS, {
      goldenPocketStart: DEFAULT_CONFIG.goldenPocketStart,
      goldenPocketEnd: DEFAULT_CONFIG.goldenPocketEnd
    })
    const extensions = calculateExtensionLevels(swingHigh.price, swingLow.price, trend, EXTENSION_RATIOS)
    
    // Current price info
    const currentCandle = candles[candles.length - 1]
    const currentPrice = currentCandle.close
    
    // Find nearest level and golden pocket status
    const nearestLevel = findNearestLevel(currentPrice, retracement, extensions)
    const goldenPocket = detectGoldenPocket(currentPrice, retracement)
    
    console.log(`📐 [FibonacciCCXT] Analysis complete: ${trend} trend, ${allPivots.length} pivots detected`)
    
    return {
      success: true,
      exchange: exchangeId,
      symbol,
      timeframe,
      trend,
      currentPrice,
      pivots: {
        swingHigh: {
          price: swingHigh.price,
          timestamp: swingHigh.timestamp,
          time: swingHigh.time,
          index: swingHigh.index
        },
        swingLow: {
          price: swingLow.price,
          timestamp: swingLow.timestamp,
          time: swingLow.time,
          index: swingLow.index
        },
        all: allPivots.slice(-10) // Last 10 pivots for visualization
      },
      levels: {
        retracement,
        extensions
      },
      nearestLevel,
      goldenPocket,
      candles: candles.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      })),
      meta: {
        priceRange: Math.round((swingHigh.price - swingLow.price) * 100) / 100,
        analyzedCandles: candles.length,
        pivotCount: allPivots.length,
        lookback,
        threshold,
        fromCache: result.fromCache,
        calculatedAt: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error(`📐 [FibonacciCCXT] Error analyzing ${symbol}:`, error.message)
    throw error
  }
}

/**
 * Compare Fibonacci levels across multiple exchanges
 * 
 * @param {string} symbol - Trading pair symbol (e.g., 'BTC/USDT')
 * @param {string} timeframe - Timeframe for analysis
 * @param {Array} exchanges - List of exchange IDs (optional, defaults to all)
 * @param {Object} options - Additional options
 * @returns {Object} Multi-exchange comparison result
 */
const compareExchanges = async (symbol, timeframe = '4h', exchanges = null, options = {}) => {
  const exchangeList = exchanges || Object.keys(ccxtService.SUPPORTED_EXCHANGES)
  const results = []
  const errors = []
  
  console.log(`📐 [FibonacciCCXT] Comparing ${symbol} across ${exchangeList.length} exchanges...`)
  
  for (const exchangeId of exchangeList) {
    try {
      const analysis = await analyzeFibonacci(exchangeId, symbol, timeframe, options)
      results.push({
        exchange: exchangeId,
        name: ccxtService.SUPPORTED_EXCHANGES[exchangeId]?.name || exchangeId,
        ...analysis
      })
    } catch (error) {
      errors.push({
        exchange: exchangeId,
        error: error.message
      })
    }
  }
  
  // Calculate average levels across exchanges
  const avgLevels = calculateAverageLevels(results)
  
  return {
    success: true,
    symbol,
    timeframe,
    exchanges: results,
    errors,
    averageLevels: avgLevels,
    meta: {
      exchangesAnalyzed: results.length,
      exchangesFailed: errors.length,
      calculatedAt: new Date().toISOString()
    }
  }
}

/**
 * Calculate average Fibonacci levels from multiple exchange analyses
 * 
 * @param {Array} analyses - Array of analysis results
 * @returns {Object} Average levels
 */
const calculateAverageLevels = (analyses) => {
  if (analyses.length === 0) return null
  
  const retracementKeys = Object.keys(analyses[0].levels?.retracement || {})
  const extensionKeys = Object.keys(analyses[0].levels?.extensions || {})
  
  const avgRetracement = {}
  const avgExtensions = {}
  
  retracementKeys.forEach(key => {
    const prices = analyses
      .filter(a => a.levels?.retracement?.[key])
      .map(a => a.levels.retracement[key].price)
    
    if (prices.length > 0) {
      avgRetracement[key] = {
        price: prices.reduce((a, b) => a + b, 0) / prices.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
        spread: Math.max(...prices) - Math.min(...prices)
      }
    }
  })
  
  extensionKeys.forEach(key => {
    const prices = analyses
      .filter(a => a.levels?.extensions?.[key])
      .map(a => a.levels.extensions[key].price)
    
    if (prices.length > 0) {
      avgExtensions[key] = {
        price: prices.reduce((a, b) => a + b, 0) / prices.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
        spread: Math.max(...prices) - Math.min(...prices)
      }
    }
  })
  
  return {
    retracement: avgRetracement,
    extensions: avgExtensions
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Config
  RETRACEMENT_RATIOS,
  EXTENSION_RATIOS,
  DEFAULT_CONFIG,
  
  // Pivot Detection
  findPivots,
  filterAlternatingPivots,
  getRecentSwings,
  
  // Trend Detection
  detectTrend,
  
  // Fibonacci Calculations
  calculateRetracementLevels,
  calculateExtensionLevels,
  detectGoldenPocket,
  findNearestLevel,
  
  // Main Analysis
  analyzeFibonacci,
  compareExchanges,
  calculateAverageLevels
}
