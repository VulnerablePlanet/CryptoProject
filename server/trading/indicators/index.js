/**
 * ============================================================================
 * INDICATORS ENGINE - Main Orchestrator
 * ============================================================================
 * Unified interface for all technical indicators.
 * Uses the well-tested `technicalindicators` npm package as the single
 * source of truth for all core indicator calculations.
 *
 * IMPORTANT: All calculator functions return arrays of the SAME length as
 * the input, with `null` at the beginning for warm-up periods. This is
 * the established convention for alignment with OHLCV candle arrays.
 */

const {
  SMA, EMA, WMA, RSI, MACD, BollingerBands, ATR, ROC
} = require('technicalindicators');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pad a shorter result array with nulls at the front to match full input
 * length. This is the key adapter between `technicalindicators` (which
 * returns only valid-period results) and our convention of null-padded
 * arrays aligned with the input.
 *
 * @param {number} fullLength - Length of the original input array
 * @param {any[]} result - Shorter result from technicalindicators
 * @returns {any[]} Null-padded array of length `fullLength`
 */
function padResult(fullLength, result) {
  const padCount = fullLength - result.length;
  if (padCount <= 0) return result;
  const padded = new Array(padCount).fill(null);
  return padded.concat(result);
}

/**
 * Get the latest non-null value from an array.
 */
function getLatestValue(arr) {
  if (!arr || arr.length === 0) return null;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && !isNaN(arr[i])) return arr[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core Calculators — wrapped from `technicalindicators`
// ---------------------------------------------------------------------------

/**
 * Calculate Simple Moving Average
 * @param {number[]} prices - Array of close prices
 * @param {number} period - Number of periods for SMA
 * @returns {(number|null)[]} SMA values aligned with input (nulls for warm-up)
 */
function calculateSMA(prices, period) {
  if (!prices || prices.length < period) {
    return prices ? prices.map(() => null) : [];
  }
  return padResult(prices.length, SMA.calculate({ period, values: prices }));
}

/**
 * Calculate Exponential Moving Average
 * @param {number[]} prices - Array of close prices
 * @param {number} period - Number of periods for EMA
 * @returns {(number|null)[]} EMA values aligned with input (nulls for warm-up)
 */
function calculateEMA(prices, period) {
  if (!prices || prices.length < period) {
    return prices ? prices.map(() => null) : [];
  }
  return padResult(prices.length, EMA.calculate({ period, values: prices }));
}

/**
 * Calculate Weighted Moving Average
 * @param {number[]} prices - Array of close prices
 * @param {number} period - Number of periods for WMA
 * @returns {(number|null)[]} WMA values aligned with input (nulls for warm-up)
 */
function calculateWMA(prices, period) {
  if (!prices || prices.length < period) {
    return prices ? prices.map(() => null) : [];
  }
  return padResult(prices.length, WMA.calculate({ period, values: prices }));
}

/**
 * Calculate RSI using Wilder's smoothing method
 * @param {number[]} prices - Array of close prices
 * @param {number} period - RSI period (default: 14)
 * @returns {(number|null)[]} RSI values (0-100) aligned with input
 */
function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) {
    return prices ? prices.map(() => null) : [];
  }
  return padResult(prices.length, RSI.calculate({ period, values: prices }));
}

/**
 * Calculate MACD — Moving Average Convergence Divergence
 * @param {number[]} prices - Array of close prices
 * @param {number} fastPeriod - Fast EMA period (default: 12)
 * @param {number} slowPeriod - Slow EMA period (default: 26)
 * @param {number} signalPeriod - Signal line period (default: 9)
 * @returns {object} { macd: (number|null)[], signal: (number|null)[], histogram: (number|null)[] }
 */
function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (!prices || prices.length < slowPeriod) {
    const empty = prices ? prices.map(() => null) : [];
    return { macd: empty, signal: empty, histogram: empty };
  }

  const result = MACD.calculate({
    values: prices,
    fastPeriod,
    slowPeriod,
    signalPeriod,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  const padCount = prices.length - result.length;
  const macdLine = new Array(padCount).fill(null);
  const signalLine = new Array(padCount).fill(null);
  const histogram = new Array(padCount).fill(null);

  for (const item of result) {
    macdLine.push(item.MACD ?? null);
    signalLine.push(item.signal ?? null);
    histogram.push(item.histogram ?? null);
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Calculate Bollinger Bands
 * @param {number[]} prices - Array of close prices
 * @param {number} period - SMA period (default: 20)
 * @param {number} stdDev - Number of standard deviations (default: 2)
 * @returns {object} { upper, middle, lower, bandwidth, percentB }
 */
function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (!prices || prices.length < period) {
    const empty = prices ? prices.map(() => null) : [];
    return { upper: empty, middle: empty, lower: empty, bandwidth: empty, percentB: empty };
  }

  const result = BollingerBands.calculate({ period, stdDev, values: prices });

  const padCount = prices.length - result.length;
  const upper = new Array(padCount).fill(null);
  const middle = new Array(padCount).fill(null);
  const lower = new Array(padCount).fill(null);
  const bandwidth = new Array(padCount).fill(null);
  const percentB = new Array(padCount).fill(null);

  for (const item of result) {
    upper.push(item.upper);
    middle.push(item.middle);
    lower.push(item.lower);
    // bandwidth = (upper - lower) / middle * 100
    bandwidth.push(item.middle > 0 ? ((item.upper - item.lower) / item.middle) * 100 : null);
    // percentB is provided directly by the library as `pb`
    percentB.push(item.pb ?? 0.5);
  }

  return { upper, middle, lower, bandwidth, percentB };
}

/**
 * Calculate ATR (Average True Range) from OHLC candles
 * @param {object[]} candles - Array of {high, low, close} objects
 * @param {number} period - ATR period (default: 14)
 * @returns {(number|null)[]} ATR values aligned with input (nulls for warm-up)
 */
function calculateATR(candles, period = 14) {
  if (!candles || candles.length < period) {
    return candles ? candles.map(() => null) : [];
  }
  const high = candles.map(c => c.high);
  const low = candles.map(c => c.low);
  const close = candles.map(c => c.close);
  return padResult(candles.length, ATR.calculate({ period, high, low, close }));
}

/**
 * Calculate Rate of Change (momentum oscillator, percentage)
 * @param {number[]} prices - Array of close prices
 * @param {number} period - ROC period (default: 12)
 * @returns {(number|null)[]} ROC values (%) aligned with input
 */
function calculateROC(prices, period = 12) {
  if (!prices || prices.length <= period) {
    return prices ? prices.map(() => null) : [];
  }
  return padResult(prices.length, ROC.calculate({ period, values: prices }));
}

// ---------------------------------------------------------------------------
// Custom calculators (no direct equivalent in `technicalindicators`)
// ---------------------------------------------------------------------------

/**
 * Calculate True Range for a single candle
 * @param {object} current - Current candle {high, low, close}
 * @param {object} previous - Previous candle {close}
 * @returns {number} True Range value
 */
function calculateTrueRange(current, previous) {
  const highLow = current.high - current.low;
  const highPrevClose = previous ? Math.abs(current.high - previous.close) : 0;
  const lowPrevClose = previous ? Math.abs(current.low - previous.close) : 0;
  return Math.max(highLow, highPrevClose, lowPrevClose);
}

/**
 * Calculate ATR-based stop loss levels (1:2 R:R default)
 * @param {number} entryPrice - Entry price
 * @param {number} atr - Current ATR value
 * @param {number} multiplier - ATR multiplier (default: 2)
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {object} {stopLoss, takeProfit, riskAmount, rewardAmount}
 */
function calculateATRStops(entryPrice, atr, multiplier = 2, direction = 'LONG') {
  const atrDistance = atr * multiplier;
  if (direction === 'LONG') {
    return {
      stopLoss: entryPrice - atrDistance,
      takeProfit: entryPrice + (atrDistance * 2),
      riskAmount: atrDistance,
      rewardAmount: atrDistance * 2
    };
  }
  return {
    stopLoss: entryPrice + atrDistance,
    takeProfit: entryPrice - (atrDistance * 2),
    riskAmount: atrDistance,
    rewardAmount: atrDistance * 2
  };
}

/**
 * Calculate ATR as percentage of price
 * @param {number} atr - ATR value
 * @param {number} price - Current price
 * @returns {number} ATR as percentage
 */
function calculateATRPercent(atr, price) {
  if (!atr || !price || price === 0) return 0;
  return (atr / price) * 100;
}

/**
 * Calculate absolute Momentum (price difference over period)
 * @param {number[]} prices - Array of close prices
 * @param {number} period - Momentum period (default: 10)
 * @returns {(number|null)[]} Momentum values aligned with input
 */
function calculateMomentum(prices, period = 10) {
  if (!prices || prices.length <= period) {
    return prices ? prices.map(() => null) : [];
  }
  const result = new Array(period).fill(null);
  for (let i = period; i < prices.length; i++) {
    result.push(prices[i] - prices[i - period]);
  }
  return result;
}

/**
 * Calculate Momentum Slope (rate of change of momentum)
 * @param {(number|null)[]} momentum - Momentum values
 * @param {number} period - Slope period (default: 5)
 * @returns {(number|null)[]} Slope values aligned with input
 */
function calculateMomentumSlope(momentum, period = 5) {
  if (!momentum || momentum.length <= period) {
    return momentum ? momentum.map(() => null) : [];
  }
  const result = [];
  for (let i = 0; i < momentum.length; i++) {
    if (i < period || momentum[i] === null || momentum[i - period] === null) {
      result.push(null);
    } else {
      result.push((momentum[i] - momentum[i - period]) / period);
    }
  }
  return result;
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * @param {object[]} candles - Array of {high, low, close, volume, timestamp}
 * @param {boolean} resetDaily - Reset VWAP at day boundary (default: true)
 * @returns {(number|null)[]} VWAP values aligned with input
 */
function calculateVWAP(candles, resetDaily = true) {
  if (!candles || candles.length === 0) return [];

  const result = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  let currentDay = null;

  for (const candle of candles) {
    const date = new Date(candle.timestamp);
    const day = date.toISOString().split('T')[0];

    if (resetDaily && currentDay !== null && day !== currentDay) {
      cumulativeTPV = 0;
      cumulativeVolume = 0;
    }
    currentDay = day;

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    const volume = candle.volume || 0;

    cumulativeTPV += typicalPrice * volume;
    cumulativeVolume += volume;

    result.push(cumulativeVolume === 0 ? null : cumulativeTPV / cumulativeVolume);
  }

  return result;
}

/**
 * Calculate VWAP bands (standard deviation bands around VWAP)
 * @param {object[]} candles - Array of candles
 * @param {(number|null)[]} vwap - VWAP values
 * @param {number} multiplier - Band multiplier (default: 2)
 * @returns {object} {vwap, upper, lower}
 */
function calculateVWAPBands(candles, vwap, multiplier = 2) {
  if (!candles || !vwap || candles.length !== vwap.length) {
    return { vwap: vwap || [], upper: [], lower: [] };
  }

  const upper = [];
  const lower = [];
  let cumulativeVariance = 0;
  let count = 0;
  let currentDay = null;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const date = new Date(candle.timestamp);
    const day = date.toISOString().split('T')[0];

    if (currentDay !== null && day !== currentDay) {
      cumulativeVariance = 0;
      count = 0;
    }
    currentDay = day;

    if (vwap[i] === null) {
      upper.push(null);
      lower.push(null);
      continue;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeVariance += Math.pow(typicalPrice - vwap[i], 2);
    count++;

    const stdDev = count > 1 ? Math.sqrt(cumulativeVariance / count) : 0;
    upper.push(vwap[i] + (multiplier * stdDev));
    lower.push(vwap[i] - (multiplier * stdDev));
  }

  return { vwap, upper, lower };
}

/**
 * Get price position relative to VWAP
 * @param {number} price - Current price
 * @param {number} vwap - Current VWAP
 * @returns {string} 'above', 'below', or 'at'
 */
function getVWAPPosition(price, vwap) {
  if (price === null || vwap === null) return 'unknown';
  const diff = ((price - vwap) / vwap) * 100;
  if (diff > 0.1) return 'above';
  if (diff < -0.1) return 'below';
  return 'at';
}

// ---------------------------------------------------------------------------
// Detection Helpers (logic unique to this project — not in indicator libs)
// ---------------------------------------------------------------------------

/**
 * Detect RSI divergence (price vs RSI direction mismatch)
 * @param {number[]} prices - Close prices
 * @param {(number|null)[]} rsi - RSI values
 * @param {number} lookback - Lookback periods (default: 10)
 * @returns {object|null} Divergence info or null
 */
function detectRSIDivergence(prices, rsi, lookback = 10) {
  if (!prices || !rsi || prices.length < lookback) return null;

  const recentPrices = prices.slice(-lookback);
  const recentRSI = rsi.slice(-lookback).filter(v => v !== null);

  if (recentRSI.length < 2) return null;

  const priceDirection = recentPrices[recentPrices.length - 1] > recentPrices[0] ? 'UP' : 'DOWN';
  const rsiDirection = recentRSI[recentRSI.length - 1] > recentRSI[0] ? 'UP' : 'DOWN';

  if (priceDirection !== rsiDirection) {
    return {
      type: priceDirection === 'UP' ? 'bearish' : 'bullish',
      price_direction: priceDirection,
      rsi_direction: rsiDirection
    };
  }
  return null;
}

/**
 * Detect MACD crossover (line crosses signal line)
 * @param {(number|null)[]} macd - MACD line values
 * @param {(number|null)[]} signal - Signal line values
 * @returns {string|null} 'bullish_cross', 'bearish_cross', or null
 */
function detectMACDCrossover(macd, signal) {
  if (!macd || !signal || macd.length < 2) return null;

  const len = macd.length;
  const curr = { macd: macd[len - 1], signal: signal[len - 1] };
  const prev = { macd: macd[len - 2], signal: signal[len - 2] };

  if (curr.macd === null || curr.signal === null ||
      prev.macd === null || prev.signal === null) {
    return null;
  }

  if (prev.macd <= prev.signal && curr.macd > curr.signal) return 'bullish_cross';
  if (prev.macd >= prev.signal && curr.macd < curr.signal) return 'bearish_cross';
  return null;
}

/**
 * Detect Bollinger Band squeeze (low volatility contraction)
 * @param {(number|null)[]} bandwidth - Bandwidth values
 * @param {number} threshold - Squeeze threshold (default: 5)
 * @returns {boolean} True if in squeeze
 */
function detectBBSqueeze(bandwidth, threshold = 5) {
  if (!bandwidth || bandwidth.length === 0) return false;
  const recent = bandwidth.filter(v => v !== null).slice(-10);
  if (recent.length === 0) return false;
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return avg < threshold;
}

/**
 * Detect Bollinger Band breakout
 * @param {number} price - Current price
 * @param {number} upper - Upper band
 * @param {number} lower - Lower band
 * @returns {string|null} 'upper_breakout', 'lower_breakout', or null
 */
function detectBBBreakout(price, upper, lower) {
  if (price === null || upper === null || lower === null) return null;
  if (price > upper) return 'upper_breakout';
  if (price < lower) return 'lower_breakout';
  return null;
}

/**
 * Detect momentum divergence (price vs momentum direction mismatch)
 * @param {number[]} prices - Close prices
 * @param {(number|null)[]} momentum - Momentum values
 * @returns {string|null} 'bullish', 'bearish', or null
 */
function detectMomentumDivergence(prices, momentum) {
  if (!prices || !momentum || prices.length < 10) return null;

  const recentPrices = prices.slice(-10);
  const recentMomentum = momentum.slice(-10).filter(v => v !== null);

  if (recentMomentum.length < 2) return null;

  const priceTrend = recentPrices[recentPrices.length - 1] > recentPrices[0];
  const momentumTrend = recentMomentum[recentMomentum.length - 1] > recentMomentum[0];

  if (priceTrend && !momentumTrend) return 'bearish';
  if (!priceTrend && momentumTrend) return 'bullish';
  return null;
}

// ---------------------------------------------------------------------------
// Orchestrator: calculate all indicators at once
// ---------------------------------------------------------------------------

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
};

/**
 * Calculate all indicators for a candle series
 * @param {object[]} candles - Array of OHLCV candles
 * @param {object} config - Custom configuration (optional, merged with defaults)
 * @returns {object} All calculated indicators
 */
function calculateAllIndicators(candles, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // SMAs
  const sma = {};
  for (const period of cfg.sma.periods) {
    sma[period] = calculateSMA(closes, period);
  }

  // EMAs
  const ema = {};
  for (const period of cfg.ema.periods) {
    ema[period] = calculateEMA(closes, period);
  }

  // RSI
  const rsi = calculateRSI(closes, cfg.rsi.period);

  // MACD
  const macd = calculateMACD(closes, cfg.macd.fast, cfg.macd.slow, cfg.macd.signal);

  // Bollinger Bands
  const bollinger = calculateBollingerBands(closes, cfg.bollinger.period, cfg.bollinger.stdDev);

  // ATR
  const atr = calculateATR(candles, cfg.atr.period);

  // Momentum
  const roc = calculateROC(closes, cfg.roc.period);
  const momentum = calculateMomentum(closes, cfg.momentum.period);
  const momentumSlope = calculateMomentumSlope(momentum);

  // VWAP
  const vwap = calculateVWAP(candles);
  const vwapBands = calculateVWAPBands(candles, vwap);

  return { sma, ema, rsi, macd, bollinger, atr, roc, momentum, momentumSlope, vwap: vwapBands };
}

/**
 * Extract current (latest non-null) values from calculated indicators
 * @param {object} indicators - Result from calculateAllIndicators
 * @returns {object} Current values keyed by indicator name
 */
function getCurrentValues(indicators) {
  const getLatest = (arr) => {
    if (!arr) return null;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== null) return arr[i];
    }
    return null;
  };

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
  };
}

/**
 * Detect trading signals from indicator values
 * @param {object} indicators - Calculated indicators
 * @param {number[]} prices - Close prices
 * @returns {object[]} Array of detected signals
 */
function detectSignals(indicators, prices) {
  const signals = [];

  // RSI signals
  const currentRSI = indicators.rsi[indicators.rsi.length - 1];
  if (currentRSI !== null) {
    if (currentRSI < 30) {
      signals.push({ type: 'oversold', indicator: 'RSI', value: currentRSI, direction: 'LONG' });
    } else if (currentRSI > 70) {
      signals.push({ type: 'overbought', indicator: 'RSI', value: currentRSI, direction: 'SHORT' });
    }
  }

  // MACD crossover
  const macdCross = detectMACDCrossover(indicators.macd.macd, indicators.macd.signal);
  if (macdCross) {
    signals.push({
      type: macdCross,
      indicator: 'MACD',
      direction: macdCross === 'bullish_cross' ? 'LONG' : 'SHORT'
    });
  }

  // Bollinger squeeze
  if (detectBBSqueeze(indicators.bollinger.bandwidth)) {
    signals.push({ type: 'squeeze', indicator: 'Bollinger', direction: 'NEUTRAL' });
  }

  // Bollinger breakout
  const latestPrice = prices[prices.length - 1];
  const bbBreakout = detectBBBreakout(
    latestPrice,
    indicators.bollinger.upper[indicators.bollinger.upper.length - 1],
    indicators.bollinger.lower[indicators.bollinger.lower.length - 1]
  );
  if (bbBreakout) {
    signals.push({
      type: bbBreakout,
      indicator: 'Bollinger',
      direction: bbBreakout === 'upper_breakout' ? 'SHORT' : 'LONG'
    });
  }

  // RSI divergence
  const rsiDivergence = detectRSIDivergence(prices, indicators.rsi);
  if (rsiDivergence) {
    signals.push({
      type: 'divergence',
      subtype: rsiDivergence.type,
      indicator: 'RSI',
      direction: rsiDivergence.type === 'bullish' ? 'LONG' : 'SHORT'
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Orchestrators
  calculateAllIndicators,
  getCurrentValues,
  detectSignals,

  // Core calculators (from technicalindicators)
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateATR,
  calculateROC,

  // Custom calculators
  calculateTrueRange,
  calculateATRStops,
  calculateATRPercent,
  calculateMomentum,
  calculateMomentumSlope,
  calculateVWAP,
  calculateVWAPBands,
  getVWAPPosition,

  // Detection helpers
  detectRSIDivergence,
  detectMACDCrossover,
  detectBBSqueeze,
  detectBBBreakout,
  detectMomentumDivergence,

  // Config
  DEFAULT_CONFIG
};
