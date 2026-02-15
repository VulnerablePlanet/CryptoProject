/**
 * ============================================================================
 * Pro Trading Store - Pinia Store for CCXT & TA-Lib Module
 * ============================================================================
 * Manages state for the Pro Trading module including exchange data,
 * technical indicators, patterns, and chart settings.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as ccxtService from '@/services/ccxt'
import { transformToHeikinAshi, detectHATrend } from '@/utils/heikinAshi'
import { calculateAllIndicators, getRSIInterpretation } from '@/utils/technicalIndicators'

// ============================================================================
// Supported Exchanges & Configuration
// ============================================================================

const DEFAULT_EXCHANGE = 'binance'
const DEFAULT_SYMBOL = { base: 'BTC', quote: 'USDT' }
const DEFAULT_TIMEFRAME = '1h'

const POPULAR_SYMBOLS = [
  { base: 'BTC', quote: 'USDT', name: 'Bitcoin' },
  { base: 'ETH', quote: 'USDT', name: 'Ethereum' },
  { base: 'SOL', quote: 'USDT', name: 'Solana' },
  { base: 'BNB', quote: 'USDT', name: 'BNB' },
  { base: 'XRP', quote: 'USDT', name: 'XRP' },
  { base: 'DOGE', quote: 'USDT', name: 'Dogecoin' },
  { base: 'ADA', quote: 'USDT', name: 'Cardano' },
  { base: 'AVAX', quote: 'USDT', name: 'Avalanche' }
]

const TIMEFRAMES = [
  { value: '1m', label: '1m', description: '1 Minute' },
  { value: '5m', label: '5m', description: '5 Minutes' },
  { value: '15m', label: '15m', description: '15 Minutes' },
  { value: '30m', label: '30m', description: '30 Minutes' },
  { value: '1h', label: '1h', description: '1 Hour' },
  { value: '4h', label: '4h', description: '4 Hours' },
  { value: '1d', label: '1D', description: '1 Day' },
  { value: '1w', label: '1W', description: '1 Week' }
]

const CHART_TYPES = [
  { value: 'candlestick', label: 'Candlestick', icon: 'candlestick_chart' },
  { value: 'heikinashi', label: 'Heikin-Ashi', icon: 'stacked_bar_chart' },
  { value: 'line', label: 'Line', icon: 'show_chart' },
  { value: 'area', label: 'Area', icon: 'area_chart' }
]

const OSCILLATOR_TYPES = [
  { value: 'rsi', label: 'RSI', description: 'Relative Strength Index' },
  { value: 'macd', label: 'MACD', description: 'Moving Average Convergence Divergence' }
]

// ============================================================================
// Store Definition
// ============================================================================

export const useProTradingStore = defineStore('proTrading', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  // Exchange & Symbol
  const exchanges = ref([])
  const selectedExchange = ref(DEFAULT_EXCHANGE)
  const selectedSymbol = ref({ ...DEFAULT_SYMBOL })
  const markets = ref([])
  
  // Timeframe & Chart Type
  const selectedTimeframe = ref(DEFAULT_TIMEFRAME)
  const chartType = ref('candlestick')
  const selectedOscillator = ref('rsi')
  
  // Data
  const candles = ref([])
  const orderBook = ref(null)
  const ticker = ref(null)
  
  // Indicators & Patterns
  const indicators = ref({})
  const patterns = ref([])
  const overlaySettings = ref({
    bollingerBands: { enabled: false, period: 20, stdDev: 2 }, // Disabled - not available from utility
    sma: { enabled: true, periods: [7, 14, 30] }, // Available periods from utility
    ema: { enabled: true, periods: [12, 26] } // Available periods from utility
  })
  
  // UI State
  const loading = ref(false)
  const syncing = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const fromCache = ref(false)
  const showDepthChart = ref(false)
  const showIndicatorSettings = ref(false)
  
  // ============================================================================
  // Computed
  // ============================================================================
  
  const currentSymbol = computed(() => {
    return `${selectedSymbol.value.base}/${selectedSymbol.value.quote}`
  })
  
  const currentSymbolInfo = computed(() => {
    return POPULAR_SYMBOLS.find(
      s => s.base === selectedSymbol.value.base && s.quote === selectedSymbol.value.quote
    ) || { base: selectedSymbol.value.base, quote: selectedSymbol.value.quote, name: selectedSymbol.value.base }
  })
  
  const currentTimeframe = computed(() => {
    return TIMEFRAMES.find(t => t.value === selectedTimeframe.value) || TIMEFRAMES[4]
  })
  
  // Chart data for TradingView
  const tvCandleData = computed(() => {
    if (chartType.value === 'heikinashi') {
      return transformToHeikinAshi(candles.value)
    }
    return candles.value.map(c => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }))
  })
  
  const tvVolumeData = computed(() => {
    return candles.value.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)'
    }))
  })
  
  const tvLineData = computed(() => {
    return candles.value.map(c => ({
      time: c.time,
      value: c.close
    }))
  })
  
  // Current prices from latest candle
  const latestCandle = computed(() => {
    if (candles.value.length === 0) return null
    return candles.value[candles.value.length - 1]
  })
  
  const currentPrice = computed(() => latestCandle.value?.close || 0)
  const openPrice = computed(() => latestCandle.value?.open || 0)
  const highPrice = computed(() => latestCandle.value?.high || 0)
  const lowPrice = computed(() => latestCandle.value?.low || 0)
  const volume = computed(() => latestCandle.value?.volume || 0)
  
  const priceChange = computed(() => {
    if (!latestCandle.value) return 0
    const change = latestCandle.value.close - latestCandle.value.open
    return (change / latestCandle.value.open) * 100
  })
  
  const candleCount = computed(() => candles.value.length)
  
  // Indicator overlays data
  const bollingerBandsData = computed(() => {
    if (!indicators.value.bollinger || !overlaySettings.value.bollingerBands.enabled) {
      return null
    }
    return {
      upper: indicators.value.bollinger.upper.map((v, i) => ({
        time: candles.value[i]?.time,
        value: v
      })).filter(d => d.value !== null),
      middle: indicators.value.bollinger.middle.map((v, i) => ({
        time: candles.value[i]?.time,
        value: v
      })).filter(d => d.value !== null),
      lower: indicators.value.bollinger.lower.map((v, i) => ({
        time: candles.value[i]?.time,
        value: v
      })).filter(d => d.value !== null)
    }
  })
  
  const smaData = computed(() => {
    if (!overlaySettings.value.sma.enabled) {
      return {}
    }
    const result = {}
    // Map period to history key
    const periodToKey = { 7: 'sma7History', 14: 'sma14History', 30: 'sma30History' }
    for (const period of overlaySettings.value.sma.periods) {
      const key = periodToKey[period]
      if (key && indicators.value[key]) {
        result[period] = indicators.value[key].map((v, i) => ({
          time: candles.value[i]?.time,
          value: v
        })).filter(d => d.value !== null && d.time)
      }
    }
    return result
  })
  
  const emaData = computed(() => {
    if (!overlaySettings.value.ema.enabled) {
      return {}
    }
    const result = {}
    // Map period to history key
    const periodToKey = { 12: 'ema12History', 26: 'ema26History' }
    for (const period of overlaySettings.value.ema.periods) {
      const key = periodToKey[period]
      if (key && indicators.value[key]) {
        result[period] = indicators.value[key].map((v, i) => ({
          time: candles.value[i]?.time,
          value: v
        })).filter(d => d.value !== null && d.time)
      }
    }
    return result
  })
  
  // RSI data for oscillator panel
  const rsiData = computed(() => {
    if (!indicators.value.rsiHistory || indicators.value.rsiHistory.length === 0) return []
    return indicators.value.rsiHistory.map((v, i) => ({
      time: candles.value[i]?.time,
      value: v
    })).filter(d => d.value !== null && d.time)
  })
  
  const currentRSI = computed(() => {
    // Use the single RSI value if available, otherwise get from history
    if (indicators.value.rsi !== null && indicators.value.rsi !== undefined) {
      return indicators.value.rsi
    }
    if (rsiData.value.length === 0) return null
    return rsiData.value[rsiData.value.length - 1]?.value
  })
  
  const rsiInterpretation = computed(() => {
    return getRSIInterpretation(currentRSI.value)
  })
  
  // MACD data for oscillator panel
  const macdData = computed(() => {
    if (!indicators.value.macdHistory || indicators.value.macdHistory.length === 0) {
      return { macd: [], signal: [], histogram: [] }
    }
    
    // macdHistory is now an array of numbers (MACD values)
    const macdLine = indicators.value.macdHistory.map((v, i) => ({
      time: candles.value[i]?.time,
      value: v
    })).filter(d => d.value !== null && d.value !== undefined && d.time)
    
    // For histogram, use the same MACD values with color coding
    const histogram = indicators.value.macdHistory.map((v, i) => ({
      time: candles.value[i]?.time,
      value: v,
      color: (v ?? 0) >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)'
    })).filter(d => d.value !== null && d.value !== undefined && d.time)
    
    return {
      macd: macdLine,
      signal: [], // Signal line would require additional calculation
      histogram: histogram
    }
  })
  
  // Depth chart data
  const depthData = computed(() => {
    if (!orderBook.value) return { bids: [], asks: [], midPrice: null }
    
    return {
      bids: orderBook.value.bids.map(b => ({
        price: b.price,
        amount: b.amount,
        cumulative: b.cumulative
      })),
      asks: orderBook.value.asks.map(a => ({
        price: a.price,
        amount: a.amount,
        cumulative: a.cumulative
      })),
      midPrice: orderBook.value.midPrice
    }
  })
  
  // Heikin-Ashi trend detection
  const haTrend = computed(() => {
    if (chartType.value !== 'heikinashi' || tvCandleData.value.length === 0) {
      return null
    }
    return detectHATrend(tvCandleData.value)
  })
  
  // ============================================================================
  // Actions
  // ============================================================================
  
  // Helper to extract clean error message
  const extractErrorMessage = (err) => {
    if (!err) return 'Unknown error occurred'
    
    // Check for specific backend error structure
    if (err.message) {
      // If message is a JSON string (often from backend proxy), parse it
      try {
        // Example: "Error: binance GET ... 451 ... {"code":0,"msg":"..."}"
        const jsonMatch = err.message.match(/({.*})/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1])
          if (parsed && (parsed.msg || parsed.message)) {
            return `${parsed.msg || parsed.message}`
          }
        }
      } catch (e) {
        // If parsing fails, use the original message
      }
      
      // Clean up common prefixes
      let cleanMsg = err.message
      
      // Handle HTML/CloudFront Errors
      if (cleanMsg.includes('CloudFront') || cleanMsg.includes('<!DOCTYPE HTML')) {
        if (cleanMsg.includes('403')) return 'Access Forbidden (Geo-restricted by CloudFront)'
        return 'Network Error (Content Blocked by CloudFront)'
      }

      if (cleanMsg.includes('451')) return 'Service unavailable in your region (Geo-blocked)'
      if (cleanMsg.includes('403')) return 'Access Forbidden (Geo-blocked)'
      if (cleanMsg.includes('Net failed')) return 'Network connection failed'
      if (cleanMsg.includes('500')) return 'Exchange API Error (Internal Server 500)'

      return cleanMsg
    }
    
    return 'Unknown error'
  }

  // ============================================================================
  // Actions
  // ============================================================================
  
  /**
   * Initialize the store with exchange data
   */
  const initialize = async () => {
    loading.value = true
    error.value = null
    
    try {
      // Fetch supported exchanges
      const exchangeData = await ccxtService.fetchSupportedExchanges()
      exchanges.value = exchangeData.exchanges
      
      // Fetch initial candle data
      try {
        await fetchCandles()
      } catch (err) {
        console.warn(`Initial fetch with ${selectedExchange.value} failed, trying fallback...`)
        // Fallback for Railway/US restrictions
        const fallbacks = ['coinbase', 'kraken']
        for (const fb of fallbacks) {
          if (fb !== selectedExchange.value) {
            try {
              console.log(`Trying fallback exchange: ${fb}`)
              selectedExchange.value = fb
              // Adjust symbol quote if needed (USDT -> USD for Coinbase/Kraken)
              if (selectedSymbol.value.quote === 'USDT' && (fb === 'coinbase' || fb === 'kraken')) {
                selectedSymbol.value.quote = 'USD'
              }
              await fetchCandles()
              console.log(`Fallback to ${fb} successful`)
              error.value = null // Clear error if fallback succeeded
              break
            } catch (fbErr) {
              console.warn(`Fallback to ${fb} failed`)
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to initialize Pro Trading:', err)
      error.value = extractErrorMessage(err)
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch OHLCV candles
   */
  const fetchCandles = async () => {
    loading.value = true
    error.value = null
    
    try {
      const result = await ccxtService.fetchOHLCV(
        selectedExchange.value,
        selectedSymbol.value.base,
        selectedSymbol.value.quote,
        selectedTimeframe.value,
        200
      )
      
      candles.value = result.candles
      fromCache.value = result.fromCache
      lastUpdated.value = new Date().toISOString()
      
      // Calculate indicators after fetching candles
      calculateIndicators()
    } catch (err) {
      console.error('Failed to fetch candles:', err)
      error.value = extractErrorMessage(err)
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Fetch order book for depth chart
   */
  const fetchDepthData = async () => {
    try {
      const result = await ccxtService.fetchOrderBook(
        selectedExchange.value,
        selectedSymbol.value.base,
        selectedSymbol.value.quote,
        100
      )
      
      orderBook.value = result.orderBook
    } catch (err) {
      console.error('Failed to fetch order book:', err)
    }
  }
  
  /**
   * Fetch ticker data
   */
  const fetchTickerData = async () => {
    try {
      const result = await ccxtService.fetchTicker(
        selectedExchange.value,
        selectedSymbol.value.base,
        selectedSymbol.value.quote
      )
      
      ticker.value = result.ticker
    } catch (err) {
      console.error('Failed to fetch ticker:', err)
    }
  }
  
  /**
   * Sync fresh data (force refresh)
   */
  const syncData = async () => {
    syncing.value = true
    
    try {
      // Clear cache first
      await ccxtService.clearCache(selectedExchange.value)
      
      // Fetch fresh data
      await fetchCandles()
      
      if (showDepthChart.value) {
        await fetchDepthData()
      }
    } catch (err) {
      console.error('Sync failed:', err)
      error.value = extractErrorMessage(err)
    } finally {
      syncing.value = false
    }
  }
  
  /**
   * Calculate technical indicators
   */
  const calculateIndicators = () => {
    if (candles.value.length < 20) {
      indicators.value = {}
      return
    }
    
    try {
      indicators.value = calculateAllIndicators(candles.value)
    } catch (err) {
      console.error('Failed to calculate indicators:', err)
    }
  }
  
  /**
   * Change selected exchange
   */
  /**
   * Change selected exchange
   */
  const changeExchange = async (exchangeId) => {
    selectedExchange.value = exchangeId
    
    // Auto-adjust symbol quote currency
    if (exchangeId === 'coinbase' || exchangeId === 'kraken') {
      if (selectedSymbol.value.quote === 'USDT') {
        selectedSymbol.value.quote = 'USD'
      }
    } else {
      // For Binance, Bybit, etc. prefer USDT
      if (selectedSymbol.value.quote === 'USD') {
        selectedSymbol.value.quote = 'USDT'
      }
    }
    
    await fetchCandles()
  }
  
  /**
   * Change selected symbol
   */
  /**
   * Change selected symbol
   */
  const changeSymbol = async (base, _quote) => { // _quote is user input, but we might override it
    let quote = _quote
    
    // Auto-adjust quote based on exchange constraints
    if (selectedExchange.value === 'coinbase' || selectedExchange.value === 'kraken') {
      if (quote === 'USDT') quote = 'USD'
    } else {
      if (quote === 'USD') quote = 'USDT'
    }
    
    selectedSymbol.value = { base, quote }
    await fetchCandles()
    
    if (showDepthChart.value) {
      await fetchDepthData()
    }
  }
  
  /**
   * Change timeframe
   */
  const changeTimeframe = async (timeframe) => {
    selectedTimeframe.value = timeframe
    await fetchCandles()
  }
  
  /**
   * Change chart type
   */
  const changeChartType = (type) => {
    chartType.value = type
  }
  
  /**
   * Change oscillator type
   */
  const changeOscillator = (type) => {
    selectedOscillator.value = type
  }
  
  /**
   * Toggle depth chart visibility
   */
  const toggleDepthChart = async () => {
    showDepthChart.value = !showDepthChart.value
    
    if (showDepthChart.value && !orderBook.value) {
      await fetchDepthData()
    }
  }
  
  /**
   * Toggle indicator settings panel
   */
  const toggleIndicatorSettings = () => {
    showIndicatorSettings.value = !showIndicatorSettings.value
  }
  
  /**
   * Update overlay settings
   */
  const updateOverlaySetting = (indicator, setting, value) => {
    if (overlaySettings.value[indicator]) {
      overlaySettings.value[indicator][setting] = value
    }
  }
  
  /**
   * Clear error
   */
  const clearError = () => {
    error.value = null
  }
  
  // ============================================================================
  // Return Store
  // ============================================================================
  
  return {
    // State
    exchanges,
    selectedExchange,
    selectedSymbol,
    markets,
    selectedTimeframe,
    chartType,
    selectedOscillator,
    candles,
    orderBook,
    ticker,
    indicators,
    patterns,
    overlaySettings,
    loading,
    syncing,
    error,
    lastUpdated,
    fromCache,
    showDepthChart,
    showIndicatorSettings,
    
    // Constants
    POPULAR_SYMBOLS,
    TIMEFRAMES,
    CHART_TYPES,
    OSCILLATOR_TYPES,
    
    // Computed
    currentSymbol,
    currentSymbolInfo,
    currentTimeframe,
    tvCandleData,
    tvVolumeData,
    tvLineData,
    latestCandle,
    currentPrice,
    openPrice,
    highPrice,
    lowPrice,
    volume,
    priceChange,
    candleCount,
    bollingerBandsData,
    smaData,
    emaData,
    rsiData,
    currentRSI,
    rsiInterpretation,
    macdData,
    depthData,
    haTrend,
    
    // Actions
    initialize,
    fetchCandles,
    fetchDepthData,
    fetchTickerData,
    syncData,
    calculateIndicators,
    changeExchange,
    changeSymbol,
    changeTimeframe,
    changeChartType,
    changeOscillator,
    toggleDepthChart,
    toggleIndicatorSettings,
    updateOverlaySetting,
    clearError
  }
})
