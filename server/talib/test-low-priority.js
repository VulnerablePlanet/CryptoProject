/**
 * Test Script for Low Priority TA-Lib Modules
 * Walk-Forward Testing, ML Feature Store, Adaptive Strategies
 */

const talib = require('./index');

console.log('🧪 Testing Low Priority TA-Lib Modules\n');
console.log('============================================================\n');

// Sample candle data for testing
const candles = [];
let price = 100;
for (let i = 0; i < 200; i++) {
  const change = (Math.random() - 0.5) * 2;
  const open = price;
  const close = price + change;
  const high = Math.max(open, close) + Math.random();
  const low = Math.min(open, close) - Math.random();
  const volume = 1000 + Math.random() * 500;

  candles.push({
    timestamp: new Date(Date.now() - (200 - i) * 3600000),
    open,
    high,
    low,
    close,
    volume
  });
  price = close;
}

console.log('1️⃣  WALK-FORWARD TESTING MODULE\n');
console.log('------------------------------------------------------------');

try {
  // Generate windows
  const startDate = candles[0].timestamp;
  const endDate = candles[candles.length - 1].timestamp;
  const windows = talib.backtest.generateWindows(startDate, endDate, {
    optimizationDays: 30,
    testDays: 10,
    stepDays: 10
  });
  
  console.log('   Walk-Forward Windows:');
  console.log(`     Generated: ${windows.length} windows`);
  if (windows.length > 0) {
    console.log(`     First Window: ${windows[0].optStart.toISOString().split('T')[0]} to ${windows[0].testEnd.toISOString().split('T')[0]}`);
  }
  
  // Test performance metrics
  const sampleTrades = [
    { pnl: 50, pnlPercent: 0.05, entryPrice: 100, size: 10 },
    { pnl: -30, pnlPercent: -0.03, entryPrice: 100, size: 10 },
    { pnl: 80, pnlPercent: 0.08, entryPrice: 100, size: 10 },
    { pnl: -20, pnlPercent: -0.02, entryPrice: 100, size: 10 },
    { pnl: 100, pnlPercent: 0.10, entryPrice: 100, size: 10 }
  ];
  
  const metrics = talib.backtest.calculateMetrics(sampleTrades);
  console.log('\n   Performance Metrics (sample trades):');
  console.log(`     Win Rate: ${(metrics.winrate * 100).toFixed(1)}%`);
  console.log(`     Profit Factor: ${metrics.profitFactor.toFixed(2)}`);
  console.log(`     Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
  console.log(`     Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(1)}%`);
  
  console.log('\n   ✅ Walk-Forward module working!\n');
} catch (error) {
  console.log(`   ❌ Error: ${error.message}\n`);
  console.log(error.stack);
}

console.log('2️⃣  ML FEATURE STORE MODULE\n');
console.log('------------------------------------------------------------');

try {
  // Extract features
  const features = talib.ml.extractFeatures(candles, 'BTC/USDT');
  
  console.log('   Extracted Features:');
  console.log(`     Indicator Count: ${Object.keys(features.indicators).length}`);
  console.log(`     Regime: ${features.regime}`);
  console.log(`     Volatility: ${(features.volatility * 100).toFixed(2)}%`);
  
  // Sample features
  const sampleKeys = Object.keys(features.indicators).slice(0, 5);
  console.log('\n   Sample Features:');
  for (const key of sampleKeys) {
    console.log(`     ${key}: ${features.indicators[key].toFixed(4)}`);
  }
  
  // Store and retrieve
  talib.ml.storeFeatures('BTC/USDT', features);
  const stored = talib.ml.getStoredFeatures('BTC/USDT');
  console.log(`\n   Storage: ${stored.length} feature sets stored`);
  
  console.log('\n   ✅ ML Feature Store module working!\n');
} catch (error) {
  console.log(`   ❌ Error: ${error.message}\n`);
  console.log(error.stack);
}

console.log('3️⃣  ADAPTIVE STRATEGIES MODULE\n');
console.log('------------------------------------------------------------');

try {
  // Initialize strategy
  talib.strategy.initialize('momentum_strategy', { type: 'momentum' });
  
  // Record some trades
  const trades = [
    { pnl: 100, pnlPercent: 0.05, symbol: 'BTC/USDT' },
    { pnl: -50, pnlPercent: -0.025, symbol: 'BTC/USDT' },
    { pnl: 80, pnlPercent: 0.04, symbol: 'BTC/USDT' },
    { pnl: 120, pnlPercent: 0.06, symbol: 'BTC/USDT' },
    { pnl: -30, pnlPercent: -0.015, symbol: 'BTC/USDT' }
  ];
  
  for (const trade of trades) {
    talib.strategy.recordTrade('momentum_strategy', trade);
  }
  
  // Get recommendations
  const recommendations = talib.strategy.getRecommendations({
    regime: 'strong_trend',
    volatility: 0.03
  });
  
  console.log('   Strategy Performance:');
  const summary = talib.strategy.getPerformanceSummary();
  console.log(`     Active Strategies: ${summary.enabledStrategies}`);
  console.log(`     Total Trades: ${summary.totalTrades}`);
  console.log(`     Avg Win Rate: ${(summary.avgWinrate * 100).toFixed(1)}%`);
  
  // Size multiplier
  const sizeMultiplier = talib.strategy.calculateSizeMultiplier('momentum_strategy', {
    volatility: 0.03,
    drawdown: 0.05
  });
  console.log(`\n   Size Multiplier: ${sizeMultiplier.multiplier.toFixed(2)}x`);
  console.log(`   Reason: ${sizeMultiplier.reason}`);
  
  // Regime recommendations
  const regimeRecs = talib.strategy.getRegimeRecommendations('strong_trend');
  console.log('\n   Regime Recommendations (Strong Trend):');
  console.log(`     Preferred: ${regimeRecs.preferred.join(', ')}`);
  console.log(`     Avoid: ${regimeRecs.avoid.join(', ')}`);
  
  console.log('\n   ✅ Adaptive Strategies module working!\n');
} catch (error) {
  console.log(`   ❌ Error: ${error.message}\n`);
  console.log(error.stack);
}

console.log('============================================================');
console.log('✅ All low priority module tests completed!\n');
