/**
 * Mathematical Helper Functions
 * Reusable math utilities for technical analysis
 *
 * @deprecated For SMA, EMA, Standard Deviation: use `calculators` from
 *   `server/trading/indicators` (delegates to `technicalindicators` npm package).
 *   Non-indicator math helpers (percentile, normalize, correlation, findPeaks,
 *   findTroughs, lerp, zScore, hysteresis, realizedVolatility) are NOT duplicated
 *   elsewhere and remain valid here.
 */

// Native statistical helpers (replaces mathjs dependency)
const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length
const std = (arr) => { const m = mean(arr); return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length) }
const variance = (arr) => { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length }

/**
 * Calculate Simple Moving Average
 * @param {number[]} data - Array of values
 * @param {number} period - Period for SMA
 * @returns {number[]} Array of SMA values
 */
function sma(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    result.push(mean(slice));
  }
  return result;
}

/**
 * Calculate Standard Deviation
 * @param {number[]} data - Array of values
 * @returns {number} Standard deviation
 */
function standardDeviation(data) {
  return std(data);
}

/**
 * Calculate Percentile
 * @param {number[]} data - Array of values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} Percentile value
 */
function percentile(data, percentile) {
  const sorted = [...data].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Normalize value to range [-1, 1]
 * @param {number} value - Value to normalize
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Normalized value
 */
function normalize(value, min, max) {
  if (max === min) return 0;
  return 2 * ((value - min) / (max - min)) - 1;
}

/**
 * Normalize value to range [0, 1]
 * @param {number} value - Value to normalize
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Normalized value
 */
function normalizePositive(value, min, max) {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/**
 * Calculate Pearson Correlation Coefficient
 * @param {number[]} x - First array
 * @param {number[]} y - Second array
 * @returns {number} Correlation coefficient (-1 to 1)
 */
function correlation(x, y) {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);
  
  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;
  
  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    sumSqX += diffX * diffX;
    sumSqY += diffY * diffY;
  }
  
  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate Exponential Moving Average
 * @param {number[]} data - Array of values
 * @param {number} period - EMA period
 * @returns {number[]} Array of EMA values
 */
function ema(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  
  // Start with SMA
  const firstSMA = mean(data.slice(0, period));
  result.push(firstSMA);
  
  // Calculate EMA
  for (let i = period; i < data.length; i++) {
    const emaValue = data[i] * k + result[result.length - 1] * (1 - k);
    result.push(emaValue);
  }
  
  return result;
}

/**
 * Calculate True Range
 * @param {Object} candle - OHLC candle
 * @param {Object} prevCandle - Previous OHLC candle
 * @returns {number} True range
 */
function trueRange(candle, prevCandle) {
  if (!prevCandle) return candle.high - candle.low;
  
  const hl = candle.high - candle.low;
  const hc = Math.abs(candle.high - prevCandle.close);
  const lc = Math.abs(candle.low - prevCandle.close);
  
  return Math.max(hl, hc, lc);
}

/**
 * Find local peaks in data
 * @param {number[]} data - Array of values
 * @param {number} distance - Minimum distance between peaks
 * @returns {number[]} Array of peak indices
 */
function findPeaks(data, distance = 5) {
  const peaks = [];
  
  for (let i = distance; i < data.length - distance; i++) {
    let isPeak = true;
    
    // Check left side
    for (let j = 1; j <= distance; j++) {
      if (data[i] <= data[i - j]) {
        isPeak = false;
        break;
      }
    }
    
    // Check right side
    if (isPeak) {
      for (let j = 1; j <= distance; j++) {
        if (data[i] <= data[i + j]) {
          isPeak = false;
          break;
        }
      }
    }
    
    if (isPeak) peaks.push(i);
  }
  
  return peaks;
}

/**
 * Find local troughs in data
 * @param {number[]} data - Array of values
 * @param {number} distance - Minimum distance between troughs
 * @returns {number[]} Array of trough indices
 */
function findTroughs(data, distance = 5) {
  const troughs = [];
  
  for (let i = distance; i < data.length - distance; i++) {
    let isTrough = true;
    
    // Check left side
    for (let j = 1; j <= distance; j++) {
      if (data[i] >= data[i - j]) {
        isTrough = false;
        break;
      }
    }
    
    // Check right side
    if (isTrough) {
      for (let j = 1; j <= distance; j++) {
        if (data[i] >= data[i + j]) {
          isTrough = false;
          break;
        }
      }
    }
    
    if (isTrough) troughs.push(i);
  }
  
  return troughs;
}

/**
 * Calculate Realized Volatility
 * @param {Object[]} candles - Array of OHLCV candles
 * @param {number} period - Lookback period
 * @returns {number} Realized volatility (annualized)
 */
function realizedVolatility(candles, period = 20) {
  if (candles.length < period + 1) return 0;
  
  const returns = [];
  const recent = candles.slice(-period - 1);
  
  for (let i = 1; i < recent.length; i++) {
    const logReturn = Math.log(recent[i].close / recent[i - 1].close);
    returns.push(logReturn);
  }
  
  const stdDev = standardDeviation(returns);
  // Annualize (assuming daily data, multiply by sqrt(365))
  return stdDev * Math.sqrt(365);
}

/**
 * Apply hysteresis to prevent signal flipping
 * @param {number} value - Current value
 * @param {number} prevState - Previous state (-1, 0, 1)
 * @param {number} upperThreshold - Upper threshold
 * @param {number} lowerThreshold - Lower threshold
 * @param {number} hysteresis - Hysteresis band
 * @returns {number} New state (-1, 0, 1)
 */
function applyHysteresis(value, prevState, upperThreshold, lowerThreshold, hysteresis) {
  if (value > upperThreshold + (prevState < 1 ? hysteresis : 0)) {
    return 1;
  } else if (value < lowerThreshold - (prevState > -1 ? hysteresis : 0)) {
    return -1;
  } else if (Math.abs(value) < Math.min(Math.abs(upperThreshold), Math.abs(lowerThreshold))) {
    return 0;
  }
  return prevState;
}

/**
 * Linear interpolation
 * @param {number} x - Input value
 * @param {number} x0 - Lower bound input
 * @param {number} x1 - Upper bound input
 * @param {number} y0 - Lower bound output
 * @param {number} y1 - Upper bound output
 * @returns {number} Interpolated value
 */
function lerp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
}

/**
 * Calculate Z-Score
 * @param {number} value - Value to calculate z-score for
 * @param {number[]} data - Historical data
 * @returns {number} Z-score
 */
function zScore(value, data) {
  const avg = mean(data);
  const stdDev = standardDeviation(data);
  
  if (stdDev === 0) return 0;
  return (value - avg) / stdDev;
}

module.exports = {
  sma,
  ema,
  standardDeviation,
  percentile,
  normalize,
  normalizePositive,
  correlation,
  trueRange,
  findPeaks,
  findTroughs,
  realizedVolatility,
  applyHysteresis,
  lerp,
  zScore
};
