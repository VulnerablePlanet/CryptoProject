/**
 * ============================================================================
 * Bot Trading Store - Pinia Store for Trading Bot Module
 * ============================================================================
 * Manages state for the automated trading bot including:
 * - Bot status and configuration
 * - Generated signals and trade history
 * - Risk management settings
 * - Real-time signal monitoring
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import { logger } from '@/utils/logger'

// ============================================================================
// Bot Status Constants
// ============================================================================
export const BOT_STATUS = {
  STOPPED: 'stopped',
  STARTING: 'starting',
  RUNNING: 'running',
  PAUSED: 'paused',
  ERROR: 'error'
}

export const SIGNAL_TYPES = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  NO_TRADE: 'NO_TRADE'
}

export const TRADE_RESULT = {
  PENDING: 'pending',
  WIN: 'win',
  LOSS: 'loss',
  BREAKEVEN: 'breakeven'
}

// ============================================================================
// Default Configuration
// ============================================================================
const DEFAULT_CONFIG = {
  symbol: 'bitcoin',
  timeframe: '1h',
  riskPerTrade: 2, // Percentage
  capital: 1000, // USD
  minConfidence: 60, // Minimum confidence to take trade
  atrMultiplier: 2, // ATR multiplier for SL
  maxOpenTrades: 3,
  tradingEnabled: false, // Paper trading by default
  symbols: [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'solana', name: 'Solana', symbol: 'SOL' },
    { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
    { id: 'ripple', name: 'XRP', symbol: 'XRP' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
    { id: 'avalanche-2', name: 'Avalanche', symbol: 'AVAX' }
  ],
  timeframes: [
    { value: '15m', label: '15 Min' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' }
  ]
}

// ============================================================================
// Store Definition
// ============================================================================
export const useBotTradingStore = defineStore('botTrading', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  // Bot Status
  const status = ref(BOT_STATUS.STOPPED)
  const lastError = ref(null)
  const lastUpdate = ref(null)
  
  // Configuration
  const config = ref({ ...DEFAULT_CONFIG })
  
  // Current Signal
  const currentSignal = ref(null)
  const signalLoading = ref(false)
  
  // Signal History
  const signalHistory = ref([])
  const historyLoading = ref(false)
  
  // Trade History
  const tradeHistory = ref([])
  const tradesLoading = ref(false)
  
  // Statistics
  const stats = ref({
    totalTrades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: 0,
    totalPnL: 0,
    avgWin: 0,
    avgLoss: 0,
    maxDrawdown: 0,
    profitFactor: 0,
    sharpeRatio: 0
  })
  
  // Backtest Results
  const backtestResults = ref(null)
  const backtestLoading = ref(false)
  
  // ============================================================================
  // Computed
  // ============================================================================
  
  const isRunning = computed(() => status.value === BOT_STATUS.RUNNING)
  const isPaused = computed(() => status.value === BOT_STATUS.PAUSED)
  const isStopped = computed(() => status.value === BOT_STATUS.STOPPED)
  const hasError = computed(() => status.value === BOT_STATUS.ERROR)
  
  const currentSymbol = computed(() => {
    return config.value.symbols.find(s => s.id === config.value.symbol) || config.value.symbols[0]
  })
  
  const currentTimeframe = computed(() => {
    return config.value.timeframes.find(t => t.value === config.value.timeframe) || config.value.timeframes[1]
  })
  
  const recentSignals = computed(() => {
    return signalHistory.value.slice(0, 10)
  })
  
  const recentTrades = computed(() => {
    return tradeHistory.value.slice(0, 10)
  })
  
  const openTrades = computed(() => {
    return tradeHistory.value.filter(t => t.status === 'open')
  })
  
// ============================================================================
// Actions
// ============================================================================

/**
 * Fetch current trading signal from the Autonomous Agent
 */
const fetchCurrentSignal = async () => {
  signalLoading.value = true
  try {
    // Try our new autonomous agent first
    try {
      const symbol = config.value.symbol === 'bitcoin' ? 'BTC/USDT' : `${config.value.symbol.toUpperCase()}/USDT`
      const response = await api.get('/agent/signal', {
        params: { symbol }
      })
      currentSignal.value = response.data.signal
      lastUpdate.value = new Date().toISOString()
      return response.data
    } catch (agentError) {
      // Fallback to old signal endpoint if agent fails
      const response = await api.get(`/trading/${config.value.symbol}/signal`, {
        params: {
          timeframe: config.value.timeframe,
          atrMultiplier: config.value.atrMultiplier,
          minConfidence: config.value.minConfidence / 100
        }
      })
      currentSignal.value = response.data
      lastUpdate.value = new Date().toISOString()
      return response.data
    }
  } catch (error) {
    logger.error('[BotTrading] Error fetching signal:', error)
    lastError.value = error.response?.data?.error || error.message
    throw error
  } finally {
    signalLoading.value = false
  }
}
  
  /**
   * Fetch signal history
   */
  const fetchSignalHistory = async (limit = 50) => {
    historyLoading.value = true
    try {
      const response = await api.get(`/trading/${config.value.symbol}/signals`, {
        params: { limit }
      })
      signalHistory.value = response.data.signals || []
      return response.data
    } catch (error) {
      logger.error('[BotTrading] Error fetching signal history:', error)
      throw error
    } finally {
      historyLoading.value = false
    }
  }
  
  /**
   * Run backtest on current configuration
   */
  const runBacktest = async (options = {}) => {
    backtestLoading.value = true
    try {
      const response = await api.get(`/trading/${config.value.symbol}/backtest`, {
        params: {
          timeframe: config.value.timeframe,
          capital: config.value.capital,
          riskPerTrade: config.value.riskPerTrade / 100,
          minConfidence: config.value.minConfidence,
          ...options
        }
      })
      backtestResults.value = response.data
      if (response.data.stats) {
        stats.value = { ...stats.value, ...response.data.stats }
      }
      return response.data
    } catch (error) {
      logger.error('[BotTrading] Error running backtest:', error)
      lastError.value = error.response?.data?.error || error.message
      throw error
    } finally {
      backtestLoading.value = false
    }
  }
  
  /**
   * Fetch full analysis for current symbol
   */
  const fetchAnalysis = async () => {
    try {
      const response = await api.get(`/trading/${config.value.symbol}/analysis`, {
        params: {
          timeframe: config.value.timeframe,
          periods: 100
        }
      })
      return response.data
    } catch (error) {
      logger.error('[BotTrading] Error fetching analysis:', error)
      throw error
    }
  }
  
/**
 * Start the autonomous trading agent
 */
const startBot = async () => {
  status.value = BOT_STATUS.STARTING
  try {
    // Start the agent via API
    const symbol = config.value.symbol === 'bitcoin' ? 'BTC/USDT' : `${config.value.symbol.toUpperCase()}/USDT`
    await api.post('/agent/start', { symbols: [symbol] })
    status.value = BOT_STATUS.RUNNING
    lastError.value = null
  } catch (error) {
    // Fallback: just fetch signal if agent API not available
    logger.warn('[BotTrading] Agent API not available, using manual mode')
    try {
      await fetchCurrentSignal()
      status.value = BOT_STATUS.RUNNING
    } catch (signalError) {
      status.value = BOT_STATUS.ERROR
      lastError.value = signalError.message
      throw signalError
    }
  }
}

/**
 * Stop the autonomous trading agent
 */
const stopBot = async () => {
  try {
    await api.post('/agent/stop')
  } catch (error) {
    logger.warn('[BotTrading] Agent stop failed:', error.message)
  }
  status.value = BOT_STATUS.STOPPED
  currentSignal.value = null
}

/**
 * Fetch agent status from the autonomous agent
 */
const fetchAgentStatus = async () => {
  try {
    const response = await api.get('/agent/status')
    return response.data
  } catch (error) {
    logger.error('[BotTrading] Error fetching agent status:', error)
    return null
  }
}
  
  /**
   * Pause the trading bot
   */
  const pauseBot = () => {
    if (status.value === BOT_STATUS.RUNNING) {
      status.value = BOT_STATUS.PAUSED
    }
  }
  
  /**
   * Resume the trading bot
   */
  const resumeBot = () => {
    if (status.value === BOT_STATUS.PAUSED) {
      status.value = BOT_STATUS.RUNNING
    }
  }
  
  /**
   * Update bot configuration
   */
  const updateConfig = (newConfig) => {
    config.value = { ...config.value, ...newConfig }
  }
  
  /**
   * Update risk settings
   */
  const updateRiskSettings = (settings) => {
    config.value = {
      ...config.value,
      riskPerTrade: settings.riskPerTrade ?? config.value.riskPerTrade,
      capital: settings.capital ?? config.value.capital,
      minConfidence: settings.minConfidence ?? config.value.minConfidence,
      atrMultiplier: settings.atrMultiplier ?? config.value.atrMultiplier,
      maxOpenTrades: settings.maxOpenTrades ?? config.value.maxOpenTrades
    }
  }
  
  /**
   * Change trading symbol
   */
  const changeSymbol = (symbolId) => {
    config.value.symbol = symbolId
  }
  
  /**
   * Change timeframe
   */
  const changeTimeframe = (timeframe) => {
    config.value.timeframe = timeframe
  }
  
  /**
   * Clear error
   */
  const clearError = () => {
    lastError.value = null
    if (status.value === BOT_STATUS.ERROR) {
      status.value = BOT_STATUS.STOPPED
    }
  }
  
  /**
   * Initialize store
   */
  const initialize = async () => {
    try {
      // Load any saved configuration from localStorage
      const savedConfig = localStorage.getItem('botTradingConfig')
      if (savedConfig) {
        config.value = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) }
      }
    } catch (error) {
      logger.error('[BotTrading] Error initializing:', error)
    }
  }
  
  /**
   * Reset store to defaults
   */
  const reset = () => {
    status.value = BOT_STATUS.STOPPED
    config.value = { ...DEFAULT_CONFIG }
    currentSignal.value = null
    signalHistory.value = []
    tradeHistory.value = []
    backtestResults.value = null
    lastError.value = null
    lastUpdate.value = null
  }
  
  return {
    // State
    status,
    lastError,
    lastUpdate,
    config,
    currentSignal,
    signalLoading,
    signalHistory,
    historyLoading,
    tradeHistory,
    tradesLoading,
    stats,
    backtestResults,
    backtestLoading,
    
    // Computed
    isRunning,
    isPaused,
    isStopped,
    hasError,
    currentSymbol,
    currentTimeframe,
    recentSignals,
    recentTrades,
    openTrades,
    
// Actions
  fetchCurrentSignal,
  fetchSignalHistory,
  runBacktest,
  fetchAnalysis,
  startBot,
  stopBot,
  pauseBot,
  resumeBot,
  updateConfig,
  updateRiskSettings,
  changeSymbol,
  changeTimeframe,
  clearError,
  initialize,
  reset,
  fetchAgentStatus
}
})
