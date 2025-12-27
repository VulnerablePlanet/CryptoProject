/**
 * ============================================================================
 * SUPPORT & RESISTANCE INDEX
 * ============================================================================
 * Main entry point for support/resistance analysis.
 */

const {
  findSwingHighs,
  findSwingLows,
  clusterLevels,
  calculateLevelStrength,
  getRoundnessScore,
  detectLevels,
  findNearestLevels
} = require('./detector')

module.exports = {
  findSwingHighs,
  findSwingLows,
  clusterLevels,
  calculateLevelStrength,
  getRoundnessScore,
  detectLevels,
  findNearestLevels
}
