/**
 * ============================================================================
 * PRICE ACTION PATTERNS - Phase 4
 * ============================================================================
 * Detect candlestick patterns for price action analysis.
 *
 * All pattern detection logic is imported from the canonical source at
 * `server/talib/patterns/candlestickPatterns.js`. This file provides:
 *   1. Convenience wrappers that add trend context to single-candle checks
 *   2. Batch analysis with price-action-specific output formatting
 */

const {
  getCandleMetrics,
  isDoji,
  isHammer,
  isShootingStar,
  isInvertedHammer,
  isEngulfing,
  isPinBar
} = require('../../talib/patterns/candlestickPatterns');

// Re-export getCandleMetrics for consumers
module.exports.getCandleMetrics = getCandleMetrics;

// ---------------------------------------------------------------------------
// Convenience wrappers (add trend context to canonical checks)
// ---------------------------------------------------------------------------

/**
 * Detect Doji pattern (indecision).
 * Wraps canonical `isDoji` with price-action output format.
 */
function detectDoji(candle) {
  const result = isDoji(candle);
  if (!result) return null;

  return {
    pattern: 'doji',
    type: result.type,
    confidence: result.confidence,
    direction: 'NEUTRAL',
    description: `Doji (${result.type}) indicates market indecision`
  };
}

/**
 * Detect Hammer or Hanging Man.
 * Wraps canonical `isHammer` with trend context.
 */
function detectHammer(candle, trend = null) {
  if (!isHammer(candle)) return null;

  const isHangingMan = trend === 'up';
  const pattern = isHangingMan ? 'hanging_man' : 'hammer';

  return {
    pattern,
    confidence: 0.75,
    direction: isHangingMan ? 'SHORT' : 'LONG',
    description: isHangingMan
      ? 'Hanging Man: potential bearish reversal after uptrend'
      : 'Hammer: potential bullish reversal after downtrend'
  };
}

/**
 * Detect Inverted Hammer or Shooting Star.
 * Wraps canonical `isShootingStar` / `isInvertedHammer` with trend context.
 */
function detectInvertedHammer(candle, trend = null) {
  if (!isShootingStar(candle)) return null;

  const isShootingStarPattern = trend === 'up';
  const pattern = isShootingStarPattern ? 'shooting_star' : 'inverted_hammer';

  return {
    pattern,
    confidence: 0.7,
    direction: isShootingStarPattern ? 'SHORT' : 'LONG',
    description: isShootingStarPattern
      ? 'Shooting Star: potential bearish reversal signal'
      : 'Inverted Hammer: potential bullish reversal signal'
  };
}

/**
 * Detect Bullish or Bearish Engulfing.
 * Wraps canonical `isEngulfing`.
 */
function detectEngulfing(current, previous) {
  if (!previous) return null;

  const direction = isEngulfing(previous, current);
  if (!direction) return null;

  return {
    pattern: direction === 'bullish' ? 'bullish_engulfing' : 'bearish_engulfing',
    confidence: 0.8,
    direction: direction === 'bullish' ? 'LONG' : 'SHORT',
    description: direction === 'bullish'
      ? 'Bullish Engulfing: strong reversal signal, buyers taking control'
      : 'Bearish Engulfing: strong reversal signal, sellers taking control'
  };
}

/**
 * Detect Pin Bar (rejection candle).
 * Wraps canonical `isPinBar`.
 */
function detectPinBar(candle) {
  const direction = isPinBar(candle);
  if (!direction) return null;

  return {
    pattern: direction === 'bullish' ? 'bullish_pin_bar' : 'bearish_pin_bar',
    confidence: 0.75,
    direction: direction === 'bullish' ? 'LONG' : 'SHORT',
    description: direction === 'bullish'
      ? 'Bullish Pin Bar: strong rejection of lower prices'
      : 'Bearish Pin Bar: strong rejection of higher prices'
  };
}

// ---------------------------------------------------------------------------
// Batch analysis
// ---------------------------------------------------------------------------

/**
 * Detect all patterns for a single candle.
 */
const detectPatterns = (candle, previous = null, trend = null) => {
  const patterns = [];

  const doji = detectDoji(candle);
  if (doji) patterns.push(doji);

  const hammer = detectHammer(candle, trend);
  if (hammer) patterns.push(hammer);

  const inverted = detectInvertedHammer(candle, trend);
  if (inverted) patterns.push(inverted);

  const pinbar = detectPinBar(candle);
  if (pinbar) patterns.push(pinbar);

  if (previous) {
    const engulfing = detectEngulfing(candle, previous);
    if (engulfing) patterns.push(engulfing);
  }

  return patterns;
};

/**
 * Analyze candles array for patterns with trend context.
 */
const analyzePatterns = (candles, lookback = 20) => {
  if (!candles || candles.length < 2) return [];

  const results = [];
  const start = Math.max(0, candles.length - lookback);

  const getTrend = (index) => {
    if (index < 5) return null;
    const recent5 = candles.slice(index - 5, index);
    const firstClose = recent5[0].close;
    const lastClose = recent5[recent5.length - 1].close;
    return lastClose > firstClose ? 'up' : 'down';
  };

  for (let i = start; i < candles.length; i++) {
    const trend = getTrend(i);
    const patterns = detectPatterns(candles[i], candles[i - 1], trend);

    if (patterns.length > 0) {
      results.push({
        index: i,
        timestamp: candles[i].timestamp,
        candle: candles[i],
        patterns
      });
    }
  }

  return results;
};

/**
 * Get pattern summary for recent candles.
 */
const getPatternSummary = (candles) => {
  const analysis = analyzePatterns(candles);

  const summary = {
    totalPatterns: 0,
    bullishPatterns: 0,
    bearishPatterns: 0,
    neutralPatterns: 0,
    recentPatterns: [],
    patternCounts: {}
  };

  for (const result of analysis) {
    for (const pattern of result.patterns) {
      summary.totalPatterns++;
      summary.patternCounts[pattern.pattern] = (summary.patternCounts[pattern.pattern] || 0) + 1;

      if (pattern.direction === 'LONG') summary.bullishPatterns++;
      else if (pattern.direction === 'SHORT') summary.bearishPatterns++;
      else summary.neutralPatterns++;
    }
  }

  summary.recentPatterns = analysis.slice(-5).reverse();

  return summary;
};

module.exports = {
  getCandleMetrics,
  detectDoji,
  detectHammer,
  detectInvertedHammer,
  detectEngulfing,
  detectPinBar,
  detectPatterns,
  analyzePatterns,
  getPatternSummary
};
