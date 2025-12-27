/**
 * ============================================================================
 * SIGNAL ENGINE - Phase 8
 * ============================================================================
 * Combines all analysis modules to generate actionable trading signals.
 * Each signal includes: type, entry, SL, TP, R:R, confidence, and explanation.
 */

const { calculateAllIndicators, getCurrentValues, calculateATRStops } = require('../indicators')
const { analyzePatterns, getPatternSummary } = require('../priceAction')
const { detectLevels, findNearestLevels } = require('../levels')
const { getCurrentHourContext, getSignalSensitivity } = require('../context')
const { analyzeMTF, detectTrend, detectRange } = require('../mtf')
const { markDataQuality, filterCleanData } = require('../data/dataCleaner')

/**
 * Signal types
 */
const SIGNAL_TYPES = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  NO_TRADE: 'NO_TRADE'
}

/**
 * Generate complete trading signal
 * @param {object[]} candles - OHLC candles
 * @param {object} options - Configuration options
 * @returns {object} Complete signal with all details
 */
const generateSignal = (candles, options = {}) => {
  const {
    atrMultiplier = 2,
    minConfidence = 0.5,
    respectContext = true
  } = options
  
  if (!candles || candles.length < 55) {
    return {
      type: SIGNAL_TYPES.NO_TRADE,
      reason: 'Insufficient data for analysis'
    }
  }
  
  // Clean data
  const cleanCandles = filterCleanData(markDataQuality(candles))
  if (cleanCandles.length < 55) {
    return {
      type: SIGNAL_TYPES.NO_TRADE,
      reason: 'Insufficient clean data'
    }
  }
  
  const prices = cleanCandles.map(c => c.close)
  const latestCandle = cleanCandles[cleanCandles.length - 1]
  const currentPrice = latestCandle.close
  
  // 1. Calculate all indicators
  const indicators = calculateAllIndicators(cleanCandles)
  const currentValues = getCurrentValues(indicators)
  
  // 2. Get price action patterns
  const patternSummary = getPatternSummary(cleanCandles)
  
  // 3. Get support/resistance levels
  const levels = findNearestLevels(cleanCandles)
  
  // 4. Get hourly context
  const hourContext = getCurrentHourContext(cleanCandles)
  const sensitivity = getSignalSensitivity(hourContext)
  
  // 5. Get MTF analysis
  const mtfAnalysis = analyzeMTF(cleanCandles)
  
  // Collect all signals and their weights
  const signals = []
  
  // --- Indicator-based signals ---
  
  // RSI signals
  if (currentValues.rsi !== null) {
    if (currentValues.rsi < 30) {
      signals.push({
        source: 'RSI',
        direction: SIGNAL_TYPES.LONG,
        weight: 0.15,
        reason: `RSI oversold (${currentValues.rsi.toFixed(1)})`
      })
    } else if (currentValues.rsi > 70) {
      signals.push({
        source: 'RSI',
        direction: SIGNAL_TYPES.SHORT,
        weight: 0.15,
        reason: `RSI overbought (${currentValues.rsi.toFixed(1)})`
      })
    }
  }
  
  // MACD signals
  if (currentValues.macd.histogram !== null) {
    const hist = currentValues.macd.histogram
    const prevHist = indicators.macd.histogram.filter(h => h !== null).slice(-2)[0]
    
    if (hist > 0 && prevHist && prevHist <= 0) {
      signals.push({
        source: 'MACD',
        direction: SIGNAL_TYPES.LONG,
        weight: 0.2,
        reason: 'MACD bullish crossover'
      })
    } else if (hist < 0 && prevHist && prevHist >= 0) {
      signals.push({
        source: 'MACD',
        direction: SIGNAL_TYPES.SHORT,
        weight: 0.2,
        reason: 'MACD bearish crossover'
      })
    }
  }
  
  // Bollinger Band signals
  if (currentValues.bollinger.percentB !== null) {
    const percentB = currentValues.bollinger.percentB
    if (percentB < 0) {
      signals.push({
        source: 'BB',
        direction: SIGNAL_TYPES.LONG,
        weight: 0.15,
        reason: 'Price below lower Bollinger Band (oversold)'
      })
    } else if (percentB > 1) {
      signals.push({
        source: 'BB',
        direction: SIGNAL_TYPES.SHORT,
        weight: 0.15,
        reason: 'Price above upper Bollinger Band (overbought)'
      })
    }
  }
  
  // --- Trend signals ---
  if (mtfAnalysis.currentTF.trend.strength >= 0.7) {
    signals.push({
      source: 'Trend',
      direction: mtfAnalysis.currentTF.trend.direction,
      weight: 0.25,
      reason: `${mtfAnalysis.currentTF.trend.trend} (strength: ${(mtfAnalysis.currentTF.trend.strength * 100).toFixed(0)}%)`
    })
  }
  
  // --- Price Action signals ---
  if (patternSummary.recentPatterns.length > 0) {
    const lastPattern = patternSummary.recentPatterns[0]
    if (lastPattern && lastPattern.patterns.length > 0) {
      const pattern = lastPattern.patterns[0]
      if (pattern.direction !== 'NEUTRAL') {
        signals.push({
          source: 'Pattern',
          direction: pattern.direction,
          weight: pattern.confidence * 0.2,
          reason: pattern.description
        })
      }
    }
  }
  
  // --- Support/Resistance signals ---
  if (levels.nearestSupport && levels.nearestResistance) {
    const distToSupport = Math.abs(parseFloat(levels.supportDistance))
    const distToResistance = Math.abs(parseFloat(levels.resistanceDistance))
    
    // Near support = potential long
    if (distToSupport < 0.5) {
      signals.push({
        source: 'S/R',
        direction: SIGNAL_TYPES.LONG,
        weight: 0.15,
        reason: `At support level (${distToSupport.toFixed(2)}% away)`
      })
    }
    // Near resistance = potential short
    if (distToResistance < 0.5) {
      signals.push({
        source: 'S/R',
        direction: SIGNAL_TYPES.SHORT,
        weight: 0.15,
        reason: `At resistance level (${distToResistance.toFixed(2)}% away)`
      })
    }
  }
  
  // --- Calculate final signal ---
  let longWeight = 0
  let shortWeight = 0
  const longReasons = []
  const shortReasons = []
  
  for (const sig of signals) {
    if (sig.direction === SIGNAL_TYPES.LONG) {
      longWeight += sig.weight
      longReasons.push(sig.reason)
    } else if (sig.direction === SIGNAL_TYPES.SHORT) {
      shortWeight += sig.weight
      shortReasons.push(sig.reason)
    }
  }
  
  // Apply sensitivity adjustment from context
  longWeight *= sensitivity
  shortWeight *= sensitivity
  
  // Determine signal type
  let signalType = SIGNAL_TYPES.NO_TRADE
  let confidence = 0
  let reasons = []
  
  const netWeight = longWeight - shortWeight
  
  if (Math.abs(netWeight) >= minConfidence) {
    if (netWeight > 0) {
      signalType = SIGNAL_TYPES.LONG
      confidence = Math.min(longWeight, 1)
      reasons = longReasons
    } else {
      signalType = SIGNAL_TYPES.SHORT
      confidence = Math.min(shortWeight, 1)
      reasons = shortReasons
    }
  }
  
  // Check context filters
  if (respectContext && hourContext.isDeadHour) {
    signalType = SIGNAL_TYPES.NO_TRADE
    reasons = ['Dead hour - avoid trading during low volatility']
  }
  
  // Check MTF confirmation
  if (signalType !== SIGNAL_TYPES.NO_TRADE && mtfAnalysis.currentTF.trend.direction !== 'NEUTRAL') {
    if (signalType !== mtfAnalysis.currentTF.trend.direction) {
      confidence *= 0.5 // Reduce confidence for counter-trend trades
      reasons.push('⚠️ Counter-trend trade (reduced confidence)')
    }
  }
  
  // Calculate entry, SL, TP
  const atr = currentValues.atr
  let entry = null
  let stopLoss = null
  let takeProfit = null
  let riskReward = null
  
  if (signalType !== SIGNAL_TYPES.NO_TRADE && atr) {
    entry = currentPrice
    const stops = calculateATRStops(currentPrice, atr, atrMultiplier, signalType)
    stopLoss = stops.stopLoss
    takeProfit = stops.takeProfit
    riskReward = 2 // Default 1:2 R:R
  }
  
  return {
    type: signalType,
    confidence: parseFloat((confidence * 100).toFixed(1)),
    entry,
    stopLoss,
    takeProfit,
    riskReward,
    reasons,
    context: {
      session: hourContext.sessions,
      volatility: hourContext.volatility,
      trend: mtfAnalysis.currentTF.trend.trend,
      trendStrength: mtfAnalysis.currentTF.trend.strength
    },
    indicators: {
      rsi: currentValues.rsi,
      macd: currentValues.macd.histogram,
      atr,
      bbPercentB: currentValues.bollinger.percentB
    },
    levels: {
      nearestSupport: levels.nearestSupport?.price,
      nearestResistance: levels.nearestResistance?.price
    },
    timestamp: new Date().toISOString()
  }
}

/**
 * Format signal for human-readable explanation
 * @param {object} signal - Generated signal
 * @returns {string} Human-readable explanation
 */
const explainSignal = (signal) => {
  if (signal.type === SIGNAL_TYPES.NO_TRADE) {
    return `NO TRADE: ${signal.reasons.join(', ') || 'No clear opportunity'}`
  }
  
  const lines = [
    `📊 **${signal.type}** Signal (Confidence: ${signal.confidence}%)`,
    '',
    `📈 Entry: $${signal.entry?.toLocaleString()}`,
    `🛑 Stop Loss: $${signal.stopLoss?.toLocaleString()}`,
    `🎯 Take Profit: $${signal.takeProfit?.toLocaleString()}`,
    `⚖️ Risk/Reward: 1:${signal.riskReward}`,
    '',
    '**Reasons:**',
    ...signal.reasons.map(r => `• ${r}`),
    '',
    `**Context:** ${signal.context.session.join(', ')} session, ${signal.context.volatility} volatility`,
    `**Trend:** ${signal.context.trend} (${(signal.context.trendStrength * 100).toFixed(0)}% strength)`
  ]
  
  return lines.join('\n')
}

module.exports = {
  SIGNAL_TYPES,
  generateSignal,
  explainSignal
}
