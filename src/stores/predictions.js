/**
 * Predictions Store
 * Pinia store for managing cryptocurrency price predictions state
 * 
 * Features:
 * - Exchange and symbol selection
 * - Prediction data fetching with caching
 * - Real-time updates via Socket.io
 * - Kalman filtered data management
 */

import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'
import { useAuthStore } from './auth'

// API base URL
// API base URL
const API_URL = import.meta.env.PROD 
  ? '/api' 
  : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')

// Cache configuration
const CACHE_TTL_MS = 60 * 1000 // 1 minute
const dataCache = new Map()

export const usePredictionsStore = defineStore('predictions', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  // Selection state
  const selectedExchange = ref('binance')
  const selectedSymbol = ref('BTC/USDT')
  const selectedTimeframe = ref('1h')
  const predictionSteps = ref(5)
  const selectedQuote = ref('USDT')
  
  // Data state
  const ohlcvData = ref([])
  const kalmanData = ref([])
  const velocityData = ref([])
  const predictions = ref([])
  const currentPrice = ref(0)
  const features = ref({})
  const summary = ref({})
  const metadata = ref({})
  
  // UI state
  const isLoading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const cacheHit = ref(false)
  
  // Chart settings state (persisted to DB)
  const chartSettings = ref({
    visibleRange: { from: null, to: null },
    lastSymbol: null,
    lastTimeframe: null
  })
  const chartSettingsLoaded = ref(false)
  
  // Available options
  const exchanges = ref([
    { id: 'binance', name: 'Binance', icon: '🟡' },
    { id: 'bitget', name: 'Bitget', icon: '🔵' },
    { id: 'kraken', name: 'Kraken', icon: '🟣' },
    { id: 'bybit', name: 'Bybit', icon: '🟠' },
    { id: 'okx', name: 'OKX', icon: '⚪' }
  ])
  
  const symbols = ref([])
  const isLoadingSymbols = ref(false)
  
  const timeframes = [
    { value: '5m', label: '5m', description: '5 Minutes' },
    { value: '15m', label: '15m', description: '15 Minutes' },
    { value: '30m', label: '30m', description: '30 Minutes' },
    { value: '1h', label: '1h', description: '1 Hour' },
    { value: '4h', label: '4h', description: '4 Hours' },
    { value: '1d', label: '1D', description: '1 Day' }
  ]

  // ============================================================================
  // Cache Helpers
  // ============================================================================
  
  function getCacheKey(exchange, symbol, timeframe) {
    return `${exchange}:${symbol}:${timeframe}`
  }
  
  function getFromCache(exchange, symbol, timeframe) {
    const key = getCacheKey(exchange, symbol, timeframe)
    const cached = dataCache.get(key)
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data
    }
    
    return null
  }
  
  function saveToCache(exchange, symbol, timeframe, data) {
    const key = getCacheKey(exchange, symbol, timeframe)
    dataCache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  // ============================================================================
  // Computed
  // ============================================================================
  
  const currentExchange = computed(() => {
    return exchanges.value.find(e => e.id === selectedExchange.value) || exchanges.value[0]
  })
  
  const currentSymbolParts = computed(() => {
    const parts = selectedSymbol.value.split('/')
    return {
      base: parts[0] || 'BTC',
      quote: parts[1] || 'USDT'
    }
  })
  
  // Chart data formatted for Lightweight Charts
  const candlestickData = computed(() => {
    return ohlcvData.value.map(candle => ({
      time: Math.floor(candle.time / 1000), // Convert to seconds
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }))
  })
  
  const kalmanLineData = computed(() => {
    return kalmanData.value.map(point => ({
      time: Math.floor(point.time / 1000),
      value: point.value
    }))
  })
  
  const predictionLineData = computed(() => {
    return predictions.value.map(pred => ({
      time: Math.floor(pred.time / 1000),
      value: pred.price
    }))
  })
  
  const confidenceAreaData = computed(() => {
    return predictions.value.map(pred => ({
      time: Math.floor(pred.time / 1000),
      lower: pred.lower,
      upper: pred.upper
    }))
  })
  
  const latestPrediction = computed(() => {
    return predictions.value[0] || null
  })
  
  const predictionDirection = computed(() => {
    return summary.value?.direction || 'NEUTRAL'
  })
  
  const predictionConfidence = computed(() => {
    return Math.round((summary.value?.avgConfidence || 0) * 100)
  })
  
  const expectedChange = computed(() => {
    return summary.value?.expectedChange || 0
  })
  
  const isPositive = computed(() => {
    return predictionDirection.value === 'LONG'
  })

  // ============================================================================
  // Actions
  // ============================================================================
  
  /**
   * Fetch available symbols for the selected exchange
   */
  async function fetchSymbols() {
    isLoadingSymbols.value = true
    
    try {
      const response = await axios.get(
        `${API_URL}/predictions/markets/${selectedExchange.value}`,
        { params: { quote: selectedQuote.value } }
      )
      
      if (response.data.success) {
        symbols.value = response.data.markets.map(m => ({
          symbol: m.symbol,
          base: m.base,
          quote: m.quote,
          label: m.symbol
        }))
        
        // If current symbol not in list, select first available
        if (!symbols.value.find(s => s.symbol === selectedSymbol.value)) {
          if (symbols.value.length > 0) {
            selectedSymbol.value = symbols.value[0].symbol
          }
        }
      }
    } catch (err) {
      console.error('Error fetching symbols:', err)
      // Set default symbols on error
      symbols.value = [
        { symbol: 'BTC/USDT', base: 'BTC', quote: 'USDT', label: 'BTC/USDT' },
        { symbol: 'ETH/USDT', base: 'ETH', quote: 'USDT', label: 'ETH/USDT' },
        { symbol: 'SOL/USDT', base: 'SOL', quote: 'USDT', label: 'SOL/USDT' }
      ]
    } finally {
      isLoadingSymbols.value = false
    }
  }
  
  /**
   * Fetch full prediction analysis
   */
  async function fetchPrediction(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh) {
      const cached = getFromCache(
        selectedExchange.value,
        selectedSymbol.value,
        selectedTimeframe.value
      )
      
      if (cached) {
        applyPredictionData(cached)
        cacheHit.value = true
        return
      }
    }
    
    isLoading.value = true
    error.value = null
    cacheHit.value = false
    
    try {
      const { base, quote } = currentSymbolParts.value
      
      const response = await axios.get(
        `${API_URL}/predictions/analyze/${selectedExchange.value}/${base}/${quote}`,
        {
          params: {
            timeframe: selectedTimeframe.value,
            limit: 100,
            steps: predictionSteps.value
          }
        }
      )
      
      if (response.data.success) {
        applyPredictionData(response.data)
        
        // Save to cache
        saveToCache(
          selectedExchange.value,
          selectedSymbol.value,
          selectedTimeframe.value,
          response.data
        )
      } else {
        throw new Error(response.data.error || 'Failed to fetch prediction')
      }
    } catch (err) {
      console.error('Error fetching prediction:', err)
      error.value = err.response?.data?.message || err.message || 'Failed to fetch prediction'
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Apply prediction data to state
   */
  function applyPredictionData(data) {
    ohlcvData.value = data.ohlcv || []
    kalmanData.value = data.kalman?.smoothedData || []
    velocityData.value = data.kalman?.velocity || []
    predictions.value = data.predictions || []
    currentPrice.value = data.current?.price || 0
    features.value = data.features || {}
    summary.value = data.summary || {}
    metadata.value = data.metadata || {}
    lastUpdated.value = Date.now()
  }
  
  /**
   * Change exchange and reload data
   */
  async function changeExchange(exchangeId) {
    if (exchangeId === selectedExchange.value) return
    
    selectedExchange.value = exchangeId
    await fetchSymbols()
    await fetchPrediction(true)
  }
  
  /**
   * Change symbol and reload data
   */
  async function changeSymbol(symbol) {
    selectedSymbol.value = symbol
    // Always fetch prediction when symbol is explicitly changed
    await fetchPrediction(true)
  }
  
  /**
   * Change timeframe and reload data
   */
  async function changeTimeframe(timeframe) {
    if (timeframe === selectedTimeframe.value) return
    
    selectedTimeframe.value = timeframe
    await fetchPrediction(true)
  }
  
  /**
   * Refresh prediction data (force)
   */
  async function refresh() {
    await fetchPrediction(true)
  }
  
  /**
   * Initialize the store
   */
  async function initialize() {
    await fetchSymbols()
    await fetchPrediction()
  }
  
  /**
   * Clear error
   */
  function clearError() {
    error.value = null
  }
  
  /**
   * Save chart settings to database (debounce in component)
   * @param {Object} chartState - Complete chart state
   * @param {Object} chartState.logicalRange - Visible logical range {from, to}
   * @param {number} chartState.barSpacing - Bar spacing (zoom level)
   * @param {number} chartState.rightOffset - Right offset
   * @param {number} chartState.scrollPosition - Scroll position
   */
  async function saveChartSettings(chartState) {
    console.log('📊 [Store] saveChartSettings called with:', JSON.stringify(chartState))
    console.log('📊 [Store] barSpacing being saved:', chartState?.barSpacing)
    
    try {
      const authStore = useAuthStore()
      const token = authStore.accessToken
      if (!token) {
        console.log('📊 [Store] No token, skipping save')
        return
      }
      
      const payload = {
        module: 'predictions',
        chartState: chartState,
        symbol: selectedSymbol.value,
        timeframe: selectedTimeframe.value
      }
      console.log('📊 [Store] Saving payload:', JSON.stringify(payload))
      
      await axios.put(
        `${API_URL}/auth/settings/chart`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      // Update local state
      chartSettings.value.chartState = chartState
      chartSettings.value.lastSymbol = selectedSymbol.value
      chartSettings.value.lastTimeframe = selectedTimeframe.value
      
      console.log('📊 [Store] Chart settings saved successfully. barSpacing:', chartState?.barSpacing)
    } catch (err) {
      console.warn('Could not save chart settings:', err.message)
    }
  }
  
  /**
   * Load chart settings from database
   */
  async function loadChartSettings() {
    console.log('📊 [Store] loadChartSettings called')
    
    if (chartSettingsLoaded.value) {
      console.log('📊 [Store] Returning cached settings. barSpacing:', chartSettings.value?.chartState?.barSpacing)
      return chartSettings.value
    }
    
    try {
      const authStore = useAuthStore()
      
      if (authStore.accessToken && authStore.refreshToken) {
        await authStore.refreshAccessToken()
      }
      
      const token = authStore.accessToken
      if (!token) {
        console.log('📊 [Store] No token available')
        return null
      }
      
      console.log('📊 [Store] Fetching chart settings from API...')
      const response = await axios.get(
        `${API_URL}/auth/settings/chart/predictions`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      console.log('📊 [Store] API raw response:', JSON.stringify(response.data))
      
      if (response.data.success && response.data.settings) {
        chartSettings.value = response.data.settings
        chartSettingsLoaded.value = true
        const cs = response.data.settings?.chartState
        console.log('📊 [Store] Loaded barSpacing:', cs?.barSpacing)
        console.log('📊 [Store] Loaded visibleRange:', JSON.stringify(cs?.visibleRange))
        console.log('📊 [Store] Loaded logicalRange (legacy):', JSON.stringify(cs?.logicalRange))
        return response.data.settings
      }
    } catch (err) {
      console.warn('Could not load chart settings:', err.message)
    }
    
    return null
  }
  
  /**
   * Reset store to initial state
   */
  function reset() {
    selectedExchange.value = 'binance'
    selectedSymbol.value = 'BTC/USDT'
    selectedTimeframe.value = '1h'
    ohlcvData.value = []
    kalmanData.value = []
    velocityData.value = []
    predictions.value = []
    currentPrice.value = 0
    features.value = {}
    summary.value = {}
    metadata.value = {}
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
    predictionSteps,
    selectedQuote,
    ohlcvData,
    kalmanData,
    velocityData,
    predictions,
    currentPrice,
    features,
    summary,
    metadata,
    isLoading,
    error,
    lastUpdated,
    cacheHit,
    exchanges,
    symbols,
    isLoadingSymbols,
    timeframes,
    
    // Computed
    currentExchange,
    currentSymbolParts,
    candlestickData,
    kalmanLineData,
    predictionLineData,
    confidenceAreaData,
    latestPrediction,
    predictionDirection,
    predictionConfidence,
    expectedChange,
    isPositive,
    
    // Actions
    fetchSymbols,
    fetchPrediction,
    changeExchange,
    changeSymbol,
    changeTimeframe,
    refresh,
    initialize,
    clearError,
    reset,
    saveChartSettings,
    loadChartSettings,
    
    // Chart settings
    chartSettings,
    chartSettingsLoaded
  }
})
