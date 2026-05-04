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
 */

const express = require('express')
const router = express.Router()
const { auth } = require('../middleware/auth')

// All agent routes require authentication (controls real money)
router.use(auth)

// Lazy-load the orchestrator to avoid circular deps
let tradingAgentOrchestrator = null
let agentConfig = null

function getOrchestrator() {
  if (!tradingAgentOrchestrator) {
    try {
      const { TradingAgentOrchestrator } = require('../trading/agent/orchestrator')
      agentConfig = agentConfig || require('../trading/agent/config')

      // Attach mongoose if available
      const mongoose = require('mongoose')
      if (mongoose.connection.readyState === 1) {
        tradingAgentOrchestrator = new TradingAgentOrchestrator(agentConfig)
        tradingAgentOrchestrator.setMongoose(mongoose)
        console.log('[Agent API] Orchestrator initialized with MongoDB')
      } else {
        console.warn('[Agent API] MongoDB not connected yet')
      }
    } catch (error) {
      console.error('[Agent API] Failed to initialize orchestrator:', error.message)
    }
  }
  return tradingAgentOrchestrator
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
    binance: !!(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET),
    mode: process.env.BINANCE_MODE || 'sandbox'
  }

  res.json({
    isRunning: orchestrator.isRunning,
    state: state.state,
    capital: state.capital,
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
    console.error('[Agent API] Start error:', error)
    res.status(500).json({ error: error.message })
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
    console.error('[Agent API] Stop error:', error)
    res.status(500).json({ error: error.message })
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

    // Run one cycle for the symbol
    const state = orchestrator.getState()
    if (!orchestrator.isRunning) {
      orchestrator.isRunning = true // Allow manual cycle
    }

    await orchestrator.runCycle()

    res.json({
      message: 'Cycle completed',
      symbol,
      state: orchestrator.getState()
    })
  } catch (error) {
    console.error('[Agent API] Cycle error:', error)
    res.status(500).json({ error: error.message })
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
    console.error('[Agent API] Signal error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/agent/positions - Get open positions
router.get('/positions', async (req, res) => {
  try {
    const mongoose = require('mongoose')

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB not connected' })
    }

    const Position = mongoose.model('Position')
    const positions = await Position.find({ status: 'OPEN' }).lean()

    res.json({ positions, count: positions.length })
  } catch (error) {
    console.error('[Agent API] Positions error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/agent/state - Get agent state from MongoDB
router.get('/state', async (req, res) => {
  try {
    const mongoose = require('mongoose')

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB not connected' })
    }

    const AgentState = mongoose.model('AgentState')
    const state = await AgentState.findOne({ agentId: 'main' }).lean()

    if (!state) {
      return res.json({ message: 'No state found', state: null })
    }

    res.json({ state })
  } catch (error) {
    console.error('[Agent API] State error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/agent/verify-keys - Verify Binance API keys are valid
router.get('/verify-keys', async (req, res) => {
  try {
    const ccxt = require('ccxt')

    const apiKey = process.env.BINANCE_API_KEY
    const apiSecret = process.env.BINANCE_API_SECRET

    if (!apiKey || !apiSecret) {
      return res.json({
        configured: false,
        message: 'API keys not configured. Set BINANCE_API_KEY and BINANCE_API_SECRET in .env',
        mode: process.env.BINANCE_MODE || 'sandbox'
      })
    }

    // Create exchange with API keys
    const exchange = new ccxt.binance({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true
    })

    // Test by fetching account info
    const account = await exchange.fetchBalance()

    res.json({
      configured: true,
      mode: process.env.BINANCE_MODE || 'sandbox',
      account: {
        total: account.total,
        used: account.used,
        free: account.free,
        // Don't expose full keys
        apiKeyPreview: apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4)
      },
      message: 'API keys are valid!'
    })
  } catch (error) {
    res.status(400).json({
      configured: true,
      valid: false,
      error: error.message,
      hint: 'Check if your API key has trading permissions and is not expired'
    })
  }
})

module.exports = router