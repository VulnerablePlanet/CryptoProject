/**
 * ============================================================================
 * MONITORING PHASE - Phase 8
 * ============================================================================
 * Risk monitoring, performance tracking, and kill-switch enforcement.
 * Runs every cycle to check position health and risk limits.
 *
 * API Signature:
 * async function runMonitoringCycle(agentState)
 * Returns: { positions, riskStatus, agentState, events: [] }
 */

const ccxtService = require('../../../services/ccxtService')

// Risk thresholds — CRITICAL: errors here = potential losses
const THRESHOLDS = {
  DAILY_LOSS_PCT: 0.03,              // 3% daily loss triggers kill switch
  MAX_DRAWDOWN_PCT: 0.10,            // 10% drawdown triggers kill switch
  MAX_CONSECUTIVE_LOSSES: 5,         // 5 consecutive losses triggers kill switch
  VOLATILITY_ANOMALY_MULTIPLIER: 3.0 // ATR > 3x average triggers pause
}

// Default exchange
const EXCHANGE_ID = 'binance'

// ============================================================================
// 1. POSITION STATUS CHECK
// ============================================================================

/**
 * Fetch all open positions from MongoDB and calculate current P&L
 * @param {object} options - Options object
 * @param {string} options.exchange - Exchange ID (default: 'binance')
 * @param {object} options.mongoose - Mongoose instance
 * @returns {Promise<{ positions: array, summary: { openCount, totalPnl, unrealizedPnl } }>}
 */
async function checkPositions(options = {}) {
  const { exchange = EXCHANGE_ID, mongoose = null } = options

  let positions = []
  let summary = { openCount: 0, totalPnl: 0, unrealizedPnl: 0 }

  try {
    // Fetch open positions from MongoDB
    if (mongoose) {
      const Position = mongoose.model('Position')
      if (Position) {
        positions = await Position.find({ status: 'OPEN' }).lean()
      }
    }

    // If no positions, return empty
    if (positions.length === 0) {
      return { positions: [], summary: { openCount: 0, totalPnl: 0, unrealizedPnl: 0 } }
    }

    // Get current prices via CCXT and calculate P&L
    const positionPnLs = []
    let totalUnrealizedPnl = 0
    let totalPnl = 0

    for (const position of positions) {
      try {
        const { ticker } = await ccxtService.fetchTicker(exchange, position.symbol)
        const currentPrice = ticker?.last || position.entryPrice

        let unrealizedPnl = 0
        if (position.side === 'LONG') {
          unrealizedPnl = (currentPrice - position.entryPrice) * position.size
        } else {
          unrealizedPnl = (position.entryPrice - currentPrice) * position.size
        }

        // Add realized P&L if any
        const realizedPnl = position.realizedPnl || 0

        positionPnLs.push({
          ...position,
          currentPrice,
          unrealizedPnl,
          unrealizedPnlPct: position.entryPrice > 0 ? unrealizedPnl / (position.entryPrice * position.size) : 0,
          realizedPnl
        })

        totalUnrealizedPnl += unrealizedPnl
        totalPnl += realizedPnl + unrealizedPnl
      } catch (error) {
        // Handle missing price data gracefully
        console.warn(`[Monitoring] Failed to fetch price for ${position.symbol}:`, error.message)
        positionPnLs.push({
          ...position,
          currentPrice: position.entryPrice,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          realizedPnl: position.realizedPnl || 0
        })
      }
    }

    summary = {
      openCount: positions.length,
      totalPnl,
      unrealizedPnl: totalUnrealizedPnl
    }

    return { positions: positionPnLs, summary }
  } catch (error) {
    console.error('[Monitoring] checkPositions error:', error.message)
    return { positions: [], summary: { openCount: 0, totalPnl: 0, unrealizedPnl: 0 } }
  }
}

// ============================================================================
// 2. RISK LIMIT CHECKS (Kill-Switch Triggers)
// ============================================================================

/**
 * Check ALL risk limits every cycle
 * @param {object} agentState - Current agent state
 * @param {object} options - Options object
 * @param {number} options.currentATR - Current ATR value
 * @param {number} options.avgATR - Average ATR value
 * @returns {Promise<{ triggered: boolean, reason?: string }>}
 */
async function runRiskChecks(agentState, options = {}) {
  const { currentATR = null, avgATR = null } = options

  const checks = {
    dailyLoss: { triggered: false, value: 0, threshold: THRESHOLDS.DAILY_LOSS_PCT },
    maxDrawdown: { triggered: false, value: 0, threshold: THRESHOLDS.MAX_DRAWDOWN_PCT },
    consecutiveLosses: { triggered: false, count: 0, threshold: THRESHOLDS.MAX_CONSECUTIVE_LOSSES },
    volatilityAnomaly: { triggered: false, ratio: 0, threshold: THRESHOLDS.VOLATILITY_ANOMALY_MULTIPLIER }
  }

  try {
    const currentCapital = agentState.capital || 0
    const dailyStartCapital = agentState.dailyStartCapital || currentCapital
    const peakCapital = agentState.peakCapital || currentCapital

    // Daily Loss Check: (dailyStartCapital - currentCapital) / dailyStartCapital > 0.03
    if (dailyStartCapital > 0) {
      const dailyLossPct = (dailyStartCapital - currentCapital) / dailyStartCapital
      checks.dailyLoss.value = dailyLossPct
      checks.dailyLoss.triggered = dailyLossPct > THRESHOLDS.DAILY_LOSS_PCT
    }

    // Max Drawdown Check: (peakCapital - currentCapital) / peakCapital > 0.10
    if (peakCapital > 0) {
      const drawdownPct = (peakCapital - currentCapital) / peakCapital
      checks.maxDrawdown.value = drawdownPct
      checks.maxDrawdown.triggered = drawdownPct > THRESHOLDS.MAX_DRAWDOWN_PCT
    }

    // Consecutive Losses Check: count >= 5
    const consecutiveLosses = agentState.consecutiveLosses || 0
    checks.consecutiveLosses.count = consecutiveLosses
    checks.consecutiveLosses.triggered = consecutiveLosses >= THRESHOLDS.MAX_CONSECUTIVE_LOSSES

    // Volatility Anomaly Check: currentATR / avgATR > 3.0
    if (currentATR && avgATR && avgATR > 0) {
      const volatilityRatio = currentATR / avgATR
      checks.volatilityAnomaly.ratio = volatilityRatio
      checks.volatilityAnomaly.triggered = volatilityRatio > THRESHOLDS.VOLATILITY_ANOMALY_MULTIPLIER
    }

    // Determine if any kill-switch was triggered
    let reason = null
    if (checks.dailyLoss.triggered) {
      reason = `DAILY_LOSS_${Math.round(checks.dailyLoss.value * 100)}%`
    } else if (checks.maxDrawdown.triggered) {
      reason = `MAX_DRAWDOWN_${Math.round(checks.maxDrawdown.value * 100)}%`
    } else if (checks.consecutiveLosses.triggered) {
      reason = `CONSECUTIVE_LOSSES_${checks.consecutiveLosses.count}`
    } else if (checks.volatilityAnomaly.triggered) {
      reason = `VOLATILITY_ANOMALY_${checks.volatilityAnomaly.ratio.toFixed(1)}x`
    }

    return {
      triggered: reason !== null,
      reason,
      checks
    }
  } catch (error) {
    console.error('[Monitoring] runRiskChecks error:', error.message)
    // Fail safe: if risk checks fail, trigger kill-switch
    return {
      triggered: true,
      reason: 'RISK_CHECK_ERROR',
      checks,
      error: error.message
    }
  }
}

// ============================================================================
// 3. POSITION CLOSED CHECK
// ============================================================================

/**
 * Process a closed position (by TP or SL)
 * @param {object} position - Closed position
 * @param {object} options - Options object
 * @param {object} options.mongoose - Mongoose instance
 * @param {object} options.eventBus - Event bus for emissions
 * @returns {Promise<object>} Processing result
 */
async function processClosedPosition(position, options = {}) {
  const { mongoose = null, eventBus = null } = options

  const result = { positionId: position._id || position.positionId, processed: false }

  try {
    // Calculate realized P&L
    const realizedPnl = position.realizedPnl || 0
    const isWin = realizedPnl > 0
    const isLoss = realizedPnl < 0

    // Update win/loss tracking in agent state would happen via updateAgentState
    // For now, log trade to TradeLog collection
    if (mongoose) {
      const TradeLog = mongoose.model('TradeLog')
      if (TradeLog) {
        const tradeLogEntry = {
          symbol: position.symbol,
          side: position.side,
          entryPrice: position.entryPrice,
          exitPrice: position.currentPrice || position.exitPrice,
          size: position.size,
          realizedPnl,
          realizedPnlPct: position.entryPrice > 0
            ? realizedPnl / (position.entryPrice * position.size)
            : 0,
          exitReason: position.exitReason || 'UNKNOWN', // 'TP' or 'SL'
          openedAt: position.openedAt,
          closedAt: new Date(),
          status: isWin ? 'WIN' : isLoss ? 'LOSS' : 'BREAKEVEN'
        }

        await TradeLog.create(tradeLogEntry)
      }

      // Update position status in MongoDB
      const Position = mongoose.model('Position')
      if (Position && position._id) {
        await Position.findByIdAndUpdate(position._id, {
          status: 'CLOSED',
          closedAt: new Date(),
          realizedPnl,
          exitPrice: position.currentPrice || position.exitPrice
        })
      }
    }

    // Emit position:closed event
    if (eventBus) {
      eventBus.emit('position:closed', {
        symbol: position.symbol,
        side: position.side,
        entryPrice: position.entryPrice,
        exitPrice: position.currentPrice || position.exitPrice,
        size: position.size,
        realizedPnl,
        exitReason: position.exitReason || 'UNKNOWN',
        timestamp: Date.now()
      })
    }

    result.processed = true
    return result
  } catch (error) {
    console.error('[Monitoring] processClosedPosition error:', error.message)
    return { ...result, error: error.message }
  }
}

// ============================================================================
// 4. AGENT STATE UPDATE
// ============================================================================

/**
 * Update MongoDB AgentState document
 * @param {object} updates - Fields to update
 * @param {object} options - Options object
 * @param {object} options.mongoose - Mongoose instance
 * @returns {Promise<void>}
 */
async function updateAgentState(updates, options = {}) {
  const { mongoose = null } = options

  if (!mongoose) return

  try {
    const AgentState = mongoose.model('AgentState')
    if (AgentState) {
      await AgentState.findOneAndUpdate(
        { agentId: updates.agentId || 'main' },
        {
          $set: {
            capital: updates.capital,
            peakCapital: updates.peakCapital,
            dailyStartCapital: updates.dailyStartCapital,
            openPositions: updates.openPositions,
            consecutiveLosses: updates.consecutiveLosses,
            killSwitchActive: updates.killSwitchActive,
            state: updates.state || 'MONITORING',
            updatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      )
    }
  } catch (error) {
    console.error('[Monitoring] updateAgentState error:', error.message)
  }
}

// ============================================================================
// 5. EVENT EMISSION
// ============================================================================

/**
 * Emit events via EventBus
 * @param {string} eventName - Event name
 * @param {object} data - Event data
 * @param {object} eventBus - EventBus instance
 */
function emitEvent(eventName, data, eventBus) {
  if (eventBus) {
    eventBus.emit(eventName, data)
  }
}

// ============================================================================
// MAIN MONITORING CYCLE
// ============================================================================

/**
 * Main monitoring cycle entry point
 * @param {object} agentState - Current agent state
 * @param {object} options - Options object
 * @param {object} options.exchange - Exchange ID (default: 'binance')
 * @param {object} options.mongoose - Mongoose instance
 * @param {object} options.eventBus - EventBus instance
 * @param {object} options.killSwitch - Kill switch module with trigger()
 * @param {number} options.currentATR - Current ATR for volatility check
 * @param {number} options.avgATR - Average ATR for volatility check
 * @returns {Promise<{ positions, riskStatus, agentState, events: [] }>}
 */
async function runMonitoringCycle(agentState, options = {}) {
  const {
    exchange = EXCHANGE_ID,
    mongoose = null,
    eventBus = null,
    killSwitch = null,
    currentATR = null,
    avgATR = null
  } = options

  const events = []
  let positions = []
  let riskStatus = { triggered: false }
  let updatedAgentState = { ...agentState }

  try {
    // Emit agent:state_update event at cycle start
    emitEvent('agent:state_update', {
      state: 'MONITORING',
      capital: agentState.capital,
      openPositions: agentState.openPositions,
      killSwitchActive: agentState.killSwitchActive,
      timestamp: Date.now()
    }, eventBus)

    // 1. Check positions and calculate P&L
    const positionsResult = await checkPositions({ exchange, mongoose })
    positions = positionsResult.positions

    // 2. Run risk checks — THIS IS CRITICAL
    riskStatus = await runRiskChecks(agentState, { currentATR, avgATR })

    // If kill-switch triggered, execute IMMEDIATELY (synchronous)
    if (riskStatus.triggered) {
      console.log(`[Monitoring] KILL-SWITCH TRIGGERED: ${riskStatus.reason}`)

      // Emit kill_switch:triggered event first
      emitEvent('kill_switch:triggered', {
        reason: riskStatus.reason,
        checks: riskStatus.checks,
        timestamp: Date.now()
      }, eventBus)

      // Kill switch is synchronous — set state and let orchestrator handle stopping
      updatedAgentState.killSwitchActive = true
      updatedAgentState.killReason = riskStatus.reason

      // Note: orchestrator.runCycle() checks killSwitch at start and will stop
    }

    // 3. Update agent state in MongoDB AFTER emitting events (so dashboard updates)
    await updateAgentState({
      agentId: agentState.agentId || 'main',
      capital: agentState.capital,
      peakCapital: Math.max(agentState.peakCapital || agentState.capital || 0, agentState.capital || 0),
      dailyStartCapital: agentState.dailyStartCapital,
      openPositions: positions.length,
      consecutiveLosses: agentState.consecutiveLosses || 0,
      killSwitchActive: riskStatus.triggered,
      state: riskStatus.triggered ? 'KILL_SWITCH' : 'MONITORING'
    }, { mongoose })

    // 4. Build result
    const result = {
      positions,
      riskStatus,
      agentState: updatedAgentState,
      events,
      timestamp: Date.now()
    }

    console.log('[Monitoring] Cycle completed:', {
      openPositions: positions.length,
      unrealizedPnl: positionsResult.summary.unrealizedPnl.toFixed(2),
      riskTriggered: riskStatus.triggered,
      killReason: riskStatus.reason || 'none'
    })

    return result
  } catch (error) {
    console.error('[Monitoring] runMonitoringCycle error:', error.message)

    emitEvent('agent:error', {
      phase: 'MONITORING',
      error: error.message,
      timestamp: Date.now()
    }, eventBus)

    throw error
  }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  runMonitoringCycle,
  checkPositions,
  runRiskChecks,
  updateAgentState,
  processClosedPosition,
  THRESHOLDS
}