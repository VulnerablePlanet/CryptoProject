/**
 * ============================================================================
 * CENTRALIZED COINGECKO RATE LIMITER
 * ============================================================================
 * All CoinGecko API calls should use this module to ensure:
 * 1. Fixed minimum interval between requests (2.4 seconds for 25 calls/min)
 * 2. Verify time elapsed before each request
 * 3. No simultaneous requests - serialized queue
 * 4. Record exact time of each request
 * 5. Progressive backoff on 429 errors
 * 6. Centralized control - single queue manager
 * ============================================================================
 */

const axios = require('axios')

// CoinGecko API configuration
const COINGECKO_API = 'https://api.coingecko.com/api/v3'

// Rate limiting configuration (CoinGecko free tier: 30 calls/min)
const MAX_CALLS_PER_MINUTE = 25 // Leave buffer (30 allowed)
const BASE_INTERVAL = (60 * 1000) / MAX_CALLS_PER_MINUTE // ~2.4 seconds
const MAX_BACKOFF_MULTIPLIER = 32 // Max 32x normal interval (~77 seconds)
const BACKOFF_RESET_TIME = 5 * 60 * 1000 // Reset backoff after 5 min of success

// Centralized state (Rule 6: single manager)
let lastCallTime = 0
let callQueue = []
let isProcessingQueue = false
let currentBackoffMultiplier = 1
let lastBackoffTime = 0
let consecutiveSuccesses = 0

// Metrics tracking
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  rateLimitHits: 0,
  totalWaitTime: 0,
  queueHighWaterMark: 0
}

/**
 * Get API key from environment
 */
const getApiKey = () => process.env.COINGECKO_API_KEY || ''

/**
 * Add API key to params if available
 */
const addApiKeyToParams = (params = {}) => {
  const apiKey = getApiKey()
  if (apiKey) {
    params.x_cg_demo_api_key = apiKey
  }
  return params
}

/**
 * Get current rate limit metrics
 */
const getRateLimitMetrics = () => ({
  ...metrics,
  currentQueueLength: callQueue.length,
  currentBackoffMultiplier,
  effectiveInterval: BASE_INTERVAL * currentBackoffMultiplier,
  isProcessing: isProcessingQueue
})

/**
 * Log rate limit activity
 */
const logRateLimit = (action, details = {}) => {
  const timestamp = new Date().toISOString()
  const queueLen = callQueue.length
  console.log(`⏱️ [RateLimit] ${timestamp} | ${action} | Queue: ${queueLen} | Backoff: ${currentBackoffMultiplier}x`, 
    Object.keys(details).length > 0 ? details : '')
}

/**
 * Calculate current effective interval with backoff
 */
const getEffectiveInterval = () => {
  return BASE_INTERVAL * currentBackoffMultiplier
}

/**
 * Apply exponential backoff (Rule 5)
 */
const applyBackoff = () => {
  currentBackoffMultiplier = Math.min(currentBackoffMultiplier * 2, MAX_BACKOFF_MULTIPLIER)
  lastBackoffTime = Date.now()
  consecutiveSuccesses = 0
  metrics.rateLimitHits++
  logRateLimit('BACKOFF_APPLIED', { multiplier: currentBackoffMultiplier })
}

/**
 * Reset backoff on consecutive successes
 */
const checkBackoffReset = () => {
  if (currentBackoffMultiplier > 1) {
    consecutiveSuccesses++
    // Reset after 5 consecutive successes or after reset time
    if (consecutiveSuccesses >= 5 || (Date.now() - lastBackoffTime > BACKOFF_RESET_TIME)) {
      const oldMultiplier = currentBackoffMultiplier
      currentBackoffMultiplier = 1
      consecutiveSuccesses = 0
      logRateLimit('BACKOFF_RESET', { from: oldMultiplier, to: 1 })
    }
  }
}

/**
 * Rate-limited API call wrapper (Rule 3: no simultaneous requests)
 */
const rateLimitedCall = async (requestFn) => {
  return new Promise((resolve, reject) => {
    const queueItem = { 
      requestFn, 
      resolve, 
      reject,
      enqueuedAt: Date.now()
    }
    callQueue.push(queueItem)
    
    // Update high water mark
    if (callQueue.length > metrics.queueHighWaterMark) {
      metrics.queueHighWaterMark = callQueue.length
    }
    
    logRateLimit('ENQUEUED', { position: callQueue.length })
    processQueue()
  })
}

/**
 * Process the call queue with rate limiting (Rules 1-4)
 */
const processQueue = async () => {
  // Rule 3: No simultaneous processing
  if (isProcessingQueue || callQueue.length === 0) return
  
  isProcessingQueue = true
  
  while (callQueue.length > 0) {
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime
    const effectiveInterval = getEffectiveInterval()
    
    // Rule 2: Verify time elapsed before request
    if (timeSinceLastCall < effectiveInterval) {
      const waitTime = effectiveInterval - timeSinceLastCall
      metrics.totalWaitTime += waitTime
      logRateLimit('WAITING', { waitMs: waitTime, interval: effectiveInterval })
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    const { requestFn, resolve, reject, enqueuedAt } = callQueue.shift()
    const queueWaitTime = Date.now() - enqueuedAt
    
    // Rule 4: Record exact time of request
    lastCallTime = Date.now()
    metrics.totalRequests++
    
    logRateLimit('EXECUTING', { queueWaitMs: queueWaitTime })
    
    try {
      const result = await requestFn()
      metrics.successfulRequests++
      checkBackoffReset()
      logRateLimit('SUCCESS')
      resolve(result)
    } catch (error) {
      metrics.failedRequests++
      
      // Rule 5: Progressive backoff on rate limit
      if (error.response?.status === 429) {
        applyBackoff()
        const backoffWait = getEffectiveInterval()
        logRateLimit('RATE_LIMITED', { waitMs: backoffWait })
        await new Promise(resolve => setTimeout(resolve, backoffWait))
        
        // Re-queue the failed request
        callQueue.unshift({ requestFn, resolve, reject, enqueuedAt: Date.now() })
        logRateLimit('REQUEUED_AFTER_429')
      } else {
        logRateLimit('ERROR', { status: error.response?.status, message: error.message })
        reject(error)
      }
    }
  }
  
  isProcessingQueue = false
  logRateLimit('QUEUE_EMPTY')
}

/**
 * Make a rate-limited GET request to CoinGecko API
 * @param {string} endpoint - API endpoint (e.g., '/coins/markets')
 * @param {Object} params - Query parameters
 * @param {number} timeout - Request timeout in ms (default: 15000)
 */
const get = async (endpoint, params = {}, timeout = 15000) => {
  return rateLimitedCall(async () => {
    const response = await axios.get(`${COINGECKO_API}${endpoint}`, {
      params: addApiKeyToParams(params),
      timeout
    })
    return response.data
  })
}

/**
 * Get current service status
 */
const getServiceStatus = () => ({
  queueLength: callQueue.length,
  isProcessing: isProcessingQueue,
  currentBackoffMultiplier,
  effectiveIntervalMs: getEffectiveInterval(),
  metrics: { ...metrics }
})

module.exports = {
  get,
  rateLimitedCall,
  addApiKeyToParams,
  getRateLimitMetrics,
  getServiceStatus,
  COINGECKO_API,
  BASE_INTERVAL
}
