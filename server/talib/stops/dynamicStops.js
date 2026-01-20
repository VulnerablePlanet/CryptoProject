/**
 * Dynamic Stops & Take Profit Module
 * Institutional-grade stop loss and take profit calculation
 * 
 * Features:
 * - ATR-based stop loss
 * - Volatility-adjusted stops
 * - Structure-based stops (support/resistance)
 * - Dynamic take profit with R:R ratio
 * - Trailing stop management
 * - Time-based exit signals
 * 
 * @module stops/dynamicStops
 */

const { defaultLogger } = require('../utils/logger');
const { calculateATR, calculateRealizedVolatility } = require('../regimes/marketRegime');
const config = require('../config');

const logger = defaultLogger.child('DynamicStops');

/**
 * Calculate ATR-based stop loss and take profit
 * @param {Object[]} candles - OHLCV candles
 * @param {number} entryPrice - Entry price
 * @param {'LONG' | 'SHORT'} direction - Trade direction
 * @param {Object} params - Parameters
 * @returns {import('../types').DynamicStop} Stop/TP levels
 */
function calculateATRStop(candles, entryPrice, direction, params = {}) {
  const {
    stopMultiplier = config.stops.atr.stopMultiplier,
    tpMultiplier = config.stops.atr.tpMultiplier,
    period = config.regime.atr.period
  } = params;

  try {
    const atr = calculateATR(candles, period);
    
    if (!atr || atr <= 0) {
      logger.warn('Invalid ATR, using default 2% stop');
      const defaultStop = entryPrice * 0.02;
      return {
        stopLoss: direction === 'LONG' ? entryPrice - defaultStop : entryPrice + defaultStop,
        takeProfit: direction === 'LONG' ? entryPrice + defaultStop * 1.5 : entryPrice - defaultStop * 1.5,
        riskReward: 1.5,
        method: 'atr',
        distance: 0.02,
        atrValue: atr
      };
    }

    const stopDistance = atr * stopMultiplier;
    const tpDistance = atr * tpMultiplier;

    let stopLoss, takeProfit;
    
    if (direction === 'LONG') {
      stopLoss = entryPrice - stopDistance;
      takeProfit = entryPrice + tpDistance;
    } else {
      stopLoss = entryPrice + stopDistance;
      takeProfit = entryPrice - tpDistance;
    }

    const riskReward = tpMultiplier / stopMultiplier;
    const distancePercent = stopDistance / entryPrice;

    logger.debug('ATR stop calculated', {
      entryPrice,
      direction,
      atr,
      stopLoss: stopLoss.toFixed(8),
      takeProfit: takeProfit.toFixed(8),
      riskReward
    });

    return {
      stopLoss,
      takeProfit,
      riskReward,
      method: 'atr',
      distance: distancePercent,
      atrValue: atr
    };

  } catch (error) {
    logger.error('ATR stop calculation failed', { error: error.message });
    throw error;
  }
}

/**
 * Calculate volatility-adjusted stop loss
 * Widens stops in high volatility, tightens in low volatility
 * @param {Object[]} candles - OHLCV candles
 * @param {number} entryPrice - Entry price
 * @param {'LONG' | 'SHORT'} direction - Trade direction
 * @param {Object} params - Parameters
 * @returns {import('../types').DynamicStop} Stop/TP levels
 */
function calculateVolatilityStop(candles, entryPrice, direction, params = {}) {
  const {
    lowVolMultiplier = config.stops.volatility.lowVolMultiplier,
    highVolMultiplier = config.stops.volatility.highVolMultiplier,
    highVolThreshold = config.regime.volatility.highVolThreshold,
    period = config.regime.volatility.period
  } = params;

  try {
    const volatility = calculateRealizedVolatility(candles, period);
    
    // Determine multiplier based on volatility
    let multiplier;
    if (volatility >= highVolThreshold) {
      multiplier = highVolMultiplier;
      logger.debug('High volatility detected', { volatility, multiplier });
    } else {
      // Linear interpolation between low and high
      const volRatio = volatility / highVolThreshold;
      multiplier = lowVolMultiplier + (highVolMultiplier - lowVolMultiplier) * volRatio;
    }

    // Calculate stop distance based on volatility
    const baseDistance = volatility * multiplier;
    const stopDistance = Math.max(baseDistance, 0.005); // Minimum 0.5%
    const tpDistance = stopDistance * 1.5; // 1.5 R:R

    let stopLoss, takeProfit;
    
    if (direction === 'LONG') {
      stopLoss = entryPrice * (1 - stopDistance);
      takeProfit = entryPrice * (1 + tpDistance);
    } else {
      stopLoss = entryPrice * (1 + stopDistance);
      takeProfit = entryPrice * (1 - tpDistance);
    }

    logger.debug('Volatility stop calculated', {
      volatility,
      multiplier,
      stopDistance: (stopDistance * 100).toFixed(2) + '%'
    });

    return {
      stopLoss,
      takeProfit,
      riskReward: 1.5,
      method: 'volatility',
      distance: stopDistance,
      volatility,
      multiplier
    };

  } catch (error) {
    logger.error('Volatility stop calculation failed', { error: error.message });
    throw error;
  }
}

/**
 * Calculate structure-based stop loss (support/resistance)
 * Places stops below support (LONG) or above resistance (SHORT)
 * @param {Object[]} candles - OHLCV candles
 * @param {number} entryPrice - Entry price
 * @param {'LONG' | 'SHORT'} direction - Trade direction
 * @param {Object} params - Parameters
 * @returns {import('../types').DynamicStop} Stop/TP levels
 */
function calculateStructureStop(candles, entryPrice, direction, params = {}) {
  const {
    lookback = 20,
    buffer = 0.002 // 0.2% buffer beyond structure
  } = params;

  try {
    if (candles.length < lookback) {
      logger.warn('Insufficient candles for structure analysis, falling back to ATR');
      return calculateATRStop(candles, entryPrice, direction);
    }

    const recentCandles = candles.slice(-lookback);
    
    // Find swing highs and lows
    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);
    
    // Find significant levels
    const resistance = Math.max(...highs);
    const support = Math.min(...lows);
    
    let stopLoss, takeProfit;
    
    if (direction === 'LONG') {
      // Stop below support with buffer
      stopLoss = support * (1 - buffer);
      // TP at resistance
      takeProfit = resistance * (1 + buffer);
    } else {
      // Stop above resistance with buffer
      stopLoss = resistance * (1 + buffer);
      // TP at support
      takeProfit = support * (1 - buffer);
    }

    const stopDistancePercent = Math.abs(stopLoss - entryPrice) / entryPrice;
    const tpDistancePercent = Math.abs(takeProfit - entryPrice) / entryPrice;
    const riskReward = tpDistancePercent / stopDistancePercent;

    // Validate R:R is reasonable
    if (riskReward < 1 || riskReward > 10) {
      logger.warn('Structure R:R out of range, falling back to ATR', { riskReward });
      return calculateATRStop(candles, entryPrice, direction);
    }

    logger.debug('Structure stop calculated', {
      support,
      resistance,
      stopLoss: stopLoss.toFixed(8),
      takeProfit: takeProfit.toFixed(8),
      riskReward: riskReward.toFixed(2)
    });

    return {
      stopLoss,
      takeProfit,
      riskReward,
      method: 'structure',
      distance: stopDistancePercent,
      support,
      resistance
    };

  } catch (error) {
    logger.error('Structure stop calculation failed', { error: error.message });
    throw error;
  }
}

/**
 * Calculate optimal dynamic stop using best method for current conditions
 * @param {Object[]} candles - OHLCV candles
 * @param {number} entryPrice - Entry price
 * @param {'LONG' | 'SHORT'} direction - Trade direction
 * @param {Object} params - Parameters
 * @returns {import('../types').DynamicStop} Best stop/TP levels
 */
function calculateDynamicStop(candles, entryPrice, direction, params = {}) {
  const {
    preferredMethod = 'auto', // 'atr', 'volatility', 'structure', 'auto'
    maxRiskPercent = 0.03 // Maximum 3% risk
  } = params;

  try {
    let stop;

    if (preferredMethod !== 'auto') {
      switch (preferredMethod) {
        case 'atr':
          stop = calculateATRStop(candles, entryPrice, direction, params);
          break;
        case 'volatility':
          stop = calculateVolatilityStop(candles, entryPrice, direction, params);
          break;
        case 'structure':
          stop = calculateStructureStop(candles, entryPrice, direction, params);
          break;
        default:
          stop = calculateATRStop(candles, entryPrice, direction, params);
      }
    } else {
      // Auto mode: calculate all and choose best
      const atrStop = calculateATRStop(candles, entryPrice, direction, params);
      const volStop = calculateVolatilityStop(candles, entryPrice, direction, params);
      const structStop = calculateStructureStop(candles, entryPrice, direction, params);

      // Choose the one with best R:R within acceptable risk
      const candidates = [atrStop, volStop, structStop].filter(s => s.distance <= maxRiskPercent);

      if (candidates.length === 0) {
        // All exceed max risk, use ATR with capped distance
        stop = atrStop;
        const cappedDistance = entryPrice * maxRiskPercent;
        if (direction === 'LONG') {
          stop.stopLoss = entryPrice - cappedDistance;
        } else {
          stop.stopLoss = entryPrice + cappedDistance;
        }
        stop.distance = maxRiskPercent;
        stop.capped = true;
        logger.info('All stops exceed max risk, capping at', { maxRiskPercent });
      } else {
        // Choose best R:R
        stop = candidates.reduce((best, current) => 
          current.riskReward > best.riskReward ? current : best
        );
      }
    }

    logger.info('Dynamic stop calculated', {
      method: stop.method,
      stopLoss: stop.stopLoss.toFixed(8),
      takeProfit: stop.takeProfit.toFixed(8),
      riskReward: stop.riskReward.toFixed(2),
      distance: (stop.distance * 100).toFixed(2) + '%'
    });

    return stop;

  } catch (error) {
    logger.error('Dynamic stop calculation failed', { error: error.message });
    throw error;
  }
}

/**
 * Initialize trailing stop state
 * @param {number} entryPrice - Entry price
 * @param {'LONG' | 'SHORT'} direction - Trade direction
 * @param {Object} params - Parameters
 * @returns {import('../types').TrailingStop} Initial trailing stop state
 */
function initializeTrailingStop(entryPrice, direction, params = {}) {
  const {
    activationPercent = config.stops.trailing.activationPercent,
    trailPercent = config.stops.trailing.trailPercent
  } = params;

  return {
    currentStop: null,
    highestPrice: direction === 'LONG' ? entryPrice : null,
    lowestPrice: direction === 'SHORT' ? entryPrice : null,
    activated: false,
    activationPercent,
    trailPercent,
    direction,
    entryPrice
  };
}

/**
 * Update trailing stop based on current price
 * @param {number} currentPrice - Current market price
 * @param {import('../types').TrailingStop} trailingState - Current trailing state
 * @returns {import('../types').TrailingStop} Updated trailing stop state
 */
function updateTrailingStop(currentPrice, trailingState) {
  const { 
    direction, 
    entryPrice, 
    activationPercent, 
    trailPercent 
  } = trailingState;

  const newState = { ...trailingState };

  if (direction === 'LONG') {
    // Update highest price
    if (currentPrice > (newState.highestPrice || entryPrice)) {
      newState.highestPrice = currentPrice;
    }

    // Check activation
    const profitPercent = (currentPrice - entryPrice) / entryPrice;
    if (!newState.activated && profitPercent >= activationPercent) {
      newState.activated = true;
      newState.currentStop = currentPrice * (1 - trailPercent);
      logger.info('Trailing stop activated', { profitPercent, currentStop: newState.currentStop });
    }

    // Update trailing stop if activated
    if (newState.activated && newState.highestPrice) {
      const newStop = newState.highestPrice * (1 - trailPercent);
      if (newStop > (newState.currentStop || 0)) {
        newState.currentStop = newStop;
      }
    }

  } else {
    // SHORT direction
    // Update lowest price
    if (currentPrice < (newState.lowestPrice || entryPrice)) {
      newState.lowestPrice = currentPrice;
    }

    // Check activation
    const profitPercent = (entryPrice - currentPrice) / entryPrice;
    if (!newState.activated && profitPercent >= activationPercent) {
      newState.activated = true;
      newState.currentStop = currentPrice * (1 + trailPercent);
      logger.info('Trailing stop activated', { profitPercent, currentStop: newState.currentStop });
    }

    // Update trailing stop if activated
    if (newState.activated && newState.lowestPrice) {
      const newStop = newState.lowestPrice * (1 + trailPercent);
      if (newStop < (newState.currentStop || Infinity)) {
        newState.currentStop = newStop;
      }
    }
  }

  return newState;
}

/**
 * Check if trailing stop is hit
 * @param {number} currentPrice - Current market price
 * @param {import('../types').TrailingStop} trailingState - Trailing stop state
 * @returns {boolean} Whether stop is hit
 */
function isTrailingStopHit(currentPrice, trailingState) {
  if (!trailingState.activated || !trailingState.currentStop) {
    return false;
  }

  if (trailingState.direction === 'LONG') {
    return currentPrice <= trailingState.currentStop;
  } else {
    return currentPrice >= trailingState.currentStop;
  }
}

/**
 * Check if time-based exit should trigger
 * @param {Date|number} entryTime - Trade entry time
 * @param {number} maxHours - Maximum hours in trade
 * @returns {Object} Time exit status
 */
function checkTimeStop(entryTime, maxHours = config.stops.time.maxHoursInTrade) {
  const entryTimestamp = entryTime instanceof Date ? entryTime.getTime() : entryTime;
  const now = Date.now();
  const hoursElapsed = (now - entryTimestamp) / (1000 * 60 * 60);
  
  return {
    shouldExit: hoursElapsed >= maxHours,
    hoursElapsed,
    hoursRemaining: Math.max(0, maxHours - hoursElapsed),
    percentComplete: Math.min(1, hoursElapsed / maxHours)
  };
}

/**
 * Calculate all stop types for comparison
 * @param {Object[]} candles - OHLCV candles
 * @param {number} entryPrice - Entry price
 * @param {'LONG' | 'SHORT'} direction - Trade direction
 * @returns {Object} All stop calculations
 */
function analyzeStopOptions(candles, entryPrice, direction) {
  try {
    return {
      atr: calculateATRStop(candles, entryPrice, direction),
      volatility: calculateVolatilityStop(candles, entryPrice, direction),
      structure: calculateStructureStop(candles, entryPrice, direction),
      recommended: calculateDynamicStop(candles, entryPrice, direction, { preferredMethod: 'auto' })
    };
  } catch (error) {
    logger.error('Stop analysis failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  calculateATRStop,
  calculateVolatilityStop,
  calculateStructureStop,
  calculateDynamicStop,
  initializeTrailingStop,
  updateTrailingStop,
  isTrailingStopHit,
  checkTimeStop,
  analyzeStopOptions
};
