/**
 * ============================================================================
 * MULTI-TIMEFRAME ANALYSIS - Phase 7
 * ============================================================================
 * Analyze higher timeframes for trend confirmation and context.
 */

const { calculateEMA, calculateSMA } = require('../indicators/movingAverages')
const { calculateATR } = require('../indicators/atr')

/**
 * Timeframe hierarchy (lower to higher)
 */
const TIMEFRAME_HIERARCHY = {
  '1m': { minutes: 1, higherTFs: ['5m', '15m', '1h'] },
  '5m': { minutes: 5, higherTFs: ['15m', '1h', '4h'] },
  '15m': { minutes: 15, higherTFs: ['1h', '4h'] },
  '30m': { minutes: 30, higherTFs: ['1h', '4h'] },
  '1h': { minutes: 60, higherTFs: ['4h', '1d'] },
  '4h': { minutes: 240, higherTFs: ['1d'] },
  '1d': { minutes: 1440, higherTFs: [] }
}

/**
 * Detect trend direction using multiple EMAs
 * @param {number[]} prices - Close prices
 * @returns {object} Trend analysis
 */
const detectTrend = (prices) => {
  if (!prices || prices.length < 55) {
    return { trend: 'UNKNOWN', strength: 0 }
  }
  
  const ema9 = calculateEMA(prices, 9)
  const ema21 = calculateEMA(prices, 21)
  const ema55 = calculateEMA(prices, 55)
  
  const lastIdx = prices.length - 1
  const currentPrice = prices[lastIdx]
  const ema9Last = ema9[lastIdx]
  const ema21Last = ema21[lastIdx]
  const ema55Last = ema55[lastIdx]
  
  if (!ema9Last || !ema21Last || !ema55Last) {
    return { trend: 'UNKNOWN', strength: 0 }
  }
  
  // Check EMA alignment
  const bullishAlign = ema9Last > ema21Last && ema21Last > ema55Last
  const bearishAlign = ema9Last < ema21Last && ema21Last < ema55Last
  
  // Check price position relative to EMAs
  const aboveAllEMAs = currentPrice > ema9Last && currentPrice > ema21Last && currentPrice > ema55Last
  const belowAllEMAs = currentPrice < ema9Last && currentPrice < ema21Last && currentPrice < ema55Last
  
  // Calculate trend strength (0-1)
  let strength = 0
  if (bullishAlign || bearishAlign) strength += 0.4
  if (aboveAllEMAs || belowAllEMAs) strength += 0.3
  
  // Check EMA spacing as additional strength indicator
  const spacing = Math.abs(ema9Last - ema55Last) / ema55Last * 100
  if (spacing > 2) strength += 0.3
  else if (spacing > 1) strength += 0.15
  
  // Determine trend
  let trend = 'RANGING'
  if (bullishAlign && aboveAllEMAs) trend = 'STRONG_UPTREND'
  else if (bullishAlign || aboveAllEMAs) trend = 'UPTREND'
  else if (bearishAlign && belowAllEMAs) trend = 'STRONG_DOWNTREND'
  else if (bearishAlign || belowAllEMAs) trend = 'DOWNTREND'
  
  return {
    trend,
    direction: trend.includes('UP') ? 'LONG' : trend.includes('DOWN') ? 'SHORT' : 'NEUTRAL',
    strength: Math.min(strength, 1),
    emas: {
      ema9: ema9Last,
      ema21: ema21Last,
      ema55: ema55Last
    },
    pricePosition: aboveAllEMAs ? 'ABOVE' : belowAllEMAs ? 'BELOW' : 'BETWEEN',
    aligned: bullishAlign || bearishAlign
  }
}

/**
 * Detect if market is ranging vs trending
 * @param {object[]} candles - OHLC candles
 * @param {number} lookback - Periods to analyze
 * @returns {object} Range analysis
 */
const detectRange = (candles, lookback = 20) => {
  if (!candles || candles.length < lookback) {
    return { isRanging: false, rangeWidth: 0 }
  }
  
  const recent = candles.slice(-lookback)
  const highs = recent.map(c => c.high)
  const lows = recent.map(c => c.low)
  
  const rangeHigh = Math.max(...highs)
  const rangeLow = Math.min(...lows)
  const rangeWidth = ((rangeHigh - rangeLow) / rangeLow) * 100
  
  // Calculate how many times price touched range boundaries
  const touchThreshold = (rangeHigh - rangeLow) * 0.1
  let highTouches = 0
  let lowTouches = 0
  
  for (const candle of recent) {
    if (Math.abs(candle.high - rangeHigh) <= touchThreshold) highTouches++
    if (Math.abs(candle.low - rangeLow) <= touchThreshold) lowTouches++
  }
  
  // Range criteria: multiple touches on both sides, narrow width
  const isRanging = rangeWidth < 5 && highTouches >= 2 && lowTouches >= 2
  
  return {
    isRanging,
    rangeWidth,
    rangeHigh,
    rangeLow,
    midPoint: (rangeHigh + rangeLow) / 2,
    highTouches,
    lowTouches
  }
}

/**
 * Get higher timeframe confirmation
 * @param {object} lowerTFTrend - Trend from lower timeframe
 * @param {object} higherTFTrend - Trend from higher timeframe
 * @returns {object} Confirmation analysis
 */
const getHigherTFConfirmation = (lowerTFTrend, higherTFTrend) => {
  if (!lowerTFTrend || !higherTFTrend) {
    return { confirmed: false, reason: 'Missing data' }
  }
  
  const lowerDir = lowerTFTrend.direction
  const higherDir = higherTFTrend.direction
  
  // Perfect confirmation: same direction
  if (lowerDir === higherDir && lowerDir !== 'NEUTRAL') {
    return {
      confirmed: true,
      type: 'ALIGNED',
      confidence: 0.9,
      reason: `${lowerDir} signal confirmed by higher timeframe`
    }
  }
  
  // Higher TF is neutral (ranging)
  if (higherDir === 'NEUTRAL') {
    return {
      confirmed: true,
      type: 'RANGE_TRADE',
      confidence: 0.6,
      reason: 'Higher TF ranging - trade can work but reduce size'
    }
  }
  
  // Counter-trend (lower against higher)
  if (lowerDir !== 'NEUTRAL' && higherDir !== 'NEUTRAL' && lowerDir !== higherDir) {
    return {
      confirmed: false,
      type: 'COUNTER_TREND',
      confidence: 0.3,
      reason: `${lowerDir} is AGAINST higher TF ${higherDir} trend - high risk`
    }
  }
  
  return {
    confirmed: false,
    type: 'UNCERTAIN',
    confidence: 0.5,
    reason: 'Unclear confirmation'
  }
}

/**
 * Adjust stop loss and take profit based on higher TF
 * @param {object} stops - Original {stopLoss, takeProfit}
 * @param {object} htfATR - Higher timeframe ATR
 * @param {string} confirmation - Confirmation type
 * @returns {object} Adjusted stops
 */
const adjustStopsForMTF = (stops, htfATR, confirmation) => {
  if (!stops || !htfATR) return stops
  
  let slMultiplier = 1
  let tpMultiplier = 1
  
  switch (confirmation) {
    case 'ALIGNED':
      // Aligned with HTF - can use wider TP
      tpMultiplier = 1.5
      break
    case 'RANGE_TRADE':
      // Range trade - tighter targets
      tpMultiplier = 0.8
      slMultiplier = 0.8
      break
    case 'COUNTER_TREND':
      // Counter trend - tight SL, small TP
      slMultiplier = 0.7
      tpMultiplier = 0.5
      break
  }
  
  return {
    stopLoss: stops.stopLoss,
    takeProfit: stops.takeProfit,
    adjustedStopLoss: stops.stopLoss, // Keep original SL
    adjustedTakeProfit: stops.entry + (stops.takeProfit - stops.entry) * tpMultiplier,
    multipliers: { sl: slMultiplier, tp: tpMultiplier },
    reason: `Adjusted for ${confirmation} with higher TF`
  }
}

/**
 * Complete MTF analysis
 * @param {object[]} currentTFCandles - Current timeframe candles
 * @param {object[]} higherTFCandles - Higher timeframe candles (optional)
 * @returns {object} Complete MTF analysis
 */
const analyzeMTF = (currentTFCandles, higherTFCandles = null) => {
  const prices = currentTFCandles.map(c => c.close)
  
  // Current TF analysis
  const trend = detectTrend(prices)
  const range = detectRange(currentTFCandles)
  
  // Higher TF analysis (if provided)
  let higherTFTrend = null
  let confirmation = null
  
  if (higherTFCandles && higherTFCandles.length > 0) {
    const htfPrices = higherTFCandles.map(c => c.close)
    higherTFTrend = detectTrend(htfPrices)
    confirmation = getHigherTFConfirmation(trend, higherTFTrend)
  }
  
  // Trading recommendation
  let recommendation = 'WAIT'
  let reason = ''
  
  if (range.isRanging) {
    recommendation = 'RANGE_TRADE'
    reason = 'Market is ranging - trade boundaries'
  } else if (confirmation?.confirmed && confirmation.type === 'ALIGNED') {
    recommendation = trend.direction
    reason = `Strong ${trend.direction} confirmed by higher TF`
  } else if (!confirmation?.confirmed && confirmation?.type === 'COUNTER_TREND') {
    recommendation = 'AVOID'
    reason = 'Signal against higher TF trend'
  } else if (trend.strength > 0.7) {
    recommendation = trend.direction
    reason = `${trend.trend} detected (unconfirmed)`
  }
  
  return {
    currentTF: {
      trend,
      range
    },
    higherTF: higherTFTrend,
    confirmation,
    recommendation,
    reason,
    canTrade: recommendation !== 'WAIT' && recommendation !== 'AVOID'
  }
}

module.exports = {
  TIMEFRAME_HIERARCHY,
  detectTrend,
  detectRange,
  getHigherTFConfirmation,
  adjustStopsForMTF,
  analyzeMTF
}
