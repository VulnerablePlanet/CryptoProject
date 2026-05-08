/**
 * ============================================================================
 * FIBONACCI ANALYSIS SERVICE
 * ============================================================================
 * Provides automatic Fibonacci retracement and extension calculations
 * with pivot point detection using ZigZag algorithm.
 * 
 * Features:
 * - ZigZag pivot detection (Swing High/Low)
 * - Automatic trend detection
 * - Fibonacci retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%)
 * - Fibonacci extensions for Take Profit (127.2%, 161.8%, 261.8%)
 * ============================================================================
 */

const ohlcService = require('./ohlcService')
const { findPivots, filterAlternatingPivots, getRecentSwings, detectTrend, calculateRetracementLevels, calculateExtensionLevels, findNearestLevel } = require('./pivotDetectionService')

// ============================================================================
// Fibonacci Ratios
// ============================================================================

const RETRACEMENT_RATIOS = [
  { ratio: 0, label: '0%' },
  { ratio: 0.236, label: '23.6%' },
  { ratio: 0.382, label: '38.2%' },
  { ratio: 0.5, label: '50%' },
  { ratio: 0.618, label: '61.8% (Golden Pocket)' },
  { ratio: 0.786, label: '78.6%' },
  { ratio: 1, label: '100%' }
]

const EXTENSION_RATIOS = [
  { ratio: 1.272, label: 'TP1 - 127.2% (Conservador)' },
  { ratio: 1.618, label: 'TP2 - 161.8% (Golden Extension)' },
  { ratio: 2.618, label: 'TP3 - 261.8% (Extended)' }
]

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Perform complete Fibonacci analysis for a cryptocurrency
 * 
 * @param {string} coinId - CoinGecko coin ID (e.g., 'bitcoin')
 * @param {string} timeframe - Timeframe for analysis (e.g., '4h', '1d')
 * @param {Object} options - Additional options
 * @returns {Object} Complete Fibonacci analysis result
 */
const analyzeFibonacci = async (coinId, timeframe = '4h', options = {}) => {
  const { lookback = 5, threshold = 0.5, limit = 100 } = options
  
  console.log(`📐 [Fibonacci] Analyzing ${coinId} on ${timeframe} timeframe...`)
  
  try {
    // Get candle data using rate-limited OHLC service
    const candles = await ohlcService.getCandles(
      coinId.toLowerCase(),
      timeframe,
      'usd',
      { limit, autoSync: true }
    )
    
    if (!candles || candles.length < lookback * 2 + 1) {
      throw new Error(`Insufficient candle data. Need at least ${lookback * 2 + 1} candles, got ${candles?.length || 0}`)
    }
    
    // Find pivot points
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
    const retracement = calculateRetracementLevels(swingHigh.price, swingLow.price, trend, RETRACEMENT_RATIOS)
    const extensions = calculateExtensionLevels(swingHigh.price, swingLow.price, trend, EXTENSION_RATIOS)
    
    // Current price info
    const currentCandle = candles[candles.length - 1]
    const currentPrice = currentCandle.close
    
    // Determine which level price is near
    const nearestLevel = findNearestLevel(currentPrice, retracement, extensions)
    
    console.log(`📐 [Fibonacci] Analysis complete: ${trend} trend, ${allPivots.length} pivots detected`)
    
    return {
      success: true,
      coinId,
      timeframe,
      trend,
      currentPrice,
      pivots: {
        swingHigh: {
          price: swingHigh.price,
          timestamp: swingHigh.timestamp,
          index: swingHigh.index
        },
        swingLow: {
          price: swingLow.price,
          timestamp: swingLow.timestamp,
          index: swingLow.index
        },
        all: allPivots.slice(-10) // Last 10 pivots for visualization
      },
      levels: {
        retracement,
        extensions
      },
      nearestLevel,
      meta: {
        priceRange: Math.round((swingHigh.price - swingLow.price) * 100) / 100,
        analyzedCandles: candles.length,
        pivotCount: allPivots.length,
        lookback,
        threshold,
        calculatedAt: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error(`📐 [Fibonacci] Error analyzing ${coinId}:`, error.message)
    throw error
  }
}

/**
 * Get just the pivots for visualization
 * 
 * @param {string} coinId - CoinGecko coin ID
 * @param {string} timeframe - Timeframe
 * @param {Object} options - Options
 * @returns {Object} Pivot points
 */
const getPivots = async (coinId, timeframe = '4h', options = {}) => {
  const { lookback = 5, threshold = 0.5, limit = 100 } = options
  
  const candles = await ohlcService.getCandles(
    coinId.toLowerCase(),
    timeframe,
    'usd',
    { limit, autoSync: true }
  )
  
  const pivots = findPivots(candles, lookback, threshold)
  const trend = detectTrend(pivots, candles)
  
  return {
    success: true,
    coinId,
    timeframe,
    trend,
    pivots,
    candleCount: candles.length
  }
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  findPivots,
  filterAlternatingPivots,
  getRecentSwings,
  detectTrend,
  calculateRetracementLevels,
  calculateExtensionLevels,
  analyzeFibonacci,
  getPivots,
  findNearestLevel,
  RETRACEMENT_RATIOS,
  EXTENSION_RATIOS
}
