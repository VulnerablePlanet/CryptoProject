/**
 * ============================================================================
 * CCXT Service - Unified Exchange Data Access
 * ============================================================================
 * Provides unified interface for cryptocurrency exchange data using CCXT.
 * Supports multiple exchanges with rate limiting and caching.
 */

const ccxt = require('ccxt')

// ============================================================================
// Configuration
// ============================================================================

const SUPPORTED_EXCHANGES = {
  binance: { name: 'Binance', defaultSymbol: 'BTC/USDT', rateLimit: 1200 },
  bitget: { name: 'Bitget', defaultSymbol: 'BTC/USDT', rateLimit: 200 },
  coinbase: { name: 'Coinbase', defaultSymbol: 'BTC/USD', rateLimit: 300 },
  kraken: { name: 'Kraken', defaultSymbol: 'BTC/USD', rateLimit: 3000 },
  kucoin: { name: 'KuCoin', defaultSymbol: 'BTC/USDT', rateLimit: 200 },
  bybit: { name: 'Bybit', defaultSymbol: 'BTC/USDT', rateLimit: 200 },
  okx: { name: 'OKX', defaultSymbol: 'BTC/USDT', rateLimit: 200 }
}

const TIMEFRAME_MAP = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
  '1w': '1w'
}

// Cache for exchange instances and data
const exchangeInstances = new Map()
const dataCache = new Map()
const CACHE_TTL = 60000 // 1 minute cache

// ============================================================================
// Exchange Instance Management
// ============================================================================

/**
 * Get or create an exchange instance
 * @param {string} exchangeId - Exchange identifier (e.g., 'binance')
 * @returns {object} CCXT exchange instance
 */
const getExchange = (exchangeId) => {
  const id = exchangeId.toLowerCase()
  
  if (!SUPPORTED_EXCHANGES[id]) {
    throw new Error(`Exchange ${id} is not supported`)
  }
  
  if (!exchangeInstances.has(id)) {
    const ExchangeClass = ccxt[id]
    
    // Exchange-specific configurations
    let exchangeConfig = {
      enableRateLimit: true,
      timeout: 30000,
      options: {
        defaultType: 'spot'
      }
    }
    
    // Bitget requires specific productType for spot markets
    if (id === 'bitget') {
      exchangeConfig.options = {
        defaultType: 'spot',
        defaultSubType: 'spot',
        // For some Bitget API calls, the 'spot' type needs to be explicit
        fetchMarkets: { type: 'spot' }
      }
    }
    
    // Bybit also benefits from explicit type configuration
    if (id === 'bybit') {
      exchangeConfig.options = {
        defaultType: 'spot'
      }
    }
    
    const exchange = new ExchangeClass(exchangeConfig)
    exchangeInstances.set(id, exchange)
  }
  
  return exchangeInstances.get(id)
}

/**
 * Get list of supported exchanges
 * @returns {object[]} Array of supported exchanges
 */
const getSupportedExchanges = () => {
  return Object.entries(SUPPORTED_EXCHANGES).map(([id, info]) => ({
    id,
    name: info.name,
    defaultSymbol: info.defaultSymbol
  }))
}

// ============================================================================
// Cache Helpers
// ============================================================================

const getCacheKey = (exchange, type, symbol, timeframe = '') => {
  return `${exchange}:${type}:${symbol}:${timeframe}`
}

const getFromCache = (key) => {
  const cached = dataCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

const setCache = (key, data) => {
  dataCache.set(key, { data, timestamp: Date.now() })
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch markets from an exchange
 * @param {string} exchangeId - Exchange identifier
 * @returns {object[]} Array of market symbols
 */
const fetchMarkets = async (exchangeId) => {
  const cacheKey = getCacheKey(exchangeId, 'markets', 'all')
  const cached = getFromCache(cacheKey)
  if (cached) return cached
  
  try {
    const exchange = getExchange(exchangeId)
    await exchange.loadMarkets()
    
    const id = exchangeId.toLowerCase()
    
    // Filter markets - different exchanges have different structures
    const markets = Object.values(exchange.markets)
      .filter(m => {
        // Must be active
        if (!m.active) return false
        
        // For Bitget, check type === 'spot' as well as the spot flag
        if (id === 'bitget') {
          return m.spot === true || m.type === 'spot'
        }
        
        // Standard check for other exchanges
        return m.spot === true
      })
      .map(m => ({
        symbol: m.symbol,
        base: m.base,
        quote: m.quote,
        baseId: m.baseId,
        quoteId: m.quoteId,
        precision: {
          price: m.precision?.price,
          amount: m.precision?.amount
        }
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
    
    console.log(`[ccxtService] Fetched ${markets.length} spot markets from ${exchangeId}`)
    
    setCache(cacheKey, markets)
    return markets
  } catch (error) {
    console.error(`Failed to fetch markets from ${exchangeId}:`, error.message)
    throw error
  }
}

/**
 * Fetch OHLCV candles from an exchange
 * @param {string} exchangeId - Exchange identifier
 * @param {string} symbol - Trading pair symbol (e.g., 'BTC/USDT')
 * @param {string} timeframe - Candle timeframe (e.g., '1h')
 * @param {number} limit - Number of candles to fetch
 * @returns {object[]} Array of OHLCV candles
 */
const fetchOHLCV = async (exchangeId, symbol, timeframe = '1h', limit = 100) => {
  const cacheKey = getCacheKey(exchangeId, 'ohlcv', symbol, timeframe)
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { candles: cached, fromCache: true }
  }
  
  try {
    const exchange = getExchange(exchangeId)
    await exchange.loadMarkets()
    
    const tf = TIMEFRAME_MAP[timeframe] || '1h'
    const ohlcv = await exchange.fetchOHLCV(symbol, tf, undefined, limit)
    
    const candles = ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp,
      time: Math.floor(timestamp / 1000), // TradingView format
      open,
      high,
      low,
      close,
      volume
    }))
    
    setCache(cacheKey, candles)
    return { candles, fromCache: false }
  } catch (error) {
    console.error(`Failed to fetch OHLCV from ${exchangeId}:`, error.message)
    throw error
  }
}

/**
 * Fetch order book from an exchange
 * @param {string} exchangeId - Exchange identifier
 * @param {string} symbol - Trading pair symbol
 * @param {number} limit - Depth limit
 * @returns {object} Order book with bids and asks
 */
const fetchOrderBook = async (exchangeId, symbol, limit = 50) => {
  const cacheKey = getCacheKey(exchangeId, 'orderbook', symbol)
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { orderBook: cached, fromCache: true }
  }
  
  try {
    const exchange = getExchange(exchangeId)
    await exchange.loadMarkets()
    
    const orderBook = await exchange.fetchOrderBook(symbol, limit)
    
    // Calculate cumulative volumes for depth chart
    let bidCumulative = 0
    let askCumulative = 0
    
    const processedOrderBook = {
      timestamp: orderBook.timestamp,
      bids: orderBook.bids.map(([price, amount]) => {
        bidCumulative += amount
        return { price, amount, cumulative: bidCumulative }
      }),
      asks: orderBook.asks.map(([price, amount]) => {
        askCumulative += amount
        return { price, amount, cumulative: askCumulative }
      }),
      midPrice: orderBook.bids.length && orderBook.asks.length
        ? (orderBook.bids[0][0] + orderBook.asks[0][0]) / 2
        : null
    }
    
    setCache(cacheKey, processedOrderBook)
    return { orderBook: processedOrderBook, fromCache: false }
  } catch (error) {
    console.error(`Failed to fetch order book from ${exchangeId}:`, error.message)
    throw error
  }
}

/**
 * Fetch ticker from an exchange
 * @param {string} exchangeId - Exchange identifier
 * @param {string} symbol - Trading pair symbol
 * @returns {object} Ticker data
 */
const fetchTicker = async (exchangeId, symbol) => {
  const cacheKey = getCacheKey(exchangeId, 'ticker', symbol)
  const cached = getFromCache(cacheKey)
  if (cached) {
    return { ticker: cached, fromCache: true }
  }
  
  try {
    const exchange = getExchange(exchangeId)
    await exchange.loadMarkets()
    
    const raw = await exchange.fetchTicker(symbol)
    
    const ticker = {
      symbol: raw.symbol,
      timestamp: raw.timestamp,
      high: raw.high,
      low: raw.low,
      bid: raw.bid,
      ask: raw.ask,
      last: raw.last,
      open: raw.open,
      close: raw.close,
      change: raw.change,
      percentage: raw.percentage,
      volume: raw.baseVolume,
      quoteVolume: raw.quoteVolume
    }
    
    setCache(cacheKey, ticker)
    return { ticker, fromCache: false }
  } catch (error) {
    console.error(`Failed to fetch ticker from ${exchangeId}:`, error.message)
    throw error
  }
}

/**
 * Get available timeframes for an exchange
 * @param {string} exchangeId - Exchange identifier
 * @returns {string[]} Array of supported timeframes
 */
const getTimeframes = (exchangeId) => {
  try {
    const exchange = getExchange(exchangeId)
    return Object.keys(exchange.timeframes || TIMEFRAME_MAP)
  } catch (error) {
    return Object.keys(TIMEFRAME_MAP)
  }
}

/**
 * Clear cache for an exchange or all
 * @param {string} exchangeId - Optional exchange identifier
 */
const clearCache = (exchangeId = null) => {
  if (exchangeId) {
    for (const key of dataCache.keys()) {
      if (key.startsWith(exchangeId)) {
        dataCache.delete(key)
      }
    }
  } else {
    dataCache.clear()
  }
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
const getCacheStats = () => {
  return {
    size: dataCache.size,
    exchanges: exchangeInstances.size
  }
}

module.exports = {
  getSupportedExchanges,
  fetchMarkets,
  fetchOHLCV,
  fetchOrderBook,
  fetchTicker,
  getTimeframes,
  clearCache,
  getCacheStats,
  SUPPORTED_EXCHANGES,
  TIMEFRAME_MAP
}
