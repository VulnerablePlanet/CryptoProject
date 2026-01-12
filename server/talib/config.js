/**
 * TA-Lib Advanced Analysis Module Configuration
 * 
 * Centralized configuration for all technical analysis features
 */

module.exports = {
  // Market Regime Detection
  regime: {
    adx: {
      period: 14,
      trendThreshold: 25,      // ADX > 25 = trending
      strongTrendThreshold: 40  // ADX > 40 = strong trend
    },
    atr: {
      period: 14,
      multiplier: 2.0          // For volatility-based stops
    },
    volatility: {
      period: 20,              // Realized volatility lookback
      highVolThreshold: 0.05   // 5% daily volatility = high
    },
    clustering: {
      k: 4,                    // Number of regime clusters
      maxIterations: 100,
      tolerance: 0.0001
    },
    cache: {
      ttl: 60000              // Cache TTL: 60 seconds
    }
  },

  // Multi-Indicator Scoring
  scoring: {
    // Base weights (adjusted dynamically by regime)
    weights: {
      strong_trend: {
        ema: 0.35,
        macd: 0.30,
        adx: 0.20,
        volume: 0.10,
        orderbook: 0.05
      },
      weak_trend: {
        ema: 0.25,
        rsi: 0.25,
        macd: 0.20,
        volume: 0.15,
        orderbook: 0.15
      },
      range: {
        rsi: 0.35,
        bbands: 0.30,
        stochastic: 0.20,
        volume: 0.10,
        orderbook: 0.05
      },
      high_volatility: {
        atr: 0.30,
        bbands: 0.25,
        volume: 0.25,
        orderbook: 0.20
      }
    },
    thresholds: {
      strong: 0.7,            // Score > 0.7 = strong signal
      medium: 0.4,            // Score > 0.4 = medium signal
      weak: 0.2,              // Score > 0.2 = weak signal
      hysteresis: 0.1         // Prevent signal flipping
    }
  },

  // Multi-Timeframe Analysis
  mtf: {
    hierarchy: {
      daily: { weight: 0.5, minConfidence: 0.6 },
      '4h': { weight: 0.3, minConfidence: 0.5 },
      '1h': { weight: 0.15, minConfidence: 0.4 },
      '15m': { weight: 0.05, minConfidence: 0.3 }
    },
    // Timeframe alignment required
    requireAlignment: true,
    // Minimum timeframes that must agree
    minAgreement: 2
  },

  // Volume Analysis
  volume: {
    profile: {
      buckets: 24,            // Volume profile buckets
      vpoc_threshold: 0.7     // 70% of volume for POC
    },
    vwap: {
      type: 'session',        // 'session' or 'rolling'
      rollingPeriod: 20
    },
    delta: {
      significantThreshold: 0.6  // 60% buy pressure = significant
    },
    absorption: {
      volumeMultiplier: 2.0,  // 2x avg volume
      priceChangeMax: 0.002   // Max 0.2% price change
    }
  },

  // Order Book Intelligence
  orderbook: {
    imbalance: {
      significantThreshold: 0.65,  // 65/35 ratio
      extremeThreshold: 0.75       // 75/25 ratio
    },
    walls: {
      sizeMultiplier: 5.0,         // 5x average order size
      minDistance: 0.01            // Min 1% from mid price
    },
    depth: {
      levels: 20,                  // Analyze top 20 levels
      spreadThreshold: 0.001       // 0.1% = tight spread
    }
  },

  // Dynamic Stops & Take Profit
  stops: {
    atr: {
      stopMultiplier: 2.0,         // 2 x ATR
      tpMultiplier: 3.0            // 3 x ATR (1.5 R:R)
    },
    volatility: {
      lowVolMultiplier: 1.5,
      highVolMultiplier: 3.0
    },
    trailing: {
      activationPercent: 0.02,     // Activate at 2% profit
      trailPercent: 0.01           // Trail by 1%
    },
    time: {
      maxHoursInTrade: 48          // Exit after 48 hours
    }
  },

  // Walk-Forward Testing
  walkForward: {
    optimizationWindow: 90,        // 90 days for optimization
    testWindow: 30,                // 30 days for testing
    stepSize: 30,                  // Move forward 30 days
    minTrades: 10,                 // Min trades for valid window
    monteCarlo: {
      iterations: 1000,
      confidenceLevel: 0.95
    }
  },

  // Market Structure (Smart Money Concepts)
  structure: {
    bos: {
      minBreakPercent: 0.001,      // Min 0.1% break
      confirmationCandles: 2
    },
    fvg: {
      minGapPercent: 0.002,        // Min 0.2% gap
      maxCandlesAgo: 50            // Look back 50 candles
    },
    liquiditySweep: {
      wickMultiplier: 2.0,         // Wick 2x body
      rejectionCandles: 3
    }
  },

  // Divergence Detection
  divergence: {
    lookback: 50,                  // Look back 50 candles
    minPivotDistance: 5,           // Min 5 candles between pivots
    volumeConfirmation: true,
    multiOscillatorThreshold: 2    // At least 2 oscillators agree
  },

  // Risk Management
  risk: {
    maxRiskPerTrade: 0.01,         // 1% per trade
    maxTotalExposure: 0.10,        // 10% total
    maxCorrelatedExposure: 0.15,   // 15% in correlated assets
    correlationThreshold: 0.7,     // r > 0.7 = correlated
    killSwitch: {
      maxDailyLoss: 0.03,          // 3% daily loss
      maxDrawdown: 0.15,           // 15% drawdown
      minWinrate: 0.35             // 35% winrate threshold
    }
  },

  // ML Feature Store
  ml: {
    features: {
      lags: [1, 2, 3, 5, 10, 20],  // Price lags
      normalize: true,
      includeRegime: true,
      includeVolatility: true
    },
    storage: {
      retentionDays: 365,          // Keep 1 year of features
      batchSize: 100               // Batch inserts
    }
  },

  // Adaptive Strategies
  adaptive: {
    evaluation: {
      windowSize: 20,              // Evaluate last 20 trades
      updateFrequency: 5           // Update every 5 trades
    },
    adjustments: {
      drawdown: {
        levels: [
          { threshold: 0.05, sizeMultiplier: 0.8 },   // -5%: reduce 20%
          { threshold: 0.10, sizeMultiplier: 0.5 },   // -10%: reduce 50%
          { threshold: 0.15, sizeMultiplier: 0.0 }    // -15%: stop trading
        ]
      },
      winrate: {
        minThreshold: 0.40,        // Below 40% winrate
        disableSetup: true
      },
      volatility: {
        highVolMultiplier: 0.7,    // Reduce size in high vol
        lowVolMultiplier: 1.2      // Increase size in low vol
      }
    }
  },

  // Indicators (default periods)
  indicators: {
    ema: [9, 20, 50, 200],
    sma: [20, 50, 100, 200],
    rsi: { period: 14, overbought: 70, oversold: 30 },
    macd: { fast: 12, slow: 26, signal: 9 },
    bbands: { period: 20, stdDev: 2 },
    stochastic: { k: 14, d: 3, overbought: 80, oversold: 20 }
  },

  // API Rate Limiting
  api: {
    rateLimit: {
      windowMs: 60000,             // 1 minute
      maxRequests: 100             // 100 requests per minute
    }
  },

  // WebSocket
  websocket: {
    updateInterval: 2000,          // Update every 2 seconds
    throttle: 1000,                // Max 1 update per second
    reconnectDelay: 5000           // Reconnect after 5 seconds
  }
};
