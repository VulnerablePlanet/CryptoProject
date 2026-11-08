import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { mongoose, requireFromServer, startMongo, stopMongo, clearDatabase } from './helpers/mongo.js'

const { TradingAgentOrchestrator } = requireFromServer('./trading/agent/orchestrator.js')
const { KillSwitch } = requireFromServer('./trading/agent/killSwitch.js')
const models = requireFromServer('./trading/agent/models/index.js')

const noTradePhases = () => ({
  research: { runResearchCycle: vi.fn(async () => ({})) },
  analysis: { runAnalysisCycle: vi.fn(async () => ({})) },
  scoring: { runScoringCycle: vi.fn(async () => ({ decision: 'NO_TRADE' })) },
  execution: { runExecutionCycle: vi.fn() },
  monitoring: { runMonitoringCycle: vi.fn(async () => ({ positions: [], summary: { unrealizedPnl: 0 }, riskStatus: { triggered: false } })) }
})

const newOrchestrator = () => {
  const o = new TradingAgentOrchestrator({ CYCLE_INTERVAL: 60_000, INITIAL_CAPITAL: 10_000 })
  o.phases = noTradePhases()
  o.setMongoose(mongoose)
  o.setKillSwitch(new KillSwitch())
  o.setOrderCanceller(vi.fn(async () => ({ cancelled: [], failed: [] })))
  return o
}

describe('agent state persistence (real MongoDB)', () => {
  let replSet

  beforeAll(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    replSet = await startMongo()
  })

  afterAll(async () => {
    await stopMongo(replSet)
    vi.restoreAllMocks()
  })

  beforeEach(clearDatabase)

  it('registers every model the agent looks up by name', () => {
    for (const name of ['AgentState', 'Position', 'Signal', 'TradeLog']) {
      expect(() => mongoose.model(name)).not.toThrow()
    }
  })

  it('saves AgentState (pre-save hook works on Mongoose 9)', async () => {
    const doc = await models.AgentState.create({ capital: 123 })
    expect(doc.agentId).toBe('main')
  })

  it('restores capital, risk baselines and cycle count after a restart', async () => {
    const first = newOrchestrator()
    await first.start(['BTC/USDT'])
    await first.runCycle()
    first.stateManager.capital = 9_800
    first.stateManager.updateEquity(0)
    await first.stop()

    const second = newOrchestrator()
    await second.loadOrCreateState()
    const state = second.getState()
    expect(state.capital).toBe(9_800)
    expect(state.peakBalance).toBe(10_000)
    expect(state.dailyStartBalance).toBe(10_000)
    expect(state.cycleCount).toBe(1)
  })

  it('keeps a triggered kill switch engaged across restarts', async () => {
    const first = newOrchestrator()
    await first.start(['BTC/USDT'])
    first.stateManager.updateEquity(-2_000)
    await first.evaluateRisk()

    const stored = await models.AgentState.findOne({ agentId: 'main' }).lean()
    expect(stored.killSwitchActive).toBe(true)
    expect(stored.killReason).toBe('DAILY_LOSS')

    const second = newOrchestrator()
    await expect(second.start(['BTC/USDT'])).rejects.toMatchObject({ code: 'KILL_SWITCH_ACTIVE' })
    expect(second.isRunning).toBe(false)
  })

  it('records closed trades in TradeLog', async () => {
    const monitoring = requireFromServer('./trading/agent/phases/monitoring.js')
    const position = await models.Position.create({
      symbol: 'BTC/USDT', side: 'LONG', entryPrice: 100, size: 1, status: 'OPEN'
    })
    const result = await monitoring.processClosedPosition(
      { ...position.toObject(), exitPrice: 90, realizedPnl: -10, exitReason: 'SL' },
      { mongoose }
    )
    expect(result.processed).toBe(true)
    const log = await models.TradeLog.findOne({ positionId: position._id }).lean()
    expect(log).toMatchObject({ status: 'LOSS', realizedPnl: -10, exitReason: 'SL' })
    const closed = await models.Position.findById(position._id).lean()
    expect(closed.status).toBe('CLOSED')
  })
})
