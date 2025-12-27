/**
 * ============================================================================
 * BACKTESTING INDEX
 * ============================================================================
 * Main entry point for backtesting.
 */

const { TRADE_RESULT, runBacktest, calculateMetrics, getEquityCurve } = require('./simulator')

module.exports = {
  TRADE_RESULT,
  runBacktest,
  calculateMetrics,
  getEquityCurve
}
