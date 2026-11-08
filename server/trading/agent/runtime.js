/**
 * Trading agent runtime: owns the single orchestrator instance for this
 * process and its lifecycle.
 *
 * Previously the singleton lived inside routes/agent.js, which meant the HTTP
 * layer owned trading state and the server had no way to stop the agent on
 * shutdown.
 */

const mongoose = require('mongoose')
const { createLogger } = require('../../utils/logger')
const { TradingAgentOrchestrator } = require('./orchestrator')
const { KillSwitch } = require('./killSwitch')
const agentConfig = require('./config')
require('./models') // register AgentState, Position, Signal, TradeLog

const logger = createLogger('agent:runtime')

let orchestrator = null

/**
 * Map config.RISK.KILL_SWITCH (DAILY_LOSS_LIMIT, DRAWDOWN_LIMIT, …) to the
 * threshold names KillSwitch understands. Passing the config object straight
 * through silently ignored the configured limits.
 */
const killSwitchThresholdsFromConfig = (config = agentConfig) => {
  const ks = config.RISK?.KILL_SWITCH || {}
  const thresholds = {}
  if (ks.DAILY_LOSS_LIMIT != null) thresholds.DAILY_LOSS_PCT = ks.DAILY_LOSS_LIMIT
  if (ks.DRAWDOWN_LIMIT != null) thresholds.MAX_DRAWDOWN_PCT = ks.DRAWDOWN_LIMIT
  if (ks.MAX_CONSECUTIVE_LOSSES != null) thresholds.MAX_CONSECUTIVE_LOSSES = ks.MAX_CONSECUTIVE_LOSSES
  return thresholds
}

/**
 * Get (or lazily create) the orchestrator. Returns null until MongoDB is
 * connected: the agent must not run without persisted risk state.
 */
const getOrchestrator = () => {
  if (orchestrator) return orchestrator
  if (mongoose.connection.readyState !== 1) {
    logger.warn('Agent requested before MongoDB is connected')
    return null
  }
  orchestrator = new TradingAgentOrchestrator(agentConfig)
  orchestrator.setMongoose(mongoose)
  orchestrator.setKillSwitch(new KillSwitch(killSwitchThresholdsFromConfig()))
  logger.info('Orchestrator initialized with MongoDB and kill switch')
  return orchestrator
}

/**
 * Stop the agent (cancel orders, persist state). Safe to call when the agent
 * was never created.
 */
const shutdownAgent = async () => {
  if (!orchestrator) return
  try {
    await orchestrator.stop()
  } catch (error) {
    logger.error('Agent shutdown failed', error)
  }
}

/** Test helper */
const _resetForTests = () => {
  orchestrator = null
}

module.exports = {
  getOrchestrator,
  shutdownAgent,
  killSwitchThresholdsFromConfig,
  _resetForTests
}
