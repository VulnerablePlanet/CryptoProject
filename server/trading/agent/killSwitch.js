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

const EventEmitter = require('events')

// Default thresholds
const THRESHOLDS = {
  DAILY_LOSS_PCT: 0.03,      // 3% daily loss triggers kill switch
  MAX_DRAWDOWN_PCT: 0.10,    // 10% drawdown triggers kill switch
  MAX_CONSECUTIVE_LOSSES: 5  // 5 consecutive losses triggers kill switch
}

/**
 * KillSwitch class - EventEmitter with risk threshold checking
 * Must be instantiated and passed to the orchestrator via setKillSwitch()
 */
class KillSwitch extends EventEmitter {
  constructor(customThresholds = {}) {
    super()
    this.thresholds = { ...THRESHOLDS, ...customThresholds }
    this.triggered = false
    this.triggerReason = null
    this.triggerData = null
  }

  /**
   * Check if kill switch should be triggered
   * @param {Object} performance - Performance metrics
   * @param {number} performance.dailyLoss - Daily loss as decimal (e.g., 0.04 = 4%)
   * @param {number} performance.drawdown - Current drawdown as decimal (e.g., 0.12 = 12%)
   * @param {number} performance.consecutiveLosses - Number of consecutive losing trades
   * @returns {Object} Kill switch status { triggered, reason, details }
   */
  check(performance = {}) {
    if (this.triggered) {
      return { triggered: true, reason: this.triggerReason, details: this.triggerData }
    }

    const { dailyLoss = 0, drawdown = 0, consecutiveLosses = 0 } = performance

    const details = {
      dailyLoss,
      drawdown,
      consecutiveLosses,
      thresholds: this.thresholds
    }

    // Check daily loss threshold
    if (dailyLoss >= this.thresholds.DAILY_LOSS_PCT) {
      this._trigger('DAILY_LOSS', { ...details, triggerValue: dailyLoss, thresholdValue: this.thresholds.DAILY_LOSS_PCT })
      return { triggered: true, reason: this.triggerReason, details: this.triggerData }
    }

    // Check drawdown threshold
    if (drawdown >= this.thresholds.MAX_DRAWDOWN_PCT) {
      this._trigger('DRAWDOWN', { ...details, triggerValue: drawdown, thresholdValue: this.thresholds.MAX_DRAWDOWN_PCT })
      return { triggered: true, reason: this.triggerReason, details: this.triggerData }
    }

    // Check consecutive losses threshold
    if (consecutiveLosses >= this.thresholds.MAX_CONSECUTIVE_LOSSES) {
      this._trigger('CONSECUTIVE_LOSSES', { ...details, triggerValue: consecutiveLosses, thresholdValue: this.thresholds.MAX_CONSECUTIVE_LOSSES })
      return { triggered: true, reason: this.triggerReason, details: this.triggerData }
    }

    // No trigger
    return { triggered: false, reason: null, details }
  }

  /**
   * Internal trigger method - sets state and emits event
   */
  _trigger(reason, data) {
    this.triggered = true
    this.triggerReason = reason
    this.triggerData = data
    this.emit('trigger', reason, data)
  }

  /**
   * Reset kill switch (e.g., after manual review)
   */
  reset() {
    this.triggered = false
    this.triggerReason = null
    this.triggerData = null
  }

  /**
   * Check kill switch with separate parameters (convenience method)
   */
  checkThresholds(dailyLossPct, drawdownPct, consecutiveLosses) {
    return this.check({
      dailyLoss: dailyLossPct,
      drawdown: drawdownPct,
      consecutiveLosses
    })
  }
}

/**
 * Standalone check function (backward compatibility)
 * @param {Object} performance - Performance metrics
 * @param {Object} customThresholds - Optional custom threshold overrides
 * @returns {Object} Kill switch status { triggered, reason, details }
 */
function check(performance, customThresholds = {}) {
  const thresholds = { ...THRESHOLDS, ...customThresholds }
  const { dailyLoss = 0, drawdown = 0, consecutiveLosses = 0 } = performance

  const details = { dailyLoss, drawdown, consecutiveLosses, thresholds }

  if (dailyLoss >= thresholds.DAILY_LOSS_PCT) {
    return { triggered: true, reason: 'DAILY_LOSS', details: { ...details, triggerValue: dailyLoss, thresholdValue: thresholds.DAILY_LOSS_PCT } }
  }
  if (drawdown >= thresholds.MAX_DRAWDOWN_PCT) {
    return { triggered: true, reason: 'DRAWDOWN', details: { ...details, triggerValue: drawdown, thresholdValue: thresholds.MAX_DRAWDOWN_PCT } }
  }
  if (consecutiveLosses >= thresholds.MAX_CONSECUTIVE_LOSSES) {
    return { triggered: true, reason: 'CONSECUTIVE_LOSSES', details: { ...details, triggerValue: consecutiveLosses, thresholdValue: thresholds.MAX_CONSECUTIVE_LOSSES } }
  }
  return { triggered: false, reason: null, details }
}

function checkThresholds(dailyLossPct, drawdownPct, consecutiveLosses) {
  return check({ dailyLoss: dailyLossPct, drawdown: drawdownPct, consecutiveLosses })
}

module.exports = {
  KillSwitch,
  check,
  checkThresholds,
  THRESHOLDS
}
