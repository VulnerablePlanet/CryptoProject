/**
 * ============================================================================
 * INDICATORS ENGINE - Main Orchestrator
 * ============================================================================
 * Unified interface for all technical indicators.
 * Calculates all indicators for a given candle series.
 */

const { calculateSMA, calculateEMA } = require('./movingAverages')
const { calculateRSI, detectRSIDivergence } = require('./rsi')
const { calculateMACD, detectMACDCrossover } = require('./macd')
const { calculateBollingerBands, detectBBSqueeze, detectBBBreakout } = require('./bollingerBands')
const { calculateATR, calculateATRStops, calculateATRPercent } = require('./atr')
const { calculateROC, calculateMomentum, calculateMomentumSlope } = require('./momentum')
const { calculateVWAP, calculateVWAPBands, getVWAPPosition } = require('./vwap')

/**
 * Default indicator configuration
 */
const DEFAULT_CONFIG = {
  sma: { periods: [20, 50, 200] },
  ema: { periods: [9, 21, 55] },
  rsi: { period: 14 },
  macd: { fast: 12, slow: 26, signal: 9 },
  bollinger: { period: 20, stdDev: 2 },
  atr: { period: 14 },
  roc: { period: 12 },
  momentum: { period: 10 }
}

/**
 * Calculate all indicators for a candle series
 * @param {object[]} candles - Array of OHLCV candles
 * @param {object} config - Custom configuration (optional)
 * @returns {object} All calculated indicators
 */
const calculateAllIndicators = (candles, config = {}) => {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  
  // Extract price arrays
  const closes = candles.map(c => c.close)
  const highs = candles.map(c => c.high)
  const lows = candles.map(c => c.low)
  
  // Calculate SMAs
  const sma = {}
  for (const period of cfg.sma.periods) {
    sma[period] = calculateSMA(closes, period)
  }
  
  // Calculate EMAs
  const ema = {}
  for (const period of cfg.ema.periods) {
    ema[period] = calculateEMA(closes, period)
  }
  
  // RSI
  const rsi = calculateRSI(closes, cfg.rsi.period)
  
  // MACD
  const macd = calculateMACD(closes, cfg.macd.fast, cfg.macd.slow, cfg.macd.signal)
  
  // Bollinger Bands
  const bollinger = calculateBollingerBands(closes, cfg.bollinger.period, cfg.bollinger.stdDev)
  
  // ATR
  const atr = calculateATR(candles, cfg.atr.period)
  
  // Momentum indicators
  const roc = calculateROC(closes, cfg.roc.period)
  const momentum = calculateMomentum(closes, cfg.momentum.period)
  const momentumSlope = calculateMomentumSlope(momentum)
  
  // VWAP
  const vwap = calculateVWAP(candles)
  const vwapBands = calculateVWAPBands(candles, vwap)
  
  return {
    sma,
    ema,
    rsi,
    macd,
    bollinger,
    atr,
    roc,
    momentum,
    momentumSlope,
    vwap: vwapBands
  }
}

/**
 * Get current indicator values (latest non-null values)
 * @param {object} indicators - Calculated indicators
 * @returns {object} Current values
 */
const getCurrentValues = (indicators) => {
  const getLatest = (arr) => {
    if (!arr) return null
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== null) return arr[i]
    }
    return null
  }
  
  return {
    sma: Object.fromEntries(
      Object.entries(indicators.sma).map(([k, v]) => [k, getLatest(v)])
    ),
    ema: Object.fromEntries(
      Object.entries(indicators.ema).map(([k, v]) => [k, getLatest(v)])
    ),
    rsi: getLatest(indicators.rsi),
    macd: {
      macd: getLatest(indicators.macd.macd),
      signal: getLatest(indicators.macd.signal),
      histogram: getLatest(indicators.macd.histogram)
    },
    bollinger: {
      upper: getLatest(indicators.bollinger.upper),
      middle: getLatest(indicators.bollinger.middle),
      lower: getLatest(indicators.bollinger.lower),
      bandwidth: getLatest(indicators.bollinger.bandwidth),
      percentB: getLatest(indicators.bollinger.percentB)
    },
    atr: getLatest(indicators.atr),
    roc: getLatest(indicators.roc),
    momentum: getLatest(indicators.momentum),
    vwap: getLatest(indicators.vwap.vwap)
  }
}

/**
 * Detect signals from indicators
 * @param {object} indicators - Calculated indicators
 * @param {number[]} prices - Close prices
 * @returns {object[]} Array of detected signals
 */
const detectSignals = (indicators, prices) => {
  const signals = []
  
  // RSI signals
  const currentRSI = indicators.rsi[indicators.rsi.length - 1]
  if (currentRSI !== null) {
    if (currentRSI < 30) {
      signals.push({ type: 'oversold', indicator: 'RSI', value: currentRSI, direction: 'LONG' })
    } else if (currentRSI > 70) {
      signals.push({ type: 'overbought', indicator: 'RSI', value: currentRSI, direction: 'SHORT' })
    }
  }
  
  // MACD crossover
  const macdCross = detectMACDCrossover(indicators.macd.macd, indicators.macd.signal)
  if (macdCross) {
    signals.push({ 
      type: macdCross, 
      indicator: 'MACD', 
      direction: macdCross === 'bullish_cross' ? 'LONG' : 'SHORT' 
    })
  }
  
  // Bollinger Band squeeze
  if (detectBBSqueeze(indicators.bollinger.bandwidth)) {
    signals.push({ type: 'squeeze', indicator: 'Bollinger', direction: 'NEUTRAL' })
  }
  
  // Bollinger breakout
  const latestPrice = prices[prices.length - 1]
  const bbBreakout = detectBBBreakout(
    latestPrice,
    indicators.bollinger.upper[indicators.bollinger.upper.length - 1],
    indicators.bollinger.lower[indicators.bollinger.lower.length - 1]
  )
  if (bbBreakout) {
    signals.push({ 
      type: bbBreakout, 
      indicator: 'Bollinger', 
      direction: bbBreakout === 'upper_breakout' ? 'SHORT' : 'LONG'
    })
  }
  
  // RSI divergence
  const rsiDivergence = detectRSIDivergence(prices, indicators.rsi)
  if (rsiDivergence) {
    signals.push({ 
      type: 'divergence', 
      subtype: rsiDivergence.type, 
      indicator: 'RSI',
      direction: rsiDivergence.type === 'bullish' ? 'LONG' : 'SHORT'
    })
  }
  
  return signals
}

module.exports = {
  // Main functions
  calculateAllIndicators,
  getCurrentValues,
  detectSignals,
  
  // Individual calculators
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateATRStops,
  calculateATRPercent,
  calculateROC,
  calculateMomentum,
  calculateMomentumSlope,
  calculateVWAP,
  calculateVWAPBands,
  
  // Detection helpers
  detectRSIDivergence,
  detectMACDCrossover,
  detectBBSqueeze,
  detectBBBreakout,
  getVWAPPosition,
  
  // Config
  DEFAULT_CONFIG
}
