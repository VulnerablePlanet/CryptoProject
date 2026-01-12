/**
 * Adaptive Indicators Module
 * Implements moving averages that adapt to market volatility
 * 
 * Features:
 * - KAMA (Kaufman Adaptive Moving Average)
 * - Efficiency Ratio calculation
 * - Market mode detection (trending vs ranging)
 * 
 * @module indicators/adaptiveIndicators
 */

const { defaultLogger } = require('../utils/logger');

const logger = defaultLogger.child('AdaptiveIndicators');

/**
 * Calculate Efficiency Ratio
 * Measures directional movement vs total movement
 * High ER = trending market, Low ER = ranging market
 * 
 * @param {Array} values - Price values
 * @param {number} period - Calculation period
 * @returns {Array} Efficiency ratios
 */
function calculateEfficiencyRatio(values, period = 10) {
  const ratios = [];
  
  for (let i = period; i < values.length; i++) {
    const segment = values.slice(i - period, i + 1);
    
    // Direction = absolute change from start to end
    const direction = Math.abs(segment[segment.length - 1] - segment[0]);
    
    // Volatility = sum of all absolute changes
    let volatility = 0;
    for (let j = 1; j < segment.length; j++) {
      volatility += Math.abs(segment[j] - segment[j - 1]);
    }
    
    // ER = direction / volatility
    // High ER (>0.5) = strong trend
    // Low ER (<0.3) = sideways/choppy
    const er = volatility === 0 ? 0 : direction / volatility;
    ratios.push(er);
  }
  
  return ratios;
}

/**
 * Calculate KAMA (Kaufman Adaptive Moving Average)
 * Adapts smoothing based on market efficiency
 * 
 * @param {Array} candles - OHLCV candles
 * @param {Object} params - KAMA parameters
 * @returns {Object} KAMA values with metadata
 */
function calculateKAMA(candles, params = {}) {
  const {
    period = 10,
    fastPeriod = 2,
    slowPeriod = 30
  } = params;
  
  const startTime = Date.now();
  
  if (!candles || candles.length < period + 10) {
    throw new Error(`Insufficient data for KAMA (minimum ${period + 10} candles required)`);
  }
  
  const closes = candles.map(c => c.close);
  
  // Calculate KAMA manually since technicalindicators doesn't have it
  const kamaValues = [];
  const fastSC = 2 / (fastPeriod + 1);  // Fast smoothing constant
  const slowSC = 2 / (slowPeriod + 1);  // Slow smoothing constant
  
  // Start with SMA for first value
  let kama = closes.slice(0, period).reduce((a, b) => a + b) / period;
  kamaValues.push(kama);
  
  for (let i = period; i < closes.length; i++) {
    // Calculate Efficiency Ratio for this period
    const direction = Math.abs(closes[i] - closes[i - period]);
    let volatility = 0;
    for (let j = i - period + 1; j <= i; j++) {
      volatility += Math.abs(closes[j] - closes[j - 1]);
    }
    const er = volatility === 0 ? 0 : direction / volatility;
    
    // Calculate Smoothing Constant
    // SC = [ER * (fastSC - slowSC) + slowSC]²
    const sc = Math.pow(er * (fastSC - slowSC) + slowSC, 2);
    
    // Calculate KAMA
    // KAMA = KAMA(previous) + SC * (Price - KAMA(previous))
    kama = kama + sc * (closes[i] - kama);
    kamaValues.push(kama);
  }
  
  // Calculate efficiency ratio to show adaptation level
  const efficiencyRatios = calculateEfficiencyRatio(closes, period);
  
  // Current efficiency ratio
  const currentER = efficiencyRatios[efficiencyRatios.length - 1];
  
  // Determine market mode based on ER
  let mode;
  if (currentER > 0.5) {
    mode = 'TRENDING';
  } else if (currentER > 0.3) {
    mode = 'TRANSITIONING';
  } else {
    mode = 'RANGING';
  }
  
  // Align KAMA values with timestamps
  const offset = closes.length - kamaValues.length;
  const alignment = kamaValues.map((kama, i) => {
    const candleIndex = i + offset;
    const candle = candles[candleIndex];
    
    return {
      timestamp: candle.timestamp,
      value: kama,
      price: candle.close,
      position: candle.close > kama ? 'ABOVE' : 'BELOW',
      distance: ((candle.close - kama) / kama * 100).toFixed(2) // Percentage
    };
  });
  
  const duration = Date.now() - startTime;
  logger.performance('calculateKAMA', duration);
  logger.info('KAMA calculated', { 
    dataPoints: kamaValues.length, 
    mode, 
    efficiency: currentER.toFixed(3) 
  });
  
  return {
    values: kamaValues,
    alignment,
    efficiency: currentER,
    mode,
    params,
    performance: duration,
    timestamp: new Date()
  };
}

/**
 * Calculate MAMA (MESA Adaptive Moving Average)
 * Alternative adaptive MA using different methodology
 * 
 * Note: If technicalindicators doesn't support MAMA, this will
 * return a KAMA with different parameters as a fallback
 * 
 * @param {Array} candles - OHLCV candles
 * @returns {Object} MAMA values with metadata
 */
function calculateMAMA(candles) {
  // Check if MAMA is available in technicalindicators
  // If not, use KAMA with more aggressive parameters
  
  // Fallback: Use KAMA with faster adaptation
  logger.info('Using KAMA as MAMA fallback with aggressive parameters');
  
  return calculateKAMA(candles, {
    period: 8,
    fastPeriod: 2,
    slowPeriod: 20
  });
}

/**
 * Compare adaptive MA with traditional EMA
 * Shows the benefit of adaptive smoothing
 * 
 * @param {Array} candles - OHLCV candles
 * @param {number} period - Period for comparison
 * @returns {Object} Comparison metrics
 */
function compareWithEMA(candles, period = 20) {
  const { EMA } = require('technicalindicators');
  
  const closes = candles.map(c => c.close);
  
  // Calculate both
  const kama = calculateKAMA(candles, { period });
  const emaValues = EMA.calculate({ period, values: closes });
  
  // Compare last N values
  const compareLength = Math.min(kama.values.length, emaValues.length, 50);
  const kamaRecent = kama.values.slice(-compareLength);
  const emaRecent = emaValues.slice(-compareLength);
  const priceRecent = closes.slice(-compareLength);
  
  // Calculate average deviation from price
  let kamaDeviation = 0;
  let emaDeviation = 0;
  
  for (let i = 0; i < compareLength; i++) {
    kamaDeviation += Math.abs(priceRecent[i] - kamaRecent[i]);
    emaDeviation += Math.abs(priceRecent[i] - emaRecent[i]);
  }
  
  kamaDeviation /= compareLength;
  emaDeviation /= compareLength;
  
  return {
    kama: {
      avgDeviation: kamaDeviation,
      mode: kama.mode
    },
    ema: {
      avgDeviation: emaDeviation
    },
    comparison: {
      kamaIsTighter: kamaDeviation < emaDeviation,
      improvementPercent: ((emaDeviation - kamaDeviation) / emaDeviation * 100).toFixed(2)
    }
  };
}

/**
 * Analyze complete adaptive indicator set
 * 
 * @param {Array} candles - OHLCV candles
 * @param {Object} options - Analysis options
 * @returns {Object} Complete adaptive analysis
 */
function analyzeAdaptive(candles, options = {}) {
  const startTime = Date.now();
  
  try {
    const kama = calculateKAMA(candles, options.kamaParams);
    const comparison = options.compareEMA ? compareWithEMA(candles) : null;
    
    const duration = Date.now() - startTime;
    
    return {
      kama,
      comparison,
      recommendations: generateRecommendations(kama),
      performance: duration,
      timestamp: new Date()
    };
    
  } catch (error) {
    logger.error('Adaptive analysis failed', { error: error.message });
    throw error;
  }
}

/**
 * Generate trading recommendations based on KAMA analysis
 * 
 * @param {Object} kama - KAMA analysis result
 * @returns {Object} Recommendations
 */
function generateRecommendations(kama) {
  const recommendations = [];
  
  if (kama.mode === 'TRENDING') {
    recommendations.push({
      type: 'STRATEGY',
      message: 'Use trend-following strategies (breakout, momentum)',
      confidence: 0.8
    });
    
    const lastAlignment = kama.alignment[kama.alignment.length - 1];
    if (lastAlignment.position === 'ABOVE') {
      recommendations.push({
        type: 'SIGNAL',
        message: 'Price above KAMA - bullish trend confirmed',
        confidence: 0.75
      });
    } else {
      recommendations.push({
        type: 'SIGNAL',
        message: 'Price below KAMA - bearish trend confirmed',
        confidence: 0.75
      });
    }
  } else if (kama.mode === 'RANGING') {
    recommendations.push({
      type: 'STRATEGY',
      message: 'Use mean-reversion strategies (support/resistance)',
      confidence: 0.7
    });
    recommendations.push({
      type: 'WARNING',
      message: 'Low efficiency - avoid trend-following entries',
      confidence: 0.85
    });
  } else {
    recommendations.push({
      type: 'CAUTION',
      message: 'Market transitioning - wait for clear direction',
      confidence: 0.6
    });
  }
  
  return recommendations;
}

module.exports = {
  calculateKAMA,
  calculateMAMA,
  calculateEfficiencyRatio,
  compareWithEMA,
  analyzeAdaptive,
  generateRecommendations
};
