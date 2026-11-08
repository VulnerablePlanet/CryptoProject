/**
 * ============================================================================
 * AUTONOMOUS TRADING AGENT API ROUTES
 * ============================================================================
 * REST API endpoints to control the autonomous trading agent
 *
 * Endpoints:
 * GET  /api/agent/status       - Get agent status
 * POST /api/agent/start        - Start the agent
 * POST /api/agent/stop         - Stop the agent
 * POST /api/agent/cycle        - Run single cycle manually
 * GET  /api/agent/signal       - Get latest signal
 * GET  /api/agent/positions    - Get open positions
 * GET  /api/agent/state        - Get agent state
 * POST /api/agent/kill-switch/reset - Clear a triggered kill switch
 * GET  /api/agent/verify-keys  - Validate exchange credentials
 */

const express = require('express')
const router = express.Router()
const { auth, requireAdmin } = require('../middleware/auth')
const { createLogger } = require('../utils/logger')

const logger = createLogger('routes:agent')

// The agent controls REAL money: authentication alone is not enough.
// Every route requires an authenticated AND administrator user.
router.use(auth)
router.use(requireAdmin)

const { getOrchestrator } = require('../trading/agent/runtime')
const { createTradingExchange, getCredentials } = require('../trading/agent/exchangeGateway')
const { getTradingMode, isLiveTradingAllowed } = require('../config/env')
const { AgentState, Position } = require('../trading/agent/models')

// Domain errors the client can act on → 409 Conflict with a clear message
const CONFLICT_CODES = new Set(['KILL_SWITCH_ACTIVE', 'LIVE_TRADING_DISABLED', 'CYCLE_IN_PROGRESS'])
const sendAgentError = (res, error, fallbackMessage) => {
  if (CONFLICT_CODES.has(error.code)) {
    return res.status(409).json({ error: error.message, code: error.code })
  }
  return res.status(500).json({ error: fallbackMessage })
}

// GET /api/agent/status - Get agent status
router.get('/status', (req, res) => {
  const orchestrator = getOrchestrator()
  if (!orchestrator) {
    return res.status(503).json({
      error: 'Agent not initialized',
      hint: 'Ensure MongoDB is connected'
    })
  }

  const state = orchestrator.getState()

  // Check if API keys are configured
  const hasApiKeys = {
    binance: Boolean(getCredentials('binance')),
    mode: getTradingMode(),
    liveTradingAllowed: isLiveTradingAllowed()
  }

  res.json({
    isRunning: orchestrator.isRunning,
    state: state.state,
    capital: state.capital,
    equity: state.equity,
    openPositions: state.openPositions,
    killSwitchActive: state.killSwitchActive,
    killReason: state.killReason,
    cycleCount: state.cycleCount,
    lastCycleTime: state.lastCycleTime,
    apiKeys: hasApiKeys
  })
})

// POST /api/agent/start - Start the agent
router.post('/start', async (req, res) => {
  try {
    const orchestrator = getOrchestrator()
    if (!orchestrator) {
      return res.status(503).json({ error: 'Agent not initialized' })
    }

    const { symbols = ['BTC/USDT'] } = req.body

    if (orchestrator.isRunning) {
      return res.json({ message: 'Agent already running', state: orchestrator.getState() })
    }

    await orchestrator.start(symbols)

    res.json({
      message: 'Agent started',
      symbols,
      state: orchestrator.getState()
    })
  } catch (error) {
    logger.error('Failed to start agent', error)
    sendAgentError(res, error, 'Failed to start agent')
  }
})

// POST /api/agent/stop - Stop the agent
router.post('/stop', async (req, res) => {
  try {
    const orchestrator = getOrchestrator()
    if (!orchestrator) {
      return res.status(503).json({ error: 'Agent not initialized' })
    }

    await orchestrator.stop()

    res.json({
      message: 'Agent stopped',
      state: orchestrator.getState()
    })
  } catch (error) {
    logger.error('Failed to stop agent', error)
    res.status(500).json({ error: 'Failed to stop agent' })
  }
})

// POST /api/agent/cycle - Run single cycle manually
router.post('/cycle', async (req, res) => {
  try {
    const orchestrator = getOrchestrator()
    if (!orchestrator) {
      return res.status(503).json({ error: 'Agent not initialized' })
    }

    const { symbol = 'BTC/USDT' } = req.body

    // Runs exactly one cycle; the agent is not left marked as running
    await orchestrator.runManualCycle([symbol])

    res.json({
      message: 'Cycle completed',
      symbol,
      state: orchestrator.getState()
    })
  } catch (error) {
    logger.error('Failed to run manual cycle', error)
    sendAgentError(res, error, 'Failed to run cycle')
  }
})

// GET /api/agent/signal - Get latest signal from research
router.get('/signal', async (req, res) => {
  try {
    const { symbol = 'BTC/USDT' } = req.query

    const research = require('../trading/agent/phases/research')
    const analysis = require('../trading/agent/phases/analysis')
    const scoring = require('../trading/agent/phases/scoring')

    // Run research phase
    const researchData = await research.runResearchCycle(symbol)

    // Run analysis phase
    const analysisData = await analysis.runAnalysisCycle(symbol, researchData)

    // Run scoring phase
    const scoringData = await scoring.runScoringCycle(symbol, researchData, analysisData)

    res.json({
      symbol,
      timestamp: new Date().toISOString(),
      research: researchData,
      analysis: {
        regime: analysisData.regime,
        mtfTrend: analysisData.mtfTrend,
        indicators: analysisData.indicators
      },
      signal: scoringData
    })
  } catch (error) {
    logger.error('Failed to generate agent signal', error)
    res.status(500).json({ error: 'Failed to generate signal' })
  }
})

// GET /api/agent/positions - Get open positions
router.get('/positions', async (req, res) => {
  try {
    const mongoose = require('mongoose')

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB not connected' })
    }

    const positions = await Position.find({ status: 'OPEN' }).lean()

    res.json({ positions, count: positions.length })
  } catch (error) {
    logger.error('Failed to fetch open positions', error)
    res.status(500).json({ error: 'Failed to fetch positions' })
  }
})

// GET /api/agent/state - Get agent state from MongoDB
router.get('/state', async (req, res) => {
  try {
    const mongoose = require('mongoose')

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB not connected' })
    }

    const state = await AgentState.findOne({ agentId: 'main' }).lean()

    if (!state) {
      return res.json({ message: 'No state found', state: null })
    }

    res.json({ state })
  } catch (error) {
    logger.error('Failed to fetch agent state', error)
    res.status(500).json({ error: 'Failed to fetch agent state' })
  }
})

// POST /api/agent/kill-switch/reset - Clear a triggered kill switch after review
router.post('/kill-switch/reset', async (req, res) => {
  try {
    const orchestrator = getOrchestrator()
    if (!orchestrator) {
      return res.status(503).json({ error: 'Agent not initialized' })
    }
    if (orchestrator.isRunning) {
      return res.status(409).json({ error: 'Stop the agent before resetting the kill switch' })
    }
    await orchestrator.resetKillSwitch()
    logger.warn('Kill switch reset', { userId: req.user?._id?.toString() })
    res.json({ message: 'Kill switch reset', state: orchestrator.getState() })
  } catch (error) {
    logger.error('Failed to reset kill switch', error)
    res.status(500).json({ error: 'Failed to reset kill switch' })
  }
})

// GET /api/agent/verify-keys - Verify Binance API keys are valid
router.get('/verify-keys', async (req, res) => {
  const mode = getTradingMode()
  const credentials = getCredentials('binance')

  if (!credentials) {
    return res.json({
      configured: false,
      message: 'API keys not configured. Set BINANCE_API_KEY and BINANCE_API_SECRET in .env',
      mode
    })
  }

  try {
    // Same sandbox-aware client the agent trades with: testnet keys are
    // verified against the testnet, production keys against production.
    const exchange = createTradingExchange('binance', { requireCredentials: true })

    // Validate the keys by performing an authenticated call.
    // NEVER expose account balances (total/used/free) in the response —
    // doing so would leak the master account funds to the caller.
    await exchange.fetchBalance()

    res.json({
      configured: true,
      valid: true,
      mode,
      apiKeyPreview: credentials.apiKey.substring(0, 4) + '...' + credentials.apiKey.substring(credentials.apiKey.length - 4),
      message: 'API keys are valid'
    })
  } catch (error) {
    // Log the real reason server-side; return a generic message to the client.
    logger.error('Binance key verification failed', error)
    res.status(400).json({
      configured: true,
      valid: false,
      mode,
      message: 'API keys are invalid or lack the required permissions'
    })
  }
})

module.exports = router
