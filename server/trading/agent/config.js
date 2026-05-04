/**
 * ============================================================================
 * TRADING AGENT CONFIGURATION
 * ============================================================================
 * All constants in one place — easy to tune and audit
 */

module.exports = {
  // ============================================================================
  // CYCLE SETTINGS
  // ============================================================================
  CYCLE_INTERVAL: 60 * 1000, // 60 seconds (1 minute) — runs every minute

  // ============================================================================
  // RISK MANAGEMENT
  // ============================================================================
  RISK: {
    MAX_CONCURRENT_POSITIONS: 3, // Maximum open positions at once
    RISK_PER_TRADE: 0.01, // 1% of capital per trade
    MAX_POSITION_SIZE: 0.05, // 5% max per position

    // Kill Switch thresholds
    KILL_SWITCH: {
      DAILY_LOSS_LIMIT: 0.03, // 3% daily loss → stop
      DRAWDOWN_LIMIT: 0.10, // 10% drawdown from peak → stop
      MAX_CONSECUTIVE_LOSSES: 5, // 5 losses in a row → stop
      VOLATILITY_ANOMALY_MULTIPLIER: 3.0 // ATR > 3x average → pause
    }
  },

  // ============================================================================
  // SCORING WEIGHTS (must sum to 1.0)
  // ============================================================================
  SCORING: {
    TECHNICAL: 0.35, // Multi-timeframe technical analysis
    REGIME: 0.20, // Market regime fit
    SENTIMENT: 0.20, // News + social sentiment
    ORDER_BOOK: 0.15, // Order book imbalance
    ON_CHAIN: 0.10 // Whale movements, OI, funding rate
  },

  // ============================================================================
  // DECISION THRESHOLDS
  // ============================================================================
  DECISION: {
    NO_TRADE: 0.60, // Score < 0.60 → skip
    LIMIT_ORDER: 0.80 // Score >= 0.80 → market order (else limit order)
  },

  // ============================================================================
  // POSITION SIZING
  // ============================================================================
  POSITION: {
    MIN_SIZE: 0.0001, // Minimum position (BTC equivalent)
    ATR_MULTIPLIER_SL: 1.5, // Stop loss = entry ± (ATR × 1.5)
    ATR_MULTIPLIER_TP: 2.0, // Take profit = entry ± (ATR × 2.0)
    KELLY_FRACTION: 0.25, // Kelly fraction safety factor
    DEFAULT_RISK_PCT: 0.01 // 1% base risk
  },

  // ============================================================================
  // MARKET DATA
  // ============================================================================
  MARKET: {
    TIMEFRAMES: ['1h', '4h', '1d'], // Multi-timeframe analysis
    CANDLE_LIMIT: 100, // Max candles per fetch
    RSI_PERIOD: 14,
    MACD_FAST: 12,
    MACD_SLOW: 26,
    MACD_SIGNAL: 9,
    CCI_PERIOD: 20,
    ATR_PERIOD: 14,
    BB_PERIOD: 20,
    BB_STD: 2,
    EMA_SHORT: 50,
    EMA_LONG: 200
  },

  // ============================================================================
  // REGIME DETECTION (K-Means)
  // ============================================================================
  REGIME: {
    NUM_CLUSTERS: 4, // K = 4 regimes
    FEATURES: ['rsi', 'atrRatio', 'macdHistogram', 'cci'],
    MIN_CANDLES_FOR_CLUSTERING: 55 // Minimum data points needed
  },

  // ============================================================================
  // EXCHANGE SETTINGS
  // ============================================================================
  EXCHANGE: {
    DEFAULT: 'binance',
    SUPPORTED: ['binance', 'bitget', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx'],
    RATE_LIMIT_BUFFER: 0.90, // Use 90% of rate limit
    INSTANCE_RECYCLE_HOURS: 23 // Recycle CCXT instances every 23h
  },

  // ============================================================================
  // API KEYS (from environment)
  // ============================================================================
  API: {
    COINGECKO_KEY: process.env.COINGECKO_API_KEY || '',
    CRYPTOPANIC_KEY: process.env.CRYPTOPANIC_API_KEY || '',
    WHALE_ALERT_KEY: process.env.WHALE_ALERT_API_KEY || ''
  },

  // ============================================================================
  // CACHE TTL (milliseconds)
  // ============================================================================
  CACHE: {
    FEAR_GREED: 5 * 60 * 1000, // 5 minutes
    CRYPTOPANIC: 30 * 1000, // 30 seconds
    APEWISDOM: 60 * 1000, // 1 minute
    OHLCV: 60 * 1000, // 1 minute
    TICKER: 30 * 1000, // 30 seconds
    FUNDING_RATE: 5 * 60 * 1000 // 5 minutes
  },

  // ============================================================================
  // SENTIMENT SETTINGS
  // ============================================================================
  SENTIMENT: {
    FEAR_GREED: {
      EXTREME_FEAR: 25,
      FEAR: 45,
      NEUTRAL: 55,
      GREED: 75,
      EXTREME_GREED: 100
    },
    CRYPTOPANIC_FILTER: 'important' // Only 'important' posts for high SNR
  },

  // ============================================================================
  // MONGOOSE MODELS
  // ============================================================================
  MODELS: {
    SIGNAL: 'Signal',
    POSITION: 'Position',
    AGENT_STATE: 'AgentState',
    TRADE_LOG: 'TradeLog'
  },

  // ============================================================================
  // SOCKET.IO EVENTS
  // ============================================================================
  EVENTS: {
    // Agent state
    AGENT_STATE: 'agent:state',
    AGENT_ERROR: 'agent:error',
    AGENT_KILL_SWITCH: 'agent:kill-switch',

    // Phase updates
    PHASE_RESEARCH: 'phase:research',
    PHASE_ANALYSIS: 'phase:analysis',
    PHASE_SCORING: 'phase:scoring',
    PHASE_EXECUTION: 'phase:execution',
    PHASE_MONITORING: 'phase:monitoring',

    // Positions
    POSITION_OPENED: 'position:opened',
    POSITION_CLOSED: 'position:closed',
    POSITION_ERROR: 'position:error',

    // Risk
    RISK_STATUS: 'risk:status',
    KILL_SWITCH_TRIGGERED: 'kill_switch:triggered',

    // Real-time data
    PRICE_UPDATE: 'price:update',
    SIGNAL_GENERATED: 'signal:generated'
  }
}