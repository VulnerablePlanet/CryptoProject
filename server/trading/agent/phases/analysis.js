/**
 * ============================================================================
 * ANALYSIS PHASE - Phase 5
 * ============================================================================
 * Market data analysis including technical indicators, regime detection,
 * multi-timeframe analysis, support/resistance levels, and pattern detection.
 *
 * API Signature:
 * async function runAnalysisCycle(symbol, researchData)
 * Returns: { indicators, regime, mtfTrend, levels, patterns, candles }
 */

const ccxtService = require('../../../services/ccxtService')
const { RingBuffer } = require('../structures/ringBuffer')
const { RSI, MACD, CCI, ATR, BollingerBands } = require('technicalindicators')
const { kmeans } = require('ml-kmeans')
const math = require('mathjs')

// Import existing modules
const { findNearestLevels } = require('../../levels/detector')

const { getPatternSummary } = require('../../priceAction/patterns')

const { detectTrend } = require('../../mtf/analyzer')

// ============================================================================
// Configuration
// ============================================================================

const TIMEFRAMES = ['1h', '4h', '1d']
const CANDLE_LIMIT = 100
const EXCHANGE_ID = 'binance' // Default exchange

// Indicator periods
const INDICATOR_CONFIG = {
  rsi: { period: 14 },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  cci: { period: 20 },
  atr: { period: 14 },
  bollingerBands: { period: 20, stdDev: 2 }
}

// EMA periods for MTF trend detection
const EMA_FAST = 50
const EMA_SLOW = 200

// ============================================================================
// Ring Buffer Storage per Timeframe
// ============================================================================

const candleBuffers = {}
TIMEFRAMES.forEach(tf => {
  candleBuffers[tf] = new RingBuffer(CANDLE_LIMIT)
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Z-score normalization for ML features
 * @param {number[]} values - Array of values to normalize
 * @returns {number[]} Z-score normalized values
 */
function zScoreNormalize(values) {
  if (!values || values.length === 0) return []

  const mean = math.mean(values)
  const std = math.std(values)

  if (std === 0 || isNaN(std)) {
    return values.map(() => 0)
  }

  return values.map(v => (v - mean) / std)
}

/**
 * Extract closing prices from candles
 * @param {object[]} candles - Array of OHLCV candles
 * @returns {number[]} Close prices
 */
function getCloses(candles) {
  return candles.map(c => c.close)
}

/**
 * Extract high prices from candles
 * @param {object[]} candles - Array of OHLCV candles
 * @returns {number[]} High prices
 */
function getHighs(candles) {
  return candles.map(c => c.high)
}

/**
 * Extract low prices from candles
 * @param {object[]} candles - Array of OHLCV candles
 * @returns {number[]} Low prices
 */
function getLows(candles) {
  return candles.map(c => c.low)
}

/**
 * Get the latest non-null value from an array
 * @param {number[]} arr - Array with potential null values
 * @returns {number|null} Latest non-null value
 */
function getLatestValue(arr) {
  if (!arr || arr.length === 0) return null
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && !isNaN(arr[i])) return arr[i]
  }
  return null
}

/**
 * Calculate EMA array for trend detection
 * @param {number[]} prices - Close prices
 * @param {number} period - EMA period
 * @returns {number[]} EMA values
 */
function calculateEMAArray(prices, period) {
  if (!prices || prices.length < period) return []

  const multiplier = 2 / (period + 1)
  const result = []

  // First EMA is SMA
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += prices[i]
  }
  let ema = sum / period

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else if (i === period - 1) {
      result.push(ema)
    } else {
      ema = (prices[i] - ema) * multiplier + ema
      result.push(ema)
    }
  }

  return result
}

// ============================================================================
// Indicator Calculation
// ============================================================================

/**
 * Calculate all technical indicators for a set of candles
 * @param {object[]} candles - Array of OHLCV candles
 * @returns {object} Calculated indicators
 */
function calculateIndicators(candles) {
  if (!candles || candles.length === 0) {
    return {
      rsi: null,
      macd: null,
      cci: null,
      atr: null,
      bollingerBands: null,
      atrPercent: null
    }
  }

  const closes = getCloses(candles)
  const highs = getHighs(candles)
  const lows = getLows(candles)

  try {
    // RSI(14)
    const rsiValues = RSI.calculate({
      period: INDICATOR_CONFIG.rsi.period,
      values: closes
    })
    const rsi = getLatestValue(rsiValues)

    // MACD(12,26,9)
    const macdValues = MACD.calculate({
      fastPeriod: INDICATOR_CONFIG.macd.fastPeriod,
      slowPeriod: INDICATOR_CONFIG.macd.slowPeriod,
      signalPeriod: INDICATOR_CONFIG.macd.signalPeriod,
      values: closes
    })
    const macd = macdValues.length > 0 ? macdValues[macdValues.length - 1] : null

    // CCI(20)
    const cciValues = CCI.calculate({
      period: INDICATOR_CONFIG.cci.period,
      high: highs,
      low: lows,
      close: closes
    })
    const cci = getLatestValue(cciValues)

    // ATR(14)
    const atrValues = ATR.calculate({
      period: INDICATOR_CONFIG.atr.period,
      high: highs,
      low: lows,
      close: closes
    })
    const atr = getLatestValue(atrValues)

    // ATR as percentage of price
    const currentPrice = closes[closes.length - 1]
    const atrPercent = atr && currentPrice ? (atr / currentPrice) * 100 : null

    // Bollinger Bands(20,2)
    const bbValues = BollingerBands.calculate({
      period: INDICATOR_CONFIG.bollingerBands.period,
      stdDev: INDICATOR_CONFIG.bollingerBands.stdDev,
      values: closes
    })
    const bollingerBands = bbValues.length > 0 ? bbValues[bbValues.length - 1] : null

    return {
      rsi,
      macd,
      cci,
      atr,
      bollingerBands,
      atrPercent
    }
  } catch (error) {
    console.error('[Analysis] Indicator calculation error:', error.message)
    return {
      rsi: null,
      macd: null,
      cci: null,
      atr: null,
      bollingerBands: null,
      atrPercent: null
    }
  }
}

// ============================================================================
// Regime Detection using K-Means
// ============================================================================

/**
 * Detect market regime using K-means clustering
 * Features: RSI, ATR ratio, MACD histogram, CCI
 * @param {object} indicators - Current indicator values
 * @param {number} currentPrice - Current price for ATR ratio
 * @returns {string} Regime label
 */
function detectRegime(indicators, currentPrice) {
  try {
    const { rsi, macd, cci, atrPercent } = indicators

    // Need at least RSI and one other indicator
    if (rsi === null) return 'UNKNOWN'

    // Get MACD histogram
    const macdHistogram = macd?.histogram ?? 0

    // Prepare feature vector (need multiple data points for k-means)
    // We'll use a simplified approach: create synthetic feature sets
    // based on current values for regime detection

    // Build feature sets for clustering
    // Using sliding window approach with current + historical features
    const features = []

    // For K-means, we need at least K samples
    // Create a simplified feature set based on indicator values
    // Feature ranges to simulate different market conditions

    // TRENDING_UP: RSI in 50-70, MACD histogram positive, CCI positive
    // TRENDING_DOWN: RSI in 30-50, MACD histogram negative, CCI negative
    // RANGING: RSI around 50, low ATR%, CCI near 0
    // HIGH_VOLATILITY: High ATR%, extreme RSI values

    const sampleRegimes = [
      [60, 0.5, 100, 1.0],    // TRENDING_UP
      [40, -0.5, -100, 1.0],  // TRENDING_DOWN
      [50, 0, 0, 0.5],        // RANGING
      [80, 2.0, 200, 3.0]     // HIGH_VOLATILITY
    ]

    // Create feature vector from current indicators
    const currentFeature = [
      rsi / 100, // Normalize RSI to 0-1
      macdHistogram / 10, // Normalize MACD histogram
      (cci ?? 0) / 200, // Normalize CCI
      (atrPercent ?? 1) / 3 // Normalize ATR%
    ]

    // Calculate distances to each regime prototype
    const distances = sampleRegimes.map(regime => {
      let dist = 0
      for (let i = 0; i < 4; i++) {
        dist += Math.pow(currentFeature[i] - regime[i] / (i === 0 ? 100 : i === 1 ? 1 : i === 2 ? 200 : 3), 2)
      }
      return Math.sqrt(dist)
    })

    // Find closest regime
    const minDistIdx = distances.indexOf(Math.min(...distances))
    const regimes = ['TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'HIGH_VOLATILITY']

    return regimes[minDistIdx]
  } catch (error) {
    console.error('[Analysis] Regime detection error:', error.message)
    return 'UNKNOWN'
  }
}

/**
 * Detect regime using K-means with proper clustering
 * @param {object[]} candles - Historical candles for feature extraction
 * @returns {string} Regime label
 */
function detectRegimeWithKMeans(candles) {
  if (!candles || candles.length < 30) return 'UNKNOWN'

  try {
    const closes = getCloses(candles)
    const highs = getHighs(candles)
    const lows = getLows(candles)

    // Calculate indicators over time
    const rsiValues = RSI.calculate({ period: 14, values: closes })
    const macdValues = MACD.calculate({
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      values: closes
    })
    const cciValues = CCI.calculate({
      period: 20,
      high: highs,
      low: lows,
      close: closes
    })
    const atrValues = ATR.calculate({
      period: 14,
      high: highs,
      low: lows,
      close: closes
    })

    // Build feature matrix (RSI, ATR ratio, MACD histogram, CCI)
    // Need at least 4 samples for K=4 clustering
    const windowSize = 20
    const numSamples = Math.min(rsiValues.length, macdValues.length, cciValues.length, atrValues.length, windowSize)

    if (numSamples < 4) return 'UNKNOWN'

    const features = []

    for (let i = 0; i < numSamples; i++) {
      const rsiIdx = rsiValues.length - numSamples + i
      const macdIdx = macdValues.length - numSamples + i
      const cciIdx = cciValues.length - numSamples + i
      const atrIdx = atrValues.length - numSamples + i

      const rsi = rsiValues[rsiIdx] ?? 50
      const macdHist = macdValues[macdIdx]?.histogram ?? 0
      const cci = cciValues[cciIdx] ?? 0
      const atr = atrValues[atrIdx] ?? 0
      const price = closes[closes.length - numSamples + i]

      const atrRatio = price > 0 ? atr / price : 0

      features.push([
        rsi / 100,
        macdHist / 10,
        cci / 200,
        atrRatio * 10
      ])
    }

    // Normalize features using Z-score
    const numFeatures = features[0].length
    const normalizedFeatures = []

    for (let f = 0; f < numFeatures; f++) {
      const column = features.map(row => row[f])
      const mean = math.mean(column)
      const std = math.std(column)

      if (std === 0 || isNaN(std)) {
        features.forEach(() => normalizedFeatures.push(0))
      } else {
        features.forEach(row => normalizedFeatures.push((row[f] - mean) / std))
      }
    }

    // Reshape back to 2D
    const featureMatrix = []
    for (let i = 0; i < numSamples; i++) {
      const row = []
      for (let f = 0; f < numFeatures; f++) {
        row.push(normalizedFeatures[i * numFeatures + f])
      }
      featureMatrix.push(row)
    }

    // Run K-means with K=4
    const K = 4
    const result = kmeans(featureMatrix, K, {
      maxIterations: 100,
      tolerance: 1e-6,
      initialization: 'kmeans++'
    })

    // Analyze clusters to determine regime labels
    // Cluster centers tell us about the market state
    const centroids = result.centroids

    // Determine which cluster is which regime based on centroid characteristics
    const clusterStats = centroids.map((centroid, idx) => {
      const rsiFeature = centroid[0] // 0 = low RSI, high = high RSI
      const macdFeature = centroid[1] // negative = bearish, positive = bullish
      const cciFeature = centroid[2] // negative = bearish, positive = bullish
      const atrFeature = centroid[3] // high = high volatility

      return {
        idx,
        rsi: rsiFeature,
        macd: macdFeature,
        cci: cciFeature,
        atr: atrFeature,
        // Score each cluster
        bullishScore: (rsiFeature > 0 ? 1 : 0) + (macdFeature > 0 ? 1 : 0) + (cciFeature > 0 ? 1 : 0),
        volatility: atrFeature
      }
    })

    // Find the most recent cluster assignment
    const lastCluster = result.clusters[result.clusters.length - 1]
    const clusterRegime = clusterStats[lastCluster]

    // Label the regime based on cluster characteristics
    let regimeLabel
    if (clusterRegime.volatility > 1) {
      regimeLabel = 'HIGH_VOLATILITY'
    } else if (clusterRegime.bullishScore >= 2 && clusterRegime.rsi > 0) {
      regimeLabel = 'TRENDING_UP'
    } else if (clusterRegime.bullishScore <= 1 && clusterRegime.rsi < 0) {
      regimeLabel = 'TRENDING_DOWN'
    } else {
      regimeLabel = 'RANGING'
    }

    return regimeLabel
  } catch (error) {
    console.error('[Analysis] K-means regime detection error:', error.message)
    return 'UNKNOWN'
  }
}

// ============================================================================
// Multi-Timeframe Trend Analysis
// ============================================================================

/**
 * Analyze trend across multiple timeframes
 * @param {object} candlesByTF - Candles organized by timeframe { '1h': [], '4h': [], '1d': [] }
 * @returns {object} MTF trend analysis
 */
function analyzeMTFTrend(candlesByTF) {
  const results = {}

  for (const tf of TIMEFRAMES) {
    const candles = candlesByTF[tf]
    if (!candles || candles.length < EMA_SLOW) {
      results[tf] = { trend: 'UNKNOWN', ema50: null, ema200: null }
      continue
    }

    const closes = getCloses(candles)
    const ema50 = calculateEMAArray(closes, EMA_FAST)
    const ema200 = calculateEMAArray(closes, EMA_SLOW)

    const ema50Val = getLatestValue(ema50)
    const ema200Val = getLatestValue(ema200)

    let trend = 'NEUTRAL'
    if (ema50Val !== null && ema200Val !== null) {
      if (ema50Val > ema200Val) {
        trend = 'BULLISH'
      } else if (ema50Val < ema200Val) {
        trend = 'BEARISH'
      }
    }

    results[tf] = {
      trend,
      ema50: ema50Val,
      ema200: ema200Val,
      bullish: ema50Val !== null && ema200Val !== null && ema50Val > ema200Val
    }
  }

  // Determine dominant trend
  const bullishCount = Object.values(results).filter(r => r.bullish).length
  let dominantTrend = 'NEUTRAL'

  if (bullishCount >= 3) {
    dominantTrend = 'STRONG_BULLISH'
  } else if (bullishCount === 2) {
    dominantTrend = 'BULLISH'
  } else if (bullishCount === 1) {
    dominantTrend = 'BEARISH' // Only 1 TF bullish, majority bearish
  } else {
    // Check if all are bearish
    const allBearish = Object.values(results).every(r => r.trend === 'BEARISH')
    dominantTrend = allBearish ? 'STRONG_BEARISH' : 'NEUTRAL'
  }

  return {
    timeframes: results,
    dominantTrend,
    bullishCount,
    timestamp: Date.now()
  }
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Detect candlestick patterns in recent candles
 * @param {object[]} candles - Recent OHLCV candles
 * @returns {object} Pattern detection results
 */
function detectPatterns(candles) {
  if (!candles || candles.length < 2) {
    return { patterns: [], summary: { totalPatterns: 0 } }
  }

  try {
    return getPatternSummary(candles)
  } catch (error) {
    console.error('[Analysis] Pattern detection error:', error.message)
    return { patterns: [], summary: { totalPatterns: 0 } }
  }
}

// ============================================================================
// Support & Resistance Levels
// ============================================================================

/**
 * Find nearest support and resistance levels
 * @param {object[]} candles - Recent OHLCV candles
 * @returns {object} S/R level analysis
 */
function findSupportResistance(candles) {
  if (!candles || candles.length < 10) {
    return {
      nearestSupport: null,
      nearestResistance: null,
      currentPrice: null,
      supportDistance: null,
      resistanceDistance: null
    }
  }

  try {
    return findNearestLevels(candles)
  } catch (error) {
    console.error('[Analysis] S/R detection error:', error.message)
    return {
      nearestSupport: null,
      nearestResistance: null,
      currentPrice: candles[candles.length - 1]?.close ?? null,
      supportDistance: null,
      resistanceDistance: null
    }
  }
}

// ============================================================================
// Main Analysis Cycle
// ============================================================================

/**
 * Run the complete analysis cycle for a symbol
 * @param {string} symbol - Trading pair symbol (e.g., 'BTC/USDT')
 * @param {object} researchData - Data from research phase { fearGreed, sentiment, socialMetrics, timestamp }
 * @returns {Promise<object>} Complete analysis results
 */
async function runAnalysisCycle(symbol, researchData) {
  console.log(`[Analysis] Starting analysis cycle for ${symbol}`)

  const result = {
    indicators: {},
    regime: 'UNKNOWN',
    mtfTrend: null,
    levels: {},
    patterns: {},
    candles: {},
    timestamp: Date.now()
  }

  try {
    // ========================================================================
    // 1. Fetch OHLCV Data for Multiple Timeframes
    // ========================================================================

    const candlesByTF = {}
    const fetchPromises = TIMEFRAMES.map(async (tf) => {
      try {
        const { candles } = await ccxtService.fetchOHLCV(
          EXCHANGE_ID,
          symbol,
          tf,
          CANDLE_LIMIT
        )

        // Store in ring buffer for later retrieval
        candles.forEach(candle => candleBuffers[tf].push(candle))

        candlesByTF[tf] = candleBuffers[tf].getAll()
        result.candles[tf] = {
          count: candles.length,
          latestTimestamp: candles.length > 0 ? candles[candles.length - 1].timestamp : null
        }

        console.log(`[Analysis] Fetched ${candles.length} candles for ${tf}`)
        return { tf, success: true }
      } catch (error) {
        console.error(`[Analysis] Failed to fetch ${tf} candles:`, error.message)
        result.candles[tf] = { count: 0, error: error.message }
        return { tf, success: false }
      }
    })

    await Promise.all(fetchPromises)

    // ========================================================================
    // 2. Calculate Technical Indicators (using 1h timeframe as primary)
    // ========================================================================

    const primaryCandles = candlesByTF['1h']
    if (primaryCandles && primaryCandles.length > 0) {
      result.indicators = calculateIndicators(primaryCandles)
      console.log(`[Analysis] Indicators calculated - RSI: ${result.indicators.rsi?.toFixed(2) ?? 'N/A'}`)
    }

    // ========================================================================
    // 3. Regime Detection
    // ========================================================================

    if (primaryCandles && primaryCandles.length >= 30) {
      result.regime = detectRegimeWithKMeans(primaryCandles)
    } else if (result.indicators.rsi !== null) {
      // Fallback to simple regime detection
      result.regime = detectRegime(result.indicators, primaryCandles?.[primaryCandles.length - 1]?.close)
    }

    console.log(`[Analysis] Regime detected: ${result.regime}`)

    // ========================================================================
    // 4. Multi-Timeframe Trend Analysis
    // ========================================================================

    result.mtfTrend = analyzeMTFTrend(candlesByTF)
    console.log(`[Analysis] MTF Trend: ${result.mtfTrend.dominantTrend}`)

    // ========================================================================
    // 5. Support & Resistance Levels
    // ========================================================================

    if (primaryCandles && primaryCandles.length > 0) {
      result.levels = findSupportResistance(primaryCandles)

      if (result.levels.nearestSupport) {
        console.log(`[Analysis] Nearest Support: ${result.levels.nearestSupport.price?.toFixed(2)}`)
      }
      if (result.levels.nearestResistance) {
        console.log(`[Analysis] Nearest Resistance: ${result.levels.nearestResistance.price?.toFixed(2)}`)
      }
    }

    // ========================================================================
    // 6. Pattern Detection
    // ========================================================================

    if (primaryCandles && primaryCandles.length > 0) {
      result.patterns = detectPatterns(primaryCandles)
      console.log(`[Analysis] Patterns detected: ${result.patterns.summary?.totalPatterns ?? 0}`)
    }

    // ========================================================================
    // 7. Include research data context
    // ========================================================================

    result.researchContext = {
      fearGreed: researchData?.fearGreed ?? null,
      sentiment: researchData?.sentiment ?? null,
      socialMetrics: researchData?.socialMetrics ?? null
    }

    console.log(`[Analysis] Analysis cycle completed for ${symbol}`)

    return result

  } catch (error) {
    console.error('[Analysis] Analysis cycle error:', error.message)
    return {
      ...result,
      error: error.message,
      partialData: true
    }
  }
}

// ============================================================================
// Get Candles from Buffer
// ============================================================================

/**
 * Get stored candles from ring buffer for a specific timeframe
 * @param {string} timeframe - Timeframe key ('1h', '4h', '1d')
 * @param {number} count - Number of recent candles to retrieve
 * @returns {object[]} Array of candles
 */
function getStoredCandles(timeframe, count = CANDLE_LIMIT) {
  const buffer = candleBuffers[timeframe]
  if (!buffer) return []
  return buffer.getLatest(count)
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
  runAnalysisCycle,
  getStoredCandles,
  calculateIndicators,
  detectRegime,
  detectRegimeWithKMeans,
  analyzeMTFTrend,
  findSupportResistance,
  detectPatterns,
  TIMEFRAMES,
  CANDLE_LIMIT
}