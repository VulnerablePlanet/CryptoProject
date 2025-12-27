/**
 * ============================================================================
 * BACKTESTING SIMULATOR - Phase 9
 * ============================================================================
 * Simulate trading signals on historical data to validate strategy.
 */

const { generateSignal, SIGNAL_TYPES } = require('../signals')

/**
 * Trade result
 */
const TRADE_RESULT = {
  WIN: 'WIN',
  LOSS: 'LOSS',
  BREAKEVEN: 'BREAKEVEN'
}

/**
 * Run backtest on historical candles
 * @param {object[]} candles - Full historical candles
 * @param {object} options - Backtest options
 * @returns {object} Backtest results
 */
const runBacktest = (candles, options = {}) => {
  const {
    lookback = 100,         // Candles to analyze for each signal
    startIndex = 100,       // Start backtesting from this index
    capital = 10000,        // Starting capital
    riskPerTrade = 0.02,    // Risk 2% per trade
    minConfidence = 50      // Minimum confidence to take trade
  } = options
  
  if (!candles || candles.length < startIndex + 50) {
    return { error: 'Insufficient data for backtesting' }
  }
  
  const trades = []
  let currentCapital = capital
  let maxCapital = capital
  let maxDrawdown = 0
  let consecutiveWins = 0
  let consecutiveLosses = 0
  let maxConsecutiveWins = 0
  let maxConsecutiveLosses = 0
  
  // Simulate trading through history
  for (let i = startIndex; i < candles.length - 1; i++) {
    // Get candles up to this point
    const historicalCandles = candles.slice(Math.max(0, i - lookback), i + 1)
    
    // Generate signal at this point in time
    const signal = generateSignal(historicalCandles, {
      atrMultiplier: 2,
      minConfidence: minConfidence / 100,
      respectContext: false // Disable context for backtesting
    })
    
    // Skip if no trade signal or low confidence
    if (signal.type === SIGNAL_TYPES.NO_TRADE || signal.confidence < minConfidence) {
      continue
    }
    
    // Simulate trade execution
    const entryCandle = candles[i]
    const entry = signal.entry
    const stopLoss = signal.stopLoss
    const takeProfit = signal.takeProfit
    
    // Look forward to see trade result
    let result = null
    let exitPrice = null
    let exitIndex = null
    
    for (let j = i + 1; j < candles.length && j < i + 50; j++) {
      const futureCandle = candles[j]
      
      if (signal.type === SIGNAL_TYPES.LONG) {
        // Check stop loss hit
        if (futureCandle.low <= stopLoss) {
          result = TRADE_RESULT.LOSS
          exitPrice = stopLoss
          exitIndex = j
          break
        }
        // Check take profit hit
        if (futureCandle.high >= takeProfit) {
          result = TRADE_RESULT.WIN
          exitPrice = takeProfit
          exitIndex = j
          break
        }
      } else { // SHORT
        // Check stop loss hit
        if (futureCandle.high >= stopLoss) {
          result = TRADE_RESULT.LOSS
          exitPrice = stopLoss
          exitIndex = j
          break
        }
        // Check take profit hit
        if (futureCandle.low <= takeProfit) {
          result = TRADE_RESULT.WIN
          exitPrice = takeProfit
          exitIndex = j
          break
        }
      }
    }
    
    // If no exit found, close at last available price
    if (!result) {
      const lastIdx = Math.min(i + 50, candles.length - 1)
      exitPrice = candles[lastIdx].close
      exitIndex = lastIdx
      
      if (signal.type === SIGNAL_TYPES.LONG) {
        result = exitPrice > entry ? TRADE_RESULT.WIN : TRADE_RESULT.LOSS
      } else {
        result = exitPrice < entry ? TRADE_RESULT.WIN : TRADE_RESULT.LOSS
      }
    }
    
    // Calculate P&L
    const riskAmount = currentCapital * riskPerTrade
    const stopDistance = Math.abs(entry - stopLoss)
    const positionSize = stopDistance > 0 ? riskAmount / stopDistance : 0
    
    let pnl = 0
    if (signal.type === SIGNAL_TYPES.LONG) {
      pnl = (exitPrice - entry) * positionSize
    } else {
      pnl = (entry - exitPrice) * positionSize
    }
    
    // Update capital
    currentCapital += pnl
    maxCapital = Math.max(maxCapital, currentCapital)
    const currentDrawdown = (maxCapital - currentCapital) / maxCapital * 100
    maxDrawdown = Math.max(maxDrawdown, currentDrawdown)
    
    // Track consecutive wins/losses
    if (result === TRADE_RESULT.WIN) {
      consecutiveWins++
      consecutiveLosses = 0
      maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins)
    } else {
      consecutiveLosses++
      consecutiveWins = 0
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses)
    }
    
    // Record trade
    trades.push({
      index: i,
      type: signal.type,
      entry,
      stopLoss,
      takeProfit,
      exitPrice,
      exitIndex,
      result,
      pnl,
      capitalAfter: currentCapital,
      confidence: signal.confidence,
      reasons: signal.reasons,
      entryTime: entryCandle.timestamp,
      exitTime: candles[exitIndex]?.timestamp
    })
    
    // Skip ahead to avoid overlapping trades
    i = exitIndex
  }
  
  // Calculate metrics
  const metrics = calculateMetrics(trades, capital, currentCapital)
  
  return {
    trades,
    metrics,
    summary: {
      totalTrades: trades.length,
      startingCapital: capital,
      endingCapital: currentCapital,
      totalReturn: ((currentCapital - capital) / capital * 100).toFixed(2) + '%',
      maxDrawdown: maxDrawdown.toFixed(2) + '%',
      maxConsecutiveWins,
      maxConsecutiveLosses
    }
  }
}

/**
 * Calculate performance metrics
 * @param {object[]} trades - Array of trade results
 * @param {number} startCapital - Starting capital
 * @param {number} endCapital - Ending capital
 * @returns {object} Performance metrics
 */
const calculateMetrics = (trades, startCapital, endCapital) => {
  if (trades.length === 0) {
    return {
      winRate: 0,
      lossRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancy: 0,
      sharpeRatio: 0
    }
  }
  
  const wins = trades.filter(t => t.result === TRADE_RESULT.WIN)
  const losses = trades.filter(t => t.result === TRADE_RESULT.LOSS)
  
  const winRate = (wins.length / trades.length) * 100
  const lossRate = (losses.length / trades.length) * 100
  
  const totalWinPnL = wins.reduce((sum, t) => sum + t.pnl, 0)
  const totalLossPnL = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0))
  
  const avgWin = wins.length > 0 ? totalWinPnL / wins.length : 0
  const avgLoss = losses.length > 0 ? totalLossPnL / losses.length : 0
  
  const profitFactor = totalLossPnL > 0 ? totalWinPnL / totalLossPnL : totalWinPnL > 0 ? Infinity : 0
  
  // Expectancy: (Win% * AvgWin) - (Loss% * AvgLoss)
  const expectancy = (winRate / 100 * avgWin) - (lossRate / 100 * avgLoss)
  
  // Simplified Sharpe Ratio (returns / std dev)
  const returns = trades.map(t => t.pnl)
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0 // Annualized
  
  return {
    winRate: parseFloat(winRate.toFixed(2)),
    lossRate: parseFloat(lossRate.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    totalWins: wins.length,
    totalLosses: losses.length
  }
}

/**
 * Generate equity curve data
 * @param {object[]} trades - Array of trades
 * @param {number} startCapital - Starting capital
 * @returns {object[]} Equity curve points
 */
const getEquityCurve = (trades, startCapital) => {
  const curve = [{ index: 0, capital: startCapital, pnl: 0 }]
  
  for (const trade of trades) {
    curve.push({
      index: curve.length,
      capital: trade.capitalAfter,
      pnl: trade.pnl,
      result: trade.result,
      timestamp: trade.exitTime
    })
  }
  
  return curve
}

module.exports = {
  TRADE_RESULT,
  runBacktest,
  calculateMetrics,
  getEquityCurve
}
