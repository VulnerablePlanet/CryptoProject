/**
 * Multi-Timeframe Analyzer (Priority #3)
 * Hierarchical analysis across multiple timeframes
 * 
 * @module mtf/timeframeAnalyzer
 */

const { detectRegime } = require('../regimes/marketRegime');
const { normalizeAllIndicators } = require('../scoring/indicatorNormalizer');
const { generateSignalScore } = require('../scoring/scoreAggregator');
const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('MTF');

/**
 * Analyze single timeframe
 * @param {Object[]} candles - OHLCV candles for this timeframe
 * @param {string} timeframe - Timeframe identifier
 * @returns {import('../types').TimeframeAnalysis} Analysis result
 */
function analyzeTimeframe(candles, timeframe) {
  try {
    // Detect regime
    const regime = detectRegime(candles);
    
    // Normalize indicators
    const signals = normalizeAllIndicators(candles);
    
    // Generate score
    const signalScore = generateSignalScore(signals, regime.regime);
    
    // Determine trend
    const trend = signalScore.direction === 'LONG' ? 'bullish' : 
                  signalScore.direction === 'SHORT' ? 'bearish' : 'neutral';
    
    return {
      timeframe,
      trend,
      strength: signalScore.confidence,
      signal: signalScore,
      regime: regime.regime,
      regimeConfidence: regime.confidence
    };

  } catch (error) {
    logger.error(`Failed to analyze ${timeframe}`, { error: error.message });
    throw error;
  }
}

/**
 * Aggregate multiple timeframe analyses with hierarchy
 * @param {Object<string, import('../types').TimeframeAnalysis>} analyses - Analyses per timeframe
 * @returns {Object} Aggregated result
 */
function aggregateTimeframes(analyses) {
  const hierarchy = config.mtf.hierarchy;
  const timeframes = Object.keys(hierarchy);
  
  let weightedScore = 0;
  let totalWeight = 0;
  let allAligned = true;
  let higherTFTrend = null;

  // Process in hierarchy order (daily first)
  for (const tf of timeframes) {
    const analysis = analyses[tf];
    if (!analysis) continue;

    const tfConfig = hierarchy[tf];
    
    // Check if this timeframe meets minimum confidence
    if (analysis.strength < tfConfig.minConfidence) {
      logger.debug(`${tf} below min confidence`, { 
        strength: analysis.strength,
        minRequired: tfConfig.minConfidence 
      });
      continue;
    }

    // First timeframe sets the higher TF trend
    if (!higherTFTrend) {
      higherTFTrend = analysis.trend;
    }

    // Check alignment with higher timeframes
    if (higherTFTrend && analysis.trend !== 'neutral' && 
        higherTFTrend !== 'neutral' && analysis.trend !== higherTFTrend) {
      allAligned = false;
    }

    // Add weighted contribution
    const score = analysis.signal.score;
    weightedScore += score * tfConfig.weight;
    totalWeight += tfConfig.weight;
  }

  // Normalize weighted score
  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
  
  // Determine if can trade (require alignment if configured)
  let canTrade = totalWeight > 0;
  if (config.mtf.requireAlignment) {
    canTrade = canTrade && allAligned;
  }

  // Determine overall direction
  let direction;
  if (finalScore > 0.2) {
    direction = 'LONG';
  } else if (finalScore < -0.2) {
    direction = 'SHORT';
  } else {
    direction = 'NEUTRAL';
  }

  // Calculate confidence based on alignment and score strength
  const baseConfidence = Math.abs(finalScore);
  const alignmentBonus = allAligned ? 0.2 : 0;
  const confidence = Math.min(1.0, baseConfidence + alignmentBonus);

  return {
    canTrade,
    direction,
    confidence,
    score: finalScore,
    aligned: allAligned,
    higherTimeframeTrend: higherTFTrend,
    activeTimeframes: Object.keys(analyses).length
  };
}

/**
 * Check if entry is allowed based on higher timeframe context
 * @param {Object} entrySignal - Entry signal from lower timeframe
 * @param {Object} higherTFAnalysis - Higher timeframe analysis
 * @returns {boolean} Whether entry is allowed
 */
function filterByContext(entrySignal, higherTFAnalysis) {
  // Don't trade against higher timeframe trend
  if (higherTFAnalysis.trend === 'bullish' && entrySignal.direction === 'SHORT') {
    logger.info('Entry filtered: against higher TF trend', {
       entry: 'SHORT',
      higherTF: 'bullish'
    });
    return false;
  }

  if (higherTFAnalysis.trend === 'bearish' && entrySignal.direction === 'LONG') {
    logger.info('Entry filtered: against higher TF trend', {
      entry: 'LONG',
      higherTF: 'bearish'
    });
    return false;
  }

  // Require minimum higher TF strength
  if (higherTFAnalysis.strength < 0.4) {
    logger.info('Entry filtered: weak higher TF trend', {
      strength: higherTFAnalysis.strength
    });
    return false;
  }

  return true;
}

/**
 * Full multi-timeframe analysis
 * @param {string} symbol - Trading symbol
 * @param {Object<string, Object[]>} candlesByTimeframe - Candles per timeframe
 * @returns {import('../types').MTFAnalysis} Complete MTF analysis
 */
function analyzeMTF(symbol, candlesByTimeframe) {
  const startTime = Date.now();

  try {
    const analyses = {};
    
    // Analyze each timeframe
    for (const [tf, candles] of Object.entries(candlesByTimeframe)) {
      if (candles && candles.length > 0) {
        analyses[tf] = analyzeTimeframe(candles, tf);
      }
    }

    // Aggregate results
    const aggregated = aggregateTimeframes(analyses);

    const result = {
      symbol,
      ...analyses,
      aggregated,
      timestamp: new Date()
    };

    const duration = Date.now() - startTime;
    logger.performance('analyzeMTF', duration);
    logger.info('MTF analysis complete', {
      symbol,
      direction: aggregated.direction,
      confidence: aggregated.confidence.toFixed(2),
      aligned: aggregated.aligned
    });

    return result;

  } catch (error) {
    logger.error('MTF analysis failed', { symbol, error: error.message });
    throw error;
  }
}

module.exports = {
  analyzeTimeframe,
  aggregateTimeframes,
  filterByContext,
  analyzeMTF
};
