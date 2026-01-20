/**
 * ============================================================================
 * CONFLUENCE SERVICE - Technical Indicator Validation
 * ============================================================================
 * Provides technical indicator calculations and confluence detection
 * to validate Fibonacci signals with additional confirmations.
 * 
 * Features:
 * - RSI calculation with overbought/oversold detection
 * - MACD calculation with signal line crossovers
 * - EMA/SMA calculations for trend alignment
 * - Bollinger Bands for volatility-based confluence
 * - Volume validation for signal confirmation
 * - Combined confluence scoring
 * ============================================================================
 */

// ============================================================================
// Configuration
// ============================================================================

const INDICATOR_CONFIG = {
  rsi: {
    period: 14,
    overbought: 70,
    oversold: 30
  },
  macd: {
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9
  },
  ema: {
    shortPeriod: 20,
    mediumPeriod: 50,
    longPeriod: 200
  },
  bollinger: {
    period: 20,
    stdDev: 2
  },
  volume: {
    avgPeriod: 20,
    spikeThreshold: 1.5 // 1.5x average volume = spike
  }
}

// ============================================================================
// Moving Average Calculations
// ============================================================================

/**
 * Calculate Simple Moving Average (SMA)
 * 
 * @param {Array} values - Array of price values
 * @param {number} period - SMA period
 * @returns {Array} SMA values (null for first period-1 values)
 */
const calculateSMA = (values, period) => {
  if (!values || values.length < period) return []
  
  const sma = []
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      sma.push(null)
    } else {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      sma.push(sum / period)
    }
  }
  return sma
}

/**
 * Calculate Exponential Moving Average (EMA)
 * 
 * @param {Array} values - Array of price values
 * @param {number} period - EMA period
 * @returns {Array} EMA values
 */
const calculateEMA = (values, period) => {
  if (!values || values.length < period) return []
  
  const k = 2 / (period + 1)
  const ema = []
  
  // First EMA is SMA
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += values[i]
    ema.push(null)
  }
  ema[period - 1] = sum / period
  
  // Calculate remaining EMA values
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k))
  }
  
  return ema
}

// ============================================================================
// RSI Calculation
// ============================================================================

/**
 * Calculate Relative Strength Index (RSI)
 * 
 * @param {Array} closes - Array of closing prices
 * @param {number} period - RSI period (default: 14)
 * @returns {Array} RSI values (0-100)
 */
const calculateRSI = (closes, period = INDICATOR_CONFIG.rsi.period) => {
  if (!closes || closes.length < period + 1) return []
  
  const rsi = []
  const gains = []
  const losses = []
  
  // Calculate price changes
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }
  
  // Initial averages
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  // Fill nulls for first values
  for (let i = 0; i < period; i++) {
    rsi.push(null)
  }
  
  // Calculate RSI
  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      avgGain = (avgGain * (period - 1) + gains[i - 1]) / period
      avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period
    }
    
    if (avgLoss === 0) {
      rsi.push(100)
    } else {
      const rs = avgGain / avgLoss
      rsi.push(100 - (100 / (1 + rs)))
    }
  }
  
  return rsi
}

/**
 * Get RSI condition (overbought, oversold, neutral)
 * 
 * @param {number} rsiValue - Current RSI value
 * @returns {Object} RSI condition info
 */
const getRSICondition = (rsiValue) => {
  if (rsiValue === null || rsiValue === undefined) {
    return { condition: 'unknown', value: null }
  }
  
  const { overbought, oversold } = INDICATOR_CONFIG.rsi
  
  if (rsiValue >= overbought) {
    return { 
      condition: 'overbought', 
      value: rsiValue,
      signal: 'sell',
      strength: Math.min(100, (rsiValue - overbought) / (100 - overbought) * 100)
    }
  } else if (rsiValue <= oversold) {
    return { 
      condition: 'oversold', 
      value: rsiValue,
      signal: 'buy',
      strength: Math.min(100, (oversold - rsiValue) / oversold * 100)
    }
  }
  
  return { 
    condition: 'neutral', 
    value: rsiValue,
    signal: null,
    strength: 0
  }
}

// ============================================================================
// MACD Calculation
// ============================================================================

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * 
 * @param {Array} closes - Array of closing prices
 * @param {number} fastPeriod - Fast EMA period (default: 12)
 * @param {number} slowPeriod - Slow EMA period (default: 26)
 * @param {number} signalPeriod - Signal line period (default: 9)
 * @returns {Object} MACD values { macd, signal, histogram }
 */
const calculateMACD = (
  closes, 
  fastPeriod = INDICATOR_CONFIG.macd.fastPeriod,
  slowPeriod = INDICATOR_CONFIG.macd.slowPeriod,
  signalPeriod = INDICATOR_CONFIG.macd.signalPeriod
) => {
  if (!closes || closes.length < slowPeriod + signalPeriod) {
    return { macd: [], signal: [], histogram: [] }
  }
  
  const fastEMA = calculateEMA(closes, fastPeriod)
  const slowEMA = calculateEMA(closes, slowPeriod)
  
  // MACD line = Fast EMA - Slow EMA
  const macdLine = []
  for (let i = 0; i < closes.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null)
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i])
    }
  }
  
  // Signal line = EMA of MACD line
  const validMacd = macdLine.filter(v => v !== null)
  const signalEMA = calculateEMA(validMacd, signalPeriod)
  
  // Align signal line with MACD line
  const signalLine = []
  let signalIdx = 0
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null)
    } else {
      signalLine.push(signalEMA[signalIdx] || null)
      signalIdx++
    }
  }
  
  // Histogram = MACD - Signal
  const histogram = macdLine.map((m, i) => {
    if (m === null || signalLine[i] === null) return null
    return m - signalLine[i]
  })
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram
  }
}

/**
 * Get MACD crossover condition
 * 
 * @param {Object} macdData - MACD calculation result
 * @returns {Object} Crossover info
 */
const getMACDCondition = (macdData) => {
  const { macd, signal, histogram } = macdData
  
  if (!histogram || histogram.length < 2) {
    return { condition: 'unknown', crossover: null }
  }
  
  const currentHist = histogram[histogram.length - 1]
  const prevHist = histogram[histogram.length - 2]
  
  if (currentHist === null || prevHist === null) {
    return { condition: 'unknown', crossover: null }
  }
  
  const currentMacd = macd[macd.length - 1]
  
  // Detect crossover
  if (prevHist < 0 && currentHist >= 0) {
    return {
      condition: 'bullish_crossover',
      signal: 'buy',
      macdValue: currentMacd,
      histogramValue: currentHist,
      strength: Math.min(100, Math.abs(currentHist) * 10)
    }
  } else if (prevHist > 0 && currentHist <= 0) {
    return {
      condition: 'bearish_crossover',
      signal: 'sell',
      macdValue: currentMacd,
      histogramValue: currentHist,
      strength: Math.min(100, Math.abs(currentHist) * 10)
    }
  }
  
  return {
    condition: currentHist > 0 ? 'bullish' : 'bearish',
    signal: null,
    macdValue: currentMacd,
    histogramValue: currentHist,
    strength: Math.min(100, Math.abs(currentHist) * 5)
  }
}

// ============================================================================
// Bollinger Bands
// ============================================================================

/**
 * Calculate Bollinger Bands
 * 
 * @param {Array} closes - Array of closing prices
 * @param {number} period - SMA period (default: 20)
 * @param {number} stdDev - Standard deviation multiplier (default: 2)
 * @returns {Object} { upper, middle, lower, bandwidth }
 */
const calculateBollingerBands = (
  closes, 
  period = INDICATOR_CONFIG.bollinger.period,
  stdDev = INDICATOR_CONFIG.bollinger.stdDev
) => {
  if (!closes || closes.length < period) {
    return { upper: [], middle: [], lower: [], bandwidth: [] }
  }
  
  const middle = calculateSMA(closes, period)
  const upper = []
  const lower = []
  const bandwidth = []
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null)
      lower.push(null)
      bandwidth.push(null)
    } else {
      // Calculate standard deviation
      const slice = closes.slice(i - period + 1, i + 1)
      const mean = middle[i]
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
      const std = Math.sqrt(variance)
      
      upper.push(mean + stdDev * std)
      lower.push(mean - stdDev * std)
      bandwidth.push((upper[i] - lower[i]) / middle[i] * 100)
    }
  }
  
  return { upper, middle, lower, bandwidth }
}

/**
 * Get Bollinger Bands condition
 * 
 * @param {number} currentPrice - Current price
 * @param {Object} bbData - Bollinger Bands data
 * @returns {Object} BB condition info
 */
const getBBCondition = (currentPrice, bbData) => {
  const { upper, middle, lower, bandwidth } = bbData
  
  const upperVal = upper[upper.length - 1]
  const middleVal = middle[middle.length - 1]
  const lowerVal = lower[lower.length - 1]
  const bwVal = bandwidth[bandwidth.length - 1]
  
  if (!upperVal || !lowerVal) {
    return { condition: 'unknown' }
  }
  
  // Calculate %B (where price is within bands: 0 = lower, 1 = upper)
  const percentB = (currentPrice - lowerVal) / (upperVal - lowerVal)
  
  let condition = 'neutral'
  let signal = null
  
  if (currentPrice >= upperVal) {
    condition = 'above_upper'
    signal = 'sell'
  } else if (currentPrice <= lowerVal) {
    condition = 'below_lower'
    signal = 'buy'
  } else if (percentB > 0.8) {
    condition = 'near_upper'
    signal = 'caution_sell'
  } else if (percentB < 0.2) {
    condition = 'near_lower'
    signal = 'caution_buy'
  }
  
  return {
    condition,
    signal,
    percentB: Math.round(percentB * 100) / 100,
    upper: upperVal,
    middle: middleVal,
    lower: lowerVal,
    bandwidth: bwVal
  }
}

// ============================================================================
// Volume Analysis
// ============================================================================

/**
 * Calculate volume metrics
 * 
 * @param {Array} volumes - Array of volume values
 * @param {number} period - Average period (default: 20)
 * @returns {Object} Volume analysis
 */
const analyzeVolume = (volumes, period = INDICATOR_CONFIG.volume.avgPeriod) => {
  if (!volumes || volumes.length < period) {
    return { hasSpike: false, ratio: 1 }
  }
  
  const currentVolume = volumes[volumes.length - 1]
  const avgVolume = volumes.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period
  const ratio = currentVolume / avgVolume
  
  return {
    current: currentVolume,
    average: avgVolume,
    ratio: Math.round(ratio * 100) / 100,
    hasSpike: ratio >= INDICATOR_CONFIG.volume.spikeThreshold,
    condition: ratio >= 2 ? 'very_high' : ratio >= 1.5 ? 'high' : ratio >= 0.7 ? 'normal' : 'low'
  }
}

// ============================================================================
// EMA Alignment
// ============================================================================

/**
 * Check EMA alignment with Fibonacci levels
 * 
 * @param {Array} closes - Closing prices
 * @param {number} fibLevel - Fibonacci level price
 * @param {number} tolerance - Price tolerance % (default: 0.5%)
 * @returns {Object} EMA alignment info
 */
const checkEMAAlignment = (closes, fibLevel, tolerance = 0.5) => {
  const ema20 = calculateEMA(closes, INDICATOR_CONFIG.ema.shortPeriod)
  const ema50 = calculateEMA(closes, INDICATOR_CONFIG.ema.mediumPeriod)
  const ema200 = calculateEMA(closes, INDICATOR_CONFIG.ema.longPeriod)
  
  const currentEMA20 = ema20[ema20.length - 1]
  const currentEMA50 = ema50[ema50.length - 1]
  const currentEMA200 = ema200[ema200.length - 1]
  
  const tolerancePrice = fibLevel * (tolerance / 100)
  
  const alignments = []
  
  if (currentEMA20 && Math.abs(currentEMA20 - fibLevel) <= tolerancePrice) {
    alignments.push({ ema: 'EMA20', price: currentEMA20 })
  }
  if (currentEMA50 && Math.abs(currentEMA50 - fibLevel) <= tolerancePrice) {
    alignments.push({ ema: 'EMA50', price: currentEMA50 })
  }
  if (currentEMA200 && Math.abs(currentEMA200 - fibLevel) <= tolerancePrice) {
    alignments.push({ ema: 'EMA200', price: currentEMA200 })
  }
  
  return {
    hasAlignment: alignments.length > 0,
    alignments,
    emaValues: {
      ema20: currentEMA20,
      ema50: currentEMA50,
      ema200: currentEMA200
    }
  }
}

// ============================================================================
// Confluence Validation
// ============================================================================

/**
 * Calculate comprehensive confluence signals
 * 
 * @param {Array} candles - OHLCV candle data
 * @param {Object} fibLevels - Fibonacci levels object
 * @param {number} currentPrice - Current price
 * @param {string} trend - Market trend
 * @returns {Object} Confluence analysis
 */
const calculateConfluence = (candles, fibLevels, currentPrice, trend) => {
  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)
  
  // Calculate all indicators
  const rsiValues = calculateRSI(closes)
  const macdData = calculateMACD(closes)
  const bbData = calculateBollingerBands(closes)
  const volumeData = analyzeVolume(volumes)
  
  // Get current conditions
  const currentRSI = rsiValues[rsiValues.length - 1]
  const rsiCondition = getRSICondition(currentRSI)
  const macdCondition = getMACDCondition(macdData)
  const bbCondition = getBBCondition(currentPrice, bbData)
  
  // Check EMA alignment with nearest Fib level
  const nearestFib = findNearestFibLevel(currentPrice, fibLevels)
  const emaAlignment = checkEMAAlignment(closes, nearestFib?.price || currentPrice)
  
  // Calculate confluence score (0-100)
  let score = 50 // Start neutral
  const signals = []
  
  // RSI contribution
  if (trend === 'bullish' && rsiCondition.condition === 'oversold') {
    score += 15
    signals.push({ type: 'rsi', direction: 'buy', message: 'RSI oversold - potential bounce' })
  } else if (trend === 'bearish' && rsiCondition.condition === 'overbought') {
    score += 15
    signals.push({ type: 'rsi', direction: 'sell', message: 'RSI overbought - potential reversal' })
  } else if (rsiCondition.condition === 'overbought' && trend === 'bullish') {
    score -= 10
    signals.push({ type: 'rsi', direction: 'caution', message: 'RSI overbought in uptrend - watch for pullback' })
  }
  
  // MACD contribution
  if (macdCondition.condition === 'bullish_crossover' && trend === 'bullish') {
    score += 15
    signals.push({ type: 'macd', direction: 'buy', message: 'MACD bullish crossover confirms uptrend' })
  } else if (macdCondition.condition === 'bearish_crossover' && trend === 'bearish') {
    score += 15
    signals.push({ type: 'macd', direction: 'sell', message: 'MACD bearish crossover confirms downtrend' })
  }
  
  // Bollinger Bands contribution
  if (bbCondition.condition === 'below_lower' && trend === 'bullish') {
    score += 10
    signals.push({ type: 'bb', direction: 'buy', message: 'Price below lower BB - oversold bounce likely' })
  } else if (bbCondition.condition === 'above_upper' && trend === 'bearish') {
    score += 10
    signals.push({ type: 'bb', direction: 'sell', message: 'Price above upper BB - overbought reversal likely' })
  }
  
  // Volume contribution
  if (volumeData.hasSpike) {
    score += 10
    signals.push({ type: 'volume', direction: 'confirm', message: `Volume spike (${volumeData.ratio}x avg) confirms move` })
  }
  
  // EMA alignment contribution
  if (emaAlignment.hasAlignment) {
    score += 10
    const emas = emaAlignment.alignments.map(a => a.ema).join(', ')
    signals.push({ type: 'ema', direction: 'support', message: `Fib level aligns with ${emas}` })
  }
  
  // Normalize score
  score = Math.max(0, Math.min(100, score))
  
  // Determine overall signal
  let overallSignal = 'neutral'
  if (score >= 70) {
    overallSignal = trend === 'bullish' ? 'strong_buy' : 'strong_sell'
  } else if (score >= 60) {
    overallSignal = trend === 'bullish' ? 'buy' : 'sell'
  } else if (score <= 30) {
    overallSignal = 'avoid'
  }
  
  return {
    score,
    overallSignal,
    signals,
    indicators: {
      rsi: {
        value: currentRSI,
        ...rsiCondition
      },
      macd: {
        line: macdData.macd[macdData.macd.length - 1],
        signal: macdData.signal[macdData.signal.length - 1],
        histogram: macdData.histogram[macdData.histogram.length - 1],
        ...macdCondition
      },
      bollingerBands: bbCondition,
      volume: volumeData,
      emaAlignment
    },
    trend
  }
}

/**
 * Find nearest Fibonacci level to current price
 */
const findNearestFibLevel = (currentPrice, fibLevels) => {
  if (!fibLevels?.retracement) return null
  
  let nearest = null
  let minDistance = Infinity
  
  Object.entries(fibLevels.retracement).forEach(([key, level]) => {
    const distance = Math.abs(currentPrice - level.price)
    if (distance < minDistance) {
      minDistance = distance
      nearest = { key, ...level }
    }
  })
  
  return nearest
}

/**
 * Generate actionable trade signals based on confluence
 * 
 * @param {Object} fibAnalysis - Fibonacci analysis result
 * @param {Object} confluence - Confluence analysis result
 * @returns {Array} Array of trade signals
 */
const generateTradeSignals = (fibAnalysis, confluence) => {
  const signals = []
  const { trend, currentPrice, levels, nearestLevel, goldenPocket } = fibAnalysis
  const { score, indicators } = confluence
  
  // Golden Pocket entry signal
  if (goldenPocket?.inZone && trend === 'bullish' && score >= 60) {
    signals.push({
      type: 'entry',
      action: 'buy',
      price: currentPrice,
      target: levels.extensions['161.8']?.price,
      stopLoss: levels.retracement['78.6']?.price,
      confidence: score,
      reason: 'Price in Golden Pocket zone with bullish confluence'
    })
  }
  
  // Extension target signal
  if (nearestLevel?.type === 'extension' && nearestLevel.percentDistance < 2) {
    signals.push({
      type: 'exit',
      action: 'take_profit',
      price: nearestLevel.price,
      confidence: score,
      reason: `Approaching ${nearestLevel.label} extension target`
    })
  }
  
  // RSI divergence warning
  if (indicators.rsi.condition === 'overbought' && trend === 'bullish') {
    signals.push({
      type: 'warning',
      action: 'reduce_position',
      reason: 'RSI overbought - consider taking partial profits'
    })
  }
  
  return signals
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Configuration
  INDICATOR_CONFIG,
  
  // Moving Averages
  calculateSMA,
  calculateEMA,
  
  // RSI
  calculateRSI,
  getRSICondition,
  
  // MACD
  calculateMACD,
  getMACDCondition,
  
  // Bollinger Bands
  calculateBollingerBands,
  getBBCondition,
  
  // Volume
  analyzeVolume,
  
  // EMA Alignment
  checkEMAAlignment,
  
  // Confluence
  calculateConfluence,
  generateTradeSignals,
  findNearestFibLevel
}
