/**
 * ============================================================================
 * RESEARCH PHASE - Phase 4
 * ============================================================================
 * Aggregates sentiment from multiple sources:
 * - Fear & Greed Index (alternative.me API, cache 5min)
 * - CryptoPanic sentiment (primary news source, if API key available)
 * - ApeWisdom social metrics (Reddit/4chan)
 *
 * API Signature:
 *   async function runResearchCycle(symbol)
 *   Returns: { fearGreed, sentiment, socialMetrics, timestamp }
 */

const axios = require('axios')

// Allow injection of axios mock for testing
let _axios = axios

function _setAxios(mockAxios) {
  _axios = mockAxios || axios
}

// Cache storage using Map with timestamp tracking
const cache = new Map()

// Cache TTLs (in ms)
const CACHE_TTL = {
  FEAR_GREED: 5 * 60 * 1000,  // 5 minutes
  CRYPTOPANIC: 30 * 1000,      // 30 seconds
  APEWISDOM: 60 * 1000         // 1 minute
}

// CryptoPanic minimum score threshold
const MIN_PANIC_SCORE = 0.6

/**
 * Check if cache is still valid
 * @param {string} key - Cache key
 * @param {number} ttl - TTL in ms
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(key, ttl) {
  const entry = cache.get(key)
  if (!entry) return false
  return (Date.now() - entry.timestamp) < ttl
}

/**
 * Get cached data if valid
 * @param {string} key - Cache key
 * @returns {*} Cached data or null
 */
function getCached(key) {
  const entry = cache.get(key)
  return entry ? entry.data : null
}

/**
 * Set cache entry
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 */
function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Fetch Fear & Greed Index from alternative.me
 * Endpoint: https://api.alternative.me/fng/?limit=1&format=json
 * Cache: 5 minutes
 * @returns {Promise<{value: number, classification: string}>}
 */
async function fetchFearAndGreed() {
  if (isCacheValid('fearGreed', CACHE_TTL.FEAR_GREED)) {
    return getCached('fearGreed')
  }

  try {
      const response = await _axios.get(
        'https://api.alternative.me/fng/?limit=1&format=json',
      { timeout: 10000 }
    )

    const rawData = response.data.data[0]
    const data = {
      value: parseInt(rawData.value, 10),
      classification: rawData.value_classification
    }

    setCache('fearGreed', data)
    return data
  } catch (error) {
    console.error('[Research] Fear & Greed fetch failed:', error.message)
    const cached = getCached('fearGreed')
    if (cached) return cached
    // Return neutral fallback if no cache
    return { value: 50, classification: 'Neutral' }
  }
}

/**
 * Fetch sentiment from CryptoPanic
 * Requires API key: CRYPTOPANIC_API_KEY env var
 * Cache: 30 seconds
 * @param {string} currency - Base currency (e.g., 'BTC')
 * @returns {Promise<{news: Array, sentimentScore: number}>}
 */
async function fetchCryptoPanic(currency = 'BTC') {
  const apiKey = process.env.CRYPTOPANIC_API_KEY

  // If no API key, return neutral sentiment gracefully
  if (!apiKey) {
    console.log('[Research] CryptoPanic: No API key, returning neutral sentiment')
    return { news: [], sentimentScore: 0.5 }
  }

  if (isCacheValid('cryptoPanic', CACHE_TTL.CRYPTOPANIC)) {
    return getCached('cryptoPanic')
  }

  try {
    const baseUrl = 'https://cryptopanic.com/api/free/v1/posts/'
    const params = new URLSearchParams({
      currency: currency,
      kind: 'news',
      filter: 'important'
    })

    const response = await _axios.get(`${baseUrl}?${params}`, {
      timeout: 10000,
      headers: { Authorization: `Token ${apiKey}` }
    })

    const news = response.data.results || []

    // Filter by panic score (high positive votes ratio)
    const filteredNews = news
      .filter(item => {
        const votes = item.votes || {}
        const positive = votes.positive || 0
        const negative = votes.negative || 0
        const total = positive + negative

        if (total === 0) return false
        const panicScore = total >= 5 ? positive / total : 0
        return panicScore >= MIN_PANIC_SCORE
      })
      .map(item => ({
        title: item.title,
        url: item.url,
        source: item.source?.domain || 'unknown',
        publishedAt: item.published_at,
        votes: item.votes,
        currencies: item.currencies?.map(c => c.code) || []
      }))

    // Calculate aggregated sentiment score (0-1, where 0.5 is neutral)
    const bullishKeywords = ['bullish', 'up', 'rise', 'gain', 'growth', 'surge']
    const bearishKeywords = ['bearish', 'down', 'fall', 'drop', 'crash', 'decline']

    let bullishCount = 0
    let bearishCount = 0

    filteredNews.forEach(item => {
      const title = item.title.toLowerCase()
      if (bullishKeywords.some(k => title.includes(k))) bullishCount++
      if (bearishKeywords.some(k => title.includes(k))) bearishCount++
    })

    const total = bullishCount + bearishCount
    const sentimentScore = total > 0 ? bullishCount / total : 0.5

    const result = { news: filteredNews, sentimentScore }
    setCache('cryptoPanic', result)
    return result
  } catch (error) {
    console.error('[Research] CryptoPanic fetch failed:', error.message)
    const cached = getCached('cryptoPanic')
    if (cached) return cached
    return { news: [], sentimentScore: 0.5 }
  }
}

/**
 * Fetch social metrics from ApeWisdom (Reddit/4chan)
 * Free API, no authentication required
 * Cache: 1 minute
 * @returns {Promise<{topMentions: Array, totalMentions: number}>}
 */
async function fetchSocialMetrics() {
  if (isCacheValid('apeWisdom', CACHE_TTL.APEWISDOM)) {
    return getCached('apeWisdom')
  }

  try {
    const response = await _axios.get(
      'https://apewisdom.io/api/v1/filter/all',
      { timeout: 10000 }
    )

    const coins = response.data || []
    const topMentions = coins.slice(0, 10).map(coin => ({
      coin: coin.coin,
      shills: coin.shills || 0,
      rank: coin.rank || 0
    }))

    const totalMentions = topMentions.reduce((sum, c) => sum + c.shills, 0)

    const result = { topMentions, totalMentions }
    setCache('apeWisdom', result)
    return result
  } catch (error) {
    console.error('[Research] ApeWisdom fetch failed:', error.message)
    const cached = getCached('apeWisdom')
    if (cached) return cached
    return { topMentions: [], totalMentions: 0 }
  }
}

/**
 * Main research cycle function
 * Aggregates Fear & Greed, CryptoPanic sentiment, and social metrics
 * @param {string} symbol - Trading symbol (e.g., 'BTC/USDT')
 * @returns {Promise<{fearGreed: object, sentiment: object, socialMetrics: object, timestamp: number}>}
 */
async function runResearchCycle(symbol) {
  console.log(`[Research] Starting research cycle for ${symbol}`)

  // Extract base currency from symbol
  const baseCurrency = symbol.split('/')[0]

  // Fetch all sources in parallel
  const [fearGreed, cryptoPanic, socialMetrics] = await Promise.all([
    fetchFearAndGreed(),
    fetchCryptoPanic(baseCurrency),
    fetchSocialMetrics()
  ])

  // Normalize Fear & Greed to sentiment scale (0-1)
  const fgSentiment = fearGreed.value / 100

  // Build result structure
  const result = {
    fearGreed: {
      value: fearGreed.value,
      classification: fearGreed.classification
    },
    sentiment: {
      cryptoPanicScore: cryptoPanic.sentimentScore,
      newsCount: cryptoPanic.news.length,
      sources: ['cryptopanic']
    },
    socialMetrics: {
      topMentions: socialMetrics.topMentions,
      totalMentions: socialMetrics.totalMentions,
      sources: ['reddit', '4chan']
    },
    timestamp: Date.now()
  }

  console.log(`[Research] Completed: FG=${fearGreed.classification}, ` +
    `Sentiment=${cryptoPanic.sentimentScore.toFixed(2)}, ` +
    `Social=${socialMetrics.totalMentions} mentions`)

  return result
}

/**
 * Aggregate and normalize social metrics from all sources
 * Separated from runResearchCycle for testability
 * @param {object} fearGreed - Fear & Greed data { value, classification }
 * @param {Array|object} cryptoPanic - Filtered news array or { news, sentimentScore }
 * @param {object} apeWisdom - Social metrics { coins } or { topMentions, totalMentions }
 * @returns {object} Normalized metrics with fearGreed, sentiment, socialMetrics
 */
function aggregateSocialMetrics(fearGreed, cryptoPanic, apeWisdom) {
  // Normalize Fear & Greed to 0-1 scale
  const fgValue = fearGreed.value / 100
  const fearGreedResult = {
    value: fearGreed.value,
    classification: fearGreed.classification,
    fear: fgValue < 0.5 ? 1 - fgValue : 0,
    greed: fgValue > 0.5 ? fgValue : 0
  }

  // Calculate bullish ratio from news titles
  const bullishKeywords = ['bullish', 'bull', 'up', 'rise', 'gain', 'growth', 'surge']
  const bearishKeywords = ['bearish', 'bear', 'down', 'fall', 'drop', 'crash', 'decline']
  let bullishCount = 0
  let bearishCount = 0

  const news = Array.isArray(cryptoPanic) ? cryptoPanic : (cryptoPanic.news || [])
  news.forEach(item => {
    const title = (item.title || '').toLowerCase()
    if (bullishKeywords.some(k => title.includes(k))) bullishCount++
    if (bearishKeywords.some(k => title.includes(k))) bearishCount++
  })

  const total = bullishCount + bearishCount
  const bullishRatio = total > 0 ? bullishCount / total : 0.5

  // Aggregate social mentions
  const coins = apeWisdom.coins || apeWisdom.topMentions || []
  const totalSocialMentions = coins.reduce((sum, c) => sum + (c.shills || 0), 0)

  return {
    fearGreed: fearGreedResult,
    sentiment: {
      bullishRatio,
      newsCount: news.length
    },
    socialMetrics: {
      totalSocialMentions,
      topMentions: coins.slice(0, 10)
    }
  }
}

module.exports = {
  runResearchCycle,
  fetchFearAndGreed,
  fetchCryptoPanic,
  fetchSocialMetrics,
  aggregateSocialMetrics,
  _clearCache() { cache.clear() },
  _setAxios
}