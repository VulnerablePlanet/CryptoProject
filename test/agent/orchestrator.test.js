import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const { TradingAgentOrchestrator, AgentStateManager } = requireFromServer('./trading/agent/orchestrator.js')
const { KillSwitch } = requireFromServer('./trading/agent/killSwitch.js')

/** Phase stubs: no network, configurable monitoring result */
const makePhases = (monitoringResult = {}) => ({
  research: { runResearchCycle: vi.fn(async () => ({})) },
  analysis: { runAnalysisCycle: vi.fn(async () => ({})) },
  scoring: { runScoringCycle: vi.fn(async () => ({ decision: 'NO_TRADE' })) },
  execution: { runExecutionCycle: vi.fn(async () => ({ executed: false })) },
  monitoring: {
    runMonitoringCycle: vi.fn(async () => ({
      positions: [],
      summary: { unrealizedPnl: 0 },
      riskStatus: { triggered: false },
      ...monitoringResult
    }))
  }
})

const makeOrchestrator = ({ phases = makePhases() } = {}) => {
  const orchestrator = new TradingAgentOrchestrator({ CYCLE_INTERVAL: 60_000, INITIAL_CAPITAL: 10_000 })
  orchestrator.phases = phases
  orchestrator.setKillSwitch(new KillSwitch())
  const canceller = vi.fn(async () => ({ cancelled: ['o-1'], failed: [] }))
  orchestrator.setOrderCanceller(canceller)
  return { orchestrator, canceller, phases }
}

describe('TradingAgentOrchestrator', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.BINANCE_MODE
    delete process.env.AGENT_ALLOW_LIVE_TRADING
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  describe('kill switch', () => {
    it('triggers from real drawdown metrics, stops the loop and cancels open orders', async () => {
      const { orchestrator, canceller } = makeOrchestrator()
      await orchestrator.start(['BTC/USDT'])
      expect(orchestrator.cycleInterval).not.toBeNull()

      // Peak reached on an earlier day; today's equity is flat but 16.7% below
      // that peak (drawdown limit: 10%, daily-loss limit not breached)
      orchestrator.stateManager.peakBalance = 12_000
      orchestrator.stateManager.updateEquity(0)
      const triggered = await orchestrator.evaluateRisk()

      expect(triggered).toBe(true)
      expect(orchestrator.isRunning).toBe(false)
      expect(orchestrator.cycleInterval).toBeNull()
      expect(canceller).toHaveBeenCalledWith(['BTC/USDT'], expect.any(Object))
      expect(orchestrator.getState().killSwitchActive).toBe(true)
      expect(orchestrator.getState().killReason).toBe('DRAWDOWN')
    })

    it('triggers on daily loss measured from the start of the UTC day', async () => {
      const { orchestrator } = makeOrchestrator()
      await orchestrator.start(['BTC/USDT'])
      orchestrator.stateManager.updateEquity(-400) // 4% daily loss (limit: 3%)
      expect(await orchestrator.evaluateRisk()).toBe(true)
      expect(orchestrator.getState().killReason).toBe('DAILY_LOSS')
    })

    it('halts when the monitoring phase reports a risk the thresholds do not cover', async () => {
      const phases = makePhases({ riskStatus: { triggered: true, reason: 'VOLATILITY_ANOMALY_3.5x', checks: {} } })
      const { orchestrator, canceller } = makeOrchestrator({ phases })
      await orchestrator.start(['BTC/USDT'])
      await orchestrator.runCycle()
      expect(orchestrator.isRunning).toBe(false)
      expect(orchestrator.getState().killReason).toBe('VOLATILITY_ANOMALY_3.5x')
      expect(canceller).toHaveBeenCalled()
    })

    it('feeds unrealized P&L from monitoring into equity', async () => {
      const phases = makePhases({ summary: { unrealizedPnl: -1500 } })
      const { orchestrator } = makeOrchestrator({ phases })
      await orchestrator.start(['BTC/USDT'])
      await orchestrator.runCycle()
      expect(orchestrator.getState().equity).toBe(8500)
      expect(orchestrator.getState().killSwitchActive).toBe(true)
    })

    it('refuses to start while the kill switch is active, until reset', async () => {
      const { orchestrator } = makeOrchestrator()
      await orchestrator.start(['BTC/USDT'])
      orchestrator.stateManager.updateEquity(-2000)
      await orchestrator.evaluateRisk()

      await expect(orchestrator.start(['BTC/USDT'])).rejects.toMatchObject({ code: 'KILL_SWITCH_ACTIVE' })

      await orchestrator.resetKillSwitch()
      await orchestrator.start(['BTC/USDT'])
      expect(orchestrator.isRunning).toBe(true)
      orchestrator.stopLoop()
    })

    it('attaches the trigger listener only once across restarts', async () => {
      const { orchestrator } = makeOrchestrator()
      await orchestrator.start(['BTC/USDT'])
      await orchestrator.stop()
      await orchestrator.start(['BTC/USDT'])
      expect(orchestrator.killSwitch.listenerCount('trigger')).toBe(1)
      orchestrator.stopLoop()
    })
  })

  describe('execution and monitoring wiring', () => {
    it('passes mongoose and the event bus to execution, and asks monitoring not to persist', async () => {
      const phases = makePhases()
      phases.scoring.runScoringCycle = vi.fn(async () => ({ decision: 'MARKET_ORDER', direction: 'LONG' }))
      const { orchestrator } = makeOrchestrator({ phases })
      const fakeMongoose = { model: vi.fn(() => ({ findOneAndUpdate: vi.fn(async () => ({})), findOne: vi.fn(async () => null), create: vi.fn(async () => ({})) })) }
      orchestrator.setMongoose(fakeMongoose)

      await orchestrator.start(['BTC/USDT'])
      await orchestrator.runCycle()
      orchestrator.stopLoop()

      const execOptions = phases.execution.runExecutionCycle.mock.calls[0][3]
      expect(execOptions.mongoose).toBe(fakeMongoose)
      expect(execOptions.eventBus).toBe(orchestrator.eventBus)
      const monitorOptions = phases.monitoring.runMonitoringCycle.mock.calls[0][1]
      expect(monitorOptions.persistState).toBe(false)
    })
  })

  describe('trading mode', () => {
    it('refuses production mode without the explicit live-trading opt-in', async () => {
      process.env.BINANCE_MODE = 'production'
      const { orchestrator } = makeOrchestrator()
      await expect(orchestrator.start(['BTC/USDT'])).rejects.toMatchObject({ code: 'LIVE_TRADING_DISABLED' })
      expect(orchestrator.isRunning).toBe(false)
    })

    it('allows production mode with AGENT_ALLOW_LIVE_TRADING=true', async () => {
      process.env.BINANCE_MODE = 'production'
      process.env.AGENT_ALLOW_LIVE_TRADING = 'true'
      const { orchestrator } = makeOrchestrator()
      await orchestrator.start(['BTC/USDT'])
      expect(orchestrator.isRunning).toBe(true)
      orchestrator.stopLoop()
    })
  })

  describe('manual cycle', () => {
    it('runs one cycle without leaving the agent marked as running', async () => {
      const { orchestrator, phases } = makeOrchestrator()
      await orchestrator.runManualCycle(['ETH/USDT'])
      expect(phases.research.runResearchCycle).toHaveBeenCalledWith('ETH/USDT')
      expect(orchestrator.isRunning).toBe(false)
      expect(orchestrator.cycleInterval).toBeNull()
    })
  })
})

describe('AgentStateManager daily window', () => {
  it('keeps the daily baseline across restarts within the same UTC day', () => {
    const sm = new AgentStateManager({ INITIAL_CAPITAL: 10_000 })
    expect(sm.rolloverDayIfNeeded(new Date('2026-01-01T08:00:00Z'))).toBe(true)
    sm.updateEquity(-500)
    // Same day: baseline must not move to the reduced equity
    expect(sm.rolloverDayIfNeeded(new Date('2026-01-01T20:00:00Z'))).toBe(false)
    expect(sm.dailyStartBalance).toBe(10_000)
    // Next day: new baseline
    expect(sm.rolloverDayIfNeeded(new Date('2026-01-02T00:00:01Z'))).toBe(true)
    expect(sm.dailyStartBalance).toBe(9_500)
  })
})
