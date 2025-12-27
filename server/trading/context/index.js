/**
 * ============================================================================
 * CONTEXT INDEX
 * ============================================================================
 * Main entry point for market context analysis.
 */

const {
  SESSIONS,
  getActiveSessions,
  calculateHourlyATR,
  classifyHour,
  getMostActiveHours,
  getLeastActiveHours,
  getCurrentHourContext,
  getHourRecommendation,
  getSignalSensitivity
} = require('./hourlyProfile')

module.exports = {
  // Sessions
  SESSIONS,
  getActiveSessions,
  
  // Hourly analysis
  calculateHourlyATR,
  classifyHour,
  getMostActiveHours,
  getLeastActiveHours,
  getCurrentHourContext,
  
  // Recommendations
  getHourRecommendation,
  getSignalSensitivity
}
