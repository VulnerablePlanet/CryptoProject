import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import talibService from '@/services/talibService'

const STORAGE_KEY = 'talib_analysis_data'

// Helper to save analysis to localStorage
const saveToStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...data,
      timestamp: Date.now()
    }))
  } catch (err) {
    console.warn('Failed to save TA-Lib data to localStorage:', err)
  }
}

// Helper to load analysis from localStorage
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    
    const data = JSON.parse(stored)
    // Check if data is less than 1 hour old
    const ONE_HOUR = 60 * 60 * 1000
    if (Date.now() - data.timestamp > ONE_HOUR) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return data
  } catch (err) {
    console.warn('Failed to load TA-Lib data from localStorage:', err)
    return null
  }
}

export const useTALibStore = defineStore('talib', () => {
  // State
  const selectedSymbol = ref({ base: 'BTC', quote: 'USDT' })
  const currentTab = ref('complete') // complete | regime | scoring | mtf | volume | orderbook | patterns | adaptive | cycles
  const loading = ref(false)
  const error = ref(null)
  
  // Analysis results
  const regimeAnalysis = ref(null)
  const scoringAnalysis = ref(null)
  const mtfAnalysis = ref(null)
  const volumeAnalysis = ref(null)
  const orderbookAnalysis = ref(null)
  const completeAnalysis = ref(null)
  
  // NEW: Pattern recognition
  const patterns = ref(null)
  
  // Health status
  const health = ref(null)
  const lastUpdated = ref(null)

  // Popular symbols for quick selection
  const POPULAR_SYMBOLS = [
    { base: 'BTC', quote: 'USDT', name: 'Bitcoin' },
    { base: 'ETH', quote: 'USDT', name: 'Ethereum' },
    { base: 'BNB', quote: 'USDT', name: 'Binance Coin' },
    { base: 'SOL', quote: 'USDT', name: 'Solana' },
    { base: 'XRP', quote: 'USDT', name: 'Ripple' },
    { base: 'ADA', quote: 'USDT', name: 'Cardano' }
  ]

  // Computed
  const currentSymbol = computed(() => `${selectedSymbol.value.base}/${selectedSymbol.value.quote}`)
  const currentSymbolPair = computed(() => `${selectedSymbol.value.base}${selectedSymbol.value.quote}`)
  
  const hasData = computed(() => {
    return !!(regimeAnalysis.value || scoringAnalysis.value || mtfAnalysis.value || 
              volumeAnalysis.value || orderbookAnalysis.value || completeAnalysis.value)
  })

  // Regime interpretation
  const regimeInterpretation = computed(() => {
    if (!regimeAnalysis.value?.regime) return { color: 'gray', label: 'Unknown', description: 'No data' }
    
    // Handle both direct regime object and nested regime property
    let regimeStr = ''
    if (typeof regimeAnalysis.value.regime === 'string') {
      regimeStr = regimeAnalysis.value.regime.toLowerCase()
    } else if (regimeAnalysis.value.regime?.regime) {
      // Nested structure from complete analysis
      regimeStr = regimeAnalysis.value.regime.regime.toLowerCase()
    } else {
      return { color: 'gray', label: 'Unknown', description: 'Invalid regime data' }
    }
    
    // Map backend regime types to UI interpretation
    if (regimeStr === 'strong_trend') {
      return {
        color: 'success',
        label: 'Strong Trend',
        description: 'High ADX - Clear directional movement'
      }
    } else if (regimeStr === 'weak_trend') {
      return {
        color: 'warning',
        label: 'Weak Trend',
        description: 'Moderate ADX - Some directional bias'
      }
    } else if (regimeStr === 'range' || regimeStr === 'ranging') {
      return {
        color: 'gray',
        label: 'Range',
        description: 'Low ADX - Market is consolidating'
      }
    } else if (regimeStr === 'high_volatility') {
      return {
        color: 'warning',
        label: 'High Volatility',
        description: 'Elevated volatility - Use wider stops'
      }
    }
    
    return { color: 'gray', label: regimeStr, description: 'Market regime detected' }
  })

  // Signal score interpretation
  const scoreInterpretation = computed(() => {
    if (!scoringAnalysis.value?.score) return { color: 'gray', label: 'Neutral', description: 'No signal' }
    
    const score = scoringAnalysis.value.score
    if (score >= 70) return { color: 'success', label: 'Strong Buy', description: 'Very bullish signal' }
    if (score >= 30) return { color: 'success', label: 'Buy', description: 'Bullish signal' }
    if (score >= -30) return { color: 'gray', label: 'Neutral', description: 'No clear direction' }
    if (score >= -70) return { color: 'danger', label: 'Sell', description: 'Bearish signal' }
    return { color: 'danger', label: 'Strong Sell', description: 'Very bearish signal' }
  })

  // Actions

  /**
   * Initialize health check and load previous data
   */
  const initialize = async () => {
    // Try to load previous analysis from localStorage
    const stored = loadFromStorage()
    if (stored) {
      // Restore analysis data
      if (stored.completeAnalysis) completeAnalysis.value = stored.completeAnalysis
      if (stored.regimeAnalysis) regimeAnalysis.value = stored.regimeAnalysis
      if (stored.scoringAnalysis) scoringAnalysis.value = stored.scoringAnalysis
      if (stored.patterns) patterns.value = stored.patterns
      if (stored.selectedSymbol) selectedSymbol.value = stored.selectedSymbol
      lastUpdated.value = new Date(stored.timestamp)
    }
    
    // Check health
    try {
      const result = await talibService.healthCheck()
      if (result.success) {
        health.value = result
      }
    } catch (err) {
      console.error('Health check failed:', err)
    }
  }

  /**
   * Fetch market regime analysis
   */
  const fetchRegimeAnalysis = async (candles) => {
    loading.value = true
    error.value = null
    
    try {
      const result = await talibService.detectRegime(currentSymbolPair.value, candles)
      if (result.success) {
        regimeAnalysis.value = result.data
        lastUpdated.value = new Date()
      } else {
        error.value = result.message || 'Failed to fetch regime analysis'
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch regime analysis'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch multi-indicator scoring
   */
  const fetchScoringAnalysis = async (candles, regime = null) => {
    loading.value = true
    error.value = null
    
    try {
      const result = await talibService.calculateScore(currentSymbolPair.value, candles, regime)
      if (result.success) {
        scoringAnalysis.value = result.data
        lastUpdated.value = new Date()
      } else {
        error.value = result.message || 'Failed to fetch scoring analysis'
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch scoring analysis'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch multi-timeframe analysis
   */
  const fetchMTFAnalysis = async (candlesByTimeframe) => {
    loading.value = true
    error.value = null
    
    try {
      const result = await talibService.analyzeMTF(currentSymbolPair.value, candlesByTimeframe)
      if (result.success) {
        mtfAnalysis.value = result.data
        lastUpdated.value = new Date()
      } else {
        error.value = result.message || 'Failed to fetch MTF analysis'
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch MTF analysis'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch volume analysis
   */
  const fetchVolumeAnalysis = async (candles, trades = null) => {
    loading.value = true
    error.value = null
    
    try {
      const result = await talibService.analyzeVolume(currentSymbolPair.value, candles, trades)
      if (result.success) {
        volumeAnalysis.value = result.data
        lastUpdated.value = new Date()
      } else {
        error.value = result.message || 'Failed to fetch volume analysis'
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch volume analysis'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch order book analysis
   */
  const fetchOrderBookAnalysis = async (orderbook, previousOrderbook = null) => {
    loading.value = true
    error.value = null
    
    try {
      const result = await talibService.analyzeOrderBook(currentSymbolPair.value, orderbook, previousOrderbook)
      if (result.success) {
        orderbookAnalysis.value = result.data
        lastUpdated.value = new Date()
      } else {
        error.value = result.message || 'Failed to fetch order book analysis'
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch order book analysis'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch complete analysis (all features)
   */
  const fetchCompleteAnalysis = async (candles) => {
    loading.value = true
    error.value = null
    
    try {
      // analyzeComplete expects params object with candles
      const result = await talibService.analyzeComplete(currentSymbolPair.value, { candles })
      if (result.success) {
        completeAnalysis.value = result.data
        
        // Also extract specific analyses
        if (result.data.regime) {
          regimeAnalysis.value = result.data.regime
        }
        // Combine signal and indicators into scoringAnalysis
        if (result.data.signal) {
          scoringAnalysis.value = {
            ...result.data.signal,
            indicators: result.data.indicators || null
          }
        }
        if (result.data.mtf) mtfAnalysis.value = result.data.mtf
        if (result.data.volume) volumeAnalysis.value = result.data.volume
        if (result.data.orderbook) orderbookAnalysis.value = result.data.orderbook
        
        lastUpdated.value = new Date()
        
        // Save to localStorage
        saveToStorage({
          completeAnalysis: completeAnalysis.value,
          regimeAnalysis: regimeAnalysis.value,
          scoringAnalysis: scoringAnalysis.value,
          patterns: patterns.value,
          selectedSymbol: selectedSymbol.value
        })
      } else {
        error.value = result.message || 'Failed to fetch complete analysis'
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch complete analysis'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch candlestick patterns
   */
  const fetchPatterns = async (candles, lookback = 50) => {
    loading.value = true
    error.value = null
    
    try {
      const result = await talibService.detectPatterns(currentSymbolPair.value, candles, lookback)
      if (result.success) {
        patterns.value = result.data
        lastUpdated.value = new Date()
        
        // Save to localStorage
        saveToStorage({
          completeAnalysis: completeAnalysis.value,
          regimeAnalysis: regimeAnalysis.value,
          scoringAnalysis: scoringAnalysis.value,
          patterns: patterns.value,
          selectedSymbol: selectedSymbol.value
        })
      } else {
        error.value = result.message || 'Failed to fetch patterns'
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch patterns'
    } finally {
      loading.value = false
    }
  }

  /**
   * Change selected symbol
   */
  const changeSymbol = (base, quote) => {
    selectedSymbol.value = { base, quote }
    // Clear previous analyses
    clearAnalyses()
  }

  /**
   * Switch active tab
   */
  const switchTab = (tab) => {
    currentTab.value = tab
  }

  /**
   * Clear all analyses
   */
  const clearAnalyses = () => {
    regimeAnalysis.value = null
    scoringAnalysis.value = null
    mtfAnalysis.value = null
    volumeAnalysis.value = null
    orderbookAnalysis.value = null
    completeAnalysis.value = null
    patterns.value = null  // NEW
  }

  /**
   * Clear error
   */
  const clearError = () => {
    error.value = null
  }

  return {
    // State
    selectedSymbol,
    currentTab,
    loading,
    error,
    regimeAnalysis,
    scoringAnalysis,
    mtfAnalysis,
    volumeAnalysis,
    orderbookAnalysis,
    completeAnalysis,
    patterns,  // NEW
    health,
    lastUpdated,
    
    // Constants
    POPULAR_SYMBOLS,
    
    // Computed
    currentSymbol,
    currentSymbolPair,
    hasData,
    regimeInterpretation,
    scoreInterpretation,
    
    // Actions
    initialize,
    fetchRegimeAnalysis,
    fetchScoringAnalysis,
    fetchMTFAnalysis,
    fetchVolumeAnalysis,
    fetchOrderBookAnalysis,
    fetchCompleteAnalysis,
    fetchPatterns,  // NEW
    changeSymbol,
    switchTab,
    clearAnalyses,
    clearError
  }
})
