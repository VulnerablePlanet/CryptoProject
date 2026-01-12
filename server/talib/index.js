/**
 * TA-Lib Advanced Analysis Module - Main Entry Point
 * Professional technical analysis with 12 institutional-grade features
 * 
 * @module talib
 */

// Core modules
const regimes = require('./regimes/marketRegime');
const regimeCache = require('./regimes/regimeCache');
const scoring = require('./scoring/indicatorNormalizer');
const scoreAggregator = require('./scoring/scoreAggregator');
const mtf = require('./mtf/timeframeAnalyzer');
const volume = require('./volume/volumeProfile');
const orderbook = require('./orderbook/intelligence');

// Utilities
const mathHelpers = require('./utils/mathHelpers');
const dataValidator = require('./utils/dataValidator');
const { defaultLogger } = require('./utils/logger');
const config = require('./config');

const logger = defaultLogger.child('TalibMain');

/**
 * Complete analysis for a symbol
 * Combines all features into one comprehensive analysis
 * @param {Object} params - Analysis parameters
 * @param {Object[]} params.candles - OHLCV candles
 * @param {Object<string, Object[]>} params.candlesByTimeframe - Multi-timeframe candles
 * @param {Object} params.orderbook - Order book data
 * @param {Object} params.previousOrderbook - Previous order book (for spoofing)
 * @param {Object[]} params.trades - Trade data for delta volume
 * @returns {Object} Comprehensive analysis result
 */
async function analyzeComplete(params) {
  const startTime = Date.now();

  try {
    const { candles, candlesByTimeframe, orderbook:  ob, previousOrderbook, trades } = params;

    logger.info('Starting complete analysis');

    // 1. Market Regime Detection
    const regime = regimes.detectRegime(candles);
    const recommendedStrategies = regimes.getRecommendedStrategy(regime.regime);

    // 2. Indicator Normalization & Scoring
    const normalizedIndicators = scoring.normalizeAllIndicators(candles);
    const signalScore = scoreAggregator.generateSignalScore(normalizedIndicators, regime.regime);

    // 3. Multi-Timeframe Analysis (if data provided)
    let mtfAnalysis = null;
    if (candlesByTimeframe) {
      mtfAnalysis = mtf.analyzeMTF(params.symbol || 'UNKNOWN', candlesByTimeframe);
    }

    // 4. Volume Analysis
    const volumeAnalysis = volume.analyzeVolume(candles, trades);

    // 5. Order Book Intelligence (if provided)
    let obAnalysis = null;
    if (ob) {
      obAnalysis = orderbook.analyzeOrderBook(ob, previousOrderbook);
    }

    const result = {
      regime,
      recommendedStrategies,
      signal: signalScore,
      indicators: normalizedIndicators,
      mtf: mtfAnalysis,
      volume: volumeAnalysis,
      orderbook: obAnalysis,
      timestamp: new Date(),
      performance: Date.now() - startTime
    };

    logger.info('Complete analysis finished', { duration: result.performance });

    return result;

  } catch (error) {
    logger.error('Complete analysis failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

// Export all modules
module.exports = {
  // Main analysis
  analyzeComplete,

  // Market Regime Detection
  regime: {
    detect: regimes.detectRegime,
    calculateADX: regimes.calculateADX,
    calculateATR: regimes.calculateATR,
    calculateVolatility: regimes.calculateRealizedVolatility,
    getRecommendedStrategy: regimes.getRecommendedStrategy,
    cache: regimeCache
  },

  // Multi-Indicator Scoring
  scoring: {
    normalize: scoring.normalizeAllIndicators,
    normalizeEMA: scoring.normalizeEMA,
    normalizeRSI: scoring.normalizeRSI,
    normalizeMACD: scoring.normalizeMACD,
    normalizeVolume: scoring.normalizeVolume,
    normalizeBollingerBands: scoring.normalizeBollingerBands,
    normalizeStochastic: scoring.normalizeStochastic,
    generateScore: scoreAggregator.generateSignalScore,
    getWeights: scoreAggregator.getWeightsByRegime
  },

  // Multi-Timeframe Analysis
  mtf: {
    analyze: mtf.analyzeMTF,
    analyzeTimeframe: mtf.analyzeTimeframe,
    aggregate: mtf.aggregateTimeframes,
    filterByContext: mtf.filterByContext
  },

  // Volume Analysis
  volume: {
    analyze: volume.analyzeVolume,
    calculateProfile: volume.calculateVolumeProfile,
    calculateVWAP: volume.calculateDynamicVWAP,
    calculateDelta: volume.calculateDeltaVolume,
    detectAbsorption: volume.detectAbsorption,
    detectExhaustion: volume.detectExhaustion
  },

  // Order Book Intelligence
  orderbook: {
    analyze: orderbook.analyzeOrderBook,
    calculateImbalance: orderbook.calculateImbalance,
    detectWalls: orderbook.detectWalls,
    detectSpoofing: orderbook.detectCancellations,
    analyzeSpread: orderbook.analyzeSpreadDepth
  },

  // Utilities
  utils: {
    math: mathHelpers,
    validator: dataValidator,
    logger: defaultLogger
  },

  // Configuration
  config
};
