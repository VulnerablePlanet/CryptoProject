/**
 * CoinGecko proxy — GET /api/coingecko/*
 *
 * The frontend called /api/coingecko, which only existed in the Vite dev
 * proxy: in production (Express serving the SPA) every call returned 404 and
 * the dashboard had no prices. Serving it here also routes the calls through
 * the centralized rate limiter (shared CoinGecko quota) and adds the server's
 * COINGECKO_API_KEY, which the dev proxy never sent.
 *
 * Only the read-only endpoints the app uses are allowed.
 */

const express = require('express')
const coingeckoRateLimiter = require('../services/coingeckoRateLimiter')
const LRUCache = require('../utils/lruCache')
const { auth } = require('../middleware/auth')
const { createLogger } = require('../utils/logger')

const router = express.Router()
const logger = createLogger('routes:coingecko')

const ALLOWED_PATHS = [
  /^\/coins\/markets$/,
  /^\/coins\/[a-z0-9-]+$/,
  /^\/coins\/[a-z0-9-]+\/market_chart$/,
  /^\/coins\/[a-z0-9-]+\/ohlc$/,
  /^\/search\/trending$/,
  /^\/global$/,
  /^\/simple\/price$/
]

const CACHE_TTL_MS = 30 * 1000
const cache = new LRUCache(200)

const isAllowedPath = (path) => ALLOWED_PATHS.some((pattern) => pattern.test(path))

router.use(auth)

router.get('/{*path}', async (req, res) => {
  const path = req.path
  if (!isAllowedPath(path)) {
    return res.status(404).json({ success: false, message: 'Endpoint not found' })
  }

  // Stable cache key: sorted query parameters
  const params = Object.fromEntries(Object.entries(req.query).sort(([a], [b]) => a.localeCompare(b)))
  const key = `${path}?${new URLSearchParams(params).toString()}`

  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return res.json(cached.data)
  }

  try {
    const data = await coingeckoRateLimiter.get(path, params)
    cache.set(key, { data, at: Date.now() })
    res.json(data)
  } catch (error) {
    const status = error.response?.status
    logger.error('CoinGecko request failed', { path, status, message: error.message })
    // Pass through "not found"/"rate limited"; anything else is an upstream failure
    const clientStatus = status === 404 || status === 429 ? status : 502
    res.status(clientStatus).json({ success: false, message: 'Market data provider unavailable' })
  }
})

module.exports = router
module.exports.isAllowedPath = isAllowedPath
