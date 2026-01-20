/**
 * Test Script for Stops and Risk Management Modules
 */

const talib = require('./index');

console.log('🧪 Testing New TA-Lib Modules\n');
console.log('============================================================\n');

// Sample candle data for testing
const candles = [];
let price = 100;
for (let i = 0; i < 50; i++) {
  const change = (Math.random() - 0.5) * 2;
  const open = price;
  const close = price + change;
  const high = Math.max(open, close) + Math.random();
  const low = Math.min(open, close) - Math.random();
  const volume = 1000 + Math.random() * 500;
  
  candles.push({
    timestamp: new Date(Date.now() - (50 - i) * 3600000),
    open,
    high,
    low,
    close,
    volume
  });
  price = close;
}

console.log('1️⃣  DYNAMIC STOPS MODULE\n');
console.log('------------------------------------------------------------');

try {
  const entryPrice = candles[candles.length - 1].close;
  
  // ATR Stop
  const atrStop = talib.stops.calculateATRStop(candles, entryPrice, 'LONG');
  console.log('   ATR Stop (LONG):');
  console.log(`     Entry: $${entryPrice.toFixed(4)}`);
  console.log(`     Stop Loss: $${atrStop.stopLoss.toFixed(4)}`);
  console.log(`     Take Profit: $${atrStop.takeProfit.toFixed(4)}`);
  console.log(`     R:R Ratio: ${atrStop.riskReward.toFixed(2)}`);
  console.log(`     Distance: ${(atrStop.distance * 100).toFixed(2)}%`);
  
  // Volatility Stop
  const volStop = talib.stops.calculateVolatilityStop(candles, entryPrice, 'LONG');
  console.log('\n   Volatility Stop (LONG):');
  console.log(`     Stop Loss: $${volStop.stopLoss.toFixed(4)}`);
  console.log(`     Volatility: ${(volStop.volatility * 100).toFixed(2)}%`);
  
  // Trailing Stop
  const trailing = talib.stops.initializeTrailing(entryPrice, 'LONG');
  console.log('\n   Trailing Stop Initialized:');
  console.log(`     Activation: ${(trailing.activationPercent * 100).toFixed(1)}%`);
  console.log(`     Trail: ${(trailing.trailPercent * 100).toFixed(1)}%`);
  
  // Dynamic (Auto) Stop
  const dynamicStop = talib.stops.calculateDynamic(candles, entryPrice, 'LONG');
  console.log('\n   Dynamic Stop (Auto):');
  console.log(`     Method: ${dynamicStop.method}`);
  console.log(`     R:R Ratio: ${dynamicStop.riskReward.toFixed(2)}`);
  
  console.log('\n   ✅ Stops module working!\n');
} catch (error) {
  console.log(`   ❌ Error: ${error.message}\n`);
  console.log(error.stack);
}

console.log('2️⃣  RISK MANAGEMENT MODULE\n');
console.log('------------------------------------------------------------');

try {
  const accountBalance = 10000;
  const entryPrice = 100;
  const stopLoss = 98;
  
  // Position Sizing
  const posSize = talib.risk.calculatePositionSize({
    accountBalance,
    riskPercent: 0.01,
    entryPrice,
    stopLoss
  });
  console.log('   Position Sizing:');
  console.log(`     Account: $${accountBalance}`);
  console.log(`     Risk: 1% = $${posSize.riskAmount.toFixed(2)}`);
  console.log(`     Position Size: $${posSize.size.toFixed(2)}`);
  console.log(`     Quantity: ${posSize.quantity.toFixed(4)}`);
  
  // Exposure Check
  const currentPositions = [{ size: 500 }, { size: 300 }];
  const newPosition = { size: 200 };
  const exposure = talib.risk.checkExposure(currentPositions, newPosition, accountBalance);
  console.log('\n   Exposure Check:');
  console.log(`     Current: ${(exposure.currentExposure * 100).toFixed(1)}%`);
  console.log(`     After Trade: ${(exposure.newExposure * 100).toFixed(1)}%`);
  console.log(`     Allowed: ${exposure.allowed ? 'Yes' : 'No'}`);
  
  // Kill Switch Check
  const performance = {
    dailyPnL: -0.01,
    drawdown: 0.05,
    winrate: 0.45,
    tradesCount: 20
  };
  const killSwitch = talib.risk.checkKillSwitch(performance);
  console.log('\n   Kill Switch:');
  console.log(`     Activated: ${killSwitch.activated ? 'YES ⚠️' : 'No'}`);
  
  // Trade Validation
  const trade = { symbol: 'BTC/USDT', size: 500, riskPercent: 0.01 };
  const validation = talib.risk.validateTrade(trade, currentPositions, performance, accountBalance);
  console.log('\n   Trade Validation:');
  console.log(`     Valid: ${validation.valid ? 'Yes ✅' : 'No ❌'}`);
  console.log(`     Errors: ${validation.errors.length}`);
  console.log(`     Warnings: ${validation.warnings.length}`);
  
  console.log('\n   ✅ Risk module working!\n');
} catch (error) {
  console.log(`   ❌ Error: ${error.message}\n`);
  console.log(error.stack);
}

console.log('3️⃣  PREVIOUSLY UNEXPORTED MODULES\n');
console.log('------------------------------------------------------------');

try {
  // Patterns
  const patterns = talib.patterns.scanAll(candles);
  console.log('   Candlestick Patterns:');
  console.log(`     Total Found: ${patterns.count}`);
  console.log(`     Types: ${Object.keys(patterns).filter(k => k !== 'count' && k !== 'recentPatterns').join(', ')}`);
  
  // Cycles
  const cycles = talib.cycles.analyze(candles);
  console.log('\n   Cycle Analysis:');
  console.log(`     Mode: ${cycles.mode}`);
  console.log(`     R-Squared: ${cycles.regression.rSquared.toFixed(4)}`);
  console.log(`     Squeeze Active: ${cycles.squeeze.active ? 'Yes' : 'No'}`);
  
  // Adaptive
  const adaptive = talib.adaptive.analyze(candles);
  console.log('\n   Adaptive Indicators:');
  console.log(`     Mode: ${adaptive.mode}`);
  console.log(`     KAMA Trend: ${adaptive.kama.trend}`);
  
  console.log('\n   ✅ All previously unexported modules working!\n');
} catch (error) {
  console.log(`   ❌ Error: ${error.message}\n`);
  console.log(error.stack);
}

console.log('============================================================');
console.log('✅ All new module tests completed!\n');
