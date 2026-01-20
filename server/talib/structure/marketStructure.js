/**
 * Market Structure Module (Smart Money Concepts)
 * Institutional-grade market structure analysis
 * 
 * Features:
 * - Break of Structure (BOS) detection
 * - Change of Character (CHOCH) detection
 * - Fair Value Gap (FVG) identification
 * - Liquidity Sweep detection
 * - Equal Highs/Lows identification
 * - Market bias determination
 * 
 * @module structure/marketStructure
 */

const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('MarketStructure');

/**
 * Find swing highs and lows in price data
 * @param {Object[]} candles - OHLCV candles
 * @param {number} lookback - Bars to look left/right for swing validation
 * @returns {Object} Swing highs and lows with indices
 */
function findSwingPoints(candles, lookback = 3) {
  const swingHighs = [];
  const swingLows = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    // Check left and right bars
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= current.high || candles[i + j].high >= current.high) {
        isSwingHigh = false;
      }
      if (candles[i - j].low <= current.low || candles[i + j].low <= current.low) {
        isSwingLow = false;
      }
    }

    if (isSwingHigh) {
      swingHighs.push({
        index: i,
        price: current.high,
        timestamp: current.timestamp
      });
    }

    if (isSwingLow) {
      swingLows.push({
        index: i,
        price: current.low,
        timestamp: current.timestamp
      });
    }
  }

  return { swingHighs, swingLows };
}

/**
 * Detect Break of Structure (BOS) patterns
 * BOS occurs when price breaks a significant swing high/low in trend direction
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - Detection parameters
 * @returns {import('../types').StructureBreak[]} Detected BOS events
 */
function detectBOS(candles, params = {}) {
  const {
    minBreakPercent = config.structure.bos.minBreakPercent,
    confirmationCandles = config.structure.bos.confirmationCandles,
    lookback = 5
  } = params;

  try {
    const breaks = [];
    const { swingHighs, swingLows } = findSwingPoints(candles, lookback);

    // Check for bullish BOS (break above swing high)
    for (const swing of swingHighs) {
      for (let i = swing.index + 1; i < candles.length; i++) {
        const candle = candles[i];
        const breakAmount = (candle.close - swing.price) / swing.price;

        if (breakAmount > minBreakPercent) {
          // Confirm with subsequent candles
          let confirmed = true;
          for (let j = 1; j <= confirmationCandles && i + j < candles.length; j++) {
            if (candles[i + j].close < swing.price) {
              confirmed = false;
              break;
            }
          }

          if (confirmed) {
            breaks.push({
              type: 'bos',
              direction: 'bullish',
              price: swing.price,
              breakPrice: candle.close,
              timestamp: candle.timestamp,
              index: i,
              strength: Math.min(1, breakAmount * 10)
            });
            break; // Only count first break of this swing
          }
        }
      }
    }

    // Check for bearish BOS (break below swing low)
    for (const swing of swingLows) {
      for (let i = swing.index + 1; i < candles.length; i++) {
        const candle = candles[i];
        const breakAmount = (swing.price - candle.close) / swing.price;

        if (breakAmount > minBreakPercent) {
          let confirmed = true;
          for (let j = 1; j <= confirmationCandles && i + j < candles.length; j++) {
            if (candles[i + j].close > swing.price) {
              confirmed = false;
              break;
            }
          }

          if (confirmed) {
            breaks.push({
              type: 'bos',
              direction: 'bearish',
              price: swing.price,
              breakPrice: candle.close,
              timestamp: candle.timestamp,
              index: i,
              strength: Math.min(1, breakAmount * 10)
            });
            break;
          }
        }
      }
    }

    logger.debug('BOS detection complete', { count: breaks.length });
    return breaks.sort((a, b) => a.index - b.index);

  } catch (error) {
    logger.error('BOS detection failed', { error: error.message });
    throw error;
  }
}

/**
 * Detect Change of Character (CHOCH)
 * CHOCH is first break against the trend, signaling potential reversal
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - Detection parameters
 * @returns {import('../types').StructureBreak[]} Detected CHOCH events
 */
function detectCHOCH(candles, params = {}) {
  const {
    lookback = 20
  } = params;

  try {
    const chochs = [];
    const bosEvents = detectBOS(candles, params);

    // Determine prevailing trend from recent BOS events
    let prevailingTrend = null;
    let trendStartIndex = 0;

    for (let i = 0; i < bosEvents.length; i++) {
      const bos = bosEvents[i];
      
      if (prevailingTrend === null) {
        prevailingTrend = bos.direction;
        trendStartIndex = bos.index;
      } else if (bos.direction !== prevailingTrend) {
        // This is a CHOCH - first break against trend
        chochs.push({
          type: 'choch',
          direction: bos.direction,
          price: bos.price,
          breakPrice: bos.breakPrice,
          timestamp: bos.timestamp,
          index: bos.index,
          strength: bos.strength * 1.2, // CHOCH is more significant
          previousTrend: prevailingTrend
        });
        
        // Reset trend
        prevailingTrend = bos.direction;
        trendStartIndex = bos.index;
      }
    }

    logger.debug('CHOCH detection complete', { count: chochs.length });
    return chochs;

  } catch (error) {
    logger.error('CHOCH detection failed', { error: error.message });
    throw error;
  }
}

/**
 * Detect Fair Value Gaps (FVG)
 * FVG is a 3-candle pattern where the wicks don't overlap
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - Detection parameters
 * @returns {import('../types').FairValueGap[]} Detected FVGs
 */
function detectFVG(candles, params = {}) {
  const {
    minGapPercent = config.structure.fvg.minGapPercent,
    maxCandlesAgo = config.structure.fvg.maxCandlesAgo
  } = params;

  try {
    const fvgs = [];
    const startIndex = Math.max(0, candles.length - maxCandlesAgo);

    for (let i = startIndex + 2; i < candles.length; i++) {
      const candle1 = candles[i - 2];
      const candle2 = candles[i - 1];
      const candle3 = candles[i];

      // Bullish FVG: candle1.high < candle3.low (gap up)
      if (candle3.low > candle1.high) {
        const gapSize = (candle3.low - candle1.high) / candle1.high;
        
        if (gapSize >= minGapPercent) {
          // Check if gap has been filled
          let filled = false;
          let fillPercent = 0;
          
          for (let j = i + 1; j < candles.length; j++) {
            if (candles[j].low <= candle1.high) {
              filled = true;
              fillPercent = 1;
              break;
            } else if (candles[j].low < candle3.low) {
              fillPercent = Math.max(fillPercent, 
                (candle3.low - candles[j].low) / (candle3.low - candle1.high));
            }
          }

          fvgs.push({
            direction: 'bullish',
            high: candle3.low,
            low: candle1.high,
            midpoint: (candle3.low + candle1.high) / 2,
            gapPercent: gapSize,
            created: candle3.timestamp,
            index: i,
            filled,
            fillPercent: Math.min(1, fillPercent)
          });
        }
      }

      // Bearish FVG: candle1.low > candle3.high (gap down)
      if (candle1.low > candle3.high) {
        const gapSize = (candle1.low - candle3.high) / candle1.low;
        
        if (gapSize >= minGapPercent) {
          let filled = false;
          let fillPercent = 0;
          
          for (let j = i + 1; j < candles.length; j++) {
            if (candles[j].high >= candle1.low) {
              filled = true;
              fillPercent = 1;
              break;
            } else if (candles[j].high > candle3.high) {
              fillPercent = Math.max(fillPercent,
                (candles[j].high - candle3.high) / (candle1.low - candle3.high));
            }
          }

          fvgs.push({
            direction: 'bearish',
            high: candle1.low,
            low: candle3.high,
            midpoint: (candle1.low + candle3.high) / 2,
            gapPercent: gapSize,
            created: candle3.timestamp,
            index: i,
            filled,
            fillPercent: Math.min(1, fillPercent)
          });
        }
      }
    }

    logger.debug('FVG detection complete', { 
      total: fvgs.length,
      unfilled: fvgs.filter(f => !f.filled).length
    });
    
    return fvgs;

  } catch (error) {
    logger.error('FVG detection failed', { error: error.message });
    throw error;
  }
}

/**
 * Detect Liquidity Sweeps
 * Occurs when price briefly breaks a level then reverses (stops hunt)
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - Detection parameters
 * @returns {import('../types').LiquiditySweep[]} Detected sweeps
 */
function detectLiquiditySweeps(candles, params = {}) {
  const {
    wickMultiplier = config.structure.liquiditySweep.wickMultiplier,
    rejectionCandles = config.structure.liquiditySweep.rejectionCandles,
    lookback = 5
  } = params;

  try {
    const sweeps = [];
    const { swingHighs, swingLows } = findSwingPoints(candles, lookback);

    // Check for high sweeps (price breaks above then reverses)
    for (const swing of swingHighs) {
      for (let i = swing.index + 1; i < candles.length; i++) {
        const candle = candles[i];
        
        // Check if wick swept the high
        if (candle.high > swing.price && candle.close < swing.price) {
          const body = Math.abs(candle.close - candle.open);
          const upperWick = candle.high - Math.max(candle.open, candle.close);
          
          // Verify significant wick (stops hunt signature)
          if (body > 0 && upperWick >= body * wickMultiplier) {
            // Check for rejection in following candles
            let rejected = true;
            for (let j = 1; j <= rejectionCandles && i + j < candles.length; j++) {
              if (candles[i + j].close > swing.price) {
                rejected = false;
                break;
              }
            }

            if (rejected) {
              sweeps.push({
                side: 'high',
                level: swing.price,
                sweepPrice: candle.high,
                timestamp: candle.timestamp,
                index: i,
                rejection: true,
                wickRatio: upperWick / body
              });
              break;
            }
          }
        }
      }
    }

    // Check for low sweeps
    for (const swing of swingLows) {
      for (let i = swing.index + 1; i < candles.length; i++) {
        const candle = candles[i];
        
        if (candle.low < swing.price && candle.close > swing.price) {
          const body = Math.abs(candle.close - candle.open);
          const lowerWick = Math.min(candle.open, candle.close) - candle.low;
          
          if (body > 0 && lowerWick >= body * wickMultiplier) {
            let rejected = true;
            for (let j = 1; j <= rejectionCandles && i + j < candles.length; j++) {
              if (candles[i + j].close < swing.price) {
                rejected = false;
                break;
              }
            }

            if (rejected) {
              sweeps.push({
                side: 'low',
                level: swing.price,
                sweepPrice: candle.low,
                timestamp: candle.timestamp,
                index: i,
                rejection: true,
                wickRatio: lowerWick / body
              });
              break;
            }
          }
        }
      }
    }

    logger.debug('Liquidity sweep detection complete', { count: sweeps.length });
    return sweeps.sort((a, b) => a.index - b.index);

  } catch (error) {
    logger.error('Liquidity sweep detection failed', { error: error.message });
    throw error;
  }
}

/**
 * Find equal highs and lows (liquidity pools)
 * @param {Object[]} candles - OHLCV candles
 * @param {number} tolerance - Price tolerance for "equal" (0.001 = 0.1%)
 * @returns {Object} Equal highs and lows
 */
function findEqualLevels(candles, tolerance = 0.001) {
  const { swingHighs, swingLows } = findSwingPoints(candles);
  
  const equalHighs = [];
  const equalLows = [];

  // Find equal highs
  for (let i = 0; i < swingHighs.length; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const diff = Math.abs(swingHighs[i].price - swingHighs[j].price) / swingHighs[i].price;
      if (diff <= tolerance) {
        equalHighs.push({
          price: (swingHighs[i].price + swingHighs[j].price) / 2,
          indices: [swingHighs[i].index, swingHighs[j].index],
          timestamps: [swingHighs[i].timestamp, swingHighs[j].timestamp]
        });
      }
    }
  }

  // Find equal lows
  for (let i = 0; i < swingLows.length; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const diff = Math.abs(swingLows[i].price - swingLows[j].price) / swingLows[i].price;
      if (diff <= tolerance) {
        equalLows.push({
          price: (swingLows[i].price + swingLows[j].price) / 2,
          indices: [swingLows[i].index, swingLows[j].index],
          timestamps: [swingLows[i].timestamp, swingLows[j].timestamp]
        });
      }
    }
  }

  return { equalHighs, equalLows };
}

/**
 * Determine overall market bias from structure
 * @param {Object[]} candles - OHLCV candles
 * @returns {Object} Market bias analysis
 */
function determineMarketBias(candles) {
  try {
    const bosEvents = detectBOS(candles);
    const chochEvents = detectCHOCH(candles);
    const fvgs = detectFVG(candles);
    const sweeps = detectLiquiditySweeps(candles);

    // Count recent events (last 20 candles)
    const recentIndex = candles.length - 20;
    
    const recentBOS = bosEvents.filter(b => b.index >= recentIndex);
    const bullishBOS = recentBOS.filter(b => b.direction === 'bullish').length;
    const bearishBOS = recentBOS.filter(b => b.direction === 'bearish').length;

    const unfilledFVGs = fvgs.filter(f => !f.filled && f.index >= recentIndex);
    const bullishFVGs = unfilledFVGs.filter(f => f.direction === 'bullish');
    const bearishFVGs = unfilledFVGs.filter(f => f.direction === 'bearish');

    // Calculate bias score
    let biasScore = 0;
    biasScore += (bullishBOS - bearishBOS) * 0.4;
    biasScore += (bullishFVGs.length - bearishFVGs.length) * 0.2;
    
    // Recent CHOCH is significant
    if (chochEvents.length > 0) {
      const lastCHOCH = chochEvents[chochEvents.length - 1];
      if (lastCHOCH.index >= recentIndex) {
        biasScore += lastCHOCH.direction === 'bullish' ? 0.4 : -0.4;
      }
    }

    let bias;
    if (biasScore > 0.3) {
      bias = 'bullish';
    } else if (biasScore < -0.3) {
      bias = 'bearish';
    } else {
      bias = 'neutral';
    }

    return {
      bias,
      biasScore,
      confidence: Math.min(1, Math.abs(biasScore)),
      bullishBOS,
      bearishBOS,
      unfilledBullishFVGs: bullishFVGs.length,
      unfilledBearishFVGs: bearishFVGs.length,
      recentCHOCH: chochEvents.length > 0 ? chochEvents[chochEvents.length - 1] : null
    };

  } catch (error) {
    logger.error('Market bias determination failed', { error: error.message });
    throw error;
  }
}

/**
 * Complete market structure analysis
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - Analysis parameters
 * @returns {import('../types').MarketStructure} Complete structure analysis
 */
function analyzeMarketStructure(candles, params = {}) {
  const startTime = Date.now();

  try {
    const bosEvents = detectBOS(candles, params);
    const chochEvents = detectCHOCH(candles, params);
    const fvgs = detectFVG(candles, params);
    const sweeps = detectLiquiditySweeps(candles, params);
    const { equalHighs, equalLows } = findEqualLevels(candles);
    const bias = determineMarketBias(candles);

    const result = {
      breaks: [...bosEvents, ...chochEvents].sort((a, b) => a.index - b.index),
      bos: bosEvents,
      choch: chochEvents,
      fvgs,
      unfilledFVGs: fvgs.filter(f => !f.filled),
      sweeps,
      equalHighs,
      equalLows,
      bias: bias.bias,
      biasConfidence: bias.confidence,
      biasDetails: bias,
      timestamp: new Date(),
      performance: Date.now() - startTime
    };

    logger.info('Market structure analysis complete', {
      bos: bosEvents.length,
      choch: chochEvents.length,
      fvgs: fvgs.length,
      sweeps: sweeps.length,
      bias: result.bias
    });

    return result;

  } catch (error) {
    logger.error('Market structure analysis failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  findSwingPoints,
  detectBOS,
  detectCHOCH,
  detectFVG,
  detectLiquiditySweeps,
  findEqualLevels,
  determineMarketBias,
  analyzeMarketStructure
};
