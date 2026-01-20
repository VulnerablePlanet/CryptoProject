/**
 * Walk-Forward Testing Module
 * Robust backtesting with out-of-sample validation
 * 
 * Features:
 * - Walk-forward optimization windows
 * - Monte Carlo simulation for robustness
 * - Performance metrics calculation
 * - Statistical validation
 * 
 * @module backtest/walkForward
 */

const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('WalkForward');

/**
 * Generate walk-forward windows
 * @param {Date} startDate - Start of historical data
 * @param {Date} endDate - End of historical data
 * @param {Object} params - Window parameters
 * @returns {import('../types').WalkForwardWindow[]} Array of windows
 */
function generateWindows(startDate, endDate, params = {}) {
  const {
    optimizationDays = config.walkForward.optimizationWindow,
    testDays = config.walkForward.testWindow,
    stepDays = config.walkForward.stepSize
  } = params;

  const windows = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  
  let currentStart = new Date(startDate);
  
  while (true) {
    const optEnd = new Date(currentStart.getTime() + optimizationDays * msPerDay);
    const testStart = optEnd;
    const testEnd = new Date(testStart.getTime() + testDays * msPerDay);
    
    if (testEnd > endDate) break;
    
    windows.push({
      optStart: new Date(currentStart),
      optEnd: new Date(optEnd),
      testStart: new Date(testStart),
      testEnd: new Date(testEnd),
      windowNumber: windows.length + 1
    });
    
    currentStart = new Date(currentStart.getTime() + stepDays * msPerDay);
  }

  logger.info('Generated walk-forward windows', { count: windows.length });
  return windows;
}

/**
 * Calculate performance metrics from trades
 * @param {Object[]} trades - Array of completed trades
 * @returns {import('../types').BacktestResult} Performance metrics
 */
function calculatePerformanceMetrics(trades) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winrate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalReturn: 0,
      expectancy: 0
    };
  }

  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  
  const avgWin = winningTrades.length > 0 
    ? grossProfit / winningTrades.length 
    : 0;
  const avgLoss = losingTrades.length > 0 
    ? grossLoss / losingTrades.length 
    : 0;

  // Calculate drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let equity = 0;
  
  for (const trade of trades) {
    equity += trade.pnl;
    if (equity > peak) peak = equity;
    const drawdown = (peak - equity) / (peak || 1);
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Calculate Sharpe Ratio (simplified, assuming daily returns)
  const returns = trades.map(t => t.pnlPercent || t.pnl / (t.entryPrice * t.size));
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // Expectancy
  const winrate = winningTrades.length / trades.length;
  const expectancy = (winrate * avgWin) - ((1 - winrate) * avgLoss);

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winrate,
    avgWin,
    avgLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    sharpeRatio,
    maxDrawdown,
    totalReturn: totalPnL,
    expectancy,
    trades
  };
}

/**
 * Run Monte Carlo simulation on trade sequence
 * @param {Object[]} trades - Original trade sequence
 * @param {Object} params - Simulation parameters
 * @returns {Object} Monte Carlo results
 */
function runMonteCarloSimulation(trades, params = {}) {
  const {
    iterations = config.walkForward.monteCarlo.iterations,
    confidenceLevel = config.walkForward.monteCarlo.confidenceLevel
  } = params;

  if (trades.length < 10) {
    logger.warn('Insufficient trades for Monte Carlo simulation');
    return null;
  }

  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    // Shuffle trades randomly
    const shuffled = [...trades].sort(() => Math.random() - 0.5);
    
    // Calculate metrics for shuffled sequence
    let equity = 0;
    let peak = 0;
    let maxDD = 0;
    
    for (const trade of shuffled) {
      equity += trade.pnl;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }
    
    results.push({
      finalEquity: equity,
      maxDrawdown: maxDD
    });
  }

  // Sort results for percentile calculations
  results.sort((a, b) => a.finalEquity - b.finalEquity);
  
  const percentileIndex = Math.floor((1 - confidenceLevel) * iterations);
  const worstCaseEquity = results[percentileIndex].finalEquity;
  
  // Drawdown distribution
  const drawdowns = results.map(r => r.maxDrawdown).sort((a, b) => a - b);
  const worstCaseDD = drawdowns[Math.floor(confidenceLevel * iterations)];
  const avgDD = drawdowns.reduce((a, b) => a + b, 0) / iterations;

  return {
    iterations,
    confidenceLevel,
    worstCaseEquity,
    worstCaseDrawdown: worstCaseDD,
    avgDrawdown: avgDD,
    medianEquity: results[Math.floor(iterations / 2)].finalEquity,
    probabilityOfProfit: results.filter(r => r.finalEquity > 0).length / iterations
  };
}

/**
 * Optimize strategy parameters on a dataset
 * @param {Object[]} candles - OHLCV candles for optimization period
 * @param {Function} strategyFn - Strategy function to optimize
 * @param {Object} parameterRanges - Parameter ranges to test
 * @param {Object} options - Optimization options
 * @returns {Object} Best parameters and results
 */
function optimizeParameters(candles, strategyFn, parameterRanges, options = {}) {
  const {
    metric = 'sharpeRatio', // Optimization target
    minTrades = config.walkForward.minTrades
  } = options;

  const results = [];
  
  // Generate parameter combinations
  const paramNames = Object.keys(parameterRanges);
  const combinations = generateCombinations(parameterRanges);
  
  logger.info('Testing parameter combinations', { count: combinations.length });

  for (const params of combinations) {
    try {
      // Run strategy with these parameters
      const trades = strategyFn(candles, params);
      
      if (trades.length < minTrades) continue;
      
      const metrics = calculatePerformanceMetrics(trades);
      
      results.push({
        params,
        metrics,
        score: metrics[metric] || 0
      });
    } catch (error) {
      logger.debug('Parameter combination failed', { params, error: error.message });
    }
  }

  if (results.length === 0) {
    logger.warn('No valid parameter combinations found');
    return null;
  }

  // Sort by optimization metric
  results.sort((a, b) => b.score - a.score);
  
  const best = results[0];
  
  logger.info('Optimization complete', {
    testedCombinations: combinations.length,
    validResults: results.length,
    bestScore: best.score,
    bestParams: best.params
  });

  return {
    bestParams: best.params,
    bestMetrics: best.metrics,
    allResults: results.slice(0, 10), // Top 10
    optimizationMetric: metric
  };
}

/**
 * Generate all combinations of parameter ranges
 * @param {Object} ranges - Parameter ranges
 * @returns {Object[]} All combinations
 */
function generateCombinations(ranges) {
  const keys = Object.keys(ranges);
  const combinations = [];
  
  function generate(index, current) {
    if (index === keys.length) {
      combinations.push({ ...current });
      return;
    }
    
    const key = keys[index];
    const range = ranges[key];
    
    if (Array.isArray(range)) {
      for (const value of range) {
        current[key] = value;
        generate(index + 1, current);
      }
    } else if (typeof range === 'object' && range.min !== undefined) {
      const step = range.step || 1;
      for (let v = range.min; v <= range.max; v += step) {
        current[key] = v;
        generate(index + 1, current);
      }
    } else {
      current[key] = range;
      generate(index + 1, current);
    }
  }
  
  generate(0, {});
  return combinations;
}

/**
 * Run complete walk-forward analysis
 * @param {Object[]} candles - Full historical candles
 * @param {Function} strategyFn - Strategy function
 * @param {Object} parameterRanges - Parameters to optimize
 * @param {Object} options - Analysis options
 * @returns {Object} Walk-forward results
 */
function runWalkForwardAnalysis(candles, strategyFn, parameterRanges, options = {}) {
  const startTime = Date.now();

  try {
    // Determine date range
    const startDate = candles[0].timestamp;
    const endDate = candles[candles.length - 1].timestamp;
    
    // Generate windows
    const windows = generateWindows(startDate, endDate, options);
    
    if (windows.length === 0) {
      throw new Error('Insufficient data for walk-forward analysis');
    }

    const windowResults = [];
    const allOutOfSampleTrades = [];

    for (const window of windows) {
      // Get candles for optimization period
      const optCandles = candles.filter(c => 
        c.timestamp >= window.optStart && c.timestamp < window.optEnd
      );
      
      // Get candles for test period
      const testCandles = candles.filter(c =>
        c.timestamp >= window.testStart && c.timestamp < window.testEnd
      );

      if (optCandles.length < 50 || testCandles.length < 20) {
        logger.debug('Skipping window with insufficient data');
        continue;
      }

      // Optimize on in-sample data
      const optimized = optimizeParameters(optCandles, strategyFn, parameterRanges, options);
      
      if (!optimized) {
        logger.debug('Optimization failed for window', { window: window.windowNumber });
        continue;
      }

      // Test on out-of-sample data
      const oosTraces = strategyFn(testCandles, optimized.bestParams);
      const oosMetrics = calculatePerformanceMetrics(oosTraces);
      
      allOutOfSampleTrades.push(...oosTraces);

      windowResults.push({
        window,
        optimizedParams: optimized.bestParams,
        inSampleMetrics: optimized.bestMetrics,
        outOfSampleMetrics: oosMetrics,
        degradation: optimized.bestMetrics.sharpeRatio > 0 
          ? 1 - (oosMetrics.sharpeRatio / optimized.bestMetrics.sharpeRatio)
          : 0
      });
    }

    // Aggregate out-of-sample results
    const aggregateOOS = calculatePerformanceMetrics(allOutOfSampleTrades);
    
    // Run Monte Carlo on OOS trades
    const monteCarlo = runMonteCarloSimulation(allOutOfSampleTrades);

    // Calculate robustness score
    const avgDegradation = windowResults.length > 0
      ? windowResults.reduce((sum, w) => sum + w.degradation, 0) / windowResults.length
      : 1;
    const robustnessScore = Math.max(0, 1 - avgDegradation);

    const result = {
      windows: windowResults,
      totalWindows: windows.length,
      validWindows: windowResults.length,
      aggregateOutOfSample: aggregateOOS,
      monteCarlo,
      robustnessScore,
      isRobust: robustnessScore > 0.5 && aggregateOOS.profitFactor > 1,
      timestamp: new Date(),
      performance: Date.now() - startTime
    };

    logger.info('Walk-forward analysis complete', {
      windows: windowResults.length,
      oosProfit: aggregateOOS.totalReturn,
      robustness: robustnessScore.toFixed(2)
    });

    return result;

  } catch (error) {
    logger.error('Walk-forward analysis failed', { error: error.message });
    throw error;
  }
}

/**
 * Validate strategy robustness
 * @param {Object} wfResults - Walk-forward results
 * @returns {Object} Validation report
 */
function validateRobustness(wfResults) {
  const checks = [];
  let passed = 0;
  const total = 6;

  // Check 1: Minimum windows
  const minWindows = wfResults.validWindows >= 3;
  checks.push({ name: 'Minimum Windows', passed: minWindows, value: wfResults.validWindows, threshold: 3 });
  if (minWindows) passed++;

  // Check 2: Positive OOS profit
  const positiveOOS = wfResults.aggregateOutOfSample.totalReturn > 0;
  checks.push({ name: 'Positive Out-of-Sample', passed: positiveOOS, value: wfResults.aggregateOutOfSample.totalReturn });
  if (positiveOOS) passed++;

  // Check 3: Profit factor > 1
  const profitFactor = wfResults.aggregateOutOfSample.profitFactor > 1;
  checks.push({ name: 'Profit Factor > 1', passed: profitFactor, value: wfResults.aggregateOutOfSample.profitFactor.toFixed(2) });
  if (profitFactor) passed++;

  // Check 4: Acceptable drawdown
  const maxDD = wfResults.aggregateOutOfSample.maxDrawdown < 0.25;
  checks.push({ name: 'Max Drawdown < 25%', passed: maxDD, value: (wfResults.aggregateOutOfSample.maxDrawdown * 100).toFixed(1) + '%' });
  if (maxDD) passed++;

  // Check 5: Robustness score
  const robust = wfResults.robustnessScore > 0.5;
  checks.push({ name: 'Robustness Score > 0.5', passed: robust, value: wfResults.robustnessScore.toFixed(2) });
  if (robust) passed++;

  // Check 6: Monte Carlo validation
  const mcValid = wfResults.monteCarlo && wfResults.monteCarlo.probabilityOfProfit > 0.6;
  checks.push({ name: 'Monte Carlo Probability > 60%', passed: mcValid, value: wfResults.monteCarlo?.probabilityOfProfit?.toFixed(2) });
  if (mcValid) passed++;

  return {
    passed,
    total,
    percentage: (passed / total) * 100,
    isValid: passed >= 4,
    checks
  };
}

module.exports = {
  generateWindows,
  calculatePerformanceMetrics,
  runMonteCarloSimulation,
  optimizeParameters,
  generateCombinations,
  runWalkForwardAnalysis,
  validateRobustness
};
