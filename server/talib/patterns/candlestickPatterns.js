/**
 * Candlestick Pattern Detection Module
 * Detects common candlestick patterns for trading signals.
 *
 * This is the CANONICAL implementation — all other pattern detection code
 * (server/trading/patterns/, server/trading/priceAction/) should import
 * from here rather than re-implementing pattern logic.
 *
 * Patterns implemented:
 * - Doji (standard, dragonfly, gravestone, long_legged)
 * - Hammer / Hanging Man
 * - Engulfing (bullish / bearish)
 * - Morning Star / Evening Star
 * - Harami (bullish / bearish)
 * - Shooting Star / Inverted Hammer
 * - Pin Bar (bullish / bearish)
 *
 * @module patterns/candlestickPatterns
 */

const { defaultLogger } = require('../utils/logger');
const logger = defaultLogger.child('CandlestickPatterns');

// ============================================================================
// Helpers — shared utilities for pattern detection
// ============================================================================

/**
 * Get standard candle metrics (body, wicks, ratios).
 * Used by both batch detectors and single-candle check functions.
 */
function getCandleMetrics(candle) {
  const body = Math.abs(candle.close - candle.open);
  const totalRange = candle.high - candle.low;
  const isBullish = candle.close > candle.open;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;

  return {
    body,
    totalRange,
    isBullish,
    upperWick,
    lowerWick,
    bodyRatio: totalRange > 0 ? body / totalRange : 0,
    upperWickRatio: totalRange > 0 ? upperWick / totalRange : 0,
    lowerWickRatio: totalRange > 0 ? lowerWick / totalRange : 0,
    bodyPosition: totalRange > 0 ? (Math.min(candle.open, candle.close) - candle.low) / totalRange : 0
  };
}

// ============================================================================
// Single-Candle Check Functions (for import by other modules)
// ============================================================================

/**
 * Check if a single candle is a Doji.
 * @param {object} candle - OHLC candle
 * @param {number} sensitivity - Body/range ratio threshold (default 0.1)
 * @returns {object|null} {type, confidence} or null
 */
function isDoji(candle, sensitivity = 0.1) {
  const m = getCandleMetrics(candle);
  if (m.totalRange === 0 || m.bodyRatio > sensitivity) return null;

  let type = 'standard';
  if (m.lowerWickRatio > 0.3 && m.upperWickRatio > 0.3) type = 'long_legged';
  else if (m.lowerWickRatio > 0.6 && m.upperWickRatio < 0.1) type = 'dragonfly';
  else if (m.upperWickRatio > 0.6 && m.lowerWickRatio < 0.1) type = 'gravestone';

  return {
    type,
    confidence: m.bodyRatio < 0.05 ? 0.9 : 0.7
  };
}

/**
 * Check if a single candle is a Hammer (or Hanging Man in uptrend).
 * @param {object} candle - OHLC candle
 * @param {boolean} inDowntrend - Optional trend context
 * @returns {boolean}
 */
function isHammer(candle, inDowntrend = true) {
  const m = getCandleMetrics(candle);
  if (m.totalRange === 0 || m.body === 0) return false;
  return (
    m.lowerWick >= m.body * 2 &&
    m.upperWick < m.body * 0.5 &&
    m.bodyRatio < 0.4
  );
}

/**
 * Check if a single candle is a Shooting Star (bearish reversal at top).
 * @param {object} candle - OHLC candle
 * @param {boolean} inUptrend - Optional trend context
 * @returns {boolean}
 */
function isShootingStar(candle, inUptrend = true) {
  const m = getCandleMetrics(candle);
  if (m.totalRange === 0 || m.body === 0) return false;
  return (
    m.upperWick >= m.body * 2 &&
    m.lowerWick < m.body * 0.5 &&
    m.bodyRatio < 0.4
  );
}

/**
 * Check if a single candle is an Inverted Hammer (bullish reversal at bottom).
 * @param {object} candle - OHLC candle
 * @param {boolean} inDowntrend - Optional trend context
 * @returns {boolean}
 */
function isInvertedHammer(candle, inDowntrend = true) {
  // Same shape as Shooting Star but in downtrend
  return isShootingStar(candle);
}

/**
 * Check if two consecutive candles form an Engulfing pattern.
 * @param {object} prev - Previous candle
 * @param {object} curr - Current candle
 * @returns {string|null} 'bullish', 'bearish', or null
 */
function isEngulfing(prev, curr) {
  if (!prev || !curr) return null;
  const pm = getCandleMetrics(prev);
  const cm = getCandleMetrics(curr);
  if (pm.isBullish === cm.isBullish) return null;    // need opposite colors
  if (cm.body <= pm.body) return null;                // current must be larger

  const currBodyHigh = Math.max(curr.open, curr.close);
  const currBodyLow = Math.min(curr.open, curr.close);
  const prevBodyHigh = Math.max(prev.open, prev.close);
  const prevBodyLow = Math.min(prev.open, prev.close);

  if (currBodyHigh >= prevBodyHigh && currBodyLow <= prevBodyLow) {
    return cm.isBullish ? 'bullish' : 'bearish';
  }
  return null;
}

/**
 * Check if two consecutive candles form a Harami pattern.
 * @param {object} prev - Previous candle
 * @param {object} curr - Current candle
 * @returns {string|null} 'bullish', 'bearish', or null
 */
function isHarami(prev, curr) {
  if (!prev || !curr) return null;
  const pm = getCandleMetrics(prev);
  const cm = getCandleMetrics(curr);
  if (pm.isBullish === cm.isBullish) return null;    // need opposite colors
  if (cm.body >= pm.body * 0.5) return null;         // current must be < 50% of prev

  const prevBodyHigh = Math.max(prev.open, prev.close);
  const prevBodyLow = Math.min(prev.open, prev.close);

  // Current body must be within prev body
  if (curr.open > prevBodyLow && curr.close < prevBodyHigh ||
      curr.open < prevBodyHigh && curr.close > prevBodyLow) {
    return cm.isBullish ? 'bullish' : 'bearish';
  }
  return null;
}

/**
 * Check if a single candle is a Pin Bar (strong rejection wick).
 * @param {object} candle - OHLC candle
 * @returns {string|null} 'bullish', 'bearish', or null
 */
function isPinBar(candle) {
  const m = getCandleMetrics(candle);
  if (m.bodyRatio >= 0.33) return null;  // body too large

  if (m.lowerWickRatio > 0.66) return 'bullish';
  if (m.upperWickRatio > 0.66) return 'bearish';
  return null;
}

// ============================================================================
// Batch Detectors — iterate candle arrays and return pattern records
// ============================================================================

/**
 * Detect Doji patterns in an array of candles.
 * Now includes dragonfly, gravestone, and long_legged subtypes.
 *
 * @param {Array} candles - OHLCV candles
 * @param {number} sensitivity - Body to range ratio threshold (default 0.1)
 * @returns {Array} Detected Doji patterns
 */
function detectDoji(candles, sensitivity = 0.1) {
  const patterns = [];

  candles.forEach((candle, index) => {
    const doji = isDoji(candle, sensitivity);
    if (!doji) return;

    const m = getCandleMetrics(candle);
    patterns.push({
      index,
      timestamp: candle.timestamp,
      pattern: 'DOJI',
      subtype: doji.type,
      type: 'NEUTRAL',
      confidence: doji.confidence,
      description: `Doji (${doji.type}) — market indecision`,
      data: {
        bodyRatio: m.bodyRatio.toFixed(4),
        range: m.totalRange
      }
    });
  });

  return patterns;
}

/**
 * Detect Hammer / Hanging Man patterns.
 *
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Hammer/Hanging Man patterns
 */
function detectHammer(candles) {
  const patterns = [];

  candles.forEach((candle, index) => {
    const m = getCandleMetrics(candle);
    if (m.totalRange === 0) return;

    if (m.lowerWick >= m.body * 2 &&
        m.upperWick < m.totalRange * 0.1 &&
        m.bodyPosition > 0.6) {

      const isBullish = index > 0 ? candles[index - 1].close < candle.close : true;

      patterns.push({
        index,
        timestamp: candle.timestamp,
        pattern: isBullish ? 'HAMMER' : 'HANGING_MAN',
        type: isBullish ? 'BULLISH_REVERSAL' : 'BEARISH_REVERSAL',
        confidence: 0.85,
        description: isBullish ?
          'Bullish reversal — buying pressure overcame selling' :
          'Bearish reversal — rejection of higher prices',
        data: {
          lowerWickRatio: (m.lowerWick / m.totalRange).toFixed(2),
          bodySize: m.body.toFixed(2)
        }
      });
    }
  });

  return patterns;
}

/**
 * Detect Engulfing patterns (bullish & bearish).
 *
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Engulfing patterns
 */
function detectEngulfing(candles) {
  const patterns = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const direction = isEngulfing(prev, curr);
    if (!direction) continue;

    const currBody = Math.abs(curr.open - curr.close);
    const prevBody = Math.abs(prev.open - prev.close);
    const sizeRatio = currBody / prevBody;

    patterns.push({
      index: i,
      timestamp: curr.timestamp,
      pattern: direction === 'bullish' ? 'BULLISH_ENGULFING' : 'BEARISH_ENGULFING',
      type: direction === 'bullish' ? 'BULLISH_REVERSAL' : 'BEARISH_REVERSAL',
      confidence: Math.min(0.95, 0.75 + (sizeRatio - 1) * 0.1),
      description: direction === 'bullish'
        ? 'Strong bullish reversal — buyers took control'
        : 'Strong bearish reversal — sellers took control',
      data: {
        sizeRatio: sizeRatio.toFixed(2),
        prevClose: prev.close,
        currClose: curr.close
      }
    });
  }

  return patterns;
}

/**
 * Detect Morning Star / Evening Star patterns (3-candle reversals).
 *
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Star patterns
 */
function detectMorningStar(candles) {
  const patterns = [];

  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const middle = candles[i - 1];
    const last = candles[i];

    const firstBody = Math.abs(first.close - first.open);
    const middleBody = Math.abs(middle.close - middle.open);
    const lastBody = Math.abs(last.close - last.open);
    const firstIsBearish = first.close < first.open;
    const lastIsBullish = last.close > last.open;

    // Morning Star
    if (firstIsBearish && lastIsBullish) {
      const isFirstLarge = firstBody > (first.high - first.low) * 0.6;
      const isMiddleSmall = middleBody < firstBody * 0.3;
      const isLastLarge = lastBody > (last.high - last.low) * 0.6;
      const hasGap = middle.high < first.close;
      const closesHigh = last.close > first.open + firstBody * 0.5;

      if (isFirstLarge && isMiddleSmall && isLastLarge && closesHigh) {
        patterns.push({
          index: i,
          timestamp: last.timestamp,
          pattern: 'MORNING_STAR',
          type: 'BULLISH_REVERSAL',
          confidence: hasGap ? 0.92 : 0.85,
          description: '3-candle bullish reversal — strong trend change',
          data: { hasGap, penetration: ((last.close - first.open) / firstBody).toFixed(2) }
        });
      }
    }

    // Evening Star
    if (!firstIsBearish && !lastIsBullish) {
      const isFirstLarge = firstBody > (first.high - first.low) * 0.6;
      const isMiddleSmall = middleBody < firstBody * 0.3;
      const isLastLarge = lastBody > (last.high - last.low) * 0.6;
      const hasGap = middle.low > first.close;
      const closesLow = last.close < first.open - firstBody * 0.5;

      if (isFirstLarge && isMiddleSmall && isLastLarge && closesLow) {
        patterns.push({
          index: i,
          timestamp: last.timestamp,
          pattern: 'EVENING_STAR',
          type: 'BEARISH_REVERSAL',
          confidence: hasGap ? 0.92 : 0.85,
          description: '3-candle bearish reversal — strong trend change',
          data: { hasGap, penetration: ((first.open - last.close) / firstBody).toFixed(2) }
        });
      }
    }
  }

  return patterns;
}

/**
 * Detect Harami patterns (bullish & bearish).
 * Harami: large candle followed by small opposite-color candle contained within.
 *
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Harami patterns
 */
function detectHarami(candles) {
  const patterns = [];

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const direction = isHarami(prev, curr);
    if (!direction) continue;

    const prevBody = Math.abs(prev.open - prev.close);
    const currBody = Math.abs(curr.open - curr.close);

    patterns.push({
      index: i,
      timestamp: curr.timestamp,
      pattern: direction === 'bullish' ? 'BULLISH_HARAMI' : 'BEARISH_HARAMI',
      type: direction === 'bullish' ? 'BULLISH_REVERSAL' : 'BEARISH_REVERSAL',
      confidence: 0.75,
      description: direction === 'bullish'
        ? 'Bullish Harami — potential reversal from downtrend'
        : 'Bearish Harami — potential reversal from uptrend',
      data: {
        prevBody: prevBody.toFixed(2),
        currBody: currBody.toFixed(2),
        ratio: (currBody / prevBody).toFixed(2)
      }
    });
  }

  return patterns;
}

/**
 * Detect Shooting Star patterns (bearish reversal at top).
 *
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Shooting Star patterns
 */
function detectShootingStar(candles) {
  const patterns = [];

  candles.forEach((candle, index) => {
    const m = getCandleMetrics(candle);
    if (!isShootingStar(candle)) return;

    // Shooting Star: long upper wick, small body at bottom
    patterns.push({
      index,
      timestamp: candle.timestamp,
      pattern: 'SHOOTING_STAR',
      type: 'BEARISH_REVERSAL',
      confidence: 0.8,
      description: 'Shooting Star — bearish rejection of higher prices',
      data: {
        upperWickRatio: m.upperWickRatio.toFixed(2),
        bodyRatio: m.bodyRatio.toFixed(2)
      }
    });
  });

  return patterns;
}

/**
 * Detect Inverted Hammer patterns (bullish reversal at bottom).
 *
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Inverted Hammer patterns
 */
function detectInvertedHammer(candles) {
  const patterns = [];

  candles.forEach((candle, index) => {
    const m = getCandleMetrics(candle);
    if (!isInvertedHammer(candle)) return;

    patterns.push({
      index,
      timestamp: candle.timestamp,
      pattern: 'INVERTED_HAMMER',
      type: 'BULLISH_REVERSAL',
      confidence: 0.75,
      description: 'Inverted Hammer — potential bullish reversal signal',
      data: {
        upperWickRatio: m.upperWickRatio.toFixed(2),
        bodyRatio: m.bodyRatio.toFixed(2)
      }
    });
  });

  return patterns;
}

/**
 * Detect Pin Bar patterns (strong price rejection wicks).
 *
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Pin Bar patterns
 */
function detectPinBar(candles) {
  const patterns = [];

  candles.forEach((candle, index) => {
    const direction = isPinBar(candle);
    if (!direction) return;

    const m = getCandleMetrics(candle);
    patterns.push({
      index,
      timestamp: candle.timestamp,
      pattern: direction === 'bullish' ? 'BULLISH_PIN_BAR' : 'BEARISH_PIN_BAR',
      type: direction === 'bullish' ? 'BULLISH_REVERSAL' : 'BEARISH_REVERSAL',
      confidence: 0.75,
      description: direction === 'bullish'
        ? 'Bullish Pin Bar — strong rejection of lower prices'
        : 'Bearish Pin Bar — strong rejection of higher prices',
      data: {
        lowerWickRatio: m.lowerWickRatio.toFixed(2),
        upperWickRatio: m.upperWickRatio.toFixed(2)
      }
    });
  });

  return patterns;
}

// ============================================================================
// Orchestrator — scan all patterns
// ============================================================================

/**
 * Scan all pattern types in recent candles.
 *
 * @param {Array} candles - OHLCV candles
 * @param {number} lookback - Number of recent candles to scan (default 50)
 * @returns {Object} All detected patterns with summary
 */
function scanAllPatterns(candles, lookback = 50) {
  const startTime = Date.now();

  if (!candles || candles.length < 3) {
    logger.warn('Insufficient candles for pattern detection', { count: candles?.length });
    return {
      patterns: [],
      summary: { total: 0, bullish: 0, bearish: 0, neutral: 0 },
      candlesScanned: 0
    };
  }

  const recentCandles = candles.slice(-lookback);

  // Run all detectors
  const allPatterns = [
    ...detectDoji(recentCandles),
    ...detectHammer(recentCandles),
    ...detectEngulfing(recentCandles),
    ...detectMorningStar(recentCandles),
    ...detectHarami(recentCandles),
    ...detectShootingStar(recentCandles),
    ...detectInvertedHammer(recentCandles),
    ...detectPinBar(recentCandles)
  ];

  // Sort by timestamp, most recent first
  allPatterns.sort((a, b) => b.timestamp - a.timestamp);

  const summary = {
    total: allPatterns.length,
    bullish: allPatterns.filter(p => p.type.includes('BULLISH')).length,
    bearish: allPatterns.filter(p => p.type.includes('BEARISH')).length,
    neutral: allPatterns.filter(p => p.type === 'NEUTRAL').length
  };

  const duration = Date.now() - startTime;
  logger.performance('scanAllPatterns', duration);
  logger.info('Pattern scan complete', {
    total: summary.total,
    candlesScanned: recentCandles.length
  });

  return {
    patterns: allPatterns,
    summary,
    candlesScanned: recentCandles.length,
    timestamp: new Date(),
    performance: duration
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Single-candle check functions (for import by other modules)
  getCandleMetrics,
  isDoji,
  isHammer,
  isShootingStar,
  isInvertedHammer,
  isEngulfing,
  isHarami,
  isPinBar,

  // Batch detectors (return arrays of pattern records)
  detectDoji,
  detectHammer,
  detectEngulfing,
  detectMorningStar,
  detectHarami,
  detectShootingStar,
  detectInvertedHammer,
  detectPinBar,

  // Orchestrator
  scanAllPatterns
};
