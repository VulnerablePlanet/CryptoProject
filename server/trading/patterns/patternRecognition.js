/**
 * ============================================================================
 * Pattern Recognition - TA-Lib Style Candlestick Pattern Detection
 * ============================================================================
 * Detects common candlestick patterns similar to TA-Lib functions.
 * Returns pattern signals that can be displayed as markers on charts.
 */

// ============================================================================
// Pattern Detection Configuration
// ============================================================================

const PATTERN_TYPES = {
  CDLDOJI: { name: 'Doji', type: 'neutral', description: 'Indecision in the market' },
  CDLHAMMER: { name: 'Hammer', type: 'bullish', description: 'Potential bullish reversal' },
  CDLHANGINGMAN: { name: 'Hanging Man', type: 'bearish', description: 'Potential bearish reversal' },
  CDLENGULFING_BULL: { name: 'Bullish Engulfing', type: 'bullish', description: 'Strong bullish reversal signal' },
  CDLENGULFING_BEAR: { name: 'Bearish Engulfing', type: 'bearish', description: 'Strong bearish reversal signal' },
  CDLMORNINGSTAR: { name: 'Morning Star', type: 'bullish', description: 'Bullish reversal pattern' },
  CDLEVENINGSTAR: { name: 'Evening Star', type: 'bearish', description: 'Bearish reversal pattern' },
  CDLHARAMI_BULL: { name: 'Bullish Harami', type: 'bullish', description: 'Potential bullish reversal' },
  CDLHARAMI_BEAR: { name: 'Bearish Harami', type: 'bearish', description: 'Potential bearish reversal' },
  CDLSHOOTINGSTAR: { name: 'Shooting Star', type: 'bearish', description: 'Bearish reversal at top' },
  CDLINVERTEDHAMMER: { name: 'Inverted Hammer', type: 'bullish', description: 'Potential bullish reversal' },
  GOLDEN_CROSS: { name: 'Golden Cross', type: 'bullish', description: 'SMA50 crosses above SMA200' },
  DEATH_CROSS: { name: 'Death Cross', type: 'bearish', description: 'SMA50 crosses below SMA200' }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get candle body size (absolute difference between open and close)
 */
const getBodySize = (candle) => Math.abs(candle.close - candle.open)

/**
 * Get total candle range (high - low)
 */
const getRange = (candle) => candle.high - candle.low

/**
 * Check if candle is bullish (close > open)
 */
const isBullish = (candle) => candle.close > candle.open

/**
 * Check if candle is bearish (close < open)
 */
const isBearish = (candle) => candle.close < candle.open

/**
 * Get upper shadow size
 */
const getUpperShadow = (candle) => {
  return candle.high - Math.max(candle.open, candle.close)
}

/**
 * Get lower shadow size
 */
const getLowerShadow = (candle) => {
  return Math.min(candle.open, candle.close) - candle.low
}

// ============================================================================
// Single Candle Patterns
// ============================================================================

/**
 * Detect Doji pattern
 * Body is very small relative to the range
 */
const detectDoji = (candle, threshold = 0.1) => {
  const body = getBodySize(candle)
  const range = getRange(candle)
  
  if (range === 0) return false
  return (body / range) < threshold
}

/**
 * Detect Hammer pattern
 * Small body at top, long lower shadow (2x body), small upper shadow
 */
const detectHammer = (candle, prevCandles = []) => {
  const body = getBodySize(candle)
  const range = getRange(candle)
  const lowerShadow = getLowerShadow(candle)
  const upperShadow = getUpperShadow(candle)
  
  if (range === 0 || body === 0) return false
  
  // Check for downtrend (simplified: previous 3 candles mostly bearish)
  const inDowntrend = prevCandles.length >= 3 &&
    prevCandles.slice(-3).filter(c => isBearish(c)).length >= 2
  
  const isHammer = 
    lowerShadow >= body * 2 &&
    upperShadow < body * 0.5 &&
    body / range < 0.4
  
  return isHammer && inDowntrend
}

/**
 * Detect Hanging Man pattern (same shape as hammer but in uptrend)
 */
const detectHangingMan = (candle, prevCandles = []) => {
  const body = getBodySize(candle)
  const range = getRange(candle)
  const lowerShadow = getLowerShadow(candle)
  const upperShadow = getUpperShadow(candle)
  
  if (range === 0 || body === 0) return false
  
  // Check for uptrend
  const inUptrend = prevCandles.length >= 3 &&
    prevCandles.slice(-3).filter(c => isBullish(c)).length >= 2
  
  const hasHangingShape = 
    lowerShadow >= body * 2 &&
    upperShadow < body * 0.5 &&
    body / range < 0.4
  
  return hasHangingShape && inUptrend
}

/**
 * Detect Shooting Star pattern
 */
const detectShootingStar = (candle, prevCandles = []) => {
  const body = getBodySize(candle)
  const range = getRange(candle)
  const lowerShadow = getLowerShadow(candle)
  const upperShadow = getUpperShadow(candle)
  
  if (range === 0 || body === 0) return false
  
  // Check for uptrend
  const inUptrend = prevCandles.length >= 3 &&
    prevCandles.slice(-3).filter(c => isBullish(c)).length >= 2
  
  const hasStarShape = 
    upperShadow >= body * 2 &&
    lowerShadow < body * 0.5 &&
    body / range < 0.4
  
  return hasStarShape && inUptrend
}

/**
 * Detect Inverted Hammer pattern
 */
const detectInvertedHammer = (candle, prevCandles = []) => {
  const body = getBodySize(candle)
  const range = getRange(candle)
  const lowerShadow = getLowerShadow(candle)
  const upperShadow = getUpperShadow(candle)
  
  if (range === 0 || body === 0) return false
  
  // Check for downtrend
  const inDowntrend = prevCandles.length >= 3 &&
    prevCandles.slice(-3).filter(c => isBearish(c)).length >= 2
  
  const hasShape = 
    upperShadow >= body * 2 &&
    lowerShadow < body * 0.5 &&
    body / range < 0.4
  
  return hasShape && inDowntrend
}

// ============================================================================
// Multi-Candle Patterns
// ============================================================================

/**
 * Detect Bullish Engulfing pattern
 */
const detectBullishEngulfing = (candles) => {
  if (candles.length < 2) return false
  
  const prev = candles[candles.length - 2]
  const curr = candles[candles.length - 1]
  
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open &&
    getBodySize(curr) > getBodySize(prev)
  )
}

/**
 * Detect Bearish Engulfing pattern
 */
const detectBearishEngulfing = (candles) => {
  if (candles.length < 2) return false
  
  const prev = candles[candles.length - 2]
  const curr = candles[candles.length - 1]
  
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open &&
    getBodySize(curr) > getBodySize(prev)
  )
}

/**
 * Detect Morning Star pattern (3 candle bullish reversal)
 */
const detectMorningStar = (candles) => {
  if (candles.length < 3) return false
  
  const first = candles[candles.length - 3]
  const middle = candles[candles.length - 2]
  const last = candles[candles.length - 1]
  
  const firstBodySize = getBodySize(first)
  const middleBodySize = getBodySize(middle)
  const lastBodySize = getBodySize(last)
  
  return (
    isBearish(first) &&
    firstBodySize > middleBodySize * 2 && // First is large bearish
    middleBodySize < firstBodySize * 0.3 && // Middle is small (star)
    isBullish(last) &&
    lastBodySize > middleBodySize * 2 && // Last is large bullish
    last.close > (first.open + first.close) / 2 // Closes above first midpoint
  )
}

/**
 * Detect Evening Star pattern (3 candle bearish reversal)
 */
const detectEveningStar = (candles) => {
  if (candles.length < 3) return false
  
  const first = candles[candles.length - 3]
  const middle = candles[candles.length - 2]
  const last = candles[candles.length - 1]
  
  const firstBodySize = getBodySize(first)
  const middleBodySize = getBodySize(middle)
  const lastBodySize = getBodySize(last)
  
  return (
    isBullish(first) &&
    firstBodySize > middleBodySize * 2 &&
    middleBodySize < firstBodySize * 0.3 &&
    isBearish(last) &&
    lastBodySize > middleBodySize * 2 &&
    last.close < (first.open + first.close) / 2
  )
}

/**
 * Detect Bullish Harami pattern
 */
const detectBullishHarami = (candles) => {
  if (candles.length < 2) return false
  
  const prev = candles[candles.length - 2]
  const curr = candles[candles.length - 1]
  
  return (
    isBearish(prev) &&
    isBullish(curr) &&
    curr.open > prev.close &&
    curr.close < prev.open &&
    getBodySize(curr) < getBodySize(prev) * 0.5
  )
}

/**
 * Detect Bearish Harami pattern
 */
const detectBearishHarami = (candles) => {
  if (candles.length < 2) return false
  
  const prev = candles[candles.length - 2]
  const curr = candles[candles.length - 1]
  
  return (
    isBullish(prev) &&
    isBearish(curr) &&
    curr.open < prev.close &&
    curr.close > prev.open &&
    getBodySize(curr) < getBodySize(prev) * 0.5
  )
}

// ============================================================================
// Moving Average Crossovers
// ============================================================================

/**
 * Detect Golden Cross (SMA50 crosses above SMA200)
 */
const detectGoldenCross = (sma50, sma200) => {
  if (sma50.length < 2 || sma200.length < 2) return false
  
  const prevSma50 = sma50[sma50.length - 2]
  const currSma50 = sma50[sma50.length - 1]
  const prevSma200 = sma200[sma200.length - 2]
  const currSma200 = sma200[sma200.length - 1]
  
  if (!prevSma50 || !currSma50 || !prevSma200 || !currSma200) return false
  
  return prevSma50 < prevSma200 && currSma50 > currSma200
}

/**
 * Detect Death Cross (SMA50 crosses below SMA200)
 */
const detectDeathCross = (sma50, sma200) => {
  if (sma50.length < 2 || sma200.length < 2) return false
  
  const prevSma50 = sma50[sma50.length - 2]
  const currSma50 = sma50[sma50.length - 1]
  const prevSma200 = sma200[sma200.length - 2]
  const currSma200 = sma200[sma200.length - 1]
  
  if (!prevSma50 || !currSma50 || !prevSma200 || !currSma200) return false
  
  return prevSma50 > prevSma200 && currSma50 < currSma200
}

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect all patterns in a candle array
 * @param {object[]} candles - Array of OHLCV candles
 * @param {object} indicators - Optional calculated indicators (for MA crossovers)
 * @returns {object[]} Array of detected patterns with timestamps
 */
const detectAllPatterns = (candles, indicators = {}) => {
  const patterns = []
  
  if (candles.length < 3) return patterns
  
  // Scan through candles
  for (let i = 5; i < candles.length; i++) {
    const currentCandle = candles[i]
    const prevCandles = candles.slice(Math.max(0, i - 5), i)
    const windowCandles = candles.slice(Math.max(0, i - 2), i + 1)
    
    const time = currentCandle.time || Math.floor(currentCandle.timestamp / 1000)
    const price = currentCandle.close
    
    // Single candle patterns
    if (detectDoji(currentCandle)) {
      patterns.push({
        time,
        pattern: 'CDLDOJI',
        ...PATTERN_TYPES.CDLDOJI,
        price,
        position: 'aboveBar'
      })
    }
    
    if (detectHammer(currentCandle, prevCandles)) {
      patterns.push({
        time,
        pattern: 'CDLHAMMER',
        ...PATTERN_TYPES.CDLHAMMER,
        price: currentCandle.low,
        position: 'belowBar'
      })
    }
    
    if (detectHangingMan(currentCandle, prevCandles)) {
      patterns.push({
        time,
        pattern: 'CDLHANGINGMAN',
        ...PATTERN_TYPES.CDLHANGINGMAN,
        price: currentCandle.high,
        position: 'aboveBar'
      })
    }
    
    if (detectShootingStar(currentCandle, prevCandles)) {
      patterns.push({
        time,
        pattern: 'CDLSHOOTINGSTAR',
        ...PATTERN_TYPES.CDLSHOOTINGSTAR,
        price: currentCandle.high,
        position: 'aboveBar'
      })
    }
    
    if (detectInvertedHammer(currentCandle, prevCandles)) {
      patterns.push({
        time,
        pattern: 'CDLINVERTEDHAMMER',
        ...PATTERN_TYPES.CDLINVERTEDHAMMER,
        price: currentCandle.low,
        position: 'belowBar'
      })
    }
    
    // Multi-candle patterns
    if (detectBullishEngulfing(windowCandles)) {
      patterns.push({
        time,
        pattern: 'CDLENGULFING_BULL',
        ...PATTERN_TYPES.CDLENGULFING_BULL,
        price: currentCandle.low,
        position: 'belowBar'
      })
    }
    
    if (detectBearishEngulfing(windowCandles)) {
      patterns.push({
        time,
        pattern: 'CDLENGULFING_BEAR',
        ...PATTERN_TYPES.CDLENGULFING_BEAR,
        price: currentCandle.high,
        position: 'aboveBar'
      })
    }
    
    if (detectMorningStar(windowCandles)) {
      patterns.push({
        time,
        pattern: 'CDLMORNINGSTAR',
        ...PATTERN_TYPES.CDLMORNINGSTAR,
        price: currentCandle.low,
        position: 'belowBar'
      })
    }
    
    if (detectEveningStar(windowCandles)) {
      patterns.push({
        time,
        pattern: 'CDLEVENINGSTAR',
        ...PATTERN_TYPES.CDLEVENINGSTAR,
        price: currentCandle.high,
        position: 'aboveBar'
      })
    }
    
    if (detectBullishHarami(windowCandles)) {
      patterns.push({
        time,
        pattern: 'CDLHARAMI_BULL',
        ...PATTERN_TYPES.CDLHARAMI_BULL,
        price: currentCandle.low,
        position: 'belowBar'
      })
    }
    
    if (detectBearishHarami(windowCandles)) {
      patterns.push({
        time,
        pattern: 'CDLHARAMI_BEAR',
        ...PATTERN_TYPES.CDLHARAMI_BEAR,
        price: currentCandle.high,
        position: 'aboveBar'
      })
    }
  }
  
  // MA Crossover detection (if indicators provided)
  if (indicators.sma && indicators.sma[50] && indicators.sma[200]) {
    if (detectGoldenCross(indicators.sma[50], indicators.sma[200])) {
      const lastCandle = candles[candles.length - 1]
      patterns.push({
        time: lastCandle.time || Math.floor(lastCandle.timestamp / 1000),
        pattern: 'GOLDEN_CROSS',
        ...PATTERN_TYPES.GOLDEN_CROSS,
        price: lastCandle.close,
        position: 'belowBar'
      })
    }
    
    if (detectDeathCross(indicators.sma[50], indicators.sma[200])) {
      const lastCandle = candles[candles.length - 1]
      patterns.push({
        time: lastCandle.time || Math.floor(lastCandle.timestamp / 1000),
        pattern: 'DEATH_CROSS',
        ...PATTERN_TYPES.DEATH_CROSS,
        price: lastCandle.close,
        position: 'aboveBar'
      })
    }
  }
  
  return patterns
}

/**
 * Convert patterns to TradingView markers format
 * @param {object[]} patterns - Detected patterns
 * @returns {object[]} TradingView marker format
 */
const patternsToMarkers = (patterns) => {
  return patterns.map(p => ({
    time: p.time,
    position: p.position,
    color: p.type === 'bullish' ? '#10b981' : p.type === 'bearish' ? '#ef4444' : '#fbbf24',
    shape: p.type === 'bullish' ? 'arrowUp' : p.type === 'bearish' ? 'arrowDown' : 'circle',
    text: p.name
  }))
}

module.exports = {
  detectAllPatterns,
  patternsToMarkers,
  PATTERN_TYPES,
  // Individual detectors
  detectDoji,
  detectHammer,
  detectHangingMan,
  detectShootingStar,
  detectInvertedHammer,
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectMorningStar,
  detectEveningStar,
  detectBullishHarami,
  detectBearishHarami,
  detectGoldenCross,
  detectDeathCross
}
