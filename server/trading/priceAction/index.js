/**
 * ============================================================================
 * PRICE ACTION INDEX
 * ============================================================================
 * Main entry point for price action analysis.
 */

const {
  getCandleMetrics,
  detectDoji,
  detectHammer,
  detectInvertedHammer,
  detectEngulfing,
  detectPinBar,
  detectPatterns,
  analyzePatterns,
  getPatternSummary
} = require('./patterns')

module.exports = {
  // Pattern detection
  getCandleMetrics,
  detectDoji,
  detectHammer,
  detectInvertedHammer,
  detectEngulfing,
  detectPinBar,
  detectPatterns,
  
  // Analysis
  analyzePatterns,
  getPatternSummary
}
