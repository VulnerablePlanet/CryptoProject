/**
 * Candlestick Pattern Detection Module
 * Detects common candlestick patterns for trading signals
 * 
 * Patterns implemented:
 * - Doji: Indecision pattern (small body, long wicks)
 * - Hammer: Bullish reversal (small body at top, long lower wick)
 * - Engulfing: Strong reversal (candle engulfs previous)
 * - Morning Star: 3-candle bullish reversal pattern
 * 
 * @module patterns/candlestickPatterns
 */

const { defaultLogger } = require('../utils/logger');
const logger = defaultLogger.child('CandlestickPatterns');

/**
 * Detect Doji patterns
 * Doji indicates market indecision - open ≈ close
 * 
 * @param {Array} candles - OHLCV candles
 * @param {number} sensitivity - Body to range ratio threshold (default 0.1 = 10%)
 * @returns {Array} Detected Doji patterns
 */
function detectDoji(candles, sensitivity = 0.1) {
  const patterns = [];
  
  candles.forEach((candle, index) => {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    
    if (totalRange === 0) return; // Skip invalid candles
    
    const bodyRatio = bodySize / totalRange;
    
    // Doji: body is very small relative to total range
    if (bodyRatio <= sensitivity) {
      patterns.push({
        index,
        timestamp: candle.timestamp,
        pattern: 'DOJI',
        type: 'NEUTRAL',
        confidence: Math.min(0.95, 0.85 + (sensitivity - bodyRatio) * 2),
        description: 'Market indecision - potential reversal',
        data: {
          bodyRatio: bodyRatio.toFixed(4),
          range: totalRange
        }
      });
    }
  });
  
  return patterns;
}

/**
 * Detect Hammer patterns
 * Hammer: Bullish reversal with small body at top, long lower wick
 * Hanging Man: Same structure but appears in uptrend (bearish)
 * 
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Hammer patterns
 */
function detectHammer(candles) {
  const patterns = [];
  
  candles.forEach((candle, index) => {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    
    if (totalRange === 0) return;
    
    // Hammer criteria:
    // 1. Lower wick is at least 2x body size
    // 2. Upper wick is very small (< 10% of total range)
    // 3. Body is in upper 1/3 of range
    
    const bodyPosition = (Math.min(candle.open, candle.close) - candle.low) / totalRange;
    
    if (lowerWick >= bodySize * 2 && 
        upperWick < totalRange * 0.1 && 
        bodyPosition > 0.6) {
      
      // Determine if bullish or bearish based on trend context
      // For now, default to bullish reversal
      const isBullish = index > 0 ? candles[index - 1].close < candle.close : true;
      
      patterns.push({
        index,
        timestamp: candle.timestamp,
        pattern: isBullish ? 'HAMMER' : 'HANGING_MAN',
        type: isBullish ? 'BULLISH_REVERSAL' : 'BEARISH_REVERSAL',
        confidence: 0.85,
        description: isBullish ? 
          'Bullish reversal - buying pressure overcame selling' : 
          'Bearish reversal - rejection of higher prices',
        data: {
          lowerWickRatio: (lowerWick / totalRange).toFixed(2),
          bodySize: bodySize.toFixed(2)
        }
      });
    }
  });
  
  return patterns;
}

/**
 * Detect Engulfing patterns
 * Bullish: Small bearish candle followed by larger bullish that engulfs it
 * Bearish: Small bullish candle followed by larger bearish that engulfs it
 * 
 * @param {Array} candles - OHLCV candles
 * @returns {Array} Detected Engulfing patterns
 */
function detectEngulfing(candles) {
  const patterns = [];
  
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    
    const prevIsBearish = prev.close < prev.open;
    const currIsBullish = curr.close > curr.open;
    
    const prevBody = Math.abs(prev.close - prev.open);
    const currBody = Math.abs(curr.close - curr.open);
    
    // Bullish Engulfing
    if (prevIsBearish && currIsBullish) {
      // Current candle's body must engulf previous candle's body
      if (curr.open <= prev.close && curr.close >= prev.open) {
        // Stronger signal if current body is significantly larger
        const sizeRatio = currBody / prevBody;
        
        patterns.push({
          index: i,
          timestamp: curr.timestamp,
          pattern: 'BULLISH_ENGULFING',
          type: 'BULLISH_REVERSAL',
          confidence: Math.min(0.95, 0.75 + (sizeRatio - 1) * 0.1),
          description: 'Strong bullish reversal - buyers took control',
          data: {
            sizeRatio: sizeRatio.toFixed(2),
            prevClose: prev.close,
            currClose: curr.close
          }
        });
      }
    }
    
    // Bearish Engulfing
    if (!prevIsBearish && !currIsBullish) {
      if (curr.open >= prev.close && curr.close <= prev.open) {
        const sizeRatio = currBody / prevBody;
        
        patterns.push({
          index: i,
          timestamp: curr.timestamp,
          pattern: 'BEARISH_ENGULFING',
          type: 'BEARISH_REVERSAL',
          confidence: Math.min(0.95, 0.75 + (sizeRatio - 1) * 0.1),
          description: 'Strong bearish reversal - sellers took control',
          data: {
            sizeRatio: sizeRatio.toFixed(2),
            prevClose: prev.close,
            currClose: curr.close
          }
        });
      }
    }
  }
  
  return patterns;
}

/**
 * Detect Morning Star / Evening Star patterns
 * Morning Star: 3-candle bullish reversal (large bearish, small gap down, large bullish)
 * Evening Star: 3-candle bearish reversal (large bullish, small gap up, large bearish)
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
    
    // Morning Star Detection
    if (firstIsBearish && lastIsBullish) {
      // 1. First candle: large bearish
      // 2. Middle candle: small body (star), gaps down
      // 3. Last candle: large bullish, closes above middle of first candle
      
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
          description: '3-candle bullish reversal - strong trend change',
          data: {
            hasGap,
            penetration: ((last.close - first.open) / firstBody).toFixed(2)
          }
        });
      }
    }
    
    // Evening Star Detection
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
          description: '3-candle bearish reversal - strong trend change',
          data: {
            hasGap,
            penetration: ((first.open - last.close) / firstBody).toFixed(2)
          }
        });
      }
    }
  }
  
  return patterns;
}

/**
 * Scan all patterns in recent candles
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
  
  // Get recent candles
  const recentCandles = candles.slice(-lookback);
  
  // Detect all pattern types
  const doji = detectDoji(recentCandles);
  const hammer = detectHammer(recentCandles);
  const engulfing = detectEngulfing(recentCandles);
  const stars = detectMorningStar(recentCandles);
  
  // Combine all patterns
  const allPatterns = [...doji, ...hammer, ...engulfing, ...stars];
  
  // Sort by timestamp (most recent first)
  allPatterns.sort((a, b) => b.timestamp - a.timestamp);
  
  // Calculate summary
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

module.exports = {
  detectDoji,
  detectHammer,
  detectEngulfing,
  detectMorningStar,
  scanAllPatterns
};
