/**
 * Fibonacci Store
 * Pinia store for managing Fibonacci analysis state
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAnalysis, getPivots } from '@/services/fibonacciService'
import { getPriceZone } from '@/utils/fibonacci'
import { logger } from '@/utils/logger'

// Cache configuration
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes cache
const dataCache = new Map()

export const useFibonacciStore = defineStore('fibonacci', () => {
  // ============================================================================
  // State
  // ============================================================================

  const selectedCoin = ref('bitcoin')
  const selectedTimeframe = ref('4h')
  
  const analysis = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  // Analysis parameters
  const lookback = ref(5)
  const threshold = ref(0.5)

  // ============================================================================
  // Static Data
  // ============================================================================

  const supportedCoins = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', color: '#f7931a' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', color: '#627eea' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB', color: '#f3ba2f' },
    { id: 'solana', symbol: 'SOL', name: 'Solana', color: '#14f195' },
    { id: 'ripple', symbol: 'XRP', name: 'XRP', color: '#00aae4' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', color: '#0033ad' },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', color: '#c3a634' },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', color: '#e6007a' }
  ]

  const timeframes = [
    { value: '1h', label: '1H', description: '1 Hour' },
    { value: '4h', label: '4H', description: '4 Hours', recommended: true },
    { value: '1d', label: '1D', description: '1 Day', recommended: true }
  ]

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  const getCacheKey = (coinId, timeframe) => `fib_${coinId}_${timeframe}`

  const getFromCache = (coinId, timeframe) => {
    const key = getCacheKey(coinId, timeframe)
    const cached = dataCache.get(key)
    
    if (!cached) return null
    
    const age = Date.now() - cached.timestamp
    if (age > CACHE_TTL_MS) {
      dataCache.delete(key)
      return null
    }
    
    logger.debug(`📐 [Fibonacci Cache] Hit: ${key}`)
    return cached.data
  }

  const saveToCache = (coinId, timeframe, data) => {
    const key = getCacheKey(coinId, timeframe)
    dataCache.set(key, { data, timestamp: Date.now() })
  }

  // ============================================================================
  // Getters (Computed)
  // ============================================================================

  const currentCoin = computed(() => {
    return supportedCoins.find(c => c.id === selectedCoin.value) || supportedCoins[0]
  })

  const currentTimeframe = computed(() => {
    return timeframes.find(t => t.value === selectedTimeframe.value) || timeframes[1]
  })

  const trend = computed(() => analysis.value?.trend || 'neutral')
  const isBullish = computed(() => trend.value === 'bullish')
  const isBearish = computed(() => trend.value === 'bearish')

  const pivots = computed(() => analysis.value?.pivots || null)
  const swingHigh = computed(() => pivots.value?.swingHigh || null)
  const swingLow = computed(() => pivots.value?.swingLow || null)

  const retracementLevels = computed(() => analysis.value?.levels?.retracement || {})
  const extensionLevels = computed(() => analysis.value?.levels?.extensions || {})

  const currentPrice = computed(() => analysis.value?.currentPrice || 0)
  const priceRange = computed(() => analysis.value?.meta?.priceRange || 0)

  const nearestLevel = computed(() => analysis.value?.nearestLevel || null)

  const priceZone = computed(() => {
    if (!analysis.value?.levels) return null
    return getPriceZone(currentPrice.value, analysis.value.levels)
  })

  // Golden Pocket level (61.8%)
  const goldenPocket = computed(() => retracementLevels.value['61.8'] || null)

  // All levels combined for chart
  const allLevels = computed(() => {
    const levels = []
    
    // Add retracement levels
    Object.entries(retracementLevels.value).forEach(([key, level]) => {
      levels.push({
        ...level,
        key,
        type: 'retracement'
      })
    })
    
    // Add extension levels
    Object.entries(extensionLevels.value).forEach(([key, level]) => {
      levels.push({
        ...level,
        key,
        type: 'extension'
      })
    })
    
    return levels.sort((a, b) => a.price - b.price)
  })

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Fetch Fibonacci analysis for current coin and timeframe
   */
  const fetchAnalysis = async (forceRefresh = false) => {
    const coinId = selectedCoin.value
    const timeframe = selectedTimeframe.value

    // Check cache first
    if (!forceRefresh) {
      const cached = getFromCache(coinId, timeframe)
      if (cached) {
        analysis.value = cached
        return
      }
    }

    loading.value = true
    error.value = null

    try {
      logger.debug(`📐 [Fibonacci] Fetching analysis for ${coinId}/${timeframe}`)
      
      const result = await getAnalysis(coinId, {
        timeframe,
        lookback: lookback.value,
        threshold: threshold.value,
        limit: 100
      })

      if (result.success) {
        analysis.value = result
        lastUpdated.value = new Date()
        saveToCache(coinId, timeframe, result)
      } else {
        throw new Error(result.message || 'Analysis failed')
      }
    } catch (err) {
      logger.error('Fibonacci Store - fetchAnalysis error:', err)
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  /**
   * Change selected coin and fetch new analysis
   */
  const changeCoin = async (coinId) => {
    if (coinId === selectedCoin.value) return
    
    selectedCoin.value = coinId
    analysis.value = null
    await fetchAnalysis()
  }

  /**
   * Change timeframe and fetch new analysis
   */
  const changeTimeframe = async (timeframe) => {
    if (timeframe === selectedTimeframe.value) return
    
    selectedTimeframe.value = timeframe
    analysis.value = null
    await fetchAnalysis()
  }

  /**
   * Update analysis parameters
   */
  const updateParams = async (params) => {
    if (params.lookback !== undefined) {
      lookback.value = Math.min(Math.max(params.lookback, 2), 20)
    }
    if (params.threshold !== undefined) {
      threshold.value = Math.min(Math.max(params.threshold, 0.1), 5)
    }
    
    // Clear cache and refetch
    dataCache.clear()
    await fetchAnalysis(true)
  }

  /**
   * Refresh data (force)
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
    await fetchAnalysis()
  }

  /**
   * Reset store
   */
  const reset = () => {
    selectedCoin.value = 'bitcoin'
    selectedTimeframe.value = '4h'
    analysis.value = null
    loading.value = false
    error.value = null
    lastUpdated.value = null
    lookback.value = 5
    threshold.value = 0.5
    dataCache.clear()
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    selectedCoin,
    selectedTimeframe,
    analysis,
    loading,
    error,
    lastUpdated,
    lookback,
    threshold,

    // Static Data
    supportedCoins,
    timeframes,

    // Getters
    currentCoin,
    currentTimeframe,
    trend,
    isBullish,
    isBearish,
    pivots,
    swingHigh,
    swingLow,
    retracementLevels,
    extensionLevels,
    currentPrice,
    priceRange,
    nearestLevel,
    priceZone,
    goldenPocket,
    allLevels,

    // Actions
    fetchAnalysis,
    changeCoin,
    changeTimeframe,
    updateParams,
    refresh,
    clearError,
    initialize,
    reset
  }
})
