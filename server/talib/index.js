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

// New high-priority modules
const stops = require('./stops/dynamicStops');
const risk = require('./risk/riskManager');

// Additional analysis modules
const adaptiveIndicators = require('./indicators/adaptiveIndicators');
const candlestickPatterns = require('./patterns/candlestickPatterns');
const cycleAnalysis = require('./analysis/cycleAnalysis');

// Medium priority modules
const marketStructure = require('./structure/marketStructure');
const divergence = require('./divergence/divergenceDetector');

// Low priority modules
const walkForward = require('./backtest/walkForward');
const featureStore = require('./ml/featureStore');
const strategyAdapter = require('./adaptive/strategyAdapter');

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

    // 6. Candlestick Patterns
    const patterns = candlestickPatterns.scanAllPatterns(candles);

    // 7. Cycle Analysis
    const cycles = cycleAnalysis.analyzeCycles(candles);

    const result = {
      regime,
      recommendedStrategies,
      signal: signalScore,
      indicators: normalizedIndicators,
      mtf: mtfAnalysis,
      volume: volumeAnalysis,
      orderbook: obAnalysis,
      patterns,
      cycles,
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

  // Dynamic Stops & Take Profit (NEW)
  stops: {
    calculateATRStop: stops.calculateATRStop,
    calculateVolatilityStop: stops.calculateVolatilityStop,
    calculateStructureStop: stops.calculateStructureStop,
    calculateDynamic: stops.calculateDynamicStop,
    initializeTrailing: stops.initializeTrailingStop,
    updateTrailing: stops.updateTrailingStop,
    isTrailingHit: stops.isTrailingStopHit,
    checkTimeStop: stops.checkTimeStop,
    analyzeOptions: stops.analyzeStopOptions
  },

  // Risk Management (NEW)
  risk: {
    calculatePositionSize: risk.calculatePositionSize,
    checkExposure: risk.checkExposure,
    checkCorrelatedExposure: risk.checkCorrelatedExposure,
    checkKillSwitch: risk.checkKillSwitch,
    calculateMetrics: risk.calculateRiskMetrics,
    validateTrade: risk.validateTrade,
    adjustPositionSize: risk.adjustPositionSize
  },

  // Adaptive Indicators (previously unexported)
  adaptive: {
    calculateKAMA: adaptiveIndicators.calculateKAMA,
    calculateMAMA: adaptiveIndicators.calculateMAMA,
    calculateEfficiencyRatio: adaptiveIndicators.calculateEfficiencyRatio,
    compareWithEMA: adaptiveIndicators.compareWithEMA,
    analyze: adaptiveIndicators.analyzeAdaptive,
    generateRecommendations: adaptiveIndicators.generateRecommendations
  },

  // Candlestick Patterns (previously unexported)
  patterns: {
    detectDoji: candlestickPatterns.detectDoji,
    detectHammer: candlestickPatterns.detectHammer,
    detectEngulfing: candlestickPatterns.detectEngulfing,
    detectMorningStar: candlestickPatterns.detectMorningStar,
    scanAll: candlestickPatterns.scanAllPatterns
  },

  // Cycle Analysis (previously unexported)
  cycles: {
    calculateLinearRegression: cycleAnalysis.calculateLinearRegression,
    calculateRSquared: cycleAnalysis.calculateRSquared,
    detectSqueezes: cycleAnalysis.detectSqueezes,
    analyze: cycleAnalysis.analyzeCycles,
    generateInsights: cycleAnalysis.generateCycleInsights
  },

  // Market Structure - Smart Money Concepts (NEW)
  structure: {
    findSwingPoints: marketStructure.findSwingPoints,
    detectBOS: marketStructure.detectBOS,
    detectCHOCH: marketStructure.detectCHOCH,
    detectFVG: marketStructure.detectFVG,
    detectLiquiditySweeps: marketStructure.detectLiquiditySweeps,
    findEqualLevels: marketStructure.findEqualLevels,
    determineBias: marketStructure.determineMarketBias,
    analyze: marketStructure.analyzeMarketStructure
  },

  // Divergence Detection (NEW)
  divergence: {
    findPivots: divergence.findPivots,
    detectDivergence: divergence.detectDivergence,
    detectMultiOscillator: divergence.detectMultiOscillatorDivergence,
    analyze: divergence.analyzeDivergences,
    checkVolumeConfirmation: divergence.checkVolumeConfirmation
  },

  // Walk-Forward Testing (NEW)
  backtest: {
    generateWindows: walkForward.generateWindows,
    calculateMetrics: walkForward.calculatePerformanceMetrics,
    runMonteCarlo: walkForward.runMonteCarloSimulation,
    optimizeParameters: walkForward.optimizeParameters,
    runWalkForward: walkForward.runWalkForwardAnalysis,
    validateRobustness: walkForward.validateRobustness
  },

  // ML Feature Store (NEW)
  ml: {
    extractFeatures: featureStore.extractFeatures,
    storeFeatures: featureStore.storeFeatures,
    getStoredFeatures: featureStore.getStoredFeatures,
    generateDataset: featureStore.generateTrainingDataset,
    getStatistics: featureStore.getFeatureStatistics,
    calculateLagFeatures: featureStore.calculateLagFeatures,
    calculateVolatilityFeatures: featureStore.calculateVolatilityFeatures
  },

  // Adaptive Strategies (NEW)
  strategy: {
    initialize: strategyAdapter.initializeStrategy,
    recordTrade: strategyAdapter.recordTrade,
    calculateSizeMultiplier: strategyAdapter.calculateSizeMultiplier,
    checkEnabled: strategyAdapter.checkStrategyEnabled,
    getRecommendations: strategyAdapter.getStrategyRecommendations,
    getPerformanceSummary: strategyAdapter.getPerformanceSummary,
    getRegimeRecommendations: strategyAdapter.getRegimeSpecificRecommendations
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
