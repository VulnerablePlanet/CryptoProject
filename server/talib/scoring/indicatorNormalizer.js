/**
 * Indicator Normalizer
 * Normalizes different technical indicators to [-1, 1] range for scoring
 * 
 * @module scoring/indicatorNormalizer
 */

const { RSI, MACD, EMA, SMA, BollingerBands, Stochastic } = require('technicalindicators');
const { normalize, normalizePositive } = require('../utils/mathHelpers');
const { validateOHLCV } = require('../utils/dataValidator');
const { defaultLogger } = require('../utils/logger');

const logger = defaultLogger.child('IndicatorNormalizer');

/**
 * Normalize EMA signal
 * Returns -1 (bearish) to 1 (bullish) based on price vs EMA
 * @param {Object[]} candles - OHLCV candles
 * @param {number} period - EMA period
 * @returns {number} Normalized signal [-1, 1]
 */
function normalizeEMA(candles, period = 20) {
  const closes = candles.map(c => c.close);
  const emaValues = EMA.calculate({ period, values: closes });
  
  if (emaValues.length === 0) {
    throw new Error('Insufficient data for EMA calculation');
  }

  const currentPrice = closes[closes.length - 1];
  const currentEMA = emaValues[emaValues.length - 1];

  // Calculate percentage distance from EMA
  const distance = (currentPrice - currentEMA) / currentEMA;

  // Normalize: +5% above = 1.0, -5% below = -1.0
  return Math.max(-1, Math.min(1, distance * 20));
}

/**
 * Normalize RSI signal
 * Returns -1 (oversold) to 1 (overbought)
 * @param {Object[]} candles - OHLCV candles
 * @param {number} period - RSI period
 * @returns {number} Normalized signal [-1, 1]
 */
function normalizeRSI(candles, period = 14) {
  const closes = candles.map(c => c.close);
  const rsiValues = RSI.calculate({ period, values: closes });

  if (rsiValues.length === 0) {
    throw new Error('Insufficient data for RSI calculation');
  }

  const currentRSI = rsiValues[rsiValues.length - 1];

  // RSI is 0-100, normalize to [-1, 1]
  // RSI 30 = -1 (oversold/bullish reversal)
  // RSI 50 = 0 (neutral)
  // RSI 70 = +1 (overbought/bearish reversal)
  
  if (currentRSI < 50) {
    // Below 50: map 0-50 to -1..0
    return normalize(currentRSI, 0, 50) - 1; // Results in -1 to 0
  } else {
    // Above 50: map 50-100 to 0..1
    return normalize(currentRSI, 50, 100); // Results in 0 to 1
  }
}

/**
 * Normalize MACD signal
 * Returns -1 (bearish) to 1 (bullish)
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - MACD parameters
 * @returns {number} Normalized signal [-1, 1]
 */
function normalizeMACD(candles, params = { fast: 12, slow: 26, signal: 9 }) {
  const closes = candles.map(c => c.close);
  
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: params.fast,
    slowPeriod: params.slow,
    signalPeriod: params.signal,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  if (macdValues.length === 0) {
    throw new Error('Insufficient data for MACD calculation');
  }

  const current = macdValues[macdValues.length - 1];
  const histogram = current.MACD - current.signal;

  // Analyze last few bars for trend
  const recentHistogram = macdValues.slice(-5).map(m => m.MACD - m.signal);
  const avgHistogram = recentHistogram.reduce((a, b) => a + Math.abs(b), 0) / recentHistogram.length;

  // Normalize based on typical histogram range
  if (avgHistogram === 0) return 0;

  return Math.max(-1, Math.min(1, histogram / (avgHistogram * 2)));
}

/**
 * Normalize Volume signal
 * Returns -1 (very low) to 1 (very high)
 * @param {Object[]} candles - OHLCV candles
 * @param {number} period - Lookback period for average
 * @returns {number} Normalized signal [-1, 1]
 */
function normalizeVolume(candles, period = 20) {
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const volumes = candles.map(c => c.volume);
  const recentVolumes = volumes.slice(-period - 1, -1);
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;

  const currentVolume = volumes[volumes.length -1];

  // Normalize: 0.5x avg = -1, 1x avg = 0, 2x avg = 1
  const ratio = currentVolume / avgVolume;
  return normalize(ratio, 0.5, 2.0);
}

/**
 * Normalize Bollinger Bands signal
 * Returns -1 (at lower band) to 1 (at upper band)
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - BB parameters
 * @returns {number} Normalized signal [-1, 1]
 */
function normalizeBollingerBands(candles, params = { period: 20, stdDev: 2 }) {
  const closes = candles.map(c => c.close);
  
  const bbValues = BollingerBands.calculate({
    period: params.period,
    values: closes,
    stdDev: params.stdDev
  });

  if (bbValues.length === 0) {
    throw new Error('Insufficient data for Bollinger Bands calculation');
  }

  const current = bbValues[bbValues.length - 1];
  const currentPrice = closes[closes.length - 1];

  // Normalize position between bands
  // Lower band = -1, Middle = 0, Upper band = 1
  const bandWidth = current.upper - current.lower;
  if (bandWidth === 0) return 0;

  const position = (currentPrice - current.middle) / (bandWidth / 2);
  return Math.max(-1, Math.min(1, position));
}

/**
 * Normalize Stochastic signal
 * Returns -1 (oversold) to 1 (overbought)
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - Stochastic parameters
 * @returns {number} Normalized signal [-1, 1]
 */
function normalizeStochastic(candles, params = { period: 14, signalPeriod: 3 }) {
  const input = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period: params.period,
    signalPeriod: params.signalPeriod
  };

  const stochValues = Stochastic.calculate(input);

  if (stochValues.length === 0) {
    throw new Error('Insufficient data for Stochastic calculation');
  }

  const current = stochValues[stochValues.length - 1];

  // Stochastic is 0-100, normalize similar to RSI
  // 20 = -1 (oversold/bullish)
  // 50 = 0 (neutral)
  // 80 = 1 (overbought/bearish)
  return normalize(current.k, 20, 80);
}

/**
 * Normalize ADX signal (trend strength, not direction)
 * Returns 0 (no trend) to 1 (strong trend)
 * @param {number} adxValue - ADX value (0-100)
 * @returns {number} Normalized signal [0, 1]
 */
function normalizeADX(adxValue) {
  // ADX > 25 = trending, > 50 = strong trend
  return Math.min(adxValue / 50, 1.0);
}

/**
 * Normalize ATR signal (volatility)
 * Returns 0 (low vol) to 1 (high vol)
 * @param {number} atr - ATR value
 * @param {number} avgPrice - Average price
 * @returns {number} Normalized signal [0, 1]
 */
function normalizeATR(atr, avgPrice) {
  // ATR as percentage of price
  const atrPercent = atr / avgPrice;
  
  // 1% ATR = 0, 5% ATR = 1
  return Math.min(atrPercent / 0.05, 1.0);
}

/**
 * Normalize OrderBook imbalance
 * Returns -1 (strong sell pressure) to 1 (strong buy pressure)
 * @param {number} imbalanceRatio - Bid ratio (0-1)
 * @returns {number} Normalized signal [-1, 1]
 */
function normalizeOrderBook(imbalanceRatio) {
  // 0.3 (30% bids) = -1 (sell pressure)
  // 0.5 (50% bids) = 0 (neutral)
  // 0.7 (70% bids) = 1 (buy pressure)
  return normalize(imbalanceRatio, 0.3, 0.7);
}

/**
 * Normalize all indicators for a given set of candles
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} options - Options for which indicators to calculate
 * @returns {Object<string, number>} Normalized indicator values
 */
function normalizeAllIndicators(candles, options = {}) {
  const startTime = Date.now();
  
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const normalized = {};

  try {
    if (options.ema !== false) {
      normalized.ema20 = normalizeEMA(candles, 20);
      normalized.ema50 = normalizeEMA(candles, 50);
    }

    if (options.rsi !== false) {
      normalized.rsi = normalizeRSI(candles, 14);
    }

    if (options.macd !== false) {
      normalized.macd = normalizeMACD(candles);
    }

    if (options.volume !== false) {
      normalized.volume = normalizeVolume(candles);
    }

    if (options.bbands !== false) {
      normalized.bbands = normalizeBollingerBands(candles);
    }

    if (options.stochastic !== false) {
      normalized.stochastic = normalizeStochastic(candles);
    }

    const duration = Date.now() - startTime;
    logger.performance('normalizeAllIndicators', duration);

    return normalized;

  } catch (error) {
    logger.error('Failed to normalize indicators', { error: error.message });
    throw error;
  }
}

module.exports = {
  normalizeEMA,
  normalizeRSI,
  normalizeMACD,
  normalizeVolume,
  normalizeBollingerBands,
  normalizeStochastic,
  normalizeADX,
  normalizeATR,
  normalizeOrderBook,
  normalizeAllIndicators
};
