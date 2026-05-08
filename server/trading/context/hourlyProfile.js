/**
 * ============================================================================
 * HOURLY PROFILE - Phase 6
 * ============================================================================
 * Analyze market behavior by hour of day.
 * Identifies active vs dead hours for better signal filtering.
 */

// NOTE: calculateATR not used directly — this file computes its own TR for hourly profiling.
// const { calculateATR } = require('../indicators')

/**
 * Trading sessions with their UTC hours
 */
const SESSIONS = {
  ASIA: { start: 0, end: 8, name: 'Asia', timezone: 'Asia/Tokyo' },
  EUROPE: { start: 7, end: 16, name: 'Europe', timezone: 'Europe/London' },
  US: { start: 13, end: 22, name: 'US', timezone: 'America/New_York' },
  // Overlap periods (high volatility)
  LONDON_TOKYO: { start: 7, end: 8, name: 'London/Tokyo Overlap' },
  LONDON_NY: { start: 13, end: 16, name: 'London/NY Overlap' }
}

/**
 * Get current active sessions
 * @param {Date} date - Date to check (default: now)
 * @returns {string[]} Array of active session names
 */
const getActiveSessions = (date = new Date()) => {
  const utcHour = date.getUTCHours()
  const active = []
  
  if (utcHour >= SESSIONS.ASIA.start && utcHour < SESSIONS.ASIA.end) {
    active.push('ASIA')
  }
  if (utcHour >= SESSIONS.EUROPE.start && utcHour < SESSIONS.EUROPE.end) {
    active.push('EUROPE')
  }
  if (utcHour >= SESSIONS.US.start && utcHour < SESSIONS.US.end) {
    active.push('US')
  }
  
  // Check overlaps
  if (utcHour >= SESSIONS.LONDON_TOKYO.start && utcHour < SESSIONS.LONDON_TOKYO.end) {
    active.push('LONDON_TOKYO_OVERLAP')
  }
  if (utcHour >= SESSIONS.LONDON_NY.start && utcHour < SESSIONS.LONDON_NY.end) {
    active.push('LONDON_NY_OVERLAP')
  }
  
  return active.length > 0 ? active : ['OFF_HOURS']
}

/**
 * Calculate ATR profile by hour
 * @param {object[]} candles - Array of OHLC candles (should have significant history)
 * @returns {object} ATR statistics per hour
 */
const calculateHourlyATR = (candles) => {
  if (!candles || candles.length < 24) {
    return { error: 'Insufficient data for hourly profile' }
  }
  
  // Group candles by hour
  const hourlyCandles = {}
  for (let h = 0; h < 24; h++) {
    hourlyCandles[h] = []
  }
  
  for (const candle of candles) {
    const hour = new Date(candle.timestamp).getUTCHours()
    hourlyCandles[hour].push(candle)
  }
  
  // Calculate ATR for each hour group
  const hourlyATR = {}
  let totalATR = 0
  let count = 0
  
  for (let h = 0; h < 24; h++) {
    const hourCandles = hourlyCandles[h]
    if (hourCandles.length >= 3) {
      // Calculate average true range for this hour
      let atrSum = 0
      for (const c of hourCandles) {
        atrSum += c.high - c.low
      }
      const avgATR = atrSum / hourCandles.length
      hourlyATR[h] = {
        atr: avgATR,
        samples: hourCandles.length
      }
      totalATR += avgATR
      count++
    }
  }
  
  // Calculate average and classify hours
  const avgATR = count > 0 ? totalATR / count : 0
  
  for (let h = 0; h < 24; h++) {
    if (hourlyATR[h]) {
      const ratio = hourlyATR[h].atr / avgATR
      hourlyATR[h].ratio = ratio
      hourlyATR[h].classification = classifyHour(ratio)
    }
  }
  
  return {
    hourlyATR,
    averageATR: avgATR,
    mostActiveHours: getMostActiveHours(hourlyATR),
    leastActiveHours: getLeastActiveHours(hourlyATR)
  }
}

/**
 * Classify hour activity level
 * @param {number} ratio - ATR ratio vs average
 * @returns {string} Classification
 */
const classifyHour = (ratio) => {
  if (ratio > 1.5) return 'EXPLOSIVE'
  if (ratio > 1.2) return 'HIGH'
  if (ratio > 0.8) return 'NORMAL'
  if (ratio > 0.5) return 'LOW'
  return 'DEAD'
}

/**
 * Get most active hours
 */
const getMostActiveHours = (hourlyATR) => {
  return Object.entries(hourlyATR)
    .filter(([_, data]) => data.ratio > 1.2)
    .sort((a, b) => b[1].ratio - a[1].ratio)
    .slice(0, 5)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      ...data
    }))
}

/**
 * Get least active (dead) hours
 */
const getLeastActiveHours = (hourlyATR) => {
  return Object.entries(hourlyATR)
    .filter(([_, data]) => data.ratio < 0.8)
    .sort((a, b) => a[1].ratio - b[1].ratio)
    .slice(0, 5)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      ...data
    }))
}

/**
 * Get volatility context for current hour
 * @param {object[]} candles - Historical candles
 * @param {Date} date - Current date (optional)
 * @returns {object} Current hour context
 */
const getCurrentHourContext = (candles, date = new Date()) => {
  const profile = calculateHourlyATR(candles)
  const currentHour = date.getUTCHours()
  const sessions = getActiveSessions(date)
  
  const hourData = profile.hourlyATR?.[currentHour] || { classification: 'UNKNOWN' }
  
  return {
    hour: currentHour,
    sessions,
    volatility: hourData.classification,
    atrRatio: hourData.ratio || 1,
    isDeadHour: hourData.classification === 'DEAD' || hourData.classification === 'LOW',
    isActiveHour: hourData.classification === 'HIGH' || hourData.classification === 'EXPLOSIVE',
    recommendation: getHourRecommendation(hourData, sessions)
  }
}

/**
 * Get trading recommendation based on hour context
 */
const getHourRecommendation = (hourData, sessions) => {
  const hasOverlap = sessions.some(s => s.includes('OVERLAP'))
  const volatility = hourData.classification
  
  if (volatility === 'DEAD') {
    return {
      action: 'AVOID',
      reason: 'Dead hour - low volatility, poor risk/reward'
    }
  }
  
  if (volatility === 'EXPLOSIVE' || hasOverlap) {
    return {
      action: 'SCALP_FRIENDLY',
      reason: 'High volatility - good for scalping, use tight stops'
    }
  }
  
  if (volatility === 'HIGH') {
    return {
      action: 'ACTIVE',
      reason: 'Normal to high activity - standard trading'
    }
  }
  
  if (volatility === 'LOW') {
    return {
      action: 'CAUTION',
      reason: 'Low volatility - consider waiting for more activity'
    }
  }
  
  return {
    action: 'NORMAL',
    reason: 'Standard market conditions'
  }
}

/**
 * Calculate signal sensitivity adjustment based on hour
 * @param {object} hourContext - From getCurrentHourContext
 * @returns {number} Multiplier for signal sensitivity (0.5-1.5)
 */
const getSignalSensitivity = (hourContext) => {
  switch (hourContext.volatility) {
    case 'EXPLOSIVE':
      return 1.5 // More selective during high volatility
    case 'HIGH':
      return 1.2
    case 'NORMAL':
      return 1.0
    case 'LOW':
      return 0.8 // Less strict during low volatility
    case 'DEAD':
      return 0.5 // Much less strict (but signals should be avoided anyway)
    default:
      return 1.0
  }
}

module.exports = {
  SESSIONS,
  getActiveSessions,
  calculateHourlyATR,
  classifyHour,
  getMostActiveHours,
  getLeastActiveHours,
  getCurrentHourContext,
  getHourRecommendation,
  getSignalSensitivity
}
