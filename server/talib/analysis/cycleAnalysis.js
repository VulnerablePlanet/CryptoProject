/**
 * Cycle Analysis Module
 * Advanced mathematical analysis for trend/cycle detection
 * 
 * Features:
 * - Linear Regression for trend projection
 * - Bollinger Band Squeeze detection
 * - R-squared for trend strength
 * - Trend/Cycle mode classification
 * 
 * @module analysis/cycleAnalysis
 */

const { BollingerBands } = require('technicalindicators');
const { defaultLogger } = require('../utils/logger');
const { percentile } = require('../utils/mathHelpers');

const logger = defaultLogger.child('CycleAnalysis');

/**
 * Calculate Linear Regression
 * Projects trend mathematically using least squares method
 * 
 * @param {Array} candles - OHLCV candles
 * @param {number} period - Regression period
 * @param {number} projectAhead - Number of periods to project
 * @returns {Object} Regression analysis
 */
function calculateLinearRegression(candles, period = 20, projectAhead = 10) {
  if (!candles || candles.length < period) {
    throw new Error(`Insufficient data for regression (minimum ${period} required)`);
  }
  
  const startTime = Date.now();
  
  // Get recent closes
  const recentCandles = candles.slice(-period);
  const closes = recentCandles.map(c => c.close);
  
  // X values (time steps): 0, 1, 2, ..., period-1
  const x = Array.from({ length: period }, (_, i) => i);
  
  // Calculate means
  const xMean = x.reduce((a, b) => a + b) / period;
  const yMean = closes.reduce((a, b) => a + b) / period;
  
  // Calculate slope (m) and intercept (b) for y = mx + b
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < period; i++) {
    numerator += (x[i] - xMean) * (closes[i] - yMean);
    denominator += Math.pow(x[i] - xMean, 2);
  }
  
  const slope = numerator / denominator;
  const intercept = yMean - slope * xMean;
  
  // Calculate R-squared (coefficient of determination)
  const rSquared = calculateRSquared(closes, x, slope, intercept, yMean);
  
  // Generate regression line values for historical period
  const regressionLine = x.map(xi => slope * xi + intercept);
  
  // Project future values
  const projections = Array.from({ length: projectAhead }, (_, i) => {
    const futureX = period + i;
    return slope * futureX + intercept;
  });
  
  // Calculate standard deviation for regression channel
  let sumSquaredErrors = 0;
  for (let i = 0; i < period; i++) {
    const predicted = regressionLine[i];
    sumSquaredErrors += Math.pow(closes[i] - predicted, 2);
  }
  const stdDev = Math.sqrt(sumSquaredErrors / period);
  
  // Upper and lower channel bounds (±1 std dev)
  const upperChannel = regressionLine.map(val => val + stdDev);
  const lowerChannel = regressionLine.map(val => val - stdDev);
  
  // Determine trend direction and strength
  const trendDirection = slope > 0 ? 'UP' : slope < 0 ? 'DOWN' : 'FLAT';
  const trendStrength = Math.abs(slope);
  
  // Price position relative to regression line
  const currentPrice = closes[closes.length - 1];
  const currentRegression = regressionLine[regressionLine.length - 1];
  const position = currentPrice > currentRegression ? 'ABOVE' : 'BELOW';
  const deviation = ((currentPrice - currentRegression) / currentRegression * 100).toFixed(2);
  
  const duration = Date.now() - startTime;
  logger.performance('calculateLinearRegression', duration);
  logger.info('Linear regression calculated', {
    slope: slope.toFixed(4),
    rSquared: rSquared.toFixed(3),
    direction: trendDirection
  });
  
  return {
    slope,
    intercept,
    rSquared,
    stdDev,
    trendDirection,
    trendStrength,
    regressionLine,
    upperChannel,
    lowerChannel,
    projections,
    currentPosition: {
      price: currentPrice,
      regression: currentRegression,
      position,
      deviation: parseFloat(deviation)
    },
    timestamps: recentCandles.map(c => c.timestamp),
    performance: duration,
    timestamp: new Date()
  };
}

/**
 * Calculate R-squared (coefficient of determination)
 * Measures how well the regression line fits the data
 * 
 * @param {Array} actual - Actual values
 * @param {Array} x - X values
 * @param {number} slope - Regression slope
 * @param {number} intercept - Regression intercept
 * @param {number} mean - Mean of actual values
 * @returns {number} R-squared value (0 to 1)
 */
function calculateRSquared(actual, x, slope, intercept, mean) {
  let ssRes = 0;  // Sum of squared residuals
  let ssTot = 0;  // Total sum of squares
  
  for (let i = 0; i < actual.length; i++) {
    const predicted = slope * x[i] + intercept;
    ssRes += Math.pow(actual[i] - predicted, 2);
    ssTot += Math.pow(actual[i] - mean, 2);
  }
  
  return ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
}

/**
 * Detect Bollinger Band Squeeze
 * Identifies periods of low volatility before explosive moves
 * 
 * @param {Array} candles - OHLCV candles
 * @param {Object} params - BB parameters
 * @returns {Object} Squeeze detection results
 */
function detectSqueezes(candles, params = {}) {
  const {
    period = 20,
    stdDev = 2,
    lookback = 100
  } = params;
  
  const startTime = Date.now();
  
  if (!candles || candles.length < lookback) {
    throw new Error(`Insufficient data for squeeze detection (minimum ${lookback} required)`);
  }
  
  const closes = candles.map(c => c.close);
  
  // Calculate Bollinger Bands
  const bb = BollingerBands.calculate({
    period,
    values: closes,
    stdDev
  });
  
  // Calculate bandwidth (distance between bands relative to middle)
  const bandwidths = bb.map(b => {
    if (!b || !b.middle || b.middle === 0) return 0;
    return ((b.upper - b.lower) / b.middle) * 100;  // As percentage
  });
  
  // Get recent bandwidths for comparison
  const recentBandwidths = bandwidths.slice(-lookback);
  
  // Calculate squeeze threshold (20th percentile)
  const threshold = percentile(recentBandwidths, 20);
  const currentBandwidth = bandwidths[bandwidths.length - 1];
  
  // Determine if in squeeze
  const inSqueeze = currentBandwidth < threshold;
  
  // Calculate squeeze duration (consecutive candles in squeeze)
  let duration = 0;
  for (let i = bandwidths.length - 1; i >= 0; i--) {
    if (bandwidths[i] < threshold) {
      duration++;
    } else {
      break;
    }
  }
  
  // Predict breakout timing
  let expectedBreakout;
  if (!inSqueeze) {
    expectedBreakout = 'NONE';
  } else if (currentBandwidth < threshold * 0.5) {
    expectedBreakout = 'IMMINENT';  // Extremely tight
  } else if (duration > 10) {
    expectedBreakout = 'SOON';  // Extended squeeze
  } else {
    expectedBreakout = 'BUILDING';  // Early squeeze
  }
  
  // Historical squeezes for pattern analysis
  const historicalSqueezes = [];
  let squeezeStart = null;
  
  for (let i = 0; i < bandwidths.length; i++) {
    if (bandwidths[i] < threshold && !squeezeStart) {
      squeezeStart = i;
    } else if (bandwidths[i] >= threshold && squeezeStart !== null) {
      historicalSqueezes.push({
        startIndex: squeezeStart,
        endIndex: i - 1,
        duration: i - squeezeStart,
        minBandwidth: Math.min(...bandwidths.slice(squeezeStart, i))
      });
      squeezeStart = null;
    }
  }
  
  const duration_ms = Date.now() - startTime;
  logger.performance('detectSqueezes', duration_ms);
  logger.info('Squeeze detection complete', {
    active: inSqueeze,
    duration,
    expectedBreakout
  });
  
  return {
    active: inSqueeze,
    bandwidth: currentBandwidth,
    threshold,
    duration,
    expectedBreakout,
    historicalCount: historicalSqueezes.length,
    currentBB: bb[bb.length - 1],
    performance: duration_ms,
    timestamp: new Date()
  };
}

/**
 * Analyze complete cycle patterns
 * Combines regression and squeeze detection
 * 
 * @param {Array} candles - OHLCV candles
 * @param {Object} options - Analysis options
 * @returns {Object} Complete cycle analysis
 */
function analyzeCycles(candles, options = {}) {
  const startTime = Date.now();
  
  try {
    const regression = calculateLinearRegression(
      candles, 
      options.regressionPeriod || 20,
      options.projectAhead || 10
    );
    
    const squeeze = detectSqueezes(
      candles,
      options.squeezeParams
    );
    
    // Determine overall market mode
    let mode;
    if (regression.rSquared > 0.7) {
      mode = 'TRENDING';
    } else if (regression.rSquared > 0.4) {
      mode = 'WEAK_TREND';
    } else {
      mode = 'CYCLING';
    }
    
    // Generate trading insights
    const insights = generateCycleInsights(regression, squeeze, mode);
    
    const duration = Date.now() - startTime;
    
    return {
      mode,
      regression,
      squeeze,
      insights,
      performance: duration,
      timestamp: new Date()
    };
    
  } catch (error) {
    logger.error('Cycle analysis failed', { error: error.message });
    throw error;
  }
}

/**
 * Generate trading insights from cycle analysis
 * 
 * @param {Object} regression - Regression analysis
 * @param {Object} squeeze - Squeeze detection
 * @param {string} mode - Market mode
 * @returns {Array} Trading insights
 */
function generateCycleInsights(regression, squeeze, mode) {
  const insights = [];
  
  // Trend quality insight
  if (regression.rSquared > 0.8) {
    insights.push({
      type: 'TREND_QUALITY',
      message: `Strong ${regression.trendDirection} trend (R²=${(regression.rSquared * 100).toFixed(0)}%)`,
      confidence: 0.9
    });
  } else if (regression.rSquared < 0.3) {
    insights.push({
      type: 'TREND_QUALITY',
      message: 'Weak trend - price is cycling',
      confidence: 0.8
    });
  }
  
  // Squeeze insights
  if (squeeze.active) {
    insights.push({
      type: 'VOLATILITY',
      message: `Squeeze active (${squeeze.duration} candles) - breakout ${squeeze.expectedBreakout.toLowerCase()}`,
      confidence: 0.85
    });
    
    if (squeeze.expectedBreakout === 'IMMINENT') {
      insights.push({
        type: 'WARNING',
        message: 'Extreme compression - prepare for volatile breakout',
        confidence: 0.9
      });
    }
  }
  
  // Regression channel position
  if (Math.abs(regression.currentPosition.deviation) > 2) {
    const direction = regression.currentPosition.position === 'ABOVE' ? 'above' : 'below';
    insights.push({
      type: 'POSITION',
      message: `Price ${Math.abs(regression.currentPosition.deviation).toFixed(1)}% ${direction} regression - potential mean reversion`,
      confidence: 0.7
    });
  }
  
  // Strategy recommendations
  if (mode === 'TRENDING' && !squeeze.active) {
    insights.push({
      type: 'STRATEGY',
      message: 'Use trend-following strategies with regression channel as guide',
      confidence: 0.8
    });
  } else if (mode === 'CYCLING') {
    insights.push({
      type: 'STRATEGY',
      message: 'Use mean-reversion strategies between channel bounds',
      confidence: 0.75
    });
  }
  
  return insights;
}

module.exports = {
  calculateLinearRegression,
  calculateRSquared,
  detectSqueezes,
  analyzeCycles,
  generateCycleInsights
};
