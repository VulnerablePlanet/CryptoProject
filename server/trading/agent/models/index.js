/**
 * Single registration point for the trading agent's Mongoose models.
 *
 * Phases look models up by name (`mongoose.model('AgentState')`), which only
 * works once the schema has been registered. Nothing required these files
 * before, so AgentState/TradeLog lookups always threw MissingSchemaError and
 * the agent never persisted its state. Require this module (it is idempotent)
 * before using the agent.
 */

const AgentState = require('./agentState')
const Position = require('./position')
const Signal = require('./signal')
const TradeLog = require('./tradeLog')

module.exports = { AgentState, Position, Signal, TradeLog }
