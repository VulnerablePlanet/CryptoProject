/**
 * Market Regime Detection (Priority #1)
 * 
 * Detects market conditions using ADX, ATR, realized volatility, and clustering.
 * Separates amateur from professional systems by adapting strategy to market conditions.
 * 
 * @module regimes/marketRegime
 */

const { ADX } = require('technicalindicators');
const { trueRange, ema, realizedVolatility, normalize } = require('../utils/mathHelpers');
const { validateOHLCV, validatePeriod } = require('../utils/dataValidator');
const { defaultLogger } = require('../utils/logger');
const config = require('../config');
const kmeans = require('ml-kmeans');

const logger = defaultLogger.child('RegimeDetection');

/**
 * Calculate Average True Range
 * @param {Object[]} candles - Array of OHLCV candles
 * @param {number} period - ATR period
 * @returns {number} ATR value
 */
function calculateATR(candles, period = 14) {
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    logger.error('Invalid OHLCV data for ATR', { error: validation.error });
    throw new Error(validation.error);
  }

  const periodValidation = validatePeriod(period, candles.length);
  if (!periodValidation.valid) {
    throw new Error(periodValidation.error);
  }

  const trueRanges = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = trueRange(candles[i], candles[i - 1]);
    trueRanges.push(tr);
  }

  // Calculate EMA of true ranges
  const atrValues = ema(trueRanges, period);
  return atrValues[atrValues.length - 1];
}

/**
 * Calculate Average Directional Index (ADX)
 * Uses technicalindicators library
 * @param {Object[]} candles - Array of OHLCV candles
 * @param {number} period - ADX period
 * @returns {{adx: number, pdi: number, mdi: number}} ADX values
 */
function calculateADX(candles, period = 14) {
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    logger.error('Invalid OHLCV data for ADX', { error: validation.error });
    throw new Error(validation.error);
  }

  const periodValidation = validatePeriod(period, candles.length);
  if (!periodValidation.valid) {
    throw new Error(periodValidation.error);
  }

  const input = {
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period
  };

  const result = ADX.calculate(input);
  
  if (result.length === 0) {
    throw new Error('ADX calculation failed - insufficient data');
  }

  const latest = result[result.length - 1];
  return {
    adx: latest.adx || 0,
    pdi: latest.pdi || 0,
    mdi: latest.mdi || 0
  };
}

/**
 * Calculate Realized Volatility
 * @param {Object[]} candles - Array of OHLCV candles
 * @param {number} period - Lookback period
 * @returns {number} Annualized volatility
 */
function calculateRealizedVolatility(candles, period = 20) {
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return realizedVolatility(candles, period);
}

/**
 * Extract features for clustering
 * @param {Object[]} candles - Array of OHLCV candles
 * @param {Object} config - Configuration object
 * @returns {number[]} Feature vector [normalized_adx, normalized_atr, normalized_vol]
 */
function extractFeatures(candles, config) {
  const adxResult = calculateADX(candles, config.regime.adx.period);
  const atr = calculateATR(candles, config.regime.atr.period);
  const vol = calculateRealizedVolatility(candles, config.regime.volatility.period);

  // Calculate typical price range for ATR normalization
  const prices = candles.slice(-50).map(c => c.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  // Normalize features to [0, 1] for clustering
  const normalizedADX = Math.min(adxResult.adx / 100, 1); // ADX is 0-100
  const normalizedATR = Math.min((atr / avgPrice) / 0.1, 1); // Normalize by 10% of price
  const normalizedVol = Math.min(vol / 1.0, 1); // Cap at 100% annualized

  return [normalizedADX, normalizedATR, normalizedVol];
}

/**
 * Perform K-Means clustering to identify regimes
 * @param {number[][]} historicalFeatures - Historical feature vectors
 * @param {number} k - Number of clusters
 * @returns {Object} Clustering result with centroids and labels
 */
function clusterRegimes(historicalFeatures, k = 4) {
  if (historicalFeatures.length < k) {
    throw new Error(`Not enough historical data for clustering (need at least ${k} samples)`);
  }

  const result = kmeans(historicalFeatures, k, {
    maxIterations: config.regime.clustering.maxIterations,
    tolerance: config.regime.clustering.tolerance
  });

  return result;
}

/**
 * Map cluster to regime type based on centroid characteristics
 * @param {number[]} centroid - Cluster centroid [adx, atr, vol]
 * @returns {string} Regime type
 */
function mapClusterToRegime(centroid) {
  const [adx, atr, vol] = centroid;

  // High volatility regime (high ATR and volatility)
  if (atr > 0.6 || vol > 0.7) {
    return 'high_volatility';
  }

  // Strong trend (high ADX, moderate volatility)
  if (adx > 0.6) {
    return 'strong_trend';
  }

  // Weak trend (medium ADX)
  if (adx > 0.3) {
    return 'weak_trend';
  }

  // Range (low ADX)
  return 'range';
}

/**
 * Rule-based regime detection (without clustering)
 * More reliable for real-time with limited historical data
 * @param {Object[]} candles - Array of OHLCV candles
 * @returns {import('../types').RegimeDetection} Regime detection result
 */
function detectRegimeRuleBased(candles) {
  const adxConfig = config.regime.adx;
  const volConfig = config.regime.volatility;

  const adxResult = calculateADX(candles, adxConfig.period);
  const atr = calculateATR(candles, config.regime.atr.period);
  const vol = calculateRealizedVolatility(candles, volConfig.period);

  let regime;
  let confidence;

  // Rule-based classification
  if (vol > volConfig.highVolThreshold) {
    regime = 'high_volatility';
    confidence = Math.min(vol / volConfig.highVolThreshold, 1.0);
  } else if (adxResult.adx > adxConfig.strongTrendThreshold) {
    regime = 'strong_trend';
    confidence = Math.min(adxResult.adx / 100, 1.0);
  } else if (adxResult.adx > adxConfig.trendThreshold) {
    regime = 'weak_trend';
    confidence = (adxResult.adx - adxConfig.trendThreshold) / 
                 (adxConfig.strongTrendThreshold - adxConfig.trendThreshold);
  } else {
    regime = 'range';
    confidence = 1.0 - (adxResult.adx / adxConfig.trendThreshold);
  }

  logger.debug('Regime detected', { regime, confidence, adx: adxResult.adx, atr, vol });

  return {
    regime,
    confidence: Math.max(0.3, Math.min(confidence, 1.0)), // Clamp between 0.3 and 1.0
    adx: adxResult.adx,
    pdi: adxResult.pdi,
    mdi: adxResult.mdi,
    atr,
    volatility: vol,
    timestamp: new Date()
  };
}

/**
 * Clustering-based regime detection (for historical analysis)
 * @param {Object[]} candles - Array of OHLCV candles
 * @param {Object[][]} historicalCandles - Historical candle data for clustering
 * @returns {import('../types').RegimeDetection} Regime detection result
 */
function detectRegimeClustering(candles, historicalCandles) {
  // Extract features from current and historical data
  const currentFeatures = extractFeatures(candles, config);
  const allFeatures = historicalCandles.map(c => extractFeatures(c, config));
  allFeatures.push(currentFeatures);

  // Perform clustering
  const clustering = clusterRegimes(allFeatures, config.regime.clustering.k);
  
  // Get cluster assignment for current data
  const currentCluster = clustering.clusters[clustering.clusters.length - 1];
  const centroid = clustering.centroids[currentCluster];

  // Map cluster to regime type
  const regime = mapClusterToRegime(centroid);

  // Calculate confidence based on distance to centroid
  const distance = Math.sqrt(
    currentFeatures.reduce((sum, val, i) => 
      sum + Math.pow(val - centroid[i], 2), 0
    )
  );
  const confidence = Math.max(0.3, 1.0 - distance);

  const adxResult = calculateADX(candles, config.regime.adx.period);
  const atr = calculateATR(candles, config.regime.atr.period);
  const vol = calculateRealizedVolatility(candles, config.regime.volatility.period);

  logger.debug('Regime detected (clustering)', { 
    regime, 
    confidence, 
    cluster: currentCluster,
    distance 
  });

  return {
    regime,
    confidence,
    adx: adxResult.adx,
    pdi: adxResult.pdi,
    mdi: adxResult.mdi,
    atr,
    volatility: vol,
    timestamp: new Date()
  };
}

/**
 * Main regime detection function
 * @param {Object[]} candles - Array of OHLCV candles (minimum 50 recommended)
 * @param {Object} options - Detection options
 * @param {boolean} options.useClustering - Use clustering method (requires historical data)
 * @param {Object[][]} options.historicalCandles - Historical candle data for clustering
 * @returns {import('../types').RegimeDetection} Regime detection result
 */
function detectRegime(candles, options = {}) {
  const startTime = Date.now();

  try {
    const validation = validateOHLCV(candles);
    if (!validation.valid) {
      throw new Error(`Invalid candle data: ${validation.error}`);
    }

    if (candles.length < 50) {
      logger.warn('Insufficient candles for accurate regime detection', { count: candles.length });
    }

    let result;

    if (options.useClustering && options.historicalCandles) {
      result = detectRegimeClustering(candles, options.historicalCandles);
    } else {
      result = detectRegimeRuleBased(candles);
    }

    const duration = Date.now() - startTime;
    logger.performance('detectRegime', duration);

    return result;

  } catch (error) {
    logger.error('Regime detection failed', { error: error.message });
    throw error;
  }
}

/**
 * Get recommended strategy for regime
 * @param {string} regime - Regime type
 * @returns {string[]} Recommended indicators/strategies
 */
function getRecommendedStrategy(regime) {
  const strategies = {
    strong_trend: ['breakout', 'ema_crossover', 'macd', 'trend_following'],
    weak_trend: ['ema', 'macd', 'pullback'],
    range: ['rsi', 'bbands', 'mean_reversion', 'support_resistance'],
    high_volatility: ['atr_stops', 'reduce_position_size', 'wider_stops']
  };

  return strategies[regime] || [];
}

module.exports = {
  calculateATR,
  calculateADX,
  calculateRealizedVolatility,
  detectRegime,
  getRecommendedStrategy,
  extractFeatures,
  clusterRegimes
};
