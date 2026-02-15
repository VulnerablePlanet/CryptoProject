/**
 * ============================================================================
 * CCXT Price Service - Price fetching from exchanges
 * ============================================================================
 * Uses ccxtService to fetch real-time prices from different exchanges.
 * Provides caching and batch price fetching capabilities.
 */

const ccxtService = require('./ccxtService')

// Price cache with TTL
const priceCache = new Map()
const PRICE_CACHE_TTL = 30000 // 30 seconds

/**
 * Get cached price or null if expired/not found
 * @param {string} key - Cache key
 * @returns {object|null}
 */
const getCachedPrice = (key) => {
  const cached = priceCache.get(key)
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.data
  }
  return null
}

/**
 * Set price in cache
 * @param {string} key - Cache key
 * @param {object} data - Price data
 */
const setCachedPrice = (key, data) => {
  priceCache.set(key, { data, timestamp: Date.now() })
}

/**
 * Get price from a specific exchange
 * @param {string} exchangeId - Exchange identifier (e.g., 'binance')
 * @param {string} symbol - Trading pair symbol (e.g., 'BTC/USDT')
 * @returns {object} Price data including last, bid, ask, change
 */
const getPrice = async (exchangeId, symbol) => {
  const cacheKey = `${exchangeId}:${symbol}`
  const cached = getCachedPrice(cacheKey)
  
  if (cached) {
    return { ...cached, fromCache: true }
  }
  
  try {
    const { ticker, fromCache } = await ccxtService.fetchTicker(exchangeId, symbol)
    
    const priceData = {
      exchange: exchangeId,
      symbol: ticker.symbol,
      price: ticker.last,
      bid: ticker.bid,
      ask: ticker.ask,
      high24h: ticker.high,
      low24h: ticker.low,
      change24h: ticker.change,
      changePercent24h: ticker.percentage,
      volume24h: ticker.volume,
      timestamp: ticker.timestamp || Date.now()
    }
    
    setCachedPrice(cacheKey, priceData)
    return { ...priceData, fromCache }
  } catch (error) {
    console.error(`[ccxtPriceService] Error fetching price for ${symbol} from ${exchangeId}:`, error.message)
    throw error
  }
}

/**
 * Get prices for multiple coins from their respective exchanges
 * @param {Array} coins - Array of { exchange, symbol } objects
 * @returns {object} Object with prices keyed by symbol
 */
const getMultiplePrices = async (coins) => {
  const results = {}
  const errors = []
  
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5
  
  for (let i = 0; i < coins.length; i += BATCH_SIZE) {
    const batch = coins.slice(i, i + BATCH_SIZE)
    
    const batchResults = await Promise.allSettled(
      batch.map(async (coin) => {
        const { exchange, symbol } = coin
        try {
          const priceData = await getPrice(exchange, symbol)
          return { ...coin, ...priceData }
        } catch (error) {
          return { ...coin, error: error.message }
        }
      })
    )
    
    batchResults.forEach((result, index) => {
      const coin = batch[index]
      const key = `${coin.exchange}:${coin.symbol}`
      
      if (result.status === 'fulfilled') {
        results[key] = result.value
      } else {
        errors.push({ key, error: result.reason?.message || 'Unknown error' })
      }
    })
  }
  
  return { results, errors }
}

/**
 * Map CoinGecko coinId to CCXT symbol
 * Common mappings for popular coins
 */
const COINGECKO_TO_SYMBOL = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  tether: 'USDT',
  'binance-coin': 'BNB',
  binancecoin: 'BNB',
  ripple: 'XRP',
  cardano: 'ADA',
  solana: 'SOL',
  polkadot: 'DOT',
  dogecoin: 'DOGE',
  'shiba-inu': 'SHIB',
  litecoin: 'LTC',
  'wrapped-bitcoin': 'WBTC',
  chainlink: 'LINK',
  'uniswap': 'UNI',
  avalanche: 'AVAX',
  'avalanche-2': 'AVAX',
  polygon: 'MATIC',
  'matic-network': 'MATIC',
  stellar: 'XLM',
  cosmos: 'ATOM',
  'near-protocol': 'NEAR',
  near: 'NEAR',
  algorand: 'ALGO',
  'ftx-token': 'FTT',
  'internet-computer': 'ICP',
  vechain: 'VET',
  filecoin: 'FIL',
  apecoin: 'APE',
  'the-sandbox': 'SAND',
  decentraland: 'MANA',
  axie: 'AXS',
  'axie-infinity': 'AXS',
  aave: 'AAVE',
  maker: 'MKR',
  'lido-dao': 'LDO',
  optimism: 'OP',
  arbitrum: 'ARB',
  pepe: 'PEPE',
  sui: 'SUI',
  aptos: 'APT',
  injective: 'INJ'
}

/**
 * Convert CoinGecko coinId to CCXT base symbol
 * @param {string} coinId - CoinGecko coin ID
 * @returns {string} Base symbol (e.g., 'BTC')
 */
const coinIdToSymbol = (coinId) => {
  return COINGECKO_TO_SYMBOL[coinId?.toLowerCase()] || coinId?.toUpperCase()
}

/**
 * Build trading pair from base symbol
 * @param {string} baseSymbol - Base symbol (e.g., 'BTC')
 * @param {string} quoteSymbol - Quote symbol (default: 'USDT')
 * @returns {string} Trading pair (e.g., 'BTC/USDT')
 */
const buildTradingPair = (baseSymbol, quoteSymbol = 'USDT') => {
  return `${baseSymbol}/${quoteSymbol}`
}

/**
 * Get price for a CoinGecko coinId from an exchange
 * @param {string} coinId - CoinGecko coin ID
 * @param {string} exchangeId - Exchange identifier
 * @param {string} quoteSymbol - Quote symbol (default: 'USDT')
 * @returns {object} Price data
 */
const getPriceByCoinId = async (coinId, exchangeId = 'binance', quoteSymbol = 'USDT') => {
  const baseSymbol = coinIdToSymbol(coinId)
  const tradingPair = buildTradingPair(baseSymbol, quoteSymbol)
  
  return getPrice(exchangeId, tradingPair)
}

/**
 * Clear the price cache
 */
const clearCache = () => {
  priceCache.clear()
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
const getCacheStats = () => {
  return {
    size: priceCache.size,
    ttl: PRICE_CACHE_TTL
  }
}

module.exports = {
  getPrice,
  getMultiplePrices,
  getPriceByCoinId,
  coinIdToSymbol,
  buildTradingPair,
  clearCache,
  getCacheStats,
  COINGECKO_TO_SYMBOL
}
