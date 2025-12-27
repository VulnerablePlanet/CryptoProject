/**
 * ============================================================================
 * PRICE ACTION PATTERNS - Phase 4
 * ============================================================================
 * Detect candlestick patterns for price action analysis.
 */

/**
 * Calculate body and wick sizes for pattern detection
 * @param {object} candle - OHLC candle
 * @returns {object} Body and wick measurements
 */
const getCandleMetrics = (candle) => {
  const body = Math.abs(candle.close - candle.open)
  const upperWick = candle.high - Math.max(candle.open, candle.close)
  const lowerWick = Math.min(candle.open, candle.close) - candle.low
  const totalRange = candle.high - candle.low
  const isBullish = candle.close > candle.open
  
  return {
    body,
    upperWick,
    lowerWick,
    totalRange,
    isBullish,
    bodyRatio: totalRange > 0 ? body / totalRange : 0,
    upperWickRatio: totalRange > 0 ? upperWick / totalRange : 0,
    lowerWickRatio: totalRange > 0 ? lowerWick / totalRange : 0
  }
}

/**
 * Detect Doji pattern (indecision)
 * Body is very small compared to total range
 * @param {object} candle - Current candle
 * @returns {object|null} Pattern info or null
 */
const detectDoji = (candle) => {
  const metrics = getCandleMetrics(candle)
  
  // Doji: body is less than 10% of total range
  if (metrics.bodyRatio < 0.1 && metrics.totalRange > 0) {
    let type = 'standard'
    
    // Long-legged Doji: both wicks are significant
    if (metrics.upperWickRatio > 0.3 && metrics.lowerWickRatio > 0.3) {
      type = 'long_legged'
    }
    // Dragonfly Doji: long lower wick, no upper wick
    else if (metrics.lowerWickRatio > 0.6 && metrics.upperWickRatio < 0.1) {
      type = 'dragonfly'
    }
    // Gravestone Doji: long upper wick, no lower wick
    else if (metrics.upperWickRatio > 0.6 && metrics.lowerWickRatio < 0.1) {
      type = 'gravestone'
    }
    
    return {
      pattern: 'doji',
      type,
      confidence: metrics.bodyRatio < 0.05 ? 0.9 : 0.7,
      direction: 'NEUTRAL',
      description: `Doji (${type}) indicates market indecision`
    }
  }
  
  return null
}

/**
 * Detect Hammer or Hanging Man
 * Small body at top, long lower wick
 * @param {object} candle - Current candle
 * @param {string} trend - 'up' or 'down' (context)
 * @returns {object|null} Pattern info or null
 */
const detectHammer = (candle, trend = null) => {
  const metrics = getCandleMetrics(candle)
  
  // Hammer/Hanging Man: lower wick is at least 2x the body, upper wick is small
  if (metrics.lowerWickRatio > 0.5 && 
      metrics.upperWickRatio < 0.15 && 
      metrics.bodyRatio < 0.35 &&
      metrics.lowerWick >= metrics.body * 2) {
    
    const isHangingMan = trend === 'up'
    const pattern = isHangingMan ? 'hanging_man' : 'hammer'
    
    return {
      pattern,
      confidence: 0.75,
      direction: isHangingMan ? 'SHORT' : 'LONG',
      description: isHangingMan 
        ? 'Hanging Man: potential bearish reversal after uptrend'
        : 'Hammer: potential bullish reversal after downtrend'
    }
  }
  
  return null
}

/**
 * Detect Inverted Hammer or Shooting Star
 * Small body at bottom, long upper wick
 * @param {object} candle - Current candle
 * @param {string} trend - 'up' or 'down' (context)
 * @returns {object|null} Pattern info or null
 */
const detectInvertedHammer = (candle, trend = null) => {
  const metrics = getCandleMetrics(candle)
  
  // Inverted Hammer/Shooting Star: upper wick is at least 2x the body, lower wick is small
  if (metrics.upperWickRatio > 0.5 && 
      metrics.lowerWickRatio < 0.15 && 
      metrics.bodyRatio < 0.35 &&
      metrics.upperWick >= metrics.body * 2) {
    
    const isShootingStar = trend === 'up'
    const pattern = isShootingStar ? 'shooting_star' : 'inverted_hammer'
    
    return {
      pattern,
      confidence: 0.7,
      direction: isShootingStar ? 'SHORT' : 'LONG',
      description: isShootingStar 
        ? 'Shooting Star: potential bearish reversal signal'
        : 'Inverted Hammer: potential bullish reversal signal'
    }
  }
  
  return null
}

/**
 * Detect Bullish or Bearish Engulfing
 * Current candle completely engulfs previous candle's body
 * @param {object} current - Current candle
 * @param {object} previous - Previous candle
 * @returns {object|null} Pattern info or null
 */
const detectEngulfing = (current, previous) => {
  if (!previous) return null
  
  const currMetrics = getCandleMetrics(current)
  const prevMetrics = getCandleMetrics(previous)
  
  // Need opposite colors
  if (currMetrics.isBullish === prevMetrics.isBullish) return null
  
  // Current body must be larger than previous
  if (currMetrics.body <= prevMetrics.body) return null
  
  const currBodyHigh = Math.max(current.open, current.close)
  const currBodyLow = Math.min(current.open, current.close)
  const prevBodyHigh = Math.max(previous.open, previous.close)
  const prevBodyLow = Math.min(previous.open, previous.close)
  
  // Current body must engulf previous body
  if (currBodyHigh >= prevBodyHigh && currBodyLow <= prevBodyLow) {
    const isBullish = currMetrics.isBullish
    
    return {
      pattern: isBullish ? 'bullish_engulfing' : 'bearish_engulfing',
      confidence: 0.8,
      direction: isBullish ? 'LONG' : 'SHORT',
      description: isBullish 
        ? 'Bullish Engulfing: strong reversal signal, buyers taking control'
        : 'Bearish Engulfing: strong reversal signal, sellers taking control'
    }
  }
  
  return null
}

/**
 * Detect Pin Bar (rejection candle)
 * Long wick showing price rejection
 * @param {object} candle - Current candle
 * @returns {object|null} Pattern info or null
 */
const detectPinBar = (candle) => {
  const metrics = getCandleMetrics(candle)
  
  // Pin bar: one wick is at least 66% of total range, body is small
  if (metrics.bodyRatio < 0.33) {
    // Bullish pin bar: long lower wick
    if (metrics.lowerWickRatio > 0.66) {
      return {
        pattern: 'bullish_pin_bar',
        confidence: 0.75,
        direction: 'LONG',
        description: 'Bullish Pin Bar: strong rejection of lower prices'
      }
    }
    
    // Bearish pin bar: long upper wick
    if (metrics.upperWickRatio > 0.66) {
      return {
        pattern: 'bearish_pin_bar',
        confidence: 0.75,
        direction: 'SHORT',
        description: 'Bearish Pin Bar: strong rejection of higher prices'
      }
    }
  }
  
  return null
}

/**
 * Detect all patterns for a candle
 * @param {object} candle - Current candle
 * @param {object} previous - Previous candle (optional)
 * @param {string} trend - Current trend context (optional)
 * @returns {object[]} Array of detected patterns
 */
const detectPatterns = (candle, previous = null, trend = null) => {
  const patterns = []
  
  // Single candle patterns
  const doji = detectDoji(candle)
  if (doji) patterns.push(doji)
  
  const hammer = detectHammer(candle, trend)
  if (hammer) patterns.push(hammer)
  
  const inverted = detectInvertedHammer(candle, trend)
  if (inverted) patterns.push(inverted)
  
  const pinbar = detectPinBar(candle)
  if (pinbar) patterns.push(pinbar)
  
  // Two candle patterns
  if (previous) {
    const engulfing = detectEngulfing(candle, previous)
    if (engulfing) patterns.push(engulfing)
  }
  
  return patterns
}

/**
 * Analyze candles array for patterns
 * @param {object[]} candles - Array of OHLC candles
 * @param {number} lookback - How many recent candles to analyze
 * @returns {object[]} Patterns with candle indices
 */
const analyzePatterns = (candles, lookback = 20) => {
  if (!candles || candles.length < 2) return []
  
  const results = []
  const start = Math.max(0, candles.length - lookback)
  
  // Determine simple trend (for context)
  const getTrend = (index) => {
    if (index < 5) return null
    const recent5 = candles.slice(index - 5, index)
    const firstClose = recent5[0].close
    const lastClose = recent5[recent5.length - 1].close
    return lastClose > firstClose ? 'up' : 'down'
  }
  
  for (let i = start; i < candles.length; i++) {
    const trend = getTrend(i)
    const patterns = detectPatterns(candles[i], candles[i - 1], trend)
    
    if (patterns.length > 0) {
      results.push({
        index: i,
        timestamp: candles[i].timestamp,
        candle: candles[i],
        patterns
      })
    }
  }
  
  return results
}

/**
 * Get pattern summary for recent candles
 * @param {object[]} candles - Array of candles
 * @returns {object} Summary with counts and most recent patterns
 */
const getPatternSummary = (candles) => {
  const analysis = analyzePatterns(candles)
  
  const summary = {
    totalPatterns: 0,
    bullishPatterns: 0,
    bearishPatterns: 0,
    neutralPatterns: 0,
    recentPatterns: [],
    patternCounts: {}
  }
  
  for (const result of analysis) {
    for (const pattern of result.patterns) {
      summary.totalPatterns++
      summary.patternCounts[pattern.pattern] = (summary.patternCounts[pattern.pattern] || 0) + 1
      
      if (pattern.direction === 'LONG') summary.bullishPatterns++
      else if (pattern.direction === 'SHORT') summary.bearishPatterns++
      else summary.neutralPatterns++
    }
  }
  
  // Get most recent patterns (last 5)
  summary.recentPatterns = analysis.slice(-5).reverse()
  
  return summary
}

module.exports = {
  getCandleMetrics,
  detectDoji,
  detectHammer,
  detectInvertedHammer,
  detectEngulfing,
  detectPinBar,
  detectPatterns,
  analyzePatterns,
  getPatternSummary
}
