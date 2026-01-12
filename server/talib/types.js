/**
 * Type Definitions for TA-Lib Module
 * JSDoc types for autocompletion and validation
 */

/**
 * @typedef {'strong_trend' | 'weak_trend' | 'range' | 'high_volatility'} RegimeType
 */

/**
 * @typedef {Object} RegimeDetection
 * @property {RegimeType} regime - Detected market regime
 * @property {number} confidence - Confidence level (0-1)
 * @property {number} adx - ADX value
 * @property {number} atr - ATR value
 * @property {number} volatility - Realized volatility
 * @property {Date} timestamp - Detection timestamp
 */

/**
 * @typedef {'LONG' | 'SHORT' | 'NEUTRAL'} SignalDirection
 */

/**
 * @typedef {'high' | 'medium' | 'low'} SignalQuality
 */

/**
 * @typedef {Object} SignalScore
 * @property {number} score - Aggregated score (-1 to 1)
 * @property {SignalQuality} quality - Signal quality
 * @property {SignalDirection} direction - Trade direction
 * @property {Object<string, number>} components - Individual indicator scores
 * @property {number} confidence - Overall confidence
 */

/**
 * @typedef {Object} NormalizedIndicator
 * @property {string} name - Indicator name
 * @property {number} value - Normalized value (-1 to 1)
 * @property {number} raw - Raw indicator value
 * @property {Date} timestamp
 */

/**
 * @typedef {'daily' | '4h' | '1h' | '15m' | '5m' | '1m'} Timeframe
 */

/**
 * @typedef {Object} TimeframeAnalysis
 * @property {Timeframe} timeframe
 * @property {'bullish' | 'bearish' | 'neutral'} trend
 * @property {number} strength - Trend strength (0-1)
 * @property {SignalScore} signal
 * @property {RegimeType} regime
 */

/**
 * @typedef {Object} MTFAnalysis
 * @property {TimeframeAnalysis} daily
 * @property {TimeframeAnalysis} '4h'
 * @property {TimeframeAnalysis} '1h'
 * @property {TimeframeAnalysis} '15m'
 * @property {Object} aggregated
 * @property {boolean} aggregated.canTrade - Whether trade is allowed
 * @property {SignalDirection} aggregated.direction
 * @property {number} aggregated.confidence
 * @property {boolean} aggregated.aligned - Timeframes aligned
 */

/**
 * @typedef {Object} VolumeNode
 * @property {number} price
 * @property {number} volume
 * @property {number} percentage - Percentage of total volume
 */

/**
 * @typedef {Object} VolumeProfile
 * @property {number} poc - Point of Control (price with most volume)
 * @property {number} vah - Value Area High
 * @property {number} val - Value Area Low
 * @property {VolumeNode[]} nodes - All volume nodes
 * @property {number} totalVolume
 */

/**
 * @typedef {Object} VWAPData
 * @property {number} vwap - Volume Weighted Average Price
 * @property {number} upperBand - VWAP + 1 std dev
 * @property {number} lowerBand - VWAP - 1 std dev
 * @property {number} distance - Current price distance from VWAP
 */

/**
 * @typedef {Object} DeltaVolume
 * @property {number} buyVolume
 * @property {number} sellVolume
 * @property {number} delta - Buy - Sell
 * @property {number} ratio - Buy / Total
 * @property {'buy' | 'sell' | 'neutral'} pressure
 */

/**
 * @typedef {Object} VolumeAnalysis
 * @property {VolumeProfile} profile
 * @property {VWAPData} vwap
 * @property {DeltaVolume} delta
 * @property {boolean} absorption - Absorption detected
 * @property {boolean} exhaustion - Exhaustion detected
 */

/**
 * @typedef {Object} OrderBookImbalance
 * @property {number} bidVolume
 * @property {number} askVolume
 * @property {number} ratio - Bid / (Bid + Ask)
 * @property {'buy' | 'sell' | 'neutral'} pressure
 * @property {'significant' | 'extreme' | 'normal'} level
 */

/**
 * @typedef {Object} OrderBookWall
 * @property {'bid' | 'ask'} side
 * @property {number} price
 * @property {number} size
 * @property {number} distance - Distance from mid price
 */

/**
 * @typedef {Object} OrderBookIntelligence
 * @property {OrderBookImbalance} imbalance
 * @property {OrderBookWall[]} walls
 * @property {number} spread - Bid-ask spread
 * @property {number} depth - Total depth (top 20 levels)
 * @property {boolean} spoofing - Possible spoofing detected
 * @property {'tight' | 'normal' | 'wide'} spreadStatus
 */

/**
 * @typedef {Object} DynamicStop
 * @property {number} stopLoss
 * @property {number} takeProfit
 * @property {number} riskReward - R:R ratio
 * @property {'atr' | 'volatility' | 'structure'} method
 * @property {number} distance - Distance from entry in percent
 */

/**
 * @typedef {Object} TrailingStop
 * @property {number} currentStop
 * @property {number} highestPrice
 * @property {boolean} activated
 * @property {number} trailPercent
 */

/**
 * @typedef {Object} BacktestResult
 * @property {number} totalTrades
 * @property {number} winningTrades
 * @property {number} losingTrades
 * @property {number} winrate
 * @property {number} avgWin
 * @property {number} avgLoss
 * @property {number} profitFactor
 * @property {number} sharpeRatio
 * @property {number} maxDrawdown
 * @property {number} totalReturn
 * @property {Object[]} trades
 */

/**
 * @typedef {Object} WalkForwardWindow
 * @property {Date} optStart
 * @property {Date} optEnd
 * @property {Date} testStart
 * @property {Date} testEnd
 * @property {Object} optimizedParams
 * @property {BacktestResult} testResults
 */

/**
 * @typedef {'bos' | 'choch'} StructureBreakType
 */

/**
 * @typedef {Object} StructureBreak
 * @property {StructureBreakType} type
 * @property {'bullish' | 'bearish'} direction
 * @property {number} price
 * @property {Date} timestamp
 * @property {number} strength
 */

/**
 * @typedef {Object} FairValueGap
 * @property {number} high - Gap high
 * @property {number} low - Gap low
 * @property {'bullish' | 'bearish'} direction
 * @property {Date} created
 * @property {boolean} filled
 * @property {number} fillPercent
 */

/**
 * @typedef {Object} LiquiditySweep
 * @property {'high' | 'low'} side
 * @property {number} level - Price level swept
 * @property {Date} timestamp
 * @property {boolean} rejection - Swept and rejected
 */

/**
 * @typedef {Object} MarketStructure
 * @property {StructureBreak[]} breaks
 * @property {FairValueGap[]} fvgs
 * @property {LiquiditySweep[]} sweeps
 * @property {number[]} equalHighs
 * @property {number[]} equalLows
 * @property {'bullish' | 'bearish' | 'neutral'} bias
 */

/**
 * @typedef {'regular' | 'hidden'} DivergenceType
 */

/**
 * @typedef {Object} Divergence
 * @property {DivergenceType} type
 * @property {'bullish' | 'bearish'} direction
 * @property {string} oscillator - Oscillator name
 * @property {number} priceStart
 * @property {number} priceEnd
 * @property {number} oscStart
 * @property {number} oscEnd
 * @property {boolean} volumeConfirmed
 * @property {number} strength
 * @property {Date} timestamp
 */

/**
 * @typedef {Object} PositionSize
 * @property {number} size - Position size in quote currency
 * @property {number} quantity - Quantity of asset
 * @property {number} riskAmount - Amount at risk
 * @property {number} riskPercent - Risk as percent of account
 */

/**
 * @typedef {Object} RiskMetrics
 * @property {number} currentExposure - Current total exposure
 * @property {number} availableCapital - Available for new positions
 * @property {number} correlatedExposure - Exposure in correlated assets
 * @property {boolean} killSwitchActive
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} MLFeatures
 * @property {Object<string, number>} indicators - Normalized indicators
 * @property {RegimeType} regime
 * @property {number} volatility
 * @property {Object<string, number>} lags - Lagged features
 * @property {Date} timestamp
 * @property {string} symbol
 */

/**
 * @typedef {Object} AdaptiveAdjustment
 * @property {number} originalSize
 * @property {number} adjustedSize
 * @property {number} multiplier
 * @property {string} reason
 * @property {Date} timestamp
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} drawdown - Current drawdown
 * @property {number} winrate - Recent winrate
 * @property {number} volatility - Market volatility
 * @property {number} tradesCount - Number of trades in window
 */

/**
 * @typedef {Object} OHLCV
 * @property {Date} timestamp
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef {Object} Trade
 * @property {string} id
 * @property {number} price
 * @property {number} amount
 * @property {'buy' | 'sell'} side
 * @property {Date} timestamp
 */

module.exports = {};
