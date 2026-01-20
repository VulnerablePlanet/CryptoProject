/**
 * ML Feature Store Module
 * Feature extraction and storage for machine learning
 * 
 * Features:
 * - Technical indicator feature extraction
 * - Price lag features
 * - Regime and volatility features
 * - Feature normalization
 * - Batch storage and retrieval
 * 
 * @module ml/featureStore
 */

const { defaultLogger } = require('../utils/logger');
const { normalizeAllIndicators } = require('../scoring/indicatorNormalizer');
const { detectRegime, calculateRealizedVolatility } = require('../regimes/marketRegime');
const config = require('../config');

const logger = defaultLogger.child('FeatureStore');

// In-memory feature storage (can be replaced with database)
const featureCache = new Map();

/**
 * Calculate price lag features
 * @param {Object[]} candles - OHLCV candles
 * @param {number[]} lags - Lag periods to calculate
 * @returns {Object} Lag features
 */
function calculateLagFeatures(candles, lags = config.ml.features.lags) {
  const closes = candles.map(c => c.close);
  const current = closes[closes.length - 1];
  
  const features = {};
  
  for (const lag of lags) {
    if (closes.length > lag) {
      const lagPrice = closes[closes.length - 1 - lag];
      features[`return_${lag}`] = (current - lagPrice) / lagPrice;
      features[`price_ratio_${lag}`] = current / lagPrice;
    } else {
      features[`return_${lag}`] = 0;
      features[`price_ratio_${lag}`] = 1;
    }
  }

  // Momentum features
  if (closes.length > 10) {
    features.momentum_5 = (current - closes[closes.length - 6]) / closes[closes.length - 6];
    features.momentum_10 = (current - closes[closes.length - 11]) / closes[closes.length - 11];
  }

  // Rate of change
  if (closes.length > 5) {
    features.roc_5 = ((current / closes[closes.length - 6]) - 1) * 100;
  }

  return features;
}

/**
 * Calculate volatility features
 * @param {Object[]} candles - OHLCV candles
 * @returns {Object} Volatility features
 */
function calculateVolatilityFeatures(candles) {
  const features = {};
  
  // Realized volatility at different windows
  const windows = [5, 10, 20];
  for (const window of windows) {
    if (candles.length >= window) {
      const subset = candles.slice(-window);
      const returns = [];
      for (let i = 1; i < subset.length; i++) {
        returns.push(Math.log(subset[i].close / subset[i-1].close));
      }
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      features[`volatility_${window}`] = Math.sqrt(variance * 252); // Annualized
    }
  }

  // Average True Range ratio
  if (candles.length >= 14) {
    const atrValues = [];
    for (let i = 1; i < Math.min(15, candles.length); i++) {
      const high = candles[candles.length - i].high;
      const low = candles[candles.length - i].low;
      const prevClose = candles[candles.length - i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      atrValues.push(tr);
    }
    const atr = atrValues.reduce((a, b) => a + b, 0) / atrValues.length;
    features.atr_ratio = atr / candles[candles.length - 1].close;
  }

  // High-Low range
  const recent = candles.slice(-20);
  const highestHigh = Math.max(...recent.map(c => c.high));
  const lowestLow = Math.min(...recent.map(c => c.low));
  features.range_20 = (highestHigh - lowestLow) / lowestLow;

  return features;
}

/**
 * Calculate volume features
 * @param {Object[]} candles - OHLCV candles
 * @returns {Object} Volume features
 */
function calculateVolumeFeatures(candles) {
  const features = {};
  const volumes = candles.map(c => c.volume);
  const currentVol = volumes[volumes.length - 1];
  
  // Volume relative to moving averages
  if (volumes.length >= 20) {
    const sma20Vol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    features.volume_ratio_20 = currentVol / sma20Vol;
  }

  if (volumes.length >= 50) {
    const sma50Vol = volumes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    features.volume_ratio_50 = currentVol / sma50Vol;
  }

  // Volume trend
  if (volumes.length >= 5) {
    const recent5 = volumes.slice(-5);
    const prev5 = volumes.slice(-10, -5);
    if (prev5.length === 5) {
      const recentAvg = recent5.reduce((a, b) => a + b, 0) / 5;
      const prevAvg = prev5.reduce((a, b) => a + b, 0) / 5;
      features.volume_trend = (recentAvg - prevAvg) / prevAvg;
    }
  }

  // On-balance volume direction
  const obv = [];
  let obvValue = 0;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i-1].close) {
      obvValue += candles[i].volume;
    } else if (candles[i].close < candles[i-1].close) {
      obvValue -= candles[i].volume;
    }
    obv.push(obvValue);
  }
  if (obv.length >= 5) {
    features.obv_trend = obv[obv.length - 1] > obv[obv.length - 5] ? 1 : -1;
  }

  return features;
}

/**
 * Calculate pattern features
 * @param {Object[]} candles - OHLCV candles
 * @returns {Object} Pattern features
 */
function calculatePatternFeatures(candles) {
  const features = {};
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  
  // Candle characteristics
  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low;
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;

  features.body_ratio = range > 0 ? body / range : 0;
  features.upper_wick_ratio = range > 0 ? upperWick / range : 0;
  features.lower_wick_ratio = range > 0 ? lowerWick / range : 0;
  features.is_bullish = last.close > last.open ? 1 : 0;

  // Gap
  if (prev) {
    features.gap = (last.open - prev.close) / prev.close;
  }

  // Price position in recent range
  const recent = candles.slice(-20);
  const highestHigh = Math.max(...recent.map(c => c.high));
  const lowestLow = Math.min(...recent.map(c => c.low));
  const rangeSize = highestHigh - lowestLow;
  features.price_position = rangeSize > 0 ? (last.close - lowestLow) / rangeSize : 0.5;

  return features;
}

/**
 * Extract all features from candles
 * @param {Object[]} candles - OHLCV candles
 * @param {string} symbol - Trading symbol
 * @param {Object} options - Feature options
 * @returns {import('../types').MLFeatures} Complete feature set
 */
function extractFeatures(candles, symbol, options = {}) {
  const {
    normalize = config.ml.features.normalize,
    includeRegime = config.ml.features.includeRegime,
    includeVolatility = config.ml.features.includeVolatility
  } = options;

  try {
    // Base indicator features
    const indicators = normalizeAllIndicators(candles);
    
    // Lag features
    const lags = calculateLagFeatures(candles);
    
    // Volatility features
    const volatility = calculateVolatilityFeatures(candles);
    
    // Volume features
    const volume = calculateVolumeFeatures(candles);
    
    // Pattern features
    const patterns = calculatePatternFeatures(candles);

    // Combine all features
    let features = {
      ...indicators,
      ...lags,
      ...volatility,
      ...volume,
      ...patterns
    };

    // Add regime if requested
    let regime = null;
    if (includeRegime) {
      const regimeResult = detectRegime(candles);
      regime = regimeResult.regime;
      
      // One-hot encode regime
      features.regime_strong_trend = regime === 'strong_trend' ? 1 : 0;
      features.regime_weak_trend = regime === 'weak_trend' ? 1 : 0;
      features.regime_range = regime === 'range' ? 1 : 0;
      features.regime_high_volatility = regime === 'high_volatility' ? 1 : 0;
    }

    // Add volatility scalar if requested
    let volatilityValue = null;
    if (includeVolatility) {
      volatilityValue = calculateRealizedVolatility(candles);
      features.realized_volatility = volatilityValue;
    }

    // Normalize features to [-1, 1] or [0, 1]
    if (normalize) {
      features = normalizeFeatures(features);
    }

    return {
      indicators: features,
      regime,
      volatility: volatilityValue,
      lags,
      timestamp: new Date(),
      symbol
    };

  } catch (error) {
    logger.error('Feature extraction failed', { error: error.message, symbol });
    throw error;
  }
}

/**
 * Normalize features to standard range
 * @param {Object} features - Raw features
 * @returns {Object} Normalized features
 */
function normalizeFeatures(features) {
  const normalized = {};
  
  for (const [key, value] of Object.entries(features)) {
    if (typeof value !== 'number' || isNaN(value)) {
      normalized[key] = 0;
      continue;
    }
    
    // Clip extreme values
    let clipped = Math.max(-10, Math.min(10, value));
    
    // Scale to [-1, 1]
    normalized[key] = clipped / 10;
  }
  
  return normalized;
}

/**
 * Store features for a symbol
 * @param {string} symbol - Trading symbol
 * @param {Object} features - Features to store
 */
function storeFeatures(symbol, features) {
  if (!featureCache.has(symbol)) {
    featureCache.set(symbol, []);
  }
  
  const symbolFeatures = featureCache.get(symbol);
  symbolFeatures.push({
    ...features,
    storedAt: new Date()
  });
  
  // Limit storage based on retention
  const maxEntries = config.ml.storage.retentionDays * 24; // Assuming hourly features
  if (symbolFeatures.length > maxEntries) {
    symbolFeatures.splice(0, symbolFeatures.length - maxEntries);
  }
  
  logger.debug('Features stored', { symbol, count: symbolFeatures.length });
}

/**
 * Retrieve stored features for a symbol
 * @param {string} symbol - Trading symbol
 * @param {Object} options - Retrieval options
 * @returns {Object[]} Stored features
 */
function getStoredFeatures(symbol, options = {}) {
  const {
    limit = 100,
    startDate = null,
    endDate = null
  } = options;

  if (!featureCache.has(symbol)) {
    return [];
  }

  let features = featureCache.get(symbol);
  
  // Filter by date if specified
  if (startDate) {
    features = features.filter(f => f.timestamp >= startDate);
  }
  if (endDate) {
    features = features.filter(f => f.timestamp <= endDate);
  }
  
  // Limit results
  return features.slice(-limit);
}

/**
 * Generate training dataset from features
 * @param {string} symbol - Trading symbol
 * @param {Object[]} candles - Historical candles for labels
 * @param {Object} options - Dataset options
 * @returns {Object} Training dataset
 */
function generateTrainingDataset(symbol, candles, options = {}) {
  const {
    lookAhead = 5, // Candles to look ahead for label
    targetType = 'direction' // 'direction' or 'return'
  } = options;

  const dataset = [];
  
  for (let i = 50; i < candles.length - lookAhead; i++) {
    const subset = candles.slice(0, i + 1);
    const features = extractFeatures(subset, symbol);
    
    // Generate label
    const futurePrice = candles[i + lookAhead].close;
    const currentPrice = candles[i].close;
    const futureReturn = (futurePrice - currentPrice) / currentPrice;
    
    let label;
    if (targetType === 'direction') {
      label = futureReturn > 0.001 ? 1 : (futureReturn < -0.001 ? -1 : 0);
    } else {
      label = futureReturn;
    }
    
    dataset.push({
      features: features.indicators,
      label,
      futureReturn,
      timestamp: candles[i].timestamp
    });
  }

  logger.info('Training dataset generated', {
    symbol,
    samples: dataset.length,
    targetType
  });

  return {
    symbol,
    samples: dataset,
    featureNames: Object.keys(dataset[0]?.features || {}),
    targetType,
    lookAhead
  };
}

/**
 * Get feature statistics for a symbol
 * @param {string} symbol - Trading symbol
 * @returns {Object} Feature statistics
 */
function getFeatureStatistics(symbol) {
  const features = getStoredFeatures(symbol);
  
  if (features.length === 0) {
    return null;
  }

  const stats = {};
  const featureNames = Object.keys(features[0].indicators || {});
  
  for (const name of featureNames) {
    const values = features.map(f => f.indicators?.[name]).filter(v => typeof v === 'number');
    
    if (values.length === 0) continue;
    
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    
    stats[name] = {
      mean,
      std: Math.sqrt(variance),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  return stats;
}

/**
 * Clear stored features for a symbol
 * @param {string} symbol - Trading symbol (optional, clears all if not provided)
 */
function clearFeatures(symbol = null) {
  if (symbol) {
    featureCache.delete(symbol);
    logger.info('Features cleared', { symbol });
  } else {
    featureCache.clear();
    logger.info('All features cleared');
  }
}

module.exports = {
  calculateLagFeatures,
  calculateVolatilityFeatures,
  calculateVolumeFeatures,
  calculatePatternFeatures,
  extractFeatures,
  normalizeFeatures,
  storeFeatures,
  getStoredFeatures,
  generateTrainingDataset,
  getFeatureStatistics,
  clearFeatures
};
