/**
 * TradingView Service
 * Handles data transformation and fetching for TradingView charts
 */

// API endpoint for OHLC data
const API_BASE = 'http://localhost:5000/api/ohlc'

// ============================================================================
// Data Transformation
// ============================================================================

/**
 * Transform OHLC candle data to TradingView Lightweight Charts format
 * TradingView expects: { time: number (unix timestamp in seconds), open, high, low, close }
 * 
 * @param {Array} candles - Array of candle objects from API
 * @returns {Array} Transformed candles for TradingView
 */
export const transformToTVFormat = (candles) => {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return []
  }

  return candles
    .map(candle => ({
      time: Math.floor(new Date(candle.timestamp).getTime() / 1000), // Convert to unix seconds
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      // Additional data for tooltips
      volume: candle.volume || 0
    }))
    .sort((a, b) => a.time - b.time) // Ensure chronological order
}

/**
 * Transform volume data to TradingView histogram format
 * 
 * @param {Array} candles - Array of candle objects from API
 * @returns {Array} Volume data for histogram series
 */
export const transformVolumeData = (candles) => {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return []
  }

  return candles
    .map(candle => ({
      time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
      value: candle.volume || 0,
      color: candle.close >= candle.open 
        ? 'rgba(16, 185, 129, 0.5)' // Green for bullish
        : 'rgba(239, 68, 68, 0.5)'   // Red for bearish
    }))
    .sort((a, b) => a.time - b.time)
}

/**
 * Transform data for line or area chart
 * 
 * @param {Array} candles - Array of candle objects
 * @param {string} priceType - Which price to use: 'close', 'open', 'high', 'low'
 * @returns {Array} Line data for TradingView
 */
export const transformLineData = (candles, priceType = 'close') => {
  if (!candles || !Array.isArray(candles) || candles.length === 0) {
    return []
  }

  return candles
    .map(candle => ({
      time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
      value: candle[priceType] || candle.close
    }))
    .sort((a, b) => a.time - b.time)
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch historical candle data for a coin
 * 
 * @param {string} coinId - Coin ID (e.g., 'bitcoin', 'ethereum')
 * @param {string} timeframe - Timeframe (e.g., '1h', '4h', '1d')
 * @param {number} limit - Number of candles to fetch
 * @returns {Promise<Object>} API response with candles
 */
export const fetchHistoricalData = async (coinId, timeframe = '1h', limit = 100) => {
  try {
    const response = await fetch(
      `${API_BASE}/${coinId}/candles?timeframe=${timeframe}&limit=${limit}`
    )
    const data = await response.json()
    
    if (data.success) {
      return {
        success: true,
        candles: data.candles || [],
        coinId,
        timeframe
      }
    } else {
      return {
        success: false,
        error: data.message || 'Failed to fetch candle data',
        candles: []
      }
    }
  } catch (error) {
    console.error('TradingView Service - fetchHistoricalData error:', error)
    return {
      success: false,
      error: error.message,
      candles: []
    }
  }
}

/**
 * Sync data from CoinGecko for a coin
 * 
 * @param {string} coinId - Coin ID
 * @param {string} timeframe - Timeframe
 * @returns {Promise<Object>} Sync result
 */
export const syncCoinData = async (coinId, timeframe = '1h') => {
  try {
    const response = await fetch(`${API_BASE}/${coinId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeframe,
        vs_currency: 'usd'
      })
    })
    const data = await response.json()
    
    return {
      success: data.success,
      message: data.message,
      syncedCount: data.syncedCount || 0
    }
  } catch (error) {
    console.error('TradingView Service - syncCoinData error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Get API status and rate limit info
 * 
 * @returns {Promise<Object>} API status
 */
export const getApiStatus = async () => {
  try {
    const response = await fetch(`${API_BASE}/status`)
    const data = await response.json()
    
    return {
      success: data.success,
      status: data.service || {}
    }
  } catch (error) {
    console.error('TradingView Service - getApiStatus error:', error)
    return {
      success: false,
      error: error.message,
      status: {}
    }
  }
}

// ============================================================================
// Chart Theme Configuration
// ============================================================================

/**
 * Get TradingView chart options for dark theme
 */
export const getDarkThemeOptions = () => ({
  layout: {
    background: { type: 'solid', color: '#1a1d29' },
    textColor: '#a1a7bb'
  },
  grid: {
    vertLines: { color: '#2d3139' },
    horzLines: { color: '#2d3139' }
  },
  crosshair: {
    mode: 1,
    vertLine: {
      color: '#758696',
      width: 1,
      style: 3,
      labelBackgroundColor: '#2d3139'
    },
    horzLine: {
      color: '#758696',
      width: 1,
      style: 3,
      labelBackgroundColor: '#2d3139'
    }
  },
  rightPriceScale: {
    borderColor: '#2d3139'
  },
  timeScale: {
    borderColor: '#2d3139',
    timeVisible: true,
    secondsVisible: false
  }
})

/**
 * Get TradingView chart options for light theme
 */
export const getLightThemeOptions = () => ({
  layout: {
    background: { type: 'solid', color: '#ffffff' },
    textColor: '#333333'
  },
  grid: {
    vertLines: { color: '#e1e5eb' },
    horzLines: { color: '#e1e5eb' }
  },
  crosshair: {
    mode: 1,
    vertLine: {
      color: '#9598a1',
      width: 1,
      style: 3,
      labelBackgroundColor: '#2d3139'
    },
    horzLine: {
      color: '#9598a1',
      width: 1,
      style: 3,
      labelBackgroundColor: '#2d3139'
    }
  },
  rightPriceScale: {
    borderColor: '#e1e5eb'
  },
  timeScale: {
    borderColor: '#e1e5eb',
    timeVisible: true,
    secondsVisible: false
  }
})

/**
 * Get candlestick series options
 */
export const getCandlestickOptions = () => ({
  upColor: '#10b981',
  downColor: '#ef4444',
  borderUpColor: '#10b981',
  borderDownColor: '#ef4444',
  wickUpColor: '#10b981',
  wickDownColor: '#ef4444'
})

/**
 * Get line series options
 */
export const getLineOptions = (color = '#137fec') => ({
  color,
  lineWidth: 2,
  crosshairMarkerVisible: true,
  crosshairMarkerRadius: 4
})

/**
 * Get area series options
 */
export const getAreaOptions = (color = '#137fec') => ({
  topColor: `${color}80`,
  bottomColor: `${color}10`,
  lineColor: color,
  lineWidth: 2
})

// ============================================================================
// Default Export
// ============================================================================

export default {
  transformToTVFormat,
  transformVolumeData,
  transformLineData,
  fetchHistoricalData,
  syncCoinData,
  getApiStatus,
  getDarkThemeOptions,
  getLightThemeOptions,
  getCandlestickOptions,
  getLineOptions,
  getAreaOptions
}
