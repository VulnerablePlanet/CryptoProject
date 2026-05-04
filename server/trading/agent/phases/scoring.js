/**
 * ============================================================================
 * SCORING PHASE - Phase 6
 * ============================================================================
 * Multi-factor scoring engine combining technical analysis, regime fit,
 * sentiment, order book analysis, and on-chain metrics.
 *
 * API Signature:
 * async function runScoringCycle(symbol, researchData, analysisData)
 * Returns: { decision, score, breakdown, reasons, recommendedEntry, recommendedSL, recommendedTP }
 */

const ccxtService = require('../../../services/ccxtService')

// Scoring weights (must sum to 1.0)
const WEIGHTS = {
  technical: 0.35,    // Multi-TF technical analysis
  regime: 0.20,       // Regime fit
  sentiment: 0.20,    // Fear & Greed sentiment
  orderBook: 0.15,    // Order book imbalance (placeholder - set to 0 if no data)
  onChain: 0.10       // On-chain metrics (placeholder - set to 0 if no data)
}

// Decision thresholds
const THRESHOLDS = {
  NO_TRADE: 0.60,      // score < 0.60 → NO_TRADE
  LIMIT_ORDER: 0.80    // score >= 0.80 → MARKET_ORDER (between is LIMIT_ORDER)
}

// Score bounds
const SCORE_BOUNDS = { min: 0, max: 1 }

// SL/TP multipliers (ATR-based)
const SL_MULTIPLIER = 1.5
const TP_MULTIPLIER = 2.0

/**
 * Normalize score to 0-1 range
 * @param {number} score - Raw score
 * @returns {number} Normalized score
 */
function normalizeScore(score) {
  return Math.max(SCORE_BOUNDS.min, Math.min(SCORE_BOUNDS.max, score))
}

/**
 * Score technical factors based on RSI, MACD, and MTF trend alignment
 * Technical Score (0-1):
 *   - RSI oversold (<30) → bullish signal
 *   - RSI overbought (>70) → bearish signal
 *   - MACD histogram positive → bullish
 *   - MACD histogram negative → bearish
 *   - MTF trend confirms direction → bonus
 *
 * @param {object} analysis - Analysis phase output
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {object} Technical score with breakdown
 */
function scoreTechnical(analysis, direction) {
  const { indicators, mtfTrend } = analysis
  let score = 0.5
  const breakdown = []
  const reasons = []

  // RSI scoring
  if (indicators.rsi !== undefined && indicators.rsi !== null) {
    const rsi = indicators.rsi
    let rsiScore = 0.5
    let rsiReason = ''

    if (rsi < 30) {
      // Oversold - bullish signal
      rsiScore = 0.7 + ((30 - rsi) / 30) * 0.3
      rsiReason = `RSI oversold (${rsi.toFixed(1)})`
    } else if (rsi > 70) {
      // Overbought - bearish signal
      rsiScore = 0.3 - ((rsi - 70) / 30) * 0.3
      rsiReason = `RSI overbought (${rsi.toFixed(1)})`
    } else {
      rsiScore = 0.5
      rsiReason = `RSI neutral (${rsi.toFixed(1)})`
    }

    score = (score * 0.5) + (rsiScore * 0.5)
    breakdown.push({ factor: 'RSI', score: rsiScore, rawValue: rsi, reason: rsiReason })

    // Add reason if RSI supports direction
    if (direction === 'LONG' && rsi < 30) {
      reasons.push('RSI oversold - bullish')
    } else if (direction === 'SHORT' && rsi > 70) {
      reasons.push('RSI overbought - bearish')
    }
  } else {
    breakdown.push({ factor: 'RSI', score: 0.5, rawValue: null, reason: 'No RSI data' })
  }

  // MACD scoring
  if (indicators.macd?.histogram !== undefined && indicators.macd?.histogram !== null) {
    const hist = indicators.macd.histogram
    let macdScore = 0.5
    let macdReason = ''

    if (hist > 0) {
      // Positive histogram - bullish
      macdScore = 0.6 + Math.min(hist / 50, 0.4)
      macdReason = `MACD bullish (hist: ${hist.toFixed(2)})`
    } else {
      // Negative histogram - bearish
      macdScore = 0.4 + Math.max(hist / 50, 0.0)
      macdReason = `MACD bearish (hist: ${hist.toFixed(2)})`
    }

    // Blend with current score
    score = (score * 0.7) + (macdScore * 0.3)
    breakdown.push({ factor: 'MACD', score: macdScore, rawValue: hist, reason: macdReason })

    // Add reason if MACD supports direction
    if (direction === 'LONG' && hist > 0) {
      reasons.push('MACD histogram positive - bullish')
    } else if (direction === 'SHORT' && hist < 0) {
      reasons.push('MACD histogram negative - bearish')
    }
  } else {
    breakdown.push({ factor: 'MACD', score: 0.5, rawValue: null, reason: 'No MACD data' })
  }

  // MTF trend alignment bonus
  if (mtfTrend && mtfTrend.consensusDirection) {
    const mtfDir = mtfTrend.consensusDirection
    if (mtfDir === direction) {
      // MTF confirms our direction - add bonus
      const bonus = 0.1
      score = normalizeScore(score + bonus)
      reasons.push(`MTF trend confirms ${direction}`)
      breakdown.push({ factor: 'MTF_Alignment', score: 0.8, rawValue: mtfDir, reason: `${mtfDir} aligned across timeframes` })
    } else if (mtfDir !== 'NEUTRAL') {
      // MTF contradicts direction
      score = normalizeScore(score - 0.05)
      breakdown.push({ factor: 'MTF_Alignment', score: 0.3, rawValue: mtfDir, reason: `MTF counter-trend (${mtfDir})` })
    } else {
      breakdown.push({ factor: 'MTF_Alignment', score: 0.5, rawValue: mtfDir, reason: 'MTF neutral' })
    }
  }

  score = normalizeScore(score)

  return {
    score,
    breakdown,
    reasons,
    direction
  }
}

/**
 * Score regime fit (alignment between signal direction and current regime)
 * Regime Score (0-1):
 *   - If regime matches signal direction → 1.0
 *   - If regime is RANGING → 0.5 (reduce conviction)
 *   - If regime contradicts signal → 0.2
 *
 * @param {string} direction - 'LONG' or 'SHORT'
 * @param {object} analysis - Analysis phase output
 * @returns {object} Regime score
 */
function scoreRegime(direction, analysis) {
  const { regime } = analysis
  let score = 0.5
  const breakdown = []
  const reasons = []

  if (!regime || !regime.regime) {
    breakdown.push({ factor: 'Regime', score: 0.5, rawValue: null, reason: 'No regime data' })
    return { score: 0.5, breakdown, reasons: ['No regime data - neutral'] }
  }

  const currentRegime = regime.regime.toUpperCase()

  // Regime alignment scoring matrix
  // BULL market favors LONG, BEAR market favors SHORT
  // SIDEWAYS is neutral, VOLATILE reduces conviction
  let regimeScore = 0.5
  let regimeReason = ''

  if (currentRegime === 'BULL' && direction === 'LONG') {
    regimeScore = 1.0
    regimeReason = 'Bull regime matches LONG signal'
    reasons.push('Regime matches - bull market aligned')
  } else if (currentRegime === 'BEAR' && direction === 'SHORT') {
    regimeScore = 1.0
    regimeReason = 'Bear regime matches SHORT signal'
    reasons.push('Regime matches - bear market aligned')
  } else if (currentRegime === 'SIDEWAYS') {
    regimeScore = 0.5
    regimeReason = 'Sideways regime - reduce conviction'
    reasons.push('Sideways regime - neutral')
  } else if (currentRegime === 'VOLATILE') {
    regimeScore = 0.4
    regimeReason = 'Volatile regime - reduced conviction'
    reasons.push('Volatile regime - caution')
  } else {
    // Regime contradicts direction
    regimeScore = 0.2
    regimeReason = `${currentRegime} regime contradicts ${direction}`
    reasons.push(`Regime contradicts signal - ${currentRegime}`)
  }

  score = regimeScore
  breakdown.push({
    factor: 'Regime',
    score: regimeScore,
    rawValue: currentRegime,
    reason: regimeReason
  })

  // Apply confidence multiplier if available
  if (regime.confidence && regime.confidence > 0.7) {
    // High confidence - stick with the score
    breakdown.push({ factor: 'Regime_Confidence', score: 1.0, rawValue: regime.confidence, reason: `High confidence (${(regime.confidence * 100).toFixed(0)}%)` })
  } else if (regime.confidence && regime.confidence < 0.5) {
    // Low confidence - reduce score
    score = normalizeScore(score - 0.1)
    breakdown.push({ factor: 'Regime_Confidence', score: 0.5, rawValue: regime.confidence, reason: `Low confidence (${(regime.confidence * 100).toFixed(0)}%)` })
  }

  return { score, breakdown, reasons }
}

/**
 * Score sentiment factors using Fear & Greed index (contrarian)
 * Sentiment Score (0-1):
 *   - Fear & Greed < 25 (Extreme Fear) → bullish (contrarian)
 *   - Fear & Greed > 75 (Extreme Greed) → bearish (contrarian)
 *   - Normal range → neutral weight
 *
 * @param {object} research - Research phase output
 * @param {string} direction - 'LONG' or 'SHORT'
 * @returns {object} Sentiment score
 */
function scoreSentiment(research, direction) {
  const { fearGreed } = research
  let score = 0.5
  const breakdown = []
  const reasons = []

  if (!fearGreed || fearGreed.value === undefined) {
    breakdown.push({ factor: 'FearGreed', score: 0.5, rawValue: null, reason: 'No Fear & Greed data' })
    return { score: 0.5, breakdown, reasons: ['No sentiment data - neutral'] }
  }

  const fgValue = fearGreed.value
  let sentimentScore = 0.5
  let fgReason = ''

  if (fgValue < 25) {
    // Extreme Fear - contrarian bullish
    sentimentScore = 0.8
    fgReason = 'Extreme Fear - potential buy opportunity'
    reasons.push('Extreme Fear - contrarian bullish')
  } else if (fgValue < 45) {
    // Fear
    sentimentScore = 0.6
    fgReason = 'Fear - slight bullish bias'
    reasons.push('Fear sentiment - mild bullish')
  } else if (fgValue > 75) {
    // Extreme Greed - contrarian bearish
    sentimentScore = 0.2
    fgReason = 'Extreme Greed - potential sell opportunity'
    reasons.push('Extreme Greed - contrarian bearish')
  } else if (fgValue > 55) {
    // Greed
    sentimentScore = 0.4
    fgReason = 'Greed - slight bearish bias'
    reasons.push('Greed sentiment - mild bearish')
  } else {
    // Neutral (45-55)
    sentimentScore = 0.5
    fgReason = 'Neutral sentiment'
    reasons.push('Neutral sentiment')
  }

  score = sentimentScore
  breakdown.push({
    factor: 'FearGreed',
    score: sentimentScore,
    rawValue: fgValue,
    classification: fearGreed.classification || 'Unknown',
    reason: fgReason
  })

  return { score, breakdown, reasons }
}

/**
 * Score order book imbalance
 * Placeholder: returns 0.5 neutral if no data
 *
 * @param {object} orderBook - Order book data (optional)
 * @returns {object} Order book score
 */
function scoreOrderBook(orderBook) {
  if (!orderBook || !orderBook.bids || !orderBook.asks) {
    return {
      score: 0.5,
      breakdown: [{ factor: 'OrderBook', score: 0.5, rawValue: null, reason: 'No order book data - neutral' }],
      reasons: ['Order book data not available - neutral']
    }
  }

  // If we have real order book data, calculate imbalance
  const { bids, asks } = orderBook

  // Calculate volume imbalance
  const bidVolume = bids.reduce((sum, b) => sum + (b.amount || 0), 0)
  const askVolume = asks.reduce((sum, a) => sum + (a.amount || 0), 0)
  const totalVolume = bidVolume + askVolume

  if (totalVolume === 0) {
    return {
      score: 0.5,
      breakdown: [{ factor: 'OrderBook', score: 0.5, rawValue: null, reason: 'Empty order book' }],
      reasons: ['Order book empty - neutral']
    }
  }

  // Imbalance: positive = more bids (bullish), negative = more asks (bearish)
  const imbalance = (bidVolume - askVolume) / totalVolume
  const score = normalizeScore(0.5 + (imbalance * 0.5))

  return {
    score,
    breakdown: [{
      factor: 'OrderBook',
      score,
      rawValue: imbalance,
      reason: `${imbalance > 0 ? 'Bullish' : 'Bearish'} imbalance (${(Math.abs(imbalance) * 100).toFixed(1)}%)`
    }],
    reasons: []
  }
}

/**
 * Score on-chain metrics
 * Placeholder: returns 0.5 neutral if no data
 *
 * @param {object} onChain - On-chain data (optional)
 * @returns {object} On-chain score
 */
function scoreOnChain(onChain) {
  if (!onChain || Object.keys(onChain).length === 0) {
    return {
      score: 0.5,
      breakdown: [{ factor: 'OnChain', score: 0.5, rawValue: null, reason: 'No on-chain data - neutral' }],
      reasons: ['On-chain metrics not available - neutral']
    }
  }

  // Placeholder - real implementation would analyze:
  // - Exchange flows (in/out)
  // - Whale transactions
  // - HODL waves
  // - Network growth

  return {
    score: 0.5,
    breakdown: [{ factor: 'OnChain', score: 0.5, rawValue: null, reason: 'On-chain placeholder' }],
    reasons: []
  }
}

/**
 * Calculate weighted composite score
 * @param {object} factors - All factor scores
 * @returns {number} Composite score 0-1
 */
function calculateCompositeScore(factors) {
  const total =
    factors.technical * WEIGHTS.technical +
    factors.regime * WEIGHTS.regime +
    factors.sentiment * WEIGHTS.sentiment +
    factors.orderBook * WEIGHTS.orderBook +
    factors.onChain * WEIGHTS.onChain

  return normalizeScore(total)
}

/**
 * Determine signal direction based on technical score
 * @param {object} technicalScore - Technical scoring result
 * @returns {string} 'LONG', 'SHORT', or 'NEUTRAL'
 */
function determineDirection(technicalScore) {
  const { score, breakdown } = technicalScore

  // Direction determined by RSI and MACD alignment
  let longSignals = 0
  let shortSignals = 0

  for (const item of breakdown) {
    if (item.factor === 'RSI' || item.factor === 'MACD') {
      if (item.score > 0.55) longSignals++
      else if (item.score < 0.45) shortSignals++
    }
  }

  if (longSignals > shortSignals) return 'LONG'
  if (shortSignals > longSignals) return 'SHORT'
  return 'NEUTRAL'
}

/**
 * Determine trade decision from score
 * @param {number} score - Composite score
 * @returns {object} Decision with type and order method
 */
function determineDecision(score) {
  if (score < THRESHOLDS.NO_TRADE) {
    return {
      decision: 'NO_TRADE',
      reason: `Score ${(score * 100).toFixed(1)} below threshold ${(THRESHOLDS.NO_TRADE * 100).toFixed(0)}`
    }
  }

  if (score >= THRESHOLDS.LIMIT_ORDER) {
    return {
      decision: 'MARKET_ORDER',
      reason: `Strong score ${(score * 100).toFixed(1)}% - immediate entry`
    }
  }

  return {
    decision: 'LIMIT_ORDER',
    reason: `Moderate score ${(score * 100).toFixed(1)}% - limit entry at key level`
  }
}

/**
 * Calculate recommended entry, stop loss, and take profit prices
 * @param {string} direction - 'LONG' or 'SHORT'
 * @param {object} analysis - Analysis phase output
 * @param {number} score - Composite score
 * @returns {object} Price recommendations
 */
function calculatePriceTargets(direction, analysis, score) {
  const { indicators, levels } = analysis
  const atr = indicators?.atr || 1
  const currentPrice = levels?.currentPrice || indicators?.close || 0

  if (!currentPrice) {
    return {
      recommendedEntry: null,
      recommendedSL: null,
      recommendedTP: null,
      atr
    }
  }

  let entry, sl, tp

  if (direction === 'LONG') {
    entry = currentPrice  // Entry at current price (or limit order slightly below)
    sl = currentPrice - (atr * SL_MULTIPLIER)
    tp = currentPrice + (atr * TP_MULTIPLIER)
  } else {
    entry = currentPrice
    sl = currentPrice + (atr * SL_MULTIPLIER)
    tp = currentPrice - (atr * TP_MULTIPLIER)
  }

  return {
    recommendedEntry: parseFloat(entry.toFixed(2)),
    recommendedSL: parseFloat(sl.toFixed(2)),
    recommendedTP: parseFloat(tp.toFixed(2)),
    atr: parseFloat(atr.toFixed(2))
  }
}

/**
 * Main scoring phase execution
 * @param {string} symbol - Trading symbol (e.g., 'BTC/USDT')
 * @param {object} researchData - Research phase output { fearGreed, sentiment, socialMetrics }
 * @param {object} analysisData - Analysis phase output { indicators, regime, mtfTrend, levels, patterns }
 * @returns {Promise<object>} Complete scoring result
 */
async function runScoringCycle(symbol, researchData, analysisData) {
  console.log(`[Scoring] Starting scoring cycle for ${symbol}`)

  try {
    // Validate inputs
    if (!researchData || !analysisData) {
      throw new Error('Missing required data: researchData and/or analysisData')
    }

    // Step 1: Determine direction from technicals
    const technicalScore = scoreTechnical(analysisData, 'LONG') // Pass LONG to get bullish score
    const technicalScoreShort = scoreTechnical(analysisData, 'SHORT') // Pass SHORT to get bearish score
    const direction = determineDirection(technicalScore)

    // If neutral, return no trade
    if (direction === 'NEUTRAL') {
      return {
        decision: 'NO_TRADE',
        score: 0.5,
        direction: 'NEUTRAL',
        breakdown: {
          technical: { score: 0.5, ...technicalScore },
          regime: { score: 0.5 },
          sentiment: { score: 0.5 },
          orderBook: { score: 0.5 },
          onChain: { score: 0.5 }
        },
        reasons: ['Mixed technical signals - no clear direction'],
        recommendedEntry: null,
        recommendedSL: null,
        recommendedTP: null,
        timestamp: Date.now()
      }
    }

    // Step 2: Score all factors
    const techScore = direction === 'LONG' ? technicalScore.score : technicalScoreShort.score
    const regimeScore = scoreRegime(direction, analysisData)
    const sentimentScore = scoreSentiment(researchData, direction)
    const obScore = { score: 0.5 } // Placeholder - no order book integration yet
    const onChainScore = { score: 0.5 } // Placeholder - no on-chain integration yet

    // Step 3: Calculate composite score
    const compositeScore = calculateCompositeScore({
      technical: techScore,
      regime: regimeScore.score,
      sentiment: sentimentScore.score,
      orderBook: obScore.score,
      onChain: onChainScore.score
    })

    // Step 4: Determine decision
    const decisionResult = determineDecision(compositeScore)

    // Step 5: Calculate price targets
    const priceTargets = calculatePriceTargets(direction, analysisData, compositeScore)

    // Step 6: Build detailed breakdown (debug-friendly)
    const breakdown = {
      technical: {
        score: techScore,
        weight: WEIGHTS.technical,
        weightedContribution: techScore * WEIGHTS.technical,
        factors: direction === 'LONG' ? technicalScore.breakdown : technicalScoreShort.breakdown
      },
      regime: {
        score: regimeScore.score,
        weight: WEIGHTS.regime,
        weightedContribution: regimeScore.score * WEIGHTS.regime,
        factors: regimeScore.breakdown
      },
      sentiment: {
        score: sentimentScore.score,
        weight: WEIGHTS.sentiment,
        weightedContribution: sentimentScore.score * WEIGHTS.sentiment,
        factors: sentimentScore.breakdown
      },
      orderBook: {
        score: obScore.score,
        weight: WEIGHTS.orderBook,
        weightedContribution: obScore.score * WEIGHTS.orderBook,
        factors: []
      },
      onChain: {
        score: onChainScore.score,
        weight: WEIGHTS.onChain,
        weightedContribution: onChainScore.score * WEIGHTS.onChain,
        factors: []
      }
    }

    // Step 7: Collect all reasons
    const reasons = [
      ...(direction === 'LONG' ? technicalScore.reasons : technicalScoreShort.reasons),
      ...regimeScore.reasons,
      ...sentimentScore.reasons
    ]

    const result = {
      decision: decisionResult.decision,
      score: compositeScore,
      direction,
      breakdown,
      reasons,
      ...priceTargets,
      weights: WEIGHTS,
      thresholds: THRESHOLDS,
      timestamp: Date.now()
    }

    console.log(`[Scoring] Completed: ${decisionResult.decision} | Score: ${(compositeScore * 100).toFixed(1)}% | Direction: ${direction}`)
    console.log(`[Scoring] Breakdown: T=${(techScore * WEIGHTS.technical * 100).toFixed(0)}% R=${(regimeScore.score * WEIGHTS.regime * 100).toFixed(0)}% S=${(sentimentScore.score * WEIGHTS.sentiment * 100).toFixed(0)}%`)

    return result

  } catch (error) {
    console.error('[Scoring] Phase failed:', error.message)
    throw error
  }
}

module.exports = {
  runScoringCycle,
  scoreTechnical,
  scoreRegime,
  scoreSentiment,
  scoreOrderBook,
  scoreOnChain,
  WEIGHTS,
  THRESHOLDS,
  determineDirection,
  determineDecision,
  calculatePriceTargets
}