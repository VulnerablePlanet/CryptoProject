/**
 * Score Aggregator
 * Aggregates normalized indicator signals into a single score
 * with dynamic weighting based on market regime
 * 
 * @module scoring/scoreAggregator
 */

const { applyHysteresis } = require('../utils/mathHelpers');
const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('ScoreAggregator');

/**
 * Get weights for indicators based on market regime
 * @param {string} regime - Market regime type
 * @returns {Object<string, number>} Indicator weights
 */
function getWeightsByRegime(regime) {
  const weights = config.scoring.weights[regime];
  
  if (!weights) {
    logger.warn('Unknown regime, using equal weights', { regime });
    return {
      ema: 0.25,
      rsi: 0.25,
      macd: 0.25,
      volume: 0.15,
      orderbook: 0.10
    };
  }

  return weights;
}

/**
 * Calculate aggregated score from normalized indicators
 * @param {Object<string, number>} signals - Normalized indicator signals
 * @param {string} regime - Market regime type
 * @param {Object} options - Scoring options
 * @returns {number} Aggregated score [-1, 1]
 */
function calculateScore(signals, regime, options = {}) {
  const weights = getWeightsByRegime(regime);
  
  let score = 0;
  let totalWeight = 0;

  // Aggregate weighted signals
  for (const [indicator, weight] of Object.entries(weights)) {
    if (signals[indicator] !== undefined && signals[indicator] !== null) {
      score += signals[indicator] * weight;
      totalWeight += weight;
    }
  }

  // Normalize by total weight (in case some indicators are missing)
  if (totalWeight === 0) {
    logger.warn('No valid signals to aggregate');
    return 0;
  }

  score = score / totalWeight;

  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, score));
}

/**
 * Determine signal quality based on indicator agreement
 * @param {Object<string, number>} signals - Normalized indicator signals
 * @param {number} score - Aggregated score
 * @returns {string} Quality: 'high' | 'medium' | 'low'
 */
function determineQuality(signals, score) {
  const signalValues = Object.values(signals).filter(v => v !== undefined && v !== null);
  
  if (signalValues.length === 0) return 'low';

  // Count how many signals agree with the score direction
  const scoreDirection = Math.sign(score);
  const agreeing = signalValues.filter(v => Math.sign(v) === scoreDirection).length;
  const agreementRatio = agreeing / signalValues.length;

  // High quality: most indicators agree (>70%)
  if (agreementRatio > 0.7 && Math.abs(score) > 0.4) {
    return 'high';
  }

  // Medium quality: some agreement (>50%)
  if (agreementRatio > 0.5 && Math.abs(score) > 0.2) {
    return 'medium';
  }

  // Low quality: poor agreement or weak signal
  return 'low';
}

/**
 * Determine trade direction from score
 * @param {number} score - Aggregated score
 * @param {Object} thresholds - Threshold configuration
 * @returns {string} Direction: 'LONG' | 'SHORT' | 'NEUTRAL'
 */
function determineDirection(score, thresholds) {
  if (score > thresholds.weak) {
    return 'LONG';
  } else if (score < -thresholds.weak) {
    return 'SHORT';
  }
  return 'NEUTRAL';
}

/**
 * Calculate confidence level for the signal
 * @param {number} score - Aggregated score
 * @param {string} quality - Signal quality
 * @returns {number} Confidence [0, 1]
 */
function calculateConfidence(score, quality) {
  const absScore = Math.abs(score);
  const qualityMultiplier = {
    high: 1.0,
    medium: 0.7,
    low: 0.4
  };

  return Math.min(1.0, absScore * qualityMultiplier[quality]);
}

/**
 * Apply hysteresis to prevent signal flipping
 * @param {number} currentScore - Current score
 * @param {string} prevDirection - Previous direction
 * @param {Object} thresholds - Threshold configuration
 * @returns {string} New direction with hysteresis
 */
function applyDirectionHysteresis(currentScore, prevDirection, thresholds) {
  const hysteresis = thresholds.hysteresis;

  if (prevDirection === 'LONG') {
    // Need to drop below weak threshold minus hysteresis to exit LONG
    if (currentScore < thresholds.weak - hysteresis) {
      if (currentScore < -thresholds.weak) {
        return 'SHORT';
      }
      return 'NEUTRAL';
    }
    return 'LONG';
  }

  if (prevDirection === 'SHORT') {
    // Need to rise above -weak threshold plus hysteresis to exit SHORT
    if (currentScore > -thresholds.weak + hysteresis) {
      if (currentScore > thresholds.weak) {
        return 'LONG';
      }
      return 'NEUTRAL';
    }
    return 'SHORT';
  }

  // NEUTRAL - use standard thresholds
  return determineDirection(currentScore, thresholds);
}

/**
 * Generate complete signal score with metadata
 * @param {Object<string, number>} signals - Normalized indicator signals
 * @param {string} regime - Market regime type
 * @param {Object} options - Options
 * @param {string} options.prevDirection - Previous direction for hysteresis
 * @param {boolean} options.useHysteresis - Whether to apply hysteresis
 * @returns {import('../types').SignalScore} Complete signal score
 */
function generateSignalScore(signals, regime, options = {}) {
  const startTime = Date.now();

  try {
    const thresholds = config.scoring.thresholds;
    
    // Calculate raw score
    const score = calculateScore(signals, regime, options);
    
    // Determine quality
    const quality = determineQuality(signals, score);
    
    // Determine direction (with or without hysteresis)
    let direction;
    if (options.useHysteresis && options.prevDirection) {
      direction = applyDirectionHysteresis(score, options.prevDirection, thresholds);
    } else {
      direction = determineDirection(score, thresholds);
    }
    
    // Calculate confidence
    const confidence = calculateConfidence(score, quality);

    // Determine signal strength
    let strength;
    if (Math.abs(score) > thresholds.strong) {
      strength = 'strong';
    } else if (Math.abs(score) > thresholds.medium) {
      strength = 'medium';
    } else if (Math.abs(score) > thresholds.weak) {
      strength = 'weak';
    } else {
      strength = 'none';
    }

    const result = {
      score,
      quality,
      direction,
      confidence,
      strength,
      components: { ...signals },
      regime,
      timestamp: new Date()
    };

    const duration = Date.now() - startTime;
    logger.performance('generateSignalScore', duration);
    logger.debug('Signal generated', { 
      score: score.toFixed(3), 
      direction, 
      quality, 
      confidence: confidence.toFixed(2),
      regime 
    });

    return result;

  } catch (error) {
    logger.error('Failed to generate signal score', { error: error.message });
    throw error;
  }
}

/**
 * Get signal strength threshold
 * @param {string} strength - Strength level
 * @returns {number} Threshold value
 */
function getStrengthThreshold(strength) {
  const thresholds = config.scoring.thresholds;
  
  switch (strength) {
    case 'strong':
      return thresholds.strong;
    case 'medium':
      return thresholds.medium;
    case 'weak':
      return thresholds.weak;
    default:
      return 0;
  }
}

/**
 * Compare two signal scores to detect changes
 * @param {Object} current - Current signal score
 * @param {Object} previous - Previous signal score
 * @returns {Object} Change detection result
 */
function detectSignalChange(current, previous) {
  if (!previous) {
    return {
      changed: true,
      reason: 'first_signal',
      directionChanged: true,
      qualityChanged: true
    };
  }

  const directionChanged = current.direction !== previous.direction;
  const qualityChanged = current.quality !== previous.quality;
  const scoreChanged = Math.abs(current.score - previous.score) > 0.1;

  return {
    changed: directionChanged || qualityChanged || scoreChanged,
    directionChanged,
    qualityChanged,
    scoreChanged,
    scoreDelta: current.score - previous.score
  };
}

module.exports = {
  getWeightsByRegime,
  calculateScore,
  determineQuality,
  determineDirection,
  calculateConfidence,
  generateSignalScore,
  applyDirectionHysteresis,
  getStrengthThreshold,
  detectSignalChange
};
