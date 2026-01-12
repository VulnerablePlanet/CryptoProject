/**
 * TA-Lib Module Test Script
 * Tests all 5 priority features independently
 */

const talib = require('./index'); // Fixed: use ./index instead of ./talib

// Sample OHLCV data (100 candles)
const candles = [];
let price = 50000;

for (let i = 0; i < 100; i++) {
  const change = (Math.random() - 0.5) * 1000;
  const open = price;
  price += change;
  const close = price;
  const high = Math.max(open, close) + Math.random() * 200;
  const low = Math.min(open, close) - Math.random() * 200;
  const volume = 1000000 + Math.random() * 5000000;

  candles.push({ open, high, low, close, volume, timestamp: new Date(Date.now() - (100 - i) * 3600000) });
}

console.log('🧪 TA-Lib Module Test\n');
console.log('='.repeat(60));

// Test 1: Market Regime Detection
console.log('\n1️⃣  MARKET REGIME DETECTION');
console.log('-'.repeat(60));
try {
  const regime = talib.regime.detect(candles);
  console.log('✅ Regime:', regime.regime);
  console.log('   Confidence:', regime.confidence.toFixed(2));
  console.log('   ADX:', regime.adx.toFixed(2));
  console.log('   ATR:', regime.atr.toFixed(2));
  console.log('   Volatility:', (regime.volatility * 100).toFixed(2) + '%');
  console.log('   Recommended:', talib.regime.getRecommendedStrategy(regime.regime).join(', '));
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 2: Multi-Indicator Scoring
console.log('\n2️⃣  MULTI-INDICATOR SCORING');
console.log('-'.repeat(60));
try {
  const indicators = talib.scoring.normalize(candles);
  const regime = talib.regime.detect(candles);
  const score = talib.scoring.generateScore(indicators, regime.regime);
  
  console.log('✅ Score:', score.score.toFixed(3));
  console.log('   Direction:', score.direction);
  console.log('   Quality:', score.quality);
  console.log('   Confidence:', score.confidence.toFixed(2));
  console.log('   Strength:', score.strength);
  console.log('   Components:');
  for (const [key, value] of Object.entries(score.components)) {
    console.log(`     ${key}: ${value.toFixed(3)}`);
  }
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 3: Multi-Timeframe Analysis
console.log('\n3️⃣  MULTI-TIMEFRAME ANALYSIS');
console.log('-'.repeat(60));
try {
  const candlesByTF = {
    'daily': candles.slice(-30),
    '4h': candles.slice(-60),
    '1h': candles
  };
  
  const mtfAnalysis = talib.mtf.analyze('BTC/USDT', candlesByTF);
  
  console.log('✅ Daily:', mtfAnalysis.daily.trend, `(${mtfAnalysis.daily.strength.toFixed(2)})`);
  console.log('   4H:', mtfAnalysis['4h'].trend, `(${mtfAnalysis['4h'].strength.toFixed(2)})`);
  console.log('   1H:', mtfAnalysis['1h'].trend, `(${mtfAnalysis['1h'].strength.toFixed(2)})`);
  console.log('   Aggregated:');
  console.log('     Can Trade:', mtfAnalysis.aggregated.canTrade);
  console.log('     Direction:', mtfAnalysis.aggregated.direction);
  console.log('     Confidence:', mtfAnalysis.aggregated.confidence.toFixed(2));
  console.log('     Aligned:', mtfAnalysis.aggregated.aligned);
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 4: Volume Analysis
console.log('\n4️⃣  VOLUME ANALYSIS');
console.log('-'.repeat(60));
try {
  const volumeAnalysis = talib.volume.analyze(candles);
  
  console.log('✅ Volume Profile:');
  console.log('   POC:', volumeAnalysis.profile.poc.toFixed(2));
  console.log('   VAH:', volumeAnalysis.profile.vah.toFixed(2));
  console.log('   VAL:', volumeAnalysis.profile.val.toFixed(2));
  console.log('   VWAP:', volumeAnalysis.vwap.vwap.toFixed(2));
  console.log('   Distance:', (volumeAnalysis.vwap.distance * 100).toFixed(2) + '%');
  console.log('   Absorption:', volumeAnalysis.absorption ? 'YES' : 'NO');
  console.log('   Exhaustion:', volumeAnalysis.exhaustion ? 'YES' : 'NO');
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 5: Order Book Intelligence
console.log('\n5️⃣  ORDER BOOK INTELLIGENCE');
console.log('-'.repeat(60));
try {
  // Generate fake orderbook
  const midPrice = candles[candles.length - 1].close;
  const bids = [];
  const asks = [];
  
  for (let i = 0; i < 20; i++) {
    bids.push([midPrice - i * 10, Math.random() * 5 + 0.5]);
    asks.push([midPrice + i * 10, Math.random() * 3 + 0.5]); // Less ask volume
  }
  
  const orderbook = { bids, asks };
  const obAnalysis = talib.orderbook.analyze(orderbook);
  
  console.log('✅ Imbalance:');
  console.log('   Bid Volume:', obAnalysis.imbalance.bidVolume.toFixed(2));
  console.log('   Ask Volume:', obAnalysis.imbalance.askVolume.toFixed(2));
  console.log('   Ratio:', obAnalysis.imbalance.ratio.toFixed(2));
  console.log('   Pressure:', obAnalysis.imbalance.pressure);
  console.log('   Level:', obAnalysis.imbalance.level);
  console.log('   Spread:', obAnalysis.spread.toFixed(2), `(${obAnalysis.spreadPercent.toFixed(3)}%)`);
  console.log('   Status:', obAnalysis.spreadStatus);
  console.log('   Walls:', obAnalysis.walls.length);
  console.log('   Spoofing:', obAnalysis.spoofing ? 'DETECTED' : 'NO');
} catch (error) {
  console.log('❌ Error:', error.message);
}

// Test 6: Complete Analysis
console.log('\n6️⃣  COMPLETE ANALYSIS');
console.log('-'.repeat(60));
try {
  const candlesByTF = {
    'daily': candles.slice(-30),
    '4h': candles.slice(-60),
    '1h': candles
  };
  
  const midPrice = candles[candles.length - 1].close;
  const bids = [[midPrice - 10, 5], [midPrice - 20, 3]];
  const asks = [[midPrice + 10, 2], [midPrice + 20, 2]];
  const orderbook = { bids, asks };
  
  const result = talib.analyzeComplete({
    symbol: 'BTC/USDT',
    candles,
    candlesByTimeframe: candlesByTF,
    orderbook
  });
  
  console.log('✅ Complete analysis finished');
  console.log('   Regime:', result.regime.regime);
  console.log('   Signal Direction:', result.signal.direction);
  console.log('   Signal Score:', result.signal.score.toFixed(3));
  console.log('   MTF Can Trade:', result.mtf.aggregated.canTrade);
  console.log('   MTF Aligned:', result.mtf.aggregated.aligned);
  console.log('   Volume POC:', result.volume.profile.poc.toFixed(2));
  console.log('   OrderBook Pressure:', result.orderbook.imbalance.pressure);
  console.log('   Performance:', result.performance + 'ms');
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('✅ All tests completed!\n');
