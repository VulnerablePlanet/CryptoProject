/**
 * ============================================================================
 * Heikin-Ashi Transform Utility
 * ============================================================================
 * Transforms standard OHLCV candles into Heikin-Ashi candles.
 * Heikin-Ashi smooths price action to better identify trends.
 */

/**
 * Transform OHLCV candles to Heikin-Ashi format
 * 
 * Heikin-Ashi Formulas:
 * - HA Close = (Open + High + Low + Close) / 4
 * - HA Open = (Previous HA Open + Previous HA Close) / 2
 * - HA High = Max(High, HA Open, HA Close)
 * - HA Low = Min(Low, HA Open, HA Close)
 * 
 * @param {object[]} candles - Array of OHLCV candles
 * @returns {object[]} Array of Heikin-Ashi candles
 */
export const transformToHeikinAshi = (candles) => {
  if (!candles || candles.length === 0) {
    return []
  }

  const haCandles = []

  candles.forEach((candle, index) => {
    const { time, timestamp, open, high, low, close, volume } = candle

    // Calculate HA Close
    const haClose = (open + high + low + close) / 4

    // Calculate HA Open
    let haOpen
    if (index === 0) {
      // First candle: HA Open = (Open + Close) / 2
      haOpen = (open + close) / 2
    } else {
      // Subsequent candles: HA Open = (Previous HA Open + Previous HA Close) / 2
      const prevHa = haCandles[index - 1]
      haOpen = (prevHa.open + prevHa.close) / 2
    }

    // Calculate HA High and HA Low
    const haHigh = Math.max(high, haOpen, haClose)
    const haLow = Math.min(low, haOpen, haClose)

    haCandles.push({
      time: time || Math.floor(timestamp / 1000),
      timestamp: timestamp || time * 1000,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume
    })
  })

  return haCandles
}

/**
 * Detect trend based on Heikin-Ashi candles
 * 
 * Bullish: Bodies are mostly green with no/small lower wicks
 * Bearish: Bodies are mostly red with no/small upper wicks
 * 
 * @param {object[]} haCandles - Array of Heikin-Ashi candles
 * @param {number} lookback - Number of candles to analyze
 * @returns {object} Trend information
 */
export const detectHATrend = (haCandles, lookback = 5) => {
  if (!haCandles || haCandles.length < lookback) {
    return { trend: 'neutral', strength: 0 }
  }

  const recentCandles = haCandles.slice(-lookback)
  let bullishCount = 0
  let bearishCount = 0
  let strongBullish = 0
  let strongBearish = 0

  recentCandles.forEach((candle) => {
    const bodySize = Math.abs(candle.close - candle.open)
    const range = candle.high - candle.low
    const upperWick = candle.high - Math.max(candle.open, candle.close)
    const lowerWick = Math.min(candle.open, candle.close) - candle.low

    const isBullish = candle.close > candle.open
    const isBearish = candle.close < candle.open

    if (isBullish) {
      bullishCount++
      // Strong bullish: no lower wick
      if (lowerWick < range * 0.1) {
        strongBullish++
      }
    } else if (isBearish) {
      bearishCount++
      // Strong bearish: no upper wick
      if (upperWick < range * 0.1) {
        strongBearish++
      }
    }
  })

  const trend = bullishCount > bearishCount 
    ? 'bullish' 
    : bearishCount > bullishCount 
      ? 'bearish' 
      : 'neutral'

  const strength = Math.max(strongBullish, strongBearish) / lookback

  return {
    trend,
    strength,
    bullishCount,
    bearishCount,
    strongBullish,
    strongBearish
  }
}

/**
 * Get the color for Heikin-Ashi candle based on close vs open
 * 
 * @param {object} haCandle - Heikin-Ashi candle
 * @returns {object} Color configuration
 */
export const getHACandleColor = (haCandle) => {
  const isBullish = haCandle.close >= haCandle.open
  
  return {
    upColor: '#10b981',     // Green for bullish
    downColor: '#ef4444',    // Red for bearish
    wickUpColor: '#10b981',
    wickDownColor: '#ef4444',
    color: isBullish ? '#10b981' : '#ef4444'
  }
}

export default {
  transformToHeikinAshi,
  detectHATrend,
  getHACandleColor
}
