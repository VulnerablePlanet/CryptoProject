/**
 * ============================================================================
 * MTF INDEX
 * ============================================================================
 * Main entry point for multi-timeframe analysis.
 */

const {
  TIMEFRAME_HIERARCHY,
  detectTrend,
  detectRange,
  getHigherTFConfirmation,
  adjustStopsForMTF,
  analyzeMTF
} = require('./analyzer')

module.exports = {
  TIMEFRAME_HIERARCHY,
  detectTrend,
  detectRange,
  getHigherTFConfirmation,
  adjustStopsForMTF,
  analyzeMTF
}
