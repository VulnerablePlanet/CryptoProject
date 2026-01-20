/**
 * Test Script for Market Structure and Divergence Modules
 */

const talib = require('./index');

console.log('🧪 Testing Medium Priority TA-Lib Modules\n');
console.log('============================================================\n');

// Sample candle data for testing (100 candles for better analysis)
const candles = [];
let price = 100;
let trend = 1; // 1 = up, -1 = down

for (let i = 0; i < 100; i++) {
  // Create some trend changes for structure detection
  if (i === 30) trend = -1;
  if (i === 60) trend = 1;
  if (i === 85) trend = -1;

  const volatility = Math.random() * 1.5;
  const change = trend * volatility + (Math.random() - 0.5) * 0.5;
  
  const open = price;
  const close = price + change;
  const high = Math.max(open, close) + Math.random() * 0.5;
  const low = Math.min(open, close) - Math.random() * 0.5;
  const volume = 1000 + (Math.random() * 500) * (i % 10 === 0 ? 3 : 1); // Volume spikes

  candles.push({
    timestamp: new Date(Date.now() - (100 - i) * 3600000),
    open,
    high,
    low,
    close,
    volume
  });
  price = close;
}

console.log('1️⃣  MARKET STRUCTURE (SMC) MODULE\n');
console.log('------------------------------------------------------------');

try {
  const structure = talib.structure.analyze(candles);
  
  console.log('   Break of Structure (BOS):');
  console.log(`     Total: ${structure.bos.length}`);
  console.log(`     Bullish: ${structure.bos.filter(b => b.direction === 'bullish').length}`);
  console.log(`     Bearish: ${structure.bos.filter(b => b.direction === 'bearish').length}`);
  
  console.log('\n   Change of Character (CHOCH):');
  console.log(`     Total: ${structure.choch.length}`);
  
  console.log('\n   Fair Value Gaps (FVG):');
  console.log(`     Total: ${structure.fvgs.length}`);
  console.log(`     Unfilled: ${structure.unfilledFVGs.length}`);
  
  console.log('\n   Liquidity Sweeps:');
  console.log(`     Total: ${structure.sweeps.length}`);
  
  console.log('\n   Market Bias:');
  console.log(`     Direction: ${structure.bias.toUpperCase()}`);
  console.log(`     Confidence: ${(structure.biasConfidence * 100).toFixed(1)}%`);
  
  console.log('\n   ✅ Market Structure module working!\n');
} catch (error) {
  console.log(`   ❌ Error: ${error.message}\n`);
  console.log(error.stack);
}

console.log('2️⃣  DIVERGENCE DETECTION MODULE\n');
console.log('------------------------------------------------------------');

try {
  const divergences = talib.divergence.analyze(candles);
  
  console.log('   Divergences Found:');
  console.log(`     RSI: ${divergences.rsi.length}`);
  console.log(`     MACD: ${divergences.macd.length}`);
  console.log(`     Stochastic: ${divergences.stochastic.length}`);
  console.log(`     Total: ${divergences.summary.totalDivergences}`);
  
  console.log('\n   By Type:');
  console.log(`     Regular Bullish: ${divergences.summary.regularBullish}`);
  console.log(`     Regular Bearish: ${divergences.summary.regularBearish}`);
  console.log(`     Hidden Bullish: ${divergences.summary.hiddenBullish}`);
  console.log(`     Hidden Bearish: ${divergences.summary.hiddenBearish}`);
  
  console.log('\n   Multi-Oscillator Confirmed:');
  console.log(`     Count: ${divergences.confirmed.length}`);
  console.log(`     Has Strong Signal: ${divergences.hasStrongSignal ? 'Yes' : 'No'}`);
  
  if (divergences.currentSignal) {
    console.log('\n   ⚠️  Current Active Signal:');
    console.log(`     Type: ${divergences.currentSignal.type} ${divergences.currentSignal.direction}`);
    console.log(`     Oscillators: ${divergences.currentSignal.oscillators.join(', ')}`);
  }
  
  console.log('\n   ✅ Divergence module working!\n');
} catch (error) {
  console.log(`   ❌ Error: ${error.message}\n`);
  console.log(error.stack);
}

console.log('============================================================');
console.log('✅ All medium priority module tests completed!\n');
