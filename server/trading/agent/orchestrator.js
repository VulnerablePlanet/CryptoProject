/**
 * ============================================================================
 * TRADING AGENT ORCHESTRATOR
 * ============================================================================
 * Main event loop implementing the 5-phase FSM:
 * IDLE → RESEARCH → ANALYSIS → SCORING → EXECUTION → MONITORING → IDLE
 *
 * This is the MAIN entry point — when someone starts the agent, they call
 * orchestrator.start(symbols)
 */

const EventEmitter = require('events');

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

/**
 * EventBus wrapper for Socket.io
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
    this.peakBalance = this.config.INITIAL_CAPITAL;
    this.dailyStartBalance = this.config.INITIAL_CAPITAL;
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

  resetDay() {
    this.dailyStartBalance = this.capital;
  }

  updateBalance(pnl) {
    this.capital += pnl;
    if (this.capital > this.peakBalance) {
      this.peakBalance = this.capital;
    }
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
      peakBalance: this.peakBalance,
      dailyStartBalance: this.dailyStartBalance,
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
    this.ccxtService = null;
    this.killSwitch = null;
    this.cycleInterval = null;
    this.isRunning = false;
    this.symbols = [];

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
   * Initialize phase modules
   */
  async initializePhases() {
    try {
      this.phases = {
        research: require('./phases/research'),
        analysis: require('./phases/analysis'),
        scoring: require('./phases/scoring'),
        execution: require('./phases/execution'),
        monitoring: require('./phases/monitoring')
      };
      console.log('[Orchestrator] All phases initialized');
      return true;
    } catch (error) {
      console.error('[Orchestrator] Phase initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Load AgentState from MongoDB or create defaults
   */
  async loadOrCreateState() {
    if (!this.mongoose) {
      console.log('[Orchestrator] No mongoose connection, using default state');
      return;
    }

    try {
      const AgentState = this.mongoose.model('AgentState');
      let state = await AgentState.findOne({});

      if (!state) {
        // Create default state
        state = new AgentState({
          capital: this.config.INITIAL_CAPITAL,
          peakBalance: this.config.INITIAL_CAPITAL,
          dailyStartBalance: this.config.INITIAL_CAPITAL,
          cycleCount: 0,
          state: PHASES.IDLE,
          symbols: this.symbols,
          openPositions: [],
          tradeHistory: []
        });
        await state.save();
        console.log('[Orchestrator] Created new AgentState in MongoDB');
      } else {
        // Restore state
        this.stateManager.capital = state.capital;
        this.stateManager.peakBalance = state.peakBalance;
        this.stateManager.dailyStartBalance = state.dailyStartBalance;
        this.stateManager.cycleCount = state.cycleCount;
        this.stateManager.state = state.state;
        this.stateManager.openPositions = state.openPositions || [];
        this.stateManager.tradeHistory = state.tradeHistory || [];
        console.log('[Orchestrator] Loaded AgentState from MongoDB');
      }
    } catch (error) {
      console.error('[Orchestrator] Failed to load state from MongoDB:', error.message);
      // Continue with default state
    }
  }

  /**
   * Persist AgentState to MongoDB
   */
  async saveState() {
    if (!this.mongoose) return;

    try {
      const AgentState = this.mongoose.model('AgentState');
      await AgentState.findOneAndUpdate(
        {},
        {
          capital: this.stateManager.capital,
          peakBalance: this.stateManager.peakBalance,
          dailyStartBalance: this.stateManager.dailyStartBalance,
          cycleCount: this.stateManager.cycleCount,
          state: this.stateManager.state,
          symbols: this.symbols,
          openPositions: this.stateManager.openPositions,
          tradeHistory: this.stateManager.tradeHistory,
          lastCycleTime: this.stateManager.lastCycleTime,
          updatedAt: Date.now()
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('[Orchestrator] Failed to save state to MongoDB:', error.message);
    }
  }

  /**
   * Start the agent for given symbols
   * @param {string[]} symbols - Array of trading symbols (e.g., ['BTC/USDT', 'ETH/USDT'])
   */
  async start(symbols = ['BTC/USDT']) {
    if (this.isRunning) {
      console.log('[Orchestrator] Already running');
      return;
    }

    console.log('[Orchestrator] Starting agent...');
    console.log('[Orchestrator] Symbols:', symbols.join(', '));

    this.symbols = symbols;
    this.stateManager.symbols = symbols;

    try {
      // Initialize phases
      await this.initializePhases();

      // Initialize CCXT via ResourcePool if available
      if (this.ccxtService) {
        console.log('[Orchestrator] CCXT service initialized');
      }

      // Load or create state from MongoDB
      await this.loadOrCreateState();

      // Set up kill switch handler
      this.setupKillSwitchHandler();

      // Reset daily balance at start
      this.stateManager.resetDay();

      // Set running flag
      this.isRunning = true;

      // Start cycle interval
      this.cycleInterval = setInterval(() => {
        this.runCycle().catch(err => {
          console.error('[Orchestrator] Cycle error:', err.message);
        });
      }, this.config.CYCLE_INTERVAL);

      // Emit started event
      this.eventBus.emit('agent:state', {
        state: PHASES.IDLE,
        status: 'started',
        config: {
          cycleInterval: this.config.CYCLE_INTERVAL,
          symbols: this.symbols
        },
        timestamp: Date.now()
      });

      console.log('[Orchestrator] Agent started, cycle interval:', this.config.CYCLE_INTERVAL / 1000 / 60, 'minutes');
    } catch (error) {
      console.error('[Orchestrator] Failed to start:', error.message);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Graceful shutdown
   * - Cancel all orders
   * - Save state
   * - Stop cycle loop
   */
  async stop() {
    if (!this.isRunning) {
      console.log('[Orchestrator] Not running');
      return;
    }

    console.log('[Orchestrator] Stopping agent...');

    this.isRunning = false;

    // Clear cycle interval
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = null;
    }

    // Cancel all open orders
    await this.cancelAllOrders();

    // Save state
    await this.saveState();

    // Emit stopped event
    this.eventBus.emit('agent:state', {
      state: PHASES.IDLE,
      status: 'stopped',
      timestamp: Date.now()
    });

    console.log('[Orchestrator] Agent stopped');
  }

  /**
   * Run a single 5-phase cycle (for testing)
   */
  async runCycle() {
    if (!this.isRunning) {
      console.log('[Orchestrator] Not running, skipping cycle');
      return;
    }

    // Check kill switch at start of cycle
    if (this.killSwitch && this.killSwitch.check()) {
      console.log('[Orchestrator] Kill switch active at cycle start, skipping');
      return;
    }

    console.log('[Orchestrator] Starting cycle', this.stateManager.cycleCount + 1);

    this.stateManager.cycleCount++;
    this.stateManager.lastCycleTime = Date.now();

    // Process each symbol
    for (const symbol of this.symbols) {
      if (!this.isRunning || (this.killSwitch && this.killSwitch.check())) {
        console.log('[Orchestrator] Stopping mid-cycle');
        break;
      }

      console.log('[Orchestrator] Processing symbol:', symbol);

      try {
        await this.runSymbolCycle(symbol);
      } catch (error) {
        console.error(`[Orchestrator] Cycle failed for ${symbol}:`, error.message);
        await this.handleCycleError(error);
      }
    }

    // Persist state after cycle
    await this.saveState();

    // Return to IDLE
    this.stateManager.setState(PHASES.IDLE);
    this.eventBus.emit('agent:state', {
      state: PHASES.IDLE,
      cycleCount: this.stateManager.cycleCount,
      completedAt: Date.now(),
      timestamp: Date.now()
    });

    console.log('[Orchestrator] Cycle completed');
  }

  /**
   * Run cycle for a single symbol
   * @param {string} symbol - Trading symbol
   */
  async runSymbolCycle(symbol) {
    // 1. RESEARCH phase
    this.stateManager.setState(PHASES.RESEARCH);
    this.eventBus.emit('agent:state', {
      state: PHASES.RESEARCH,
      symbol,
      cycleCount: this.stateManager.cycleCount,
      timestamp: Date.now()
    });

    let researchData;
    try {
      researchData = await this.phases.research.runResearchCycle(symbol);
    } catch (error) {
      console.error('[Orchestrator] Research phase failed:', error.message);
      throw error;
    }

    // 2. ANALYSIS phase
    this.stateManager.setState(PHASES.ANALYSIS);
    this.eventBus.emit('agent:state', {
      state: PHASES.ANALYSIS,
      symbol,
      cycleCount: this.stateManager.cycleCount,
      timestamp: Date.now()
    });

    let analysisData;
    try {
      analysisData = await this.phases.analysis.runAnalysisCycle(symbol, researchData);
    } catch (error) {
      console.error('[Orchestrator] Analysis phase failed:', error.message);
      throw error;
    }

    // 3. SCORING phase
    this.stateManager.setState(PHASES.SCORING);
    this.eventBus.emit('agent:state', {
      state: PHASES.SCORING,
      symbol,
      cycleCount: this.stateManager.cycleCount,
      timestamp: Date.now()
    });

    let scoringData;
    try {
      scoringData = await this.phases.scoring.runScoringCycle(symbol, researchData, analysisData);
    } catch (error) {
      console.error('[Orchestrator] Scoring phase failed:', error.message);
      throw error;
    }

    // 4. EXECUTION phase (only if decision !== NO_TRADE)
    // Check kill switch before execution
    if (this.killSwitch && this.killSwitch.check()) {
      console.log('[Orchestrator] Kill switch triggered before execution, skipping');
    } else if (scoringData.decision !== 'NO_TRADE') {
      this.stateManager.setState(PHASES.EXECUTION);
      this.eventBus.emit('agent:state', {
        state: PHASES.EXECUTION,
        symbol,
        cycleCount: this.stateManager.cycleCount,
        decision: scoringData.decision,
        timestamp: Date.now()
      });

      try {
        await this.phases.execution.runExecutionCycle(symbol, scoringData, this.stateManager);
      } catch (error) {
        console.error('[Orchestrator] Execution phase failed:', error.message);
        throw error;
      }
    } else {
      console.log('[Orchestrator] No trade decision, skipping execution');
    }

    // 5. MONITORING phase (always runs)
    this.stateManager.setState(PHASES.MONITORING);
    this.eventBus.emit('agent:state', {
      state: PHASES.MONITORING,
      symbol,
      cycleCount: this.stateManager.cycleCount,
      timestamp: Date.now()
    });

    try {
      await this.phases.monitoring.runMonitoringCycle(this.stateManager);
    } catch (error) {
      console.error('[Orchestrator] Monitoring phase failed:', error.message);
      throw error;
    }
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

    // Return to IDLE on error
    this.stateManager.setState(PHASES.IDLE);
  }

  /**
   * Setup kill switch handler
   */
  setupKillSwitchHandler() {
    if (this.killSwitch) {
      this.killSwitch.on('trigger', (reason, data) => {
        console.log('[Orchestrator] Kill switch triggered:', reason);
        this.stateManager.killSwitchActive = true;
        this.stateManager.killReason = reason;

        // Immediately stop the cycle
        this.isRunning = false;

        // Emit event
        this.eventBus.emit('agent:kill-switch', {
          reason,
          data,
          timestamp: Date.now()
        });
      });
    }
  }

  /**
   * Cancel all open orders
*/
  async cancelAllOrders() {
    console.log('[Orchestrator] Cancelling all open orders...');

    if (!this.ccxtService) {
      console.log('[Orchestrator] No CCXT service available, skipping order cancellation');
      return;
    }

    try {
      // Cancel all open orders for each symbol
      const ccxt = require('ccxt')
      for (const symbol of this.symbols) {
        try {
          const exchangeId = 'binance'

          // Build exchange config with API keys from env
          const apiKey = process.env.BINANCE_API_KEY
          const apiSecret = process.env.BINANCE_API_SECRET
          const config = {
            enableRateLimit: true,
            timeout: 30000
          }
          if (apiKey && apiSecret) {
            config.apiKey = apiKey
            config.secret = apiSecret
          }

          const ExchangeClass = ccxt[exchangeId]
          const exchange = new ExchangeClass(config)
          await exchange.loadMarkets()
          const openOrders = await exchange.fetchOpenOrders(symbol);

          for (const order of openOrders) {
            await exchange.cancelOrder(order.id, symbol);
            console.log('[Orchestrator] Cancelled order:', order.id);
          }
        } catch (error) {
          console.error(`[Orchestrator] Failed to cancel orders for ${symbol}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[Orchestrator] Order cancellation error:', error.message);
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
   * Set CCXT service
   * @param {Object} ccxtService - CCXT service instance
   */
  setCcxtService(ccxtService) {
    this.ccxtService = ccxtService;
  }

  /**
   * Set kill switch
   * @param {Object} killSwitch - Kill switch instance
   */
  setKillSwitch(killSwitch) {
    this.killSwitch = killSwitch;
  }
}

module.exports = {
  TradingAgentOrchestrator,
  AgentEventBus,
  AgentStateManager,
  PHASES,
  DEFAULT_CONFIG
};