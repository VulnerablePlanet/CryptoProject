/**
 * Risk Management Module
 * Professional position sizing and risk control
 * 
 * Features:
 * - Position sizing based on risk percentage
 * - Total exposure monitoring
 * - Correlated asset exposure tracking
 * - Kill switch for emergency stop
 * - Risk metrics calculation
 * - Trade validation
 * 
 * @module risk/riskManager
 */

const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('RiskManager');

/**
 * Calculate position size based on risk parameters
 * @param {Object} params - Position sizing parameters
 * @param {number} params.accountBalance - Total account balance
 * @param {number} params.riskPercent - Risk per trade (0-1)
 * @param {number} params.entryPrice - Entry price
 * @param {number} params.stopLoss - Stop loss price
 * @returns {import('../types').PositionSize} Position sizing result
 */
function calculatePositionSize(params) {
  const {
    accountBalance,
    riskPercent = config.risk.maxRiskPerTrade,
    entryPrice,
    stopLoss
  } = params;

  try {
    // Validate inputs
    if (!accountBalance || accountBalance <= 0) {
      throw new Error('Invalid account balance');
    }
    if (!entryPrice || entryPrice <= 0) {
      throw new Error('Invalid entry price');
    }
    if (!stopLoss || stopLoss <= 0) {
      throw new Error('Invalid stop loss');
    }

    // Calculate stop distance
    const stopDistance = Math.abs(entryPrice - stopLoss);
    const stopDistancePercent = stopDistance / entryPrice;

    if (stopDistancePercent === 0) {
      throw new Error('Stop loss cannot equal entry price');
    }

    // Maximum amount to risk
    const riskAmount = accountBalance * riskPercent;

    // Position size in quote currency
    const positionSize = riskAmount / stopDistancePercent;

    // Quantity of asset
    const quantity = positionSize / entryPrice;

    logger.debug('Position size calculated', {
      accountBalance,
      riskPercent: (riskPercent * 100).toFixed(2) + '%',
      stopDistancePercent: (stopDistancePercent * 100).toFixed(2) + '%',
      riskAmount: riskAmount.toFixed(2),
      positionSize: positionSize.toFixed(2),
      quantity: quantity.toFixed(8)
    });

    return {
      size: positionSize,
      quantity,
      riskAmount,
      riskPercent,
      stopDistancePercent,
      maxLoss: riskAmount
    };

  } catch (error) {
    logger.error('Position size calculation failed', { error: error.message, params });
    throw error;
  }
}

/**
 * Check if new position would exceed total exposure limits
 * @param {Object[]} currentPositions - Array of current positions
 * @param {Object} newPosition - New position to check
 * @param {number} accountBalance - Total account balance
 * @returns {Object} Exposure check result
 */
function checkExposure(currentPositions, newPosition, accountBalance) {
  const maxExposure = config.risk.maxTotalExposure;

  try {
    // Calculate current exposure
    const currentExposure = currentPositions.reduce((total, pos) => {
      return total + (pos.size || 0);
    }, 0);

    const currentExposurePercent = currentExposure / accountBalance;
    const newExposurePercent = (currentExposure + (newPosition.size || 0)) / accountBalance;

    const withinLimit = newExposurePercent <= maxExposure;

    logger.debug('Exposure check', {
      currentExposure: (currentExposurePercent * 100).toFixed(2) + '%',
      newExposure: (newExposurePercent * 100).toFixed(2) + '%',
      maxExposure: (maxExposure * 100).toFixed(2) + '%',
      withinLimit
    });

    return {
      allowed: withinLimit,
      currentExposure: currentExposurePercent,
      newExposure: newExposurePercent,
      maxExposure,
      availableExposure: Math.max(0, maxExposure - currentExposurePercent),
      maxPositionSize: (maxExposure - currentExposurePercent) * accountBalance
    };

  } catch (error) {
    logger.error('Exposure check failed', { error: error.message });
    throw error;
  }
}

/**
 * Check exposure to correlated assets
 * @param {Object[]} positions - Current positions with symbols
 * @param {Object} correlationMatrix - Symbol correlation matrix
 * @param {string} newSymbol - Symbol of new position
 * @param {number} newSize - Size of new position
 * @param {number} accountBalance - Account balance
 * @returns {Object} Correlated exposure check result
 */
function checkCorrelatedExposure(positions, correlationMatrix, newSymbol, newSize, accountBalance) {
  const maxCorrelated = config.risk.maxCorrelatedExposure;
  const threshold = config.risk.correlationThreshold;

  try {
    // Find correlated positions
    const correlatedPositions = positions.filter(pos => {
      const correlation = correlationMatrix?.[pos.symbol]?.[newSymbol] || 0;
      return Math.abs(correlation) >= threshold;
    });

    // Sum correlated exposure
    const correlatedExposure = correlatedPositions.reduce((total, pos) => {
      return total + (pos.size || 0);
    }, 0);

    const correlatedExposureWithNew = correlatedExposure + newSize;
    const correlatedExposurePercent = correlatedExposureWithNew / accountBalance;

    const withinLimit = correlatedExposurePercent <= maxCorrelated;

    logger.debug('Correlated exposure check', {
      newSymbol,
      correlatedCount: correlatedPositions.length,
      correlatedExposure: (correlatedExposurePercent * 100).toFixed(2) + '%',
      maxCorrelated: (maxCorrelated * 100).toFixed(2) + '%',
      withinLimit
    });

    return {
      allowed: withinLimit,
      correlatedPositions: correlatedPositions.map(p => p.symbol),
      correlatedExposure: correlatedExposurePercent,
      maxCorrelated,
      correlationThreshold: threshold
    };

  } catch (error) {
    logger.error('Correlated exposure check failed', { error: error.message });
    throw error;
  }
}

/**
 * Check if kill switch should be activated
 * @param {Object} performance - Performance metrics
 * @param {number} performance.dailyPnL - Daily P&L as decimal
 * @param {number} performance.drawdown - Current drawdown as decimal
 * @param {number} performance.winrate - Recent winrate as decimal
 * @param {number} performance.tradesCount - Number of trades for winrate
 * @returns {Object} Kill switch status
 */
function checkKillSwitch(performance) {
  const { maxDailyLoss, maxDrawdown, minWinrate } = config.risk.killSwitch;

  try {
    const dailyPnL = performance.dailyPnL || 0;
    const drawdown = performance.drawdown || 0;
    const winrate = performance.winrate || 1;
    const tradesCount = performance.tradesCount || 0;

    const triggers = [];
    let activated = false;

    // Check daily loss
    if (dailyPnL <= -maxDailyLoss) {
      triggers.push({
        reason: 'MAX_DAILY_LOSS',
        value: dailyPnL,
        threshold: -maxDailyLoss
      });
      activated = true;
    }

    // Check drawdown
    if (drawdown >= maxDrawdown) {
      triggers.push({
        reason: 'MAX_DRAWDOWN',
        value: drawdown,
        threshold: maxDrawdown
      });
      activated = true;
    }

    // Check winrate (only if sufficient trades)
    if (tradesCount >= 10 && winrate < minWinrate) {
      triggers.push({
        reason: 'LOW_WINRATE',
        value: winrate,
        threshold: minWinrate
      });
      activated = true;
    }

    if (activated) {
      logger.warn('KILL SWITCH ACTIVATED', { triggers });
    }

    return {
      activated,
      triggers,
      performance: {
        dailyPnL,
        drawdown,
        winrate,
        tradesCount
      },
      thresholds: {
        maxDailyLoss,
        maxDrawdown,
        minWinrate
      }
    };

  } catch (error) {
    logger.error('Kill switch check failed', { error: error.message });
    throw error;
  }
}

/**
 * Calculate comprehensive risk metrics
 * @param {Object[]} positions - Current open positions
 * @param {Object} performance - Historical performance metrics
 * @param {number} accountBalance - Account balance
 * @returns {import('../types').RiskMetrics} Risk metrics
 */
function calculateRiskMetrics(positions, performance, accountBalance) {
  try {
    // Current exposure
    const currentExposure = positions.reduce((total, pos) => {
      return total + (pos.size || 0);
    }, 0) / accountBalance;

    // Available capital
    const availableCapital = accountBalance * (config.risk.maxTotalExposure - currentExposure);

    // Check kill switch
    const killSwitchStatus = checkKillSwitch(performance);

    // Generate warnings
    const warnings = [];

    if (currentExposure > config.risk.maxTotalExposure * 0.8) {
      warnings.push('Approaching maximum exposure limit');
    }

    if (performance.drawdown > config.risk.killSwitch.maxDrawdown * 0.7) {
      warnings.push('Approaching maximum drawdown threshold');
    }

    if (performance.dailyPnL < -config.risk.killSwitch.maxDailyLoss * 0.7) {
      warnings.push('Approaching daily loss limit');
    }

    if (positions.length > 10) {
      warnings.push('High number of open positions');
    }

    return {
      currentExposure,
      availableCapital,
      correlatedExposure: 0, // Would need correlation matrix for accurate calculation
      killSwitchActive: killSwitchStatus.activated,
      warnings,
      positionCount: positions.length,
      performance,
      canTrade: !killSwitchStatus.activated && currentExposure < config.risk.maxTotalExposure
    };

  } catch (error) {
    logger.error('Risk metrics calculation failed', { error: error.message });
    throw error;
  }
}

/**
 * Validate a trade against all risk rules
 * @param {Object} trade - Trade to validate
 * @param {Object[]} currentPositions - Current positions
 * @param {Object} performance - Performance metrics
 * @param {number} accountBalance - Account balance
 * @param {Object} correlationMatrix - Optional correlation matrix
 * @returns {Object} Validation result
 */
function validateTrade(trade, currentPositions, performance, accountBalance, correlationMatrix = null) {
  try {
    const errors = [];
    const warnings = [];

    // 1. Check kill switch
    const killSwitch = checkKillSwitch(performance);
    if (killSwitch.activated) {
      errors.push({
        code: 'KILL_SWITCH_ACTIVE',
        message: 'Trading halted due to kill switch activation',
        triggers: killSwitch.triggers
      });
    }

    // 2. Check total exposure
    const exposure = checkExposure(currentPositions, trade, accountBalance);
    if (!exposure.allowed) {
      errors.push({
        code: 'EXPOSURE_EXCEEDED',
        message: `New exposure ${(exposure.newExposure * 100).toFixed(1)}% exceeds limit ${(exposure.maxExposure * 100).toFixed(1)}%`,
        current: exposure.currentExposure,
        limit: exposure.maxExposure
      });
    } else if (exposure.newExposure > exposure.maxExposure * 0.9) {
      warnings.push('Trade would bring exposure close to maximum limit');
    }

    // 3. Check correlated exposure (if matrix provided)
    if (correlationMatrix && trade.symbol) {
      const correlated = checkCorrelatedExposure(
        currentPositions, 
        correlationMatrix, 
        trade.symbol, 
        trade.size, 
        accountBalance
      );
      if (!correlated.allowed) {
        errors.push({
          code: 'CORRELATED_EXPOSURE_EXCEEDED',
          message: 'Correlated asset exposure limit exceeded',
          correlatedSymbols: correlated.correlatedPositions
        });
      }
    }

    // 4. Check individual trade risk
    if (trade.riskPercent && trade.riskPercent > config.risk.maxRiskPerTrade) {
      errors.push({
        code: 'RISK_PER_TRADE_EXCEEDED',
        message: `Trade risk ${(trade.riskPercent * 100).toFixed(1)}% exceeds limit ${(config.risk.maxRiskPerTrade * 100).toFixed(1)}%`,
        tradeRisk: trade.riskPercent,
        limit: config.risk.maxRiskPerTrade
      });
    }

    const isValid = errors.length === 0;

    logger.info('Trade validation complete', {
      symbol: trade.symbol,
      isValid,
      errorCount: errors.length,
      warningCount: warnings.length
    });

    return {
      valid: isValid,
      errors,
      warnings,
      checks: {
        killSwitch: !killSwitch.activated,
        exposure: exposure.allowed,
        riskPerTrade: (trade.riskPercent || 0) <= config.risk.maxRiskPerTrade
      }
    };

  } catch (error) {
    logger.error('Trade validation failed', { error: error.message });
    throw error;
  }
}

/**
 * Adjust position size based on market conditions
 * @param {number} baseSize - Base position size
 * @param {Object} conditions - Market conditions
 * @param {number} conditions.volatility - Current volatility
 * @param {number} conditions.drawdown - Current drawdown
 * @returns {import('../types').AdaptiveAdjustment} Adjusted size
 */
function adjustPositionSize(baseSize, conditions) {
  const { volatility = 0, drawdown = 0 } = conditions;
  let multiplier = 1.0;
  let reason = 'normal';

  // Drawdown adjustments
  const drawdownLevels = config.adaptive.adjustments.drawdown.levels;
  for (const level of drawdownLevels) {
    if (drawdown >= level.threshold) {
      multiplier = Math.min(multiplier, level.sizeMultiplier);
      reason = `drawdown_${(level.threshold * 100).toFixed(0)}pct`;
    }
  }

  // Volatility adjustments
  const volConfig = config.adaptive.adjustments.volatility;
  if (volatility >= config.regime.volatility.highVolThreshold) {
    multiplier *= volConfig.highVolMultiplier;
    reason = reason === 'normal' ? 'high_volatility' : reason + '_high_vol';
  } else if (volatility < config.regime.volatility.highVolThreshold * 0.5) {
    multiplier *= volConfig.lowVolMultiplier;
    reason = reason === 'normal' ? 'low_volatility' : reason + '_low_vol';
  }

  const adjustedSize = baseSize * multiplier;

  logger.debug('Position size adjusted', {
    baseSize,
    adjustedSize,
    multiplier,
    reason
  });

  return {
    originalSize: baseSize,
    adjustedSize,
    multiplier,
    reason,
    timestamp: new Date()
  };
}

module.exports = {
  calculatePositionSize,
  checkExposure,
  checkCorrelatedExposure,
  checkKillSwitch,
  calculateRiskMetrics,
  validateTrade,
  adjustPositionSize
};
