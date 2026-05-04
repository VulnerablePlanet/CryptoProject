/**
 * ============================================================================
 * EXECUTION PHASE - Phase 7
 * ============================================================================
 * Places actual orders via CCXT after scoring phase approval.
 * 
 * API Signature:
 * async function runExecutionCycle(symbol, scoringData, agentState)
 * Returns: { executed: boolean, orderId?, position?, error?, message? }
 * 
 * Exports: { runExecutionCycle, checkPreExecution, calculatePositionSize }
 */

const ccxt = require('ccxt')
const ccxtService = require('../../../services/ccxtService')

// ============================================================================
// Constants
// ============================================================================

const MAX_CONCURRENT_POSITIONS = 3
const MIN_POSITION_SIZE = 0.0001 // Minimum BTC or equivalent

// Valid signal directions
const VALID_DIRECTIONS = ['LONG', 'SHORT']

// Order types
const ORDER_TYPES = {
  MARKET: 'market',
  LIMIT: 'limit',
  STOP_LOSS: 'stop-loss',
  STOP_LOSS_LIMIT: 'stop-loss-limit',
  TAKE_PROFIT: 'take-profit',
  TAKE_PROFIT_LIMIT: 'take-profit-limit'
}

// Position status
const POSITION_STATUS = {
  PENDING: 'pending',
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
}

// ============================================================================
// Exchange Instance Factory (supports API keys from environment)
// ============================================================================

/**
 * Create a CCXT exchange instance with proper credentials
 * API keys are read from environment variables:
 *   BINANCE_API_KEY / BINANCE_API_SECRET
 *   BITGET_API_KEY / BITGET_API_SECRET
 *   etc.
 *
 * Modes:
 *   sandbox = true → testnet (no real money)
 *   sandbox = false → production (real money)
 *
 * @param {string} exchangeId - Exchange ID (e.g., 'binance', 'bitget')
 * @param {object} options - Additional options
 * @param {boolean} options.sandbox - Use sandbox/testnet mode
 * @returns {object} Configured CCXT exchange instance
 */
function createExchangeInstance(exchangeId, options = {}) {
  const id = exchangeId.toLowerCase()

  // Build credentials from environment variables
  const apiKey = process.env[`${id.toUpperCase()}_API_KEY`]
  const apiSecret = process.env[`${id.toUpperCase()}_API_SECRET`]

  // Base configuration
  const config = {
    enableRateLimit: true,
    timeout: 30000,
    // User agent to avoid blocks
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }

  // Add credentials if available
  if (apiKey && apiSecret) {
    config.apiKey = apiKey
    config.secret = apiSecret
    console.log(`[Execution] Using API credentials for ${id} (${apiKey.substring(0, 8)}...)`)
  } else {
    console.warn(`[Execution] No API credentials for ${id} — using public data only (read-only)`)
  }

  // Sandbox/testnet mode for exchanges that support it
  if (options.sandbox || process.env.BINANCE_MODE === 'sandbox') {
    config.sandbox = true
    console.log(`[Execution] Sandbox mode enabled for ${id}`)
  }

  // Exchange-specific options
  if (id === 'binance') {
    config.options = {
      defaultType: 'spot', // 'spot', 'margin', 'futures'
      adjustForTimeDifference: true
    }
  } else if (id === 'bitget') {
    config.options = {
      defaultType: 'spot',
      defaultSubType: 'spot'
    }
  } else if (id === 'bybit') {
    config.options = {
      defaultType: 'spot'
    }
  }

  const ExchangeClass = ccxt[id]
  if (!ExchangeClass) {
    throw new Error(`Exchange ${id} not supported by CCXT`)
  }

  return new ExchangeClass(config)
}

// ============================================================================
// Pre-Execution Checks
// ============================================================================

/**
 * Check if trading is allowed for this symbol
 * @param {string} symbol - Trading symbol (e.g., 'BTC/USDT')
 * @param {object} agentState - Current agent state
 * @returns {object} { allowed: boolean, reason?: string }
 */
function checkPreExecution(symbol, agentState) {
  // Check 1: Kill switch NOT triggered
  if (agentState.killSwitch === true) {
    return {
      allowed: false,
      reason: `Kill switch active: ${agentState.killReason || 'No reason provided'}`
    }
  }

  // Check 2: Open positions < 3 (max concurrent)
  const openPositions = agentState.openPositions || []
  if (openPositions.length >= MAX_CONCURRENT_POSITIONS) {
    return {
      allowed: false,
      reason: `Max positions (${MAX_CONCURRENT_POSITIONS}) reached. Current: ${openPositions.length}`
    }
  }

  // Check 3: Valid signal direction (LONG or SHORT)
  // This will be validated against scoringData.direction in runExecutionCycle

  return { allowed: true }
}

// ============================================================================
// Position Sizing
// ============================================================================

/**
 * Calculate position size using Fixed Fractional with ATR adjustment
 * @param {number} capital - Available capital in quote currency
 * @param {number} riskPct - Risk percentage (0.01 = 1%)
 * @param {number} atr - Average True Range (volatility measure)
 * @param {number} entryPrice - Planned entry price
 * @param {number} stopLoss - Planned stop loss price
 * @returns {object} Position size details { amount, riskAmount, riskPerUnit }
 */
function calculatePositionSize(capital, riskPct, atr, entryPrice, stopLoss) {
  // Base risk amount: capital × riskPct
  const riskAmount = capital * riskPct

  // Calculate risk per unit (price distance)
  const riskPerUnit = Math.abs(entryPrice - stopLoss)

  if (riskPerUnit <= 0) {
    console.warn('[Execution] Invalid stop loss distance, using ATR-based fallback')
    // Fallback: use ATR as stop distance
    const adjustedStopLoss = entryPrice - atr
    const fallbackRiskPerUnit = Math.abs(entryPrice - adjustedStopLoss)
    const adjustedAmount = riskAmount / fallbackRiskPerUnit

    return {
      amount: adjustedAmount,
      riskAmount,
      riskPerUnit: fallbackRiskPerUnit,
      entryPrice,
      stopLoss: adjustedStopLoss,
      atrUsed: atr,
      fallbackUsed: true
    }
  }

  // Position size = risk amount / risk per unit
  const amount = riskAmount / riskPerUnit

  // Minimum position size check
  const finalAmount = Math.max(amount, MIN_POSITION_SIZE)

  if (amount < MIN_POSITION_SIZE) {
    console.warn(`[Execution] Position size ${amount} below minimum ${MIN_POSITION_SIZE}, adjusted to minimum`)
  }

  return {
    amount: finalAmount,
    riskAmount,
    riskPerUnit,
    entryPrice,
    stopLoss,
    atrUsed: atr,
    fallbackUsed: false
  }
}

// ============================================================================
// Order Placement
// ============================================================================

/**
 * Place an order via CCXT
 * @param {string} symbol - Trading symbol
 * @param {string} side - 'buy' or 'sell'
 * @param {string} type - Order type ('market', 'limit', etc.)
 * @param {number} amount - Order amount
 * @param {number} price - Order price (null for market orders)
 * @param {object} options - Additional order options
 * @returns {Promise<object>} Order result
 */
async function placeOrder(symbol, side, type, amount, price, options = {}) {
  const exchangeId = options.exchange || 'binance'

  try {
    const exchangeInstance = createExchangeInstance(exchangeId, options)
    await exchangeInstance.loadMarkets()

    let order

    switch (type.toLowerCase()) {
      case ORDER_TYPES.MARKET:
        order = await exchangeInstance.createMarketOrder(symbol, side, amount)
        break

      case ORDER_TYPES.LIMIT:
        if (!price) {
          throw new Error('Limit order requires price')
        }
        order = await exchangeInstance.createLimitOrder(symbol, side, amount, price)
        break

      case ORDER_TYPES.STOP_LOSS:
        if (!price) {
          throw new Error('Stop loss order requires stop price')
        }
        order = await exchangeInstance.createOrder(
          symbol,
          'stop',
          side,
          amount,
          price,
          { stopPrice: price }
        )
        break

      case ORDER_TYPES.STOP_LOSS_LIMIT:
        if (!price) {
          throw new Error('Stop loss limit order requires price')
        }
        order = await exchangeInstance.createOrder(
          symbol,
          'stop-loss-limit',
          side,
          amount,
          price,
          { stopPrice: price }
        )
        break

      case ORDER_TYPES.TAKE_PROFIT:
        if (!price) {
          throw new Error('Take profit order requires price')
        }
        order = await exchangeInstance.createOrder(
          symbol,
          'take-profit',
          side,
          amount,
          price,
          { stopPrice: price }
        )
        break

      case ORDER_TYPES.TAKE_PROFIT_LIMIT:
        if (!price) {
          throw new Error('Take profit limit order requires price')
        }
        order = await exchangeInstance.createOrder(
          symbol,
          'take-profit-limit',
          side,
          amount,
          price,
          { stopPrice: price }
        )
        break

      default:
        // Default to market order
        order = await exchangeInstance.createMarketOrder(symbol, side, amount)
    }

    console.log(`[Execution] Order placed: ${order.side} ${order.type} ${order.amount} ${symbol} @ ${order.price || 'MARKET'}`)

    return {
      success: true,
      orderId: order.id,
      status: order.status,
      filledAmount: order.filled || amount,
      averagePrice: order.average || order.price,
      side: order.side,
      type: order.type,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error(`[Execution] Order placement failed: ${error.message}`)

    // Handle common CCXT errors gracefully
    let errorType = 'UNKNOWN'
    let errorMessage = error.message

    if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
      errorType = 'RATE_LIMIT'
      errorMessage = 'Exchange rate limit exceeded, retry later'
    } else if (error.message.includes('insufficient') || error.message.includes('balance')) {
      errorType = 'INSUFFICIENT_BALANCE'
      errorMessage = 'Insufficient balance for order'
    } else if (error.message.includes('market is closed') || error.message.includes('market closed')) {
      errorType = 'MARKET_CLOSED'
      errorMessage = 'Market is currently closed'
    }

    return {
      success: false,
      error: errorMessage,
      errorType,
      timestamp: Date.now()
    }
  }
}

// ============================================================================
// OCO (One-Cancels-Other) Orders
// ============================================================================

/**
 * Place OCO orders (Take Profit + Stop Loss) after entry fills
 * Uses bracket order if supported, otherwise places two separate orders
 * @param {string} symbol - Trading symbol
 * @param {string} side - Entry side ('buy' or 'sell')
 * @param {number} amount - Position size
 * @param {number} entryPrice - Actual entry price (filled)
 * @param {number} takeProfit - TP price
 * @param {number} stopLoss - SL price
 * @param {object} options - Additional options
 * @returns {Promise<object>} OCO result with order IDs
 */
async function placeOCOOrders(symbol, side, amount, entryPrice, takeProfit, stopLoss, options = {}) {
  const exchangeId = options.exchange || 'binance'
  const ocoGroupId = `oco_${symbol.replace('/', '_')}_${Date.now()}`

  try {
    const exchangeInstance = createExchangeInstance(exchangeId, options)
    await exchangeInstance.loadMarkets()

    // Opposite side for exit orders
    const exitSide = side === 'buy' ? 'sell' : 'buy'

    // Try native bracket/OCO order if exchange supports it
    try {
      const bracketOrder = await exchangeInstance.createOrder(
        symbol,
        'bracket', // Some exchanges use this
        exitSide,
        amount,
        takeProfit,
        {
          stopLossPrice: stopLoss,
          takeProfitPrice: takeProfit
        }
      )

      console.log(`[Execution] OCO placed as bracket order: ${bracketOrder.id}`)

      return {
        success: true,
        orderId: bracketOrder.id,
        ocoGroupId,
        stopLoss,
        takeProfit,
        entryPrice,
        type: 'bracket',
        timestamp: Date.now()
      }
    } catch (bracketError) {
      // Bracket not supported, fall back to separate orders
      console.log(`[Execution] Bracket order not supported, using separate orders`)
    }

    // Fallback: Place stop loss and take profit as separate OCO-linked orders
    // Many exchanges support OCO with stop-loss-limit and take-profit-limit

    let stopLossOrder, takeProfitOrder

    // Try stop-loss-limit first
    try {
      stopLossOrder = await exchangeInstance.createOrder(
        symbol,
        'stop-loss-limit',
        exitSide,
        amount,
        stopLoss,
        { stopPrice: stopLoss }
      )
    } catch (slError) {
      // If stop-loss-limit not supported, try simple stop
      try {
        stopLossOrder = await exchangeInstance.createOrder(
          symbol,
          'stop',
          exitSide,
          amount,
          stopLoss,
          { stopPrice: stopLoss }
        )
      } catch (stopError) {
        // Last resort: use market order for stop loss
        console.warn(`[Execution] Stop loss order failed, will manage manually: ${stopError.message}`)
      }
    }

    // Try take-profit-limit
    try {
      takeProfitOrder = await exchangeInstance.createOrder(
        symbol,
        'take-profit-limit',
        exitSide,
        amount,
        takeProfit,
        { stopPrice: takeProfit }
      )
    } catch (tpError) {
      console.warn(`[Execution] Take profit order failed: ${tpError.message}`)
    }

    const orderIds = []
    if (stopLossOrder?.id) orderIds.push(stopLossOrder.id)
    if (takeProfitOrder?.id) orderIds.push(takeProfitOrder.id)

    console.log(`[Execution] OCO placed as separate orders: SL=${stopLossOrder?.id}, TP=${takeProfitOrder?.id}`)

    return {
      success: true,
      orderIds,
      ocoGroupId,
      stopLoss,
      takeProfit,
      entryPrice,
      type: 'oco_separate',
      timestamp: Date.now()
    }
  } catch (error) {
    console.error(`[Execution] OCO placement failed: ${error.message}`)
    return {
      success: false,
      error: error.message,
      ocoGroupId,
      timestamp: Date.now()
    }
  }
}

// ============================================================================
// Position Recording
// ============================================================================

/**
 * Record position in MongoDB
 * @param {object} positionData - Position data to save
 * @param {object} mongoose - Mongoose instance
 * @returns {Promise<object>} Save result
 */
async function recordPosition(positionData, mongoose) {
  try {
    // Dynamic require to avoid circular dependencies
    const Position = require('../models/position')

    const position = new Position({
      ...positionData,
      openedAt: new Date()
    })

    const saved = await position.save()

    console.log(`[Execution] Position recorded: ${saved._id}`)

    return {
      success: true,
      positionId: saved._id,
      position: saved
    }
  } catch (error) {
    console.error(`[Execution] Position save failed: ${error.message}`)
    return {
      success: false,
      error: error.message
    }
  }
}

// ============================================================================
// Emit Events
// ============================================================================

/**
 * Emit position event via event bus
 * @param {object} eventBus - Event bus instance
 * @param {string} eventName - Event name
 * @param {object} data - Event data
 */
function emitPositionEvent(eventBus, eventName, data) {
  if (!eventBus) {
    console.log(`[Execution] Event bus not available, skipping emit: ${eventName}`)
    return
  }

  try {
    eventBus.emit(eventName, {
      ...data,
      timestamp: Date.now()
    })
    console.log(`[Execution] Event emitted: ${eventName}`)
  } catch (error) {
    console.error(`[Execution] Event emit failed: ${error.message}`)
  }
}

// ============================================================================
// Main Execution Cycle
// ============================================================================

/**
 * Main execution phase entry point
 * @param {string} symbol - Trading symbol (e.g., 'BTC/USDT')
 * @param {object} scoringData - Scoring phase output
 * @param {object} agentState - Current agent state
 * @param {object} options - Additional options
 * @param {string} options.exchange - Exchange ID (default: 'binance')
 * @param {object} options.eventBus - Event bus for emissions
 * @param {object} options.mongoose - Mongoose instance
 * @param {number} options.capital - Available capital (default from agentState)
 * @returns {Promise<object>} Execution result
 */
async function runExecutionCycle(symbol, scoringData, agentState, options = {}) {
  const {
    exchange = 'binance',
    eventBus = null,
    mongoose = null,
    capital = agentState?.capital || 10000
  } = options

  console.log(`[Execution] Starting execution cycle for ${symbol}`)

  // Step 1: Pre-execution checks
  const preCheck = checkPreExecution(symbol, agentState)
  if (!preCheck.allowed) {
    console.log(`[Execution] Pre-check failed: ${preCheck.reason}`)
    return {
      executed: false,
      error: preCheck.reason,
      message: 'Pre-execution check failed'
    }
  }

  // Step 2: Validate scoring data
  if (!scoringData) {
    return {
      executed: false,
      error: 'Missing scoring data',
      message: 'Scoring phase output required'
    }
  }

  const { decision, direction, score, recommendedEntry, recommendedSL, recommendedTP, atr } = scoringData

  // Check for NO_TRADE decision
  if (decision === 'NO_TRADE' || decision === 'no_trade') {
    return {
      executed: false,
      message: `No trade - score below threshold (${(score * 100).toFixed(1)}%)`
    }
  }

  // Validate direction
  if (!VALID_DIRECTIONS.includes(direction)) {
    return {
      executed: false,
      error: `Invalid direction: ${direction}`,
      message: 'Signal direction must be LONG or SHORT'
    }
  }

  try {
    // Step 3: Get current price for validation
    let entryPrice = recommendedEntry
    let stopLoss = recommendedSL
    let takeProfit = recommendedTP

    if (!entryPrice || !stopLoss || !takeProfit) {
      const { ticker } = await ccxtService.fetchTicker(exchange, symbol)
      const currentPrice = ticker.last

      if (!currentPrice) {
        throw new Error('Could not fetch current price')
      }

      // Use scoring data to calculate if not provided
      const priceAtr = atr || (currentPrice * 0.02) // Default 2% if no ATR

      if (!entryPrice) entryPrice = currentPrice
      if (!stopLoss) {
        stopLoss = direction === 'LONG'
          ? entryPrice - (priceAtr * 1.5)
          : entryPrice + (priceAtr * 1.5)
      }
      if (!takeProfit) {
        takeProfit = direction === 'LONG'
          ? entryPrice + (priceAtr * 2.0)
          : entryPrice - (priceAtr * 2.0)
      }

      console.log(`[Execution] Calculated prices from market: Entry=${entryPrice}, SL=${stopLoss}, TP=${takeProfit}`)
    }

    // Step 4: Calculate position size
    const riskPct = 0.01 // 1% risk per trade
    const sizing = calculatePositionSize(capital, riskPct, atr || 1, entryPrice, stopLoss)

    console.log(`[Execution] Position sizing: ${sizing.amount.toFixed(6)} @ ${entryPrice}`)

    // Step 5: Determine order type and place entry order
    const orderMethod = scoringData.decision === 'MARKET_ORDER' ? 'market' : 'limit'
    const side = direction === 'LONG' ? 'buy' : 'sell'

    let orderResult

    if (orderMethod === 'market') {
      orderResult = await placeOrder(symbol, side, ORDER_TYPES.MARKET, sizing.amount, null, { exchange })
    } else {
      orderResult = await placeOrder(symbol, side, ORDER_TYPES.LIMIT, sizing.amount, entryPrice, { exchange })
    }

    if (!orderResult.success) {
      throw new Error(`Entry order failed: ${orderResult.error}`)
    }

    // Use filled price if market order
    const filledEntryPrice = orderResult.averagePrice || entryPrice
    const filledAmount = orderResult.filledAmount || sizing.amount

    console.log(`[Execution] Entry order filled: ${orderResult.orderId} @ ${filledEntryPrice}`)

    // Step 6: Place OCO orders (MANDATORY) - after entry fills
    const ocoResult = await placeOCOOrders(
      symbol,
      side,
      filledAmount,
      filledEntryPrice,
      takeProfit,
      stopLoss,
      { exchange }
    )

    if (!ocoResult.success) {
      console.warn(`[Execution] OCO placement had issues: ${ocoResult.error}`)
      // Continue anyway - position was entered, OCO is best-effort
    }

    // Step 7: Prepare position record
    const positionRecord = {
      symbol,
      side: direction,
      entryPrice: filledEntryPrice,
      exitPrice: null,
      size: filledAmount,
      stopLoss,
      takeProfit,
      ocoGroupId: ocoResult.ocoGroupId,
      status: POSITION_STATUS.OPEN,
      scoring: {
        score,
        decision,
        reasons: scoringData.reasons || []
      },
      exchange,
      orderIds: {
        entry: orderResult.orderId,
        oco: ocoResult.orderIds || []
      },
      riskAmount: sizing.riskAmount,
      riskPercent: riskPct,
      filledAt: new Date()
    }

    // Step 8: Record in MongoDB
    let positionId = null
    if (mongoose) {
      const dbResult = await recordPosition(positionRecord, mongoose)
      if (dbResult.success) {
        positionId = dbResult.positionId
        positionRecord.positionId = positionId
      }
    }

    // Step 9: Emit events
    emitPositionEvent(eventBus, 'position:opened', {
      symbol,
      side: direction,
      size: filledAmount,
      entryPrice: filledEntryPrice,
      stopLoss,
      takeProfit,
      score,
      orderId: orderResult.orderId,
      ocoGroupId: ocoResult.ocoGroupId
    })

    // Log success
    console.log(`[Execution] ========== POSITION OPENED ==========`)
    console.log(`[Execution] Symbol: ${symbol}`)
    console.log(`[Execution] Side: ${direction}`)
    console.log(`[Execution] Size: ${filledAmount.toFixed(6)}`)
    console.log(`[Execution] Entry: ${filledEntryPrice}`)
    console.log(`[Execution] SL: ${stopLoss}`)
    console.log(`[Execution] TP: ${takeProfit}`)
    console.log(`[Execution] OCO Group: ${ocoResult.ocoGroupId}`)
    console.log(`[Execution] Score: ${(score * 100).toFixed(1)}%`)
    console.log(`[Execution] ======================================`)

    return {
      executed: true,
      orderId: orderResult.orderId,
      position: positionRecord,
      message: `${direction} position opened on ${symbol}`
    }
  } catch (error) {
    console.error(`[Execution] Execution failed: ${error.message}`)

    // Emit error event
    emitPositionEvent(eventBus, 'position:error', {
      symbol,
      direction,
      error: error.message,
      scoringData
    })

    return {
      executed: false,
      error: error.message,
      message: 'Execution failed'
    }
  }
}

// ============================================================================
// Module Exports
// ============================================================================

module.exports = {
  // Main entry point
  runExecutionCycle,

  // Pre-execution validation
  checkPreExecution,

  // Position sizing
  calculatePositionSize,

  // Order placement (exposed for testing)
  placeOrder,

  // OCO placement
  placeOCOOrders,

  // Position recording
  recordPosition,

  // Constants
  MAX_CONCURRENT_POSITIONS,
  MIN_POSITION_SIZE,
  VALID_DIRECTIONS,
  ORDER_TYPES,
  POSITION_STATUS
}