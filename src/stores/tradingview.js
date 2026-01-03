/**
 * TradingView Store
 * Pinia store for managing TradingView chart state
 * 
 * Rate Limiting Features:
 * - Client-side cache with TTL (60 seconds)
 * - Debouncing for rapid coin/timeframe changes (300ms)
 * - Sync cooldown (30 seconds minimum between syncs)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  fetchHistoricalData, 
  syncCoinData, 
  getApiStatus,
  transformToTVFormat,
  transformVolumeData,
  transformLineData
} from '@/services/tradingview'

// ============================================================================
// Rate Limit Configuration
// ============================================================================

const CACHE_TTL_MS = 60 * 1000        // 60 seconds cache TTL
const DEBOUNCE_MS = 300               // 300ms debounce for selections
const SYNC_COOLDOWN_MS = 30 * 1000    // 30 seconds between syncs

// Client-side cache: Map<cacheKey, { data, timestamp }>
const dataCache = new Map()

// Debounce timer reference
let debounceTimer = null

export const useTradingViewStore = defineStore('tradingview', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  const selectedCoin = ref('bitcoin')
  const selectedTimeframe = ref('1h')
  const chartType = ref('candlestick') // 'candlestick' | 'line' | 'area'
  
  const rawCandles = ref([])
  const loading = ref(false)
  const syncing = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const apiStatus = ref(null)

  // Rate limit state
  const lastSyncTime = ref(0)
  const syncCooldownRemaining = ref(0)
  const cacheHit = ref(false)
  let cooldownInterval = null

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
    { value: '5m', label: '5m', description: '5 Minutes' },
    { value: '15m', label: '15m', description: '15 Minutes' },
    { value: '30m', label: '30m', description: '30 Minutes' },
    { value: '1h', label: '1H', description: '1 Hour' },
    { value: '4h', label: '4H', description: '4 Hours' },
    { value: '1d', label: '1D', description: '1 Day' }
  ]

  const chartTypes = [
    { value: 'candlestick', label: 'Candles', icon: 'candlestick_chart' },
    { value: 'line', label: 'Line', icon: 'show_chart' },
    { value: 'area', label: 'Area', icon: 'area_chart' }
  ]

  // ============================================================================
  // Cache Helpers
  // ============================================================================

  /**
   * Generate cache key for coin + timeframe combination
   */
  const getCacheKey = (coinId, timeframe) => `${coinId}_${timeframe}`

  /**
   * Get data from cache if valid (not expired)
   */
  const getFromCache = (coinId, timeframe) => {
    const key = getCacheKey(coinId, timeframe)
    const cached = dataCache.get(key)
    
    if (!cached) return null
    
    const age = Date.now() - cached.timestamp
    if (age > CACHE_TTL_MS) {
      dataCache.delete(key)
      console.log(`📦 [Cache] Expired: ${key} (age: ${Math.round(age/1000)}s)`)
      return null
    }
    
    console.log(`📦 [Cache] Hit: ${key} (age: ${Math.round(age/1000)}s)`)
    return cached.data
  }

  /**
   * Save data to cache
   */
  const saveToCache = (coinId, timeframe, data) => {
    const key = getCacheKey(coinId, timeframe)
    dataCache.set(key, { data, timestamp: Date.now() })
    console.log(`📦 [Cache] Saved: ${key} (${data.length} candles)`)
  }

  /**
   * Clear all cache
   */
  const clearCache = () => {
    dataCache.clear()
    console.log('📦 [Cache] Cleared all entries')
  }

  // ============================================================================
  // Sync Cooldown Helpers
  // ============================================================================

  /**
   * Check if sync is allowed (cooldown expired)
   */
  const canSync = computed(() => syncCooldownRemaining.value === 0)

  /**
   * Start cooldown timer after sync
   */
  const startSyncCooldown = () => {
    lastSyncTime.value = Date.now()
    syncCooldownRemaining.value = SYNC_COOLDOWN_MS / 1000
    
    // Clear existing interval
    if (cooldownInterval) clearInterval(cooldownInterval)
    
    // Update countdown every second
    cooldownInterval = setInterval(() => {
      const elapsed = Date.now() - lastSyncTime.value
      const remaining = Math.max(0, SYNC_COOLDOWN_MS - elapsed)
      syncCooldownRemaining.value = Math.ceil(remaining / 1000)
      
      if (remaining === 0) {
        clearInterval(cooldownInterval)
        cooldownInterval = null
      }
    }, 1000)
  }

  // ============================================================================
  // Getters (Computed)
  // ============================================================================
  
  const currentCoin = computed(() => {
    return supportedCoins.find(c => c.id === selectedCoin.value) || supportedCoins[0]
  })

  const currentTimeframe = computed(() => {
    return timeframes.find(t => t.value === selectedTimeframe.value) || timeframes[3]
  })

  const candleCount = computed(() => rawCandles.value.length)

  // Transformed data for TradingView
  const tvCandleData = computed(() => transformToTVFormat(rawCandles.value))
  const tvVolumeData = computed(() => transformVolumeData(rawCandles.value))
  const tvLineData = computed(() => transformLineData(rawCandles.value, 'close'))

  // Current price info (latest candle)
  const latestCandle = computed(() => {
    if (rawCandles.value.length === 0) return null
    return rawCandles.value[rawCandles.value.length - 1]
  })

  const currentPrice = computed(() => latestCandle.value?.close || 0)
  const highPrice = computed(() => latestCandle.value?.high || 0)
  const lowPrice = computed(() => latestCandle.value?.low || 0)
  const openPrice = computed(() => latestCandle.value?.open || 0)
  const volume = computed(() => latestCandle.value?.volume || 0)

  const priceChange = computed(() => {
    if (!latestCandle.value) return 0
    const change = ((latestCandle.value.close - latestCandle.value.open) / latestCandle.value.open) * 100
    return isNaN(change) ? 0 : change
  })

  const priceDirection = computed(() => {
    if (priceChange.value > 0) return 'up'
    if (priceChange.value < 0) return 'down'
    return 'neutral'
  })

  // ============================================================================
  // Actions
  // ============================================================================
  
  /**
   * Fetch chart data for current coin and timeframe
   * Uses cache to avoid unnecessary API calls
   */
  const fetchChartData = async (limit = 100, forceRefresh = false) => {
    const coinId = selectedCoin.value
    const timeframe = selectedTimeframe.value
    
    // Check cache first (unless forced refresh)
    if (!forceRefresh) {
      const cachedData = getFromCache(coinId, timeframe)
      if (cachedData) {
        rawCandles.value = cachedData
        lastUpdated.value = new Date()
        cacheHit.value = true
        return
      }
    }
    
    loading.value = true
    error.value = null
    cacheHit.value = false
    
    try {
      console.log(`🌐 [Fetch] ${coinId}/${timeframe} (limit: ${limit})`)
      const result = await fetchHistoricalData(coinId, timeframe, limit)
      
      if (result.success) {
        rawCandles.value = result.candles
        lastUpdated.value = new Date()
        // Save to cache
        saveToCache(coinId, timeframe, result.candles)
      } else {
        error.value = result.error || 'Failed to fetch chart data'
      }
    } catch (err) {
      error.value = err.message
      console.error('TradingView Store - fetchChartData error:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Sync data from CoinGecko API with cooldown protection
   */
  const syncData = async () => {
    // Check cooldown
    if (!canSync.value) {
      console.log(`⏳ [Sync] Cooldown active: ${syncCooldownRemaining.value}s remaining`)
      return { success: false, message: `Please wait ${syncCooldownRemaining.value}s before syncing again` }
    }
    
    syncing.value = true
    error.value = null
    
    try {
      console.log(`🔄 [Sync] Starting sync for ${selectedCoin.value}/${selectedTimeframe.value}`)
      const result = await syncCoinData(selectedCoin.value, selectedTimeframe.value)
      
      if (result.success) {
        // Clear cache for this coin/timeframe to get fresh data
        const key = getCacheKey(selectedCoin.value, selectedTimeframe.value)
        dataCache.delete(key)
        
        // Start cooldown
        startSyncCooldown()
        
        // Refresh chart data (force refresh to bypass cache)
        await fetchChartData(100, true)
        
        return { success: true, message: 'Sync completed successfully' }
      } else {
        error.value = result.error || 'Sync failed'
        return { success: false, message: result.error }
      }
    } catch (err) {
      error.value = err.message
      console.error('TradingView Store - syncData error:', err)
      return { success: false, message: err.message }
    } finally {
      syncing.value = false
    }
  }

  /**
   * Change selected coin with debouncing
   */
  const changeCoin = async (coinId) => {
    if (coinId === selectedCoin.value) return
    
    // Clear pending debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      console.log(`⏱️ [Debounce] Cancelled pending fetch`)
    }
    
    selectedCoin.value = coinId
    
    // Check if we have cached data - if so, show immediately
    const cachedData = getFromCache(coinId, selectedTimeframe.value)
    if (cachedData) {
      rawCandles.value = cachedData
      lastUpdated.value = new Date()
      cacheHit.value = true
      return
    }
    
    // Clear candles while loading
    rawCandles.value = []
    
    // Debounce the API call
    debounceTimer = setTimeout(async () => {
      console.log(`⏱️ [Debounce] Executing fetch after ${DEBOUNCE_MS}ms`)
      await fetchChartData()
      debounceTimer = null
    }, DEBOUNCE_MS)
  }

  /**
   * Change timeframe with debouncing
   */
  const changeTimeframe = async (timeframe) => {
    if (timeframe === selectedTimeframe.value) return
    
    // Clear pending debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      console.log(`⏱️ [Debounce] Cancelled pending fetch`)
    }
    
    selectedTimeframe.value = timeframe
    
    // Check if we have cached data - if so, show immediately
    const cachedData = getFromCache(selectedCoin.value, timeframe)
    if (cachedData) {
      rawCandles.value = cachedData
      lastUpdated.value = new Date()
      cacheHit.value = true
      return
    }
    
    // Clear candles while loading
    rawCandles.value = []
    
    // Debounce the API call
    debounceTimer = setTimeout(async () => {
      console.log(`⏱️ [Debounce] Executing fetch after ${DEBOUNCE_MS}ms`)
      await fetchChartData()
      debounceTimer = null
    }, DEBOUNCE_MS)
  }

  /**
   * Change chart type
   */
  const changeChartType = (type) => {
    if (['candlestick', 'line', 'area'].includes(type)) {
      chartType.value = type
    }
  }

  /**
   * Fetch API status
   */
  const fetchApiStatus = async () => {
    const result = await getApiStatus()
    if (result.success) {
      apiStatus.value = result.status
    }
  }

  /**
   * Initialize the store
   */
  const initialize = async () => {
    await Promise.all([
      fetchChartData(),
      fetchApiStatus()
    ])
  }

  /**
   * Clear error
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * Reset store to initial state
   */
  const reset = () => {
    selectedCoin.value = 'bitcoin'
    selectedTimeframe.value = '1h'
    chartType.value = 'candlestick'
    rawCandles.value = []
    loading.value = false
    syncing.value = false
    error.value = null
    lastUpdated.value = null
    apiStatus.value = null
    lastSyncTime.value = 0
    syncCooldownRemaining.value = 0
    cacheHit.value = false
    clearCache()
    
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    if (cooldownInterval) {
      clearInterval(cooldownInterval)
      cooldownInterval = null
    }
  }

  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    selectedCoin,
    selectedTimeframe,
    chartType,
    rawCandles,
    loading,
    syncing,
    error,
    lastUpdated,
    apiStatus,
    
    // Rate limit state
    syncCooldownRemaining,
    cacheHit,
    canSync,
    
    // Static Data
    supportedCoins,
    timeframes,
    chartTypes,
    
    // Getters
    currentCoin,
    currentTimeframe,
    candleCount,
    tvCandleData,
    tvVolumeData,
    tvLineData,
    latestCandle,
    currentPrice,
    highPrice,
    lowPrice,
    openPrice,
    volume,
    priceChange,
    priceDirection,
    
    // Actions
    fetchChartData,
    syncData,
    changeCoin,
    changeTimeframe,
    changeChartType,
    fetchApiStatus,
    initialize,
    clearError,
    clearCache,
    reset
  }
})
