/**
 * ============================================================================
 * TRADING AGENT ORCHESTRATOR
 * ============================================================================
 * Main event loop implementing the 5-phase FSM:
 * IDLE → RESEARCH → ANALYSIS → SCORING → EXECUTION → MONITORING → IDLE
 *
 * This is the MAIN entry point — when someone starts the agent, they call
 * orchestrator.start(symbols)
 *
 * Risk invariants enforced here (the orchestrator is the single owner of the
 * agent's state and of the kill switch):
 *  - The kill switch is evaluated every cycle with real metrics (daily loss and
 *    drawdown on equity = capital + unrealized P&L, consecutive losses).
 *  - When it triggers, the loop stops, open orders are cancelled through the
 *    sandbox-aware exchange gateway and the halted state is persisted, so a
 *    restart does not silently resume trading.
 *  - Real-money mode requires an explicit opt-in (AGENT_ALLOW_LIVE_TRADING).
 */

const EventEmitter = require('events');
const { createLogger } = require('../../utils/logger');
const { getTradingMode, isLiveTradingAllowed } = require('../../config/env');
const { cancelAllOpenOrders } = require('./exchangeGateway');

const logger = createLogger('agent:orchestrator');

// FSM Phases
const PHASES = {
  IDLE: 'IDLE',
  RESEARCH: 'RESEARCH',
  ANALYSIS: 'ANALYSIS',
  SCORING: 'SCORING',
  EXECUTION: 'EXECUTION',
  MONITORING: 'MONITORING'
};

// Default configuration
const DEFAULT_CONFIG = {
  CYCLE_INTERVAL: 60 * 1000, // 60 seconds (1 minute)
  INITIAL_CAPITAL: 10000,
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 4000] // Exponential backoff
};

/** UTC calendar day used as the daily-loss window */
const utcDay = (date = new Date()) => date.toISOString().slice(0, 10);

/**
 * Event Bus for agent events
 * Extends EventEmitter to broadcast state changes
 */
class AgentEventBus extends EventEmitter {
  constructor(socket = null) {
    super();
    this.socket = socket;
  }

  emit(event, data) {
    super.emit(event, data);
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }
}

/**
 * Agent State Manager
 * Tracks current state and transitions
 */
class AgentStateManager {
  constructor(config = {}) {
    this.state = PHASES.IDLE;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cycleCount = 0;
    this.lastCycleTime = null;
    this.killSwitchActive = false;
    this.killReason = null;
    this.openPositions = [];
    this.tradeHistory = [];
    this.capital = this.config.INITIAL_CAPITAL;
    this.equity = this.config.INITIAL_CAPITAL;
    this.peakBalance = this.config.INITIAL_CAPITAL;
    this.dailyStartBalance = this.config.INITIAL_CAPITAL;
    this.dailyStartDate = null;
    this.consecutiveLosses = 0;
    this.killSwitchTriggeredAt = null;
    this.errorCount = 0;
    this.lastError = null;
    this.bufferStore = new Map(); // Symbol → { timeframe → RingBuffer }
    this.symbols = [];
  }

  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    return { from: oldState, to: newState };
  }

  /**
   * Start a new daily-loss window only when the UTC day changes.
   * (Previously the baseline was reset on every start, so restarting the
   * agent erased the day's losses from the kill switch's view.)
   * @returns {boolean} true if a new day started
   */
  rolloverDayIfNeeded(now = new Date()) {
    const today = utcDay(now);
    if (this.dailyStartDate === today) return false;
    this.dailyStartDate = today;
    this.dailyStartBalance = this.equity;
    return true;
  }

  /** Legacy alias */
  resetDay() {
    this.dailyStartDate = utcDay();
    this.dailyStartBalance = this.equity;
  }

  updateBalance(pnl) {
    this.capital += pnl;
    this.updateEquity(0);
  }

  /**
   * Update equity (capital + unrealized P&L) and the high-water mark.
   */
  updateEquity(unrealizedPnl = 0) {
    this.equity = this.capital + unrealizedPnl;
    if (this.equity > this.peakBalance) {
      this.peakBalance = this.equity;
    }
  }

  /**
   * Performance metrics in the shape KillSwitch.check() expects.
   */
  getRiskMetrics() {
    const dailyLoss = this.dailyStartBalance > 0
      ? Math.max(0, (this.dailyStartBalance - this.equity) / this.dailyStartBalance)
      : 0;
    const drawdown = this.peakBalance > 0
      ? Math.max(0, (this.peakBalance - this.equity) / this.peakBalance)
      : 0;
    return { dailyLoss, drawdown, consecutiveLosses: this.consecutiveLosses };
  }

  toJSON() {
    return {
      state: this.state,
      cycleCount: this.cycleCount,
      lastCycleTime: this.lastCycleTime,
      killSwitchActive: this.killSwitchActive,
      killReason: this.killReason,
      openPositions: this.openPositions.length,
      capital: this.capital,
      equity: this.equity,
      peakBalance: this.peakBalance,
      dailyStartBalance: this.dailyStartBalance,
      consecutiveLosses: this.consecutiveLosses,
      errorCount: this.errorCount,
      lastError: this.lastError,
      symbols: this.symbols
    };
  }
}

/**
 * Trading Agent Orchestrator
 * Main entry point for the autonomous trading agent
 */
class TradingAgentOrchestrator {
  /**
   * @param {Object} config - Configuration from config.js
   */
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateManager = new AgentStateManager(this.config);
    this.eventBus = new AgentEventBus();
    this.mongoose = null;
    this.killSwitch = null;
    this.killSwitchListenerAttached = false;
    this.cycleInterval = null;
    this.isRunning = false;
    this.cycleInProgress = false;
    this.stateLoaded = false;
    this.symbols = [];
    // Injectable for tests; defaults to the sandbox-aware gateway
    this.orderCanceller = cancelAllOpenOrders;

    // Phase modules (initialized in initializePhases)
    this.phases = {
      research: null,
      analysis: null,
      scoring: null,
      execution: null,
      monitoring: null
    };

    // Bind methods
    this.runCycle = this.runCycle.bind(this);
  }

  /**
   * Initialize phase modules (idempotent)
   */
  async initializePhases() {
    if (this.phases.research) return true;
    this.phases = {
      research: require('./phases/research'),
      analysis: require('./phases/analysis'),
      scoring: require('./phases/scoring'),
      execution: require('./phases/execution'),
      monitoring: require('./phases/monitoring')
    };
    logger.debug('All phases initialized');
    return true;
  }

  /**
   * Load AgentState from MongoDB or create defaults (idempotent)
   */
  async loadOrCreateState() {
    if (this.stateLoaded) return;
    if (!this.mongoose) {
      logger.warn('No mongoose connection, using in-memory default state');
      return;
    }

    try {
      const AgentState = this.mongoose.model('AgentState');
      const state = await AgentState.findOne({ agentId: 'main' });

      if (!state) {
        await AgentState.create({
          agentId: 'main',
          capital: this.config.INITIAL_CAPITAL,
          peakCapital: this.config.INITIAL_CAPITAL,
          dailyStartCapital: this.config.INITIAL_CAPITAL,
          cycleCount: 0,
          state: PHASES.IDLE,
          symbols: this.symbols
        });
        logger.info('Created new AgentState in MongoDB');
      } else {
        const sm = this.stateManager;
        sm.capital = state.capital ?? sm.capital;
        sm.equity = sm.capital;
        sm.peakBalance = state.peakCapital ?? sm.capital;
        sm.dailyStartBalance = state.dailyStartCapital ?? sm.capital;
        sm.dailyStartDate = state.dailyStartDate || null;
        sm.consecutiveLosses = state.consecutiveLosses || 0;
        sm.cycleCount = state.cycleCount || 0;
        sm.tradeHistory = state.tradeHistory || [];
        sm.killSwitchActive = Boolean(state.killSwitchActive);
        sm.killReason = state.killReason || null;
        sm.killSwitchTriggeredAt = state.killSwitchTriggeredAt || null;

        // A kill switch that fired before a restart stays engaged until an
        // operator resets it explicitly.
        if (sm.killSwitchActive && this.killSwitch) {
          this.killSwitch.trigger(sm.killReason || 'RESTORED_AFTER_RESTART', { restored: true });
        }
        logger.info('Loaded AgentState from MongoDB', {
          capital: sm.capital,
          killSwitchActive: sm.killSwitchActive
        });
      }
      this.stateLoaded = true;
    } catch (error) {
      // Surface the failure: running without persisted risk baselines is unsafe.
      logger.error('Failed to load AgentState from MongoDB', error);
      throw error;
    }
  }

  /**
   * Persist AgentState to MongoDB (the orchestrator is its only writer)
   */
  async saveState() {
    if (!this.mongoose) return;
    const sm = this.stateManager;

    try {
      const AgentState = this.mongoose.model('AgentState');
      await AgentState.findOneAndUpdate(
        { agentId: 'main' },
        {
          $set: {
            capital: sm.capital,
            peakCapital: sm.peakBalance,
            dailyStartCapital: sm.dailyStartBalance,
            dailyStartDate: sm.dailyStartDate,
            consecutiveLosses: sm.consecutiveLosses,
            cycleCount: sm.cycleCount,
            state: sm.killSwitchActive ? 'KILL_SWITCH' : sm.state,
            symbols: this.symbols,
            ...(sm.lastCycleTime ? { lastCycleAt: new Date(sm.lastCycleTime) } : {}),
            killSwitchActive: sm.killSwitchActive,
            killReason: sm.killReason,
            killSwitchTriggeredAt: sm.killSwitchTriggeredAt || null
          }
        },
        { upsert: true }
      );
    } catch (error) {
      logger.error('Failed to save AgentState to MongoDB', error);
    }
  }

  /**
   * Refuse to trade with real money unless explicitly allowed.
   * Closed-position reconciliation (realized P&L → capital) is not yet
   * implemented, so production mode needs a deliberate operator decision.
   */
  assertTradingModeAllowed() {
    if (getTradingMode() === 'production' && !isLiveTradingAllowed()) {
      const error = new Error(
        'Live trading is disabled. BINANCE_MODE=production also requires AGENT_ALLOW_LIVE_TRADING=true.'
      );
      error.code = 'LIVE_TRADING_DISABLED';
      throw error;
    }
  }

  /**
   * Start the agent for given symbols
   * @param {string[]} symbols - Array of trading symbols (e.g., ['BTC/USDT', 'ETH/USDT'])
   */
  async start(symbols = ['BTC/USDT']) {
    if (this.isRunning) {
      logger.info('Start requested but agent is already running');
      return;
    }

    this.assertTradingModeAllowed();

    this.symbols = symbols;
    this.stateManager.symbols = symbols;

    await this.initializePhases();
    this.setupKillSwitchHandler();
    await this.loadOrCreateState();

    if (this.killSwitch?.triggered || this.stateManager.killSwitchActive) {
      const error = new Error(
        `Kill switch is active (${this.stateManager.killReason || this.killSwitch?.triggerReason}). Reset it before starting.`
      );
      error.code = 'KILL_SWITCH_ACTIVE';
      throw error;
    }

    this.stateManager.rolloverDayIfNeeded();
    this.isRunning = true;

    // Cycle loop with overlap guard
    this.cycleInterval = setInterval(async () => {
      if (this.cycleInProgress) {
        logger.warn('Previous cycle still running, skipping this tick');
        return;
      }
      try {
        await this.runCycle();
      } catch (err) {
        logger.error('Cycle error', err);
      }
    }, this.config.CYCLE_INTERVAL);

    this.eventBus.emit('agent:state', {
      state: PHASES.IDLE,
      status: 'started',
      config: {
        cycleInterval: this.config.CYCLE_INTERVAL,
        symbols: this.symbols
      },
      timestamp: Date.now()
    });

    logger.info('Agent started', {
      symbols,
      mode: getTradingMode(),
      cycleIntervalMs: this.config.CYCLE_INTERVAL
    });
  }

  /**
   * Stop the cycle loop (no order handling)
   */
  stopLoop() {
    this.isRunning = false;
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
    }
  }

  /**
   * Graceful shutdown
   * - Stop cycle loop
   * - Cancel all open orders
   * - Save state
   */
  async stop() {
    if (!this.isRunning && !this.cycleInterval) {
      logger.info('Stop requested but agent is not running');
      return;
    }

    this.stopLoop();
    await this.cancelAllOrders();
    await this.saveState();

    this.eventBus.emit('agent:state', {
      state: PHASES.IDLE,
      status: 'stopped',
      timestamp: Date.now()
    });

    logger.info('Agent stopped');
  }

  /**
   * Emergency halt after the kill switch fires: stop the loop, cancel orders,
   * persist the halted state and notify listeners.
   */
  async halt(reason, data = {}) {
    const sm = this.stateManager;
    sm.killSwitchActive = true;
    sm.killReason = reason;
    sm.killSwitchTriggeredAt = new Date();
    this.stopLoop();

    logger.error('Kill switch triggered — halting agent', { reason, data });

    const cancellation = await this.cancelAllOrders();
    await this.saveState();

    this.eventBus.emit('agent:kill-switch', {
      reason,
      data,
      cancellation,
      timestamp: Date.now()
    });
    return cancellation;
  }

  /**
   * Operator reset after manual review. The agent stays stopped; it must be
   * started again explicitly.
   */
  async resetKillSwitch() {
    if (this.killSwitch) this.killSwitch.reset();
    const sm = this.stateManager;
    sm.killSwitchActive = false;
    sm.killReason = null;
    sm.killSwitchTriggeredAt = null;
    // New baselines from current equity so the old loss does not re-trigger
    sm.peakBalance = sm.equity;
    sm.dailyStartBalance = sm.equity;
    sm.consecutiveLosses = 0;
    await this.saveState();
    logger.warn('Kill switch reset by operator');
  }

  /**
   * Evaluate risk with real metrics and halt if a limit is breached.
   * @returns {boolean} true if the kill switch is (now) triggered
   */
  async evaluateRisk() {
    if (!this.killSwitch) return this.stateManager.killSwitchActive;
    const result = this.killSwitch.check(this.stateManager.getRiskMetrics());
    // The 'trigger' listener performs the halt; await it if it is running.
    if (this.pendingHalt) await this.pendingHalt;
    return result.triggered;
  }

  /**
   * Run a single 5-phase cycle
   */
  async runCycle() {
    if (!this.isRunning) {
      logger.debug('Not running, skipping cycle');
      return;
    }

    this.cycleInProgress = true;
    try {
      this.stateManager.rolloverDayIfNeeded();

      if (await this.evaluateRisk()) {
        logger.warn('Kill switch active at cycle start, skipping');
        return;
      }

      this.stateManager.cycleCount++;
      this.stateManager.lastCycleTime = Date.now();
      logger.info('Starting cycle', { cycle: this.stateManager.cycleCount });

      for (const symbol of this.symbols) {
        if (!this.isRunning) {
          logger.info('Stopping mid-cycle');
          break;
        }
        if (await this.evaluateRisk()) {
          logger.warn('Kill switch triggered mid-cycle');
          break;
        }

        try {
          await this.runSymbolCycle(symbol);
        } catch (error) {
          logger.error('Cycle failed for symbol', { symbol, error: error.message });
          await this.handleCycleError(error);
        }
      }

      await this.saveState();

      this.stateManager.setState(PHASES.IDLE);
      this.eventBus.emit('agent:state', {
        state: PHASES.IDLE,
        cycleCount: this.stateManager.cycleCount,
        completedAt: Date.now(),
        timestamp: Date.now()
      });
      logger.info('Cycle completed', { cycle: this.stateManager.cycleCount });
    } finally {
      this.cycleInProgress = false;
    }
  }

  /**
   * Run exactly one cycle on demand (admin "run cycle" endpoint) without
   * leaving the agent marked as running afterwards.
   */
  async runManualCycle(symbols) {
    if (this.cycleInProgress) {
      const error = new Error('A cycle is already in progress');
      error.code = 'CYCLE_IN_PROGRESS';
      throw error;
    }
    this.assertTradingModeAllowed();
    await this.initializePhases();
    this.setupKillSwitchHandler();
    await this.loadOrCreateState();

    if (this.killSwitch?.triggered || this.stateManager.killSwitchActive) {
      const error = new Error('Kill switch is active. Reset it before running a cycle.');
      error.code = 'KILL_SWITCH_ACTIVE';
      throw error;
    }

    const wasRunning = this.isRunning;
    const previousSymbols = this.symbols;
    if (!wasRunning && symbols?.length) this.symbols = symbols;
    this.isRunning = true;
    try {
      await this.runCycle();
    } finally {
      // Never leave a manual cycle looking like a running agent
      if (!wasRunning) {
        this.isRunning = false;
        this.symbols = previousSymbols;
      }
    }
  }

  /**
   * Run cycle for a single symbol
   * @param {string} symbol - Trading symbol
   */
  async runSymbolCycle(symbol) {
    const emitPhase = (state, extra = {}) => {
      this.stateManager.setState(state);
      this.eventBus.emit('agent:state', {
        state,
        symbol,
        cycleCount: this.stateManager.cycleCount,
        timestamp: Date.now(),
        ...extra
      });
    };

    // 1. RESEARCH
    emitPhase(PHASES.RESEARCH);
    const researchData = await this.phases.research.runResearchCycle(symbol);

    // 2. ANALYSIS
    emitPhase(PHASES.ANALYSIS);
    const analysisData = await this.phases.analysis.runAnalysisCycle(symbol, researchData);

    // 3. SCORING
    emitPhase(PHASES.SCORING);
    const scoringData = await this.phases.scoring.runScoringCycle(symbol, researchData, analysisData);

    // 4. EXECUTION (only if decision !== NO_TRADE and risk allows it)
    if (await this.evaluateRisk()) {
      logger.warn('Kill switch triggered before execution, skipping', { symbol });
    } else if (scoringData.decision !== 'NO_TRADE') {
      emitPhase(PHASES.EXECUTION, { decision: scoringData.decision });
      // Options were previously not passed, so positions were never recorded
      // (no mongoose) and no events were emitted (no eventBus).
      await this.phases.execution.runExecutionCycle(symbol, scoringData, this.stateManager, {
        mongoose: this.mongoose,
        eventBus: this.eventBus,
        capital: this.stateManager.capital
      });
    } else {
      logger.debug('No trade decision, skipping execution', { symbol });
    }

    // 5. MONITORING (always runs)
    emitPhase(PHASES.MONITORING);
    const monitoring = await this.phases.monitoring.runMonitoringCycle(
      {
        capital: this.stateManager.capital,
        peakCapital: this.stateManager.peakBalance,
        dailyStartCapital: this.stateManager.dailyStartBalance,
        consecutiveLosses: this.stateManager.consecutiveLosses,
        openPositions: this.stateManager.openPositions,
        killSwitchActive: this.stateManager.killSwitchActive
      },
      {
        mongoose: this.mongoose,
        eventBus: this.eventBus,
        persistState: false
      }
    );

    // Feed real exposure back into the risk model
    this.stateManager.updateEquity(monitoring?.summary?.unrealizedPnl || 0);
    if (monitoring?.positions) {
      this.stateManager.openPositions = monitoring.positions;
    }

    // Risk sources the KillSwitch thresholds do not cover (volatility anomaly,
    // failed risk checks) still halt the agent.
    if (monitoring?.riskStatus?.triggered && this.killSwitch) {
      this.killSwitch.trigger(monitoring.riskStatus.reason, { checks: monitoring.riskStatus.checks });
    }
    await this.evaluateRisk();
  }

  /**
   * Handle cycle error
   * @param {Error} error - Error that occurred
   */
  async handleCycleError(error) {
    this.stateManager.errorCount++;
    this.stateManager.lastError = error.message;

    this.eventBus.emit('agent:error', {
      error: error.message,
      cycleCount: this.stateManager.cycleCount,
      errorCount: this.stateManager.errorCount,
      timestamp: Date.now()
    });

    this.stateManager.setState(PHASES.IDLE);
  }

  /**
   * Attach the kill switch listener once (it used to be re-attached on every
   * start, and only flipped a flag without stopping the loop or the orders).
   */
  setupKillSwitchHandler() {
    if (!this.killSwitch || this.killSwitchListenerAttached) return;
    this.killSwitch.on('trigger', (reason, data) => {
      this.pendingHalt = this.halt(reason, data)
        .catch((error) => logger.error('Kill switch halt failed', error))
        .finally(() => { this.pendingHalt = null; });
    });
    this.killSwitchListenerAttached = true;
  }

  /**
   * Cancel all open orders for the agent's symbols (sandbox-aware gateway).
   */
  async cancelAllOrders() {
    try {
      return await this.orderCanceller(this.symbols, { exchangeId: this.config.EXCHANGE?.DEFAULT || 'binance' });
    } catch (error) {
      logger.error('Order cancellation error', error);
      return { cancelled: [], failed: [{ symbol: '*', error: error.message }] };
    }
  }

  /**
   * Get current state
   * @returns {Object} Current agent state
   */
  getState() {
    return this.stateManager.toJSON();
  }

  /**
   * Set mongoose connection
   * @param {Object} mongoose - Mongoose instance
   */
  setMongoose(mongoose) {
    this.mongoose = mongoose;
  }

  /**
   * Set kill switch
   * @param {Object} killSwitch - Kill switch instance
   */
  setKillSwitch(killSwitch) {
    this.killSwitch = killSwitch;
    this.killSwitchListenerAttached = false;
  }

  /**
   * Override how open orders are cancelled (tests / alternative gateways)
   * @param {Function} fn - (symbols, options) => Promise<{cancelled, failed}>
   */
  setOrderCanceller(fn) {
    this.orderCanceller = fn;
  }
}

module.exports = {
  TradingAgentOrchestrator,
  AgentEventBus,
  AgentStateManager,
  PHASES,
  DEFAULT_CONFIG
};
