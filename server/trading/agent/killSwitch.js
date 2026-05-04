/**
 * ============================================================================
 * KILL SWITCH - Risk Management
 * ============================================================================
 * Automatic trading halt when risk limits are breached.
 *
 * API Signature:
 * check(performance) → { triggered: boolean, reason: string|null, details: object }
 *
 * Triggers:
 * - Daily loss >= 3%
 * - Drawdown >= 10%
 * - Consecutive losses >= 5
 */

// Default thresholds
const THRESHOLDS = {
  DAILY_LOSS_PCT: 0.03,      // 3% daily loss triggers kill switch
  MAX_DRAWDOWN_PCT: 0.10,    // 10% drawdown triggers kill switch
  MAX_CONSECUTIVE_LOSSES: 5  // 5 consecutive losses triggers kill switch
}

/**
 * Check if kill switch should be triggered
 * @param {Object} performance - Performance metrics
 * @param {number} performance.dailyLoss - Daily loss as decimal (e.g., 0.04 = 4%)
 * @param {number} performance.drawdown - Current drawdown as decimal (e.g., 0.12 = 12%)
 * @param {number} performance.consecutiveLosses - Number of consecutive losing trades
 * @param {Object} customThresholds - Optional custom threshold overrides
 * @returns {Object} Kill switch status { triggered, reason, details }
 */
function check(performance, customThresholds = {}) {
  const thresholds = { ...THRESHOLDS, ...customThresholds }
  const { dailyLoss = 0, drawdown = 0, consecutiveLosses = 0 } = performance

  const details = {
    dailyLoss,
    drawdown,
    consecutiveLosses,
    thresholds
  }

  // Check daily loss threshold
  if (dailyLoss >= thresholds.DAILY_LOSS_PCT) {
    return {
      triggered: true,
      reason: 'DAILY_LOSS',
      details: {
        ...details,
        triggerValue: dailyLoss,
        thresholdValue: thresholds.DAILY_LOSS_PCT
      }
    }
  }

  // Check drawdown threshold
  if (drawdown >= thresholds.MAX_DRAWDOWN_PCT) {
    return {
      triggered: true,
      reason: 'DRAWDOWN',
      details: {
        ...details,
        triggerValue: drawdown,
        thresholdValue: thresholds.MAX_DRAWDOWN_PCT
      }
    }
  }

  // Check consecutive losses threshold
  if (consecutiveLosses >= thresholds.MAX_CONSECUTIVE_LOSSES) {
    return {
      triggered: true,
      reason: 'CONSECUTIVE_LOSSES',
      details: {
        ...details,
        triggerValue: consecutiveLosses,
        thresholdValue: thresholds.MAX_CONSECUTIVE_LOSSES
      }
    }
  }

  // No trigger
  return {
    triggered: false,
    reason: null,
    details
  }
}

/**
 * Check kill switch with separate parameters (alternative API)
 * @param {number} dailyLossPct - Daily loss as decimal
 * @param {number} drawdownPct - Drawdown as decimal
 * @param {number} consecutiveLosses - Number of consecutive losses
 * @returns {Object} Kill switch status
 */
function checkThresholds(dailyLossPct, drawdownPct, consecutiveLosses) {
  return check({
    dailyLoss: dailyLossPct,
    drawdown: drawdownPct,
    consecutiveLosses
  })
}

module.exports = {
  check,
  checkThresholds,
  THRESHOLDS
}