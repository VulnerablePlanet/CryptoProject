/**
 * Fibonacci CCXT Store
 * Pinia store for managing CCXT-based Fibonacci analysis state
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as fibonacciCcxtService from '@/services/fibonacciCcxtService'

// Cache configuration
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes
const dataCache = new Map()

export const useFibonacciCcxtStore = defineStore('fibonacciCcxt', () => {
  // ============================================================================
  // State
  // ============================================================================

  const selectedExchange = ref('binance')
  const selectedSymbol = ref('BTC/USDT')
  const selectedTimeframe = ref('4h')
  
  const analysis = ref(null)
  const confluence = ref(null)
  const signals = ref([])
  const candles = ref([])
  
  const isLoading = ref(false)
  const isLoadingSymbols = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const cacheHit = ref(false)

  // Supported exchanges (loaded from API)
  const exchanges = ref([
    { id: 'binance', name: 'Binance', defaultSymbol: 'BTC/USDT' },
    { id: 'coinbase', name: 'Coinbase', defaultSymbol: 'BTC/USD' },
    { id: 'kraken', name: 'Kraken', defaultSymbol: 'BTC/USD' },
    { id: 'kucoin', name: 'KuCoin', defaultSymbol: 'BTC/USDT' },
    { id: 'bybit', name: 'Bybit', defaultSymbol: 'BTC/USDT' },
    { id: 'okx', name: 'OKX', defaultSymbol: 'BTC/USDT' }
  ])

  // Common trading pairs
  const popularSymbols = [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 
    'ADA/USDT', 'DOGE/USDT', 'DOT/USDT', 'LINK/USDT'
  ]

  const timeframes = [
    { value: '1m', label: '1M', description: '1 Minute' },
    { value: '5m', label: '5M', description: '5 Minutes' },
    { value: '15m', label: '15M', description: '15 Minutes' },
    { value: '30m', label: '30M', description: '30 Minutes' },
    { value: '1h', label: '1H', description: '1 Hour' },
    { value: '4h', label: '4H', description: '4 Hours', recommended: true },
    { value: '1d', label: '1D', description: '1 Day', recommended: true },
    { value: '1w', label: '1W', description: '1 Week' }
  ]

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  const getCacheKey = (exchange, symbol, timeframe) => {
    return `${exchange}:${symbol}:${timeframe}`
  }

  const getFromCache = (exchange, symbol, timeframe) => {
    const key = getCacheKey(exchange, symbol, timeframe)
    const cached = dataCache.get(key)
    
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      dataCache.delete(key)
      return null
    }
    
    return cached.data
  }

  const saveToCache = (exchange, symbol, timeframe, data) => {
    const key = getCacheKey(exchange, symbol, timeframe)
    dataCache.set(key, { data, timestamp: Date.now() })
  }

  // ============================================================================
  // Getters (Computed)
  // ============================================================================

  const currentExchange = computed(() => {
    return exchanges.value.find(e => e.id === selectedExchange.value)
  })

  const trend = computed(() => analysis.value?.trend || 'neutral')
  const isBullish = computed(() => trend.value === 'bullish')
  const isBearish = computed(() => trend.value === 'bearish')

  const currentPrice = computed(() => analysis.value?.currentPrice || 0)
  
  const pivots = computed(() => analysis.value?.pivots || null)
  
  const retracementLevels = computed(() => analysis.value?.levels?.retracement || {})
  const extensionLevels = computed(() => analysis.value?.levels?.extensions || {})
  
  const nearestLevel = computed(() => analysis.value?.nearestLevel || null)
  const goldenPocket = computed(() => analysis.value?.goldenPocket || null)
  const priceRange = computed(() => analysis.value?.meta?.priceRange || 0)

  // Confluence computed
  const confluenceScore = computed(() => confluence.value?.score || 50)
  const overallSignal = computed(() => confluence.value?.overallSignal || 'neutral')
  const indicators = computed(() => confluence.value?.indicators || {})
  const confluenceSignals = computed(() => confluence.value?.signals || [])

  // RSI
  const rsiValue = computed(() => indicators.value?.rsi?.value || null)
  const rsiCondition = computed(() => indicators.value?.rsi?.condition || 'unknown')

  // MACD
  const macdHistogram = computed(() => indicators.value?.macd?.histogram || 0)
  const macdCondition = computed(() => indicators.value?.macd?.condition || 'unknown')

  // Bollinger Bands
  const bbPercentB = computed(() => indicators.value?.bollingerBands?.percentB || 0.5)
  const bbCondition = computed(() => indicators.value?.bollingerBands?.condition || 'neutral')

  // Volume
  const volumeRatio = computed(() => indicators.value?.volume?.ratio || 1)
  const hasVolumeSpike = computed(() => indicators.value?.volume?.hasSpike || false)

  // All levels combined for chart
  const allLevels = computed(() => {
    const levels = []
    
    // Add retracement levels
    Object.entries(retracementLevels.value).forEach(([key, level]) => {
      levels.push({
        ...level,
        key: key + '%',
        type: 'retracement',
        color: level.isGoldenPocket ? '#f59e0b' : '#3b82f6'
      })
    })
    
    // Add extension levels
    Object.entries(extensionLevels.value).forEach(([key, level]) => {
      levels.push({
        ...level,
        key: key + '%',
        type: 'extension',
        color: level.isGoldenExtension ? '#10b981' : '#8b5cf6'
      })
    })
    
    return levels.sort((a, b) => a.price - b.price)
  })

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Fetch Fibonacci analysis for current selection
   */
  const fetchAnalysis = async (forceRefresh = false) => {
    const exchange = selectedExchange.value
    const symbol = selectedSymbol.value
    const timeframe = selectedTimeframe.value

    // Check cache first
    if (!forceRefresh) {
      const cached = getFromCache(exchange, symbol, timeframe)
      if (cached) {
        analysis.value = cached.analysis
        confluence.value = cached.confluence
        signals.value = cached.signals
        candles.value = cached.candles
        cacheHit.value = true
        lastUpdated.value = new Date()
        return cached
      }
    }

    isLoading.value = true
    error.value = null
    cacheHit.value = false

    try {
      const result = await fibonacciCcxtService.getAnalysis(
        exchange,
        symbol,
        timeframe
      )

      analysis.value = {
        success: result.success,
        exchange: result.exchange,
        symbol: result.symbol,
        timeframe: result.timeframe,
        trend: result.trend,
        currentPrice: result.currentPrice,
        pivots: result.pivots,
        levels: result.levels,
        nearestLevel: result.nearestLevel,
        goldenPocket: result.goldenPocket,
        meta: result.meta
      }

      confluence.value = result.confluence
      signals.value = result.signals || []
      candles.value = result.candles || []

      lastUpdated.value = new Date()

      // Save to cache
      saveToCache(exchange, symbol, timeframe, {
        analysis: analysis.value,
        confluence: confluence.value,
        signals: signals.value,
        candles: candles.value
      })

      return result
    } catch (err) {
      error.value = err.message || 'Failed to fetch Fibonacci analysis'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Change selected exchange
   */
  const changeExchange = async (exchangeId) => {
    selectedExchange.value = exchangeId
    
    // Find default symbol for this exchange
    const exchange = exchanges.value.find(e => e.id === exchangeId)
    if (exchange?.defaultSymbol) {
      selectedSymbol.value = exchange.defaultSymbol
    }
    
    await fetchAnalysis()
  }

  /**
   * Change selected symbol
   */
  const changeSymbol = async (symbol) => {
    selectedSymbol.value = symbol
    await fetchAnalysis()
  }

  /**
   * Change timeframe
   */
  const changeTimeframe = async (timeframe) => {
    selectedTimeframe.value = timeframe
    await fetchAnalysis()
  }

  /**
   * Force refresh data
   */
  const refresh = async () => {
    await fetchAnalysis(true)
  }

  /**
   * Clear error
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * Initialize store
   */
  const initialize = async () => {
    try {
      // Load supported data
      const supported = await fibonacciCcxtService.getSupported()
      if (supported.exchanges) {
        exchanges.value = supported.exchanges
      }
      
      // Initial fetch
      await fetchAnalysis()
    } catch (err) {
      error.value = err.message
    }
  }

  /**
   * Reset store
   */
  const reset = () => {
    selectedExchange.value = 'binance'
    selectedSymbol.value = 'BTC/USDT'
    selectedTimeframe.value = '4h'
    analysis.value = null
    confluence.value = null
    signals.value = []
    candles.value = []
    error.value = null
    lastUpdated.value = null
    dataCache.clear()
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    selectedExchange,
    selectedSymbol,
    selectedTimeframe,
    analysis,
    confluence,
    signals,
    candles,
    isLoading,
    isLoadingSymbols,
    error,
    lastUpdated,
    cacheHit,
    exchanges,
    popularSymbols,
    timeframes,

    // Getters
    currentExchange,
    trend,
    isBullish,
    isBearish,
    currentPrice,
    pivots,
    retracementLevels,
    extensionLevels,
    nearestLevel,
    goldenPocket,
    priceRange,
    allLevels,
    
    // Confluence getters
    confluenceScore,
    overallSignal,
    indicators,
    confluenceSignals,
    rsiValue,
    rsiCondition,
    macdHistogram,
    macdCondition,
    bbPercentB,
    bbCondition,
    volumeRatio,
    hasVolumeSpike,

    // Actions
    fetchAnalysis,
    changeExchange,
    changeSymbol,
    changeTimeframe,
    refresh,
    clearError,
    initialize,
    reset
  }
})
