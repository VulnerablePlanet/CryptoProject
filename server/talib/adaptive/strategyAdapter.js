/**
 * Adaptive Strategies Module
 * Dynamic strategy adjustments based on performance and market conditions
 * 
 * Features:
 * - Performance-based size adjustments
 * - Drawdown-based risk reduction
 * - Volatility-based adaptation
 * - Setup enabling/disabling based on metrics
 * - Strategy rotation recommendations
 * 
 * @module adaptive/strategyAdapter
 */

const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('StrategyAdapter');

// Strategy performance tracking
const strategyPerformance = new Map();

/**
 * Initialize strategy tracking
 * @param {string} strategyId - Strategy identifier
 * @param {Object} initialConfig - Initial strategy configuration
 */
function initializeStrategy(strategyId, initialConfig = {}) {
  strategyPerformance.set(strategyId, {
    id: strategyId,
    config: initialConfig,
    trades: [],
    metrics: {
      winrate: 0,
      profitFactor: 0,
      avgReturn: 0,
      maxDrawdown: 0,
      tradesCount: 0
    },
    adjustments: [],
    enabled: true,
    sizeMultiplier: 1.0,
    lastUpdate: new Date()
  });

  logger.info('Strategy initialized', { strategyId });
}

/**
 * Record a trade for a strategy
 * @param {string} strategyId - Strategy identifier
 * @param {Object} trade - Completed trade
 */
function recordTrade(strategyId, trade) {
  if (!strategyPerformance.has(strategyId)) {
    initializeStrategy(strategyId);
  }

  const strategy = strategyPerformance.get(strategyId);
  strategy.trades.push({
    ...trade,
    recordedAt: new Date()
  });

  // Keep only recent trades for evaluation
  const maxTrades = config.adaptive.evaluation.windowSize * 10;
  if (strategy.trades.length > maxTrades) {
    strategy.trades = strategy.trades.slice(-maxTrades);
  }

  // Update metrics
  updateStrategyMetrics(strategyId);

  logger.debug('Trade recorded', {
    strategyId,
    pnl: trade.pnl,
    tradesCount: strategy.metrics.tradesCount
  });
}

/**
 * Update strategy performance metrics
 * @param {string} strategyId - Strategy identifier
 */
function updateStrategyMetrics(strategyId) {
  const strategy = strategyPerformance.get(strategyId);
  if (!strategy) return;

  const windowSize = config.adaptive.evaluation.windowSize;
  const recentTrades = strategy.trades.slice(-windowSize);

  if (recentTrades.length === 0) {
    return;
  }

  // Calculate metrics
  const winningTrades = recentTrades.filter(t => t.pnl > 0);
  const losingTrades = recentTrades.filter(t => t.pnl <= 0);

  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));

  // Calculate drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let equity = 0;
  for (const trade of recentTrades) {
    equity += trade.pnl;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  strategy.metrics = {
    winrate: recentTrades.length > 0 ? winningTrades.length / recentTrades.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 10 : 0,
    avgReturn: recentTrades.reduce((sum, t) => sum + (t.pnlPercent || 0), 0) / recentTrades.length,
    maxDrawdown,
    tradesCount: recentTrades.length,
    totalTrades: strategy.trades.length
  };

  strategy.lastUpdate = new Date();
}

/**
 * Calculate adaptive position size multiplier
 * @param {string} strategyId - Strategy identifier
 * @param {Object} marketConditions - Current market conditions
 * @returns {import('../types').AdaptiveAdjustment} Size adjustment
 */
function calculateSizeMultiplier(strategyId, marketConditions = {}) {
  const strategy = strategyPerformance.get(strategyId);
  if (!strategy) {
    return { originalSize: 1, adjustedSize: 1, multiplier: 1, reason: 'unknown_strategy' };
  }

  const { volatility = 0, drawdown = 0 } = marketConditions;
  let multiplier = 1.0;
  const reasons = [];

  // 1. Drawdown-based adjustments
  const drawdownLevels = config.adaptive.adjustments.drawdown.levels;
  const currentDrawdown = Math.max(drawdown, strategy.metrics.maxDrawdown);
  
  for (const level of drawdownLevels) {
    if (currentDrawdown >= level.threshold) {
      multiplier = Math.min(multiplier, level.sizeMultiplier);
      reasons.push(`drawdown_${(level.threshold * 100).toFixed(0)}pct`);
    }
  }

  // 2. Volatility-based adjustments
  const volConfig = config.adaptive.adjustments.volatility;
  const highVolThreshold = config.regime.volatility.highVolThreshold;
  
  if (volatility >= highVolThreshold) {
    multiplier *= volConfig.highVolMultiplier;
    reasons.push('high_volatility');
  } else if (volatility < highVolThreshold * 0.5) {
    multiplier *= volConfig.lowVolMultiplier;
    reasons.push('low_volatility');
  }

  // 3. Winrate-based adjustments
  if (strategy.metrics.tradesCount >= 10) {
    const minWinrate = config.adaptive.adjustments.winrate.minThreshold;
    if (strategy.metrics.winrate < minWinrate) {
      multiplier *= 0.5;
      reasons.push('low_winrate');
    } else if (strategy.metrics.winrate > 0.6) {
      multiplier *= 1.1;
      reasons.push('high_winrate');
    }
  }

  // 4. Profit factor adjustments
  if (strategy.metrics.profitFactor < 1.0 && strategy.metrics.tradesCount >= 10) {
    multiplier *= 0.7;
    reasons.push('negative_expectancy');
  } else if (strategy.metrics.profitFactor > 2.0) {
    multiplier *= 1.15;
    reasons.push('strong_expectancy');
  }

  // Cap multiplier
  multiplier = Math.max(0, Math.min(1.5, multiplier));

  // Update strategy
  strategy.sizeMultiplier = multiplier;

  const adjustment = {
    originalSize: 1,
    adjustedSize: multiplier,
    multiplier,
    reason: reasons.join('_') || 'normal',
    timestamp: new Date()
  };

  strategy.adjustments.push(adjustment);

  // Keep only recent adjustments
  if (strategy.adjustments.length > 100) {
    strategy.adjustments = strategy.adjustments.slice(-100);
  }

  logger.debug('Size multiplier calculated', {
    strategyId,
    multiplier: multiplier.toFixed(2),
    reasons
  });

  return adjustment;
}

/**
 * Check if a strategy should be enabled
 * @param {string} strategyId - Strategy identifier
 * @returns {Object} Enable/disable recommendation
 */
function checkStrategyEnabled(strategyId) {
  const strategy = strategyPerformance.get(strategyId);
  if (!strategy) {
    return { enabled: true, reason: 'unknown_strategy' };
  }

  const reasons = [];
  let shouldDisable = false;

  // Check minimum trades for evaluation
  if (strategy.metrics.tradesCount < 10) {
    return { enabled: true, reason: 'insufficient_data' };
  }

  // Check winrate
  const minWinrate = config.adaptive.adjustments.winrate.minThreshold;
  if (strategy.metrics.winrate < minWinrate) {
    if (config.adaptive.adjustments.winrate.disableSetup) {
      shouldDisable = true;
      reasons.push(`winrate_${(strategy.metrics.winrate * 100).toFixed(0)}pct`);
    }
  }

  // Check profit factor
  if (strategy.metrics.profitFactor < 0.5) {
    shouldDisable = true;
    reasons.push('very_low_profit_factor');
  }

  // Check drawdown
  if (strategy.metrics.maxDrawdown > config.risk.killSwitch.maxDrawdown) {
    shouldDisable = true;
    reasons.push('max_drawdown_exceeded');
  }

  strategy.enabled = !shouldDisable;

  return {
    enabled: !shouldDisable,
    reason: reasons.join('_') || 'metrics_ok',
    metrics: strategy.metrics
  };
}

/**
 * Get strategy recommendations
 * @param {Object} marketConditions - Current market conditions
 * @returns {Object} Strategy recommendations
 */
function getStrategyRecommendations(marketConditions = {}) {
  const { regime = 'unknown', volatility = 0 } = marketConditions;
  const recommendations = [];

  // Get all strategies
  for (const [strategyId, strategy] of strategyPerformance.entries()) {
    const enabled = checkStrategyEnabled(strategyId);
    const sizeMultiplier = calculateSizeMultiplier(strategyId, marketConditions);

    recommendations.push({
      strategyId,
      enabled: enabled.enabled,
      enableReason: enabled.reason,
      sizeMultiplier: sizeMultiplier.multiplier,
      sizeReason: sizeMultiplier.reason,
      metrics: strategy.metrics,
      score: calculateStrategyScore(strategy, marketConditions)
    });
  }

  // Sort by score
  recommendations.sort((a, b) => b.score - a.score);

  // Regime-specific recommendations
  const regimeRecommendations = getRegimeSpecificRecommendations(regime);

  return {
    strategies: recommendations,
    activeStrategies: recommendations.filter(r => r.enabled),
    topStrategy: recommendations[0] || null,
    regime,
    regimeRecommendations,
    timestamp: new Date()
  };
}

/**
 * Calculate strategy score for ranking
 * @param {Object} strategy - Strategy data
 * @param {Object} marketConditions - Market conditions
 * @returns {number} Strategy score
 */
function calculateStrategyScore(strategy, marketConditions) {
  const { metrics } = strategy;
  
  let score = 0;
  
  // Winrate contribution (0-30 points)
  score += metrics.winrate * 30;
  
  // Profit factor contribution (0-40 points)
  score += Math.min(metrics.profitFactor, 4) * 10;
  
  // Low drawdown contribution (0-20 points)
  score += (1 - Math.min(metrics.maxDrawdown, 0.5) * 2) * 20;
  
  // Trade count reliability (0-10 points)
  score += Math.min(metrics.tradesCount / 20, 1) * 10;

  return score;
}

/**
 * Get regime-specific strategy recommendations
 * @param {string} regime - Market regime
 * @returns {Object} Regime recommendations
 */
function getRegimeSpecificRecommendations(regime) {
  const recommendations = {
    strong_trend: {
      preferred: ['trend_following', 'breakout', 'momentum'],
      avoid: ['mean_reversion', 'range_trading'],
      notes: 'Follow the trend with wider stops. Use momentum indicators.'
    },
    weak_trend: {
      preferred: ['trend_following', 'pullback'],
      avoid: ['breakout'],
      notes: 'Trade pullbacks in trend direction. Be cautious with breakouts.'
    },
    range: {
      preferred: ['mean_reversion', 'range_trading', 'oscillator_based'],
      avoid: ['breakout', 'trend_following'],
      notes: 'Trade from support/resistance. Use RSI/Stochastic oversold/overbought.'
    },
    high_volatility: {
      preferred: ['volatility_breakout', 'options_strategies'],
      avoid: ['tight_stops', 'scalping'],
      notes: 'Use wider stops. Reduce position size. Consider hedging.'
    }
  };

  return recommendations[regime] || {
    preferred: [],
    avoid: [],
    notes: 'Unknown regime. Use caution.'
  };
}

/**
 * Get performance summary for all strategies
 * @returns {Object} Performance summary
 */
function getPerformanceSummary() {
  const summary = {
    totalStrategies: strategyPerformance.size,
    enabledStrategies: 0,
    totalTrades: 0,
    avgWinrate: 0,
    avgProfitFactor: 0,
    strategies: []
  };

  for (const [id, strategy] of strategyPerformance.entries()) {
    if (strategy.enabled) summary.enabledStrategies++;
    summary.totalTrades += strategy.metrics.totalTrades || 0;
    summary.avgWinrate += strategy.metrics.winrate;
    summary.avgProfitFactor += strategy.metrics.profitFactor;

    summary.strategies.push({
      id,
      enabled: strategy.enabled,
      sizeMultiplier: strategy.sizeMultiplier,
      metrics: strategy.metrics
    });
  }

  if (strategyPerformance.size > 0) {
    summary.avgWinrate /= strategyPerformance.size;
    summary.avgProfitFactor /= strategyPerformance.size;
  }

  return summary;
}

/**
 * Reset strategy tracking
 * @param {string} strategyId - Strategy to reset (optional, resets all if not provided)
 */
function resetStrategy(strategyId = null) {
  if (strategyId) {
    strategyPerformance.delete(strategyId);
    logger.info('Strategy reset', { strategyId });
  } else {
    strategyPerformance.clear();
    logger.info('All strategies reset');
  }
}

/**
 * Export strategy data for persistence
 * @returns {Object} Exportable strategy data
 */
function exportStrategies() {
  const data = {};
  for (const [id, strategy] of strategyPerformance.entries()) {
    data[id] = {
      config: strategy.config,
      trades: strategy.trades.slice(-100), // Last 100 trades
      metrics: strategy.metrics,
      enabled: strategy.enabled,
      sizeMultiplier: strategy.sizeMultiplier
    };
  }
  return data;
}

/**
 * Import strategy data from persistence
 * @param {Object} data - Strategy data to import
 */
function importStrategies(data) {
  for (const [id, strategyData] of Object.entries(data)) {
    strategyPerformance.set(id, {
      id,
      ...strategyData,
      adjustments: [],
      lastUpdate: new Date()
    });
  }
  logger.info('Strategies imported', { count: Object.keys(data).length });
}

module.exports = {
  initializeStrategy,
  recordTrade,
  updateStrategyMetrics,
  calculateSizeMultiplier,
  checkStrategyEnabled,
  getStrategyRecommendations,
  calculateStrategyScore,
  getRegimeSpecificRecommendations,
  getPerformanceSummary,
  resetStrategy,
  exportStrategies,
  importStrategies
};
