/**
 * Test Script for Advanced TA-Lib Features
 * Tests Pattern Recognition, Adaptive Indicators, and Cycle Analysis
 * 
 * Run: node test-advanced.js
 */

const patterns = require('./patterns/candlestickPatterns');
const adaptive = require('./indicators/adaptiveIndicators');
const cycles = require('./analysis/cycleAnalysis');

// Generate sample candle data
function generateSampleCandles(count = 100, trend = 'up') {
  const candles = [];
  let basePrice = 45000;
  const timestamp = Date.now() - (count * 3600000); // 1 hour per candle
  
  for (let i = 0; i < count; i++) {
    const volatility = basePrice * 0.02;
    
    // Add trend
    if (trend === 'up') {
      basePrice += Math.random() * 50 - 20;
    } else if (trend === 'down') {
      basePrice += Math.random() * 20 - 50;
    } else {
      basePrice += Math.random() * 30 - 30; // Sideways
    }
    
    const open = basePrice + (Math.random() - 0.5) * volatility;
    const close = basePrice + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = 1000 + Math.random() * 500;
    
    candles.push({
      timestamp: timestamp + (i * 3600000),
      open,
      high,
      low,
      close,
      volume
    });
  }
  
  // Add some specific patterns
  if (count > 50) {
    // Add a Doji
    const dojiIndex = 80;
    const dojiPrice = candles[dojiIndex].close;
    candles[dojiIndex] = {
      ...candles[dojiIndex],
      open: dojiPrice,
      close: dojiPrice + 1,
      high: dojiPrice + 50,
      low: dojiPrice - 50
    };
    
    // Add a Hammer
    const hammerIndex = 85;
    const hammerPrice = candles[hammerIndex].close;
    candles[hammerIndex] = {
      ...candles[hammerIndex],
      open: hammerPrice,
      close: hammerPrice + 20,
      high: hammerPrice + 30,
      low: hammerPrice - 100 // Long lower wick
    };
  }
  
  return candles;
}

console.log('='.repeat(80));
console.log('ADVANCED TA-LIB FEATURES - TEST SUITE');
console.log('='.repeat(80));
console.log('');

// Test 1: Pattern Recognition
console.log('📊 TEST 1: PATTERN RECOGNITION');
console.log('-'.repeat(80));

try {
  const testCandles = generateSampleCandles(100, 'up');
  console.log(`✓ Generated ${testCandles.length} sample candles`);
  
  const patternResults = patterns.scanAllPatterns(testCandles);
  
  console.log(`\n✅ Pattern Detection Successful!`);
  console.log(`   Total patterns found: ${patternResults.summary.total}`);
  console.log(`   - Bullish: ${patternResults.summary.bullish}`);
  console.log(`   - Bearish: ${patternResults.summary.bearish}`);
  console.log(`   - Neutral: ${patternResults.summary.neutral}`);
  console.log(`   Performance: ${patternResults.performance}ms`);
  
  if (patternResults.patterns.length > 0) {
    console.log(`\n   Recent patterns detected:`);
    patternResults.patterns.slice(0, 5).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.pattern} (${p.type}) - Confidence: ${(p.confidence * 100).toFixed(0)}%`);
    });
  }
  
} catch (error) {
  console.log(`❌ Pattern Recognition Test FAILED: ${error.message}`);
}

console.log('');

// Test 2: Adaptive Indicators (KAMA)
console.log('📈 TEST 2: ADAPTIVE INDICATORS (KAMA)');
console.log('-'.repeat(80));

try {
  const trendingCandles = generateSampleCandles(100, 'up');
  console.log(`✓ Generated ${trendingCandles.length} trending candles`);
  
  const kamaResult = adaptive.calculateKAMA(trendingCandles, {
    period: 10,
    fastPeriod: 2,
    slowPeriod: 30
  });
  
  console.log(`\n✅ KAMA Calculation Successful!`);
  console.log(`   Data points: ${kamaResult.values.length}`);
  console.log(`   Market mode: ${kamaResult.mode}`);
  console.log(`   Efficiency ratio: ${(kamaResult.efficiency * 100).toFixed(1)}%`);
  console.log(`   Performance: ${kamaResult.performance}ms`);
  
  const lastAlignment = kamaResult.alignment[kamaResult.alignment.length - 1];
  console.log(`\n   Current position:`);
  console.log(`   - Price: $${lastAlignment.price.toFixed(2)}`);
  console.log(`   - KAMA: $${lastAlignment.value.toFixed(2)}`);
  console.log(`   - Position: ${lastAlignment.position} (${lastAlignment.distance}%)`);
  
  // Test EMA comparison
  const comparison = adaptive.compareWithEMA(trendingCandles);
  console.log(`\n   KAMA vs EMA Comparison:`);
  console.log(`   - KAMA avg deviation: $${comparison.kama.avgDeviation.toFixed(2)}`);
  console.log(`   - EMA avg deviation: $${comparison.ema.avgDeviation.toFixed(2)}`);
  console.log(`   - KAMA improvement: ${comparison.comparison.improvementPercent}%`);
  
} catch (error) {
  console.log(`❌ Adaptive Indicators Test FAILED: ${error.message}`);
}

console.log('');

// Test 3: Cycle Analysis
console.log('🔄 TEST 3: CYCLE ANALYSIS (REGRESSION + SQUEEZE)');
console.log('-'.repeat(80));

try {
  const cycleCandles = generateSampleCandles(150, 'up');
  console.log(`✓ Generated ${cycleCandles.length} sample candles`);
  
  const cycleResult = cycles.analyzeCycles(cycleCandles, {
    regressionPeriod: 20,
    projectAhead: 10
  });
  
  console.log(`\n✅ Cycle Analysis Successful!`);
  console.log(`   Market mode: ${cycleResult.mode}`);
  console.log(`   Performance: ${cycleResult.performance}ms`);
  
  // Regression results
  console.log(`\n   📐 Linear Regression:`);
  console.log(`   - Trend: ${cycleResult.regression.trendDirection}`);
  console.log(`   - Slope: ${cycleResult.regression.slope.toFixed(4)}`);
  console.log(`   - R²: ${(cycleResult.regression.rSquared * 100).toFixed(1)}% (fit quality)`);
  console.log(`   - Current price: $${cycleResult.regression.currentPosition.price.toFixed(2)}`);
  console.log(`   - Regression line: $${cycleResult.regression.currentPosition.regression.toFixed(2)}`);
  console.log(`   - Position: ${cycleResult.regression.currentPosition.position} (${cycleResult.regression.currentPosition.deviation}%)`);
  
  // Projections
  if (cycleResult.regression.projections.length > 0) {
    console.log(`\n   📊 Price Projections (next ${cycleResult.regression.projections.length} periods):`);
    cycleResult.regression.projections.slice(0, 3).forEach((proj, i) => {
      console.log(`   ${i + 1}. $${proj.toFixed(2)}`);
    });
    console.log(`   ...`);
  }
  
  // Squeeze results
  console.log(`\n   💥 Bollinger Squeeze:`);
  console.log(`   - Active: ${cycleResult.squeeze.active ? 'YES ⚡' : 'NO'}`);
  console.log(`   - Bandwidth: ${cycleResult.squeeze.bandwidth.toFixed(3)}%`);
  console.log(`   - Threshold: ${cycleResult.squeeze.threshold.toFixed(3)}%`);
  
  if (cycleResult.squeeze.active) {
    console.log(`   - Duration: ${cycleResult.squeeze.duration} candles`);
    console.log(`   - Breakout expected: ${cycleResult.squeeze.expectedBreakout}`);
  }
  
  // Insights
  if (cycleResult.insights.length > 0) {
    console.log(`\n   💡 Trading Insights:`);
    cycleResult.insights.forEach((insight, i) => {
      console.log(`   ${i + 1}. [${insight.type}] ${insight.message}`);
      console.log(`      Confidence: ${(insight.confidence * 100).toFixed(0)}%`);
    });
  }
  
} catch (error) {
  console.log(`❌ Cycle Analysis Test FAILED: ${error.message}`);
}

console.log('');
console.log('='.repeat(80));
console.log('✅ ALL TESTS COMPLETED');
console.log('='.repeat(80));
console.log('');
console.log('Next steps:');
console.log('1. Test endpoints via API: cd ../.. && npm run dev:all');
console.log('2. Test via curl or Postman:');
console.log('   POST http://localhost:5000/api/talib/patterns/BTCUSDT');
console.log('   POST http://localhost:5000/api/talib/adaptive/BTCUSDT');
console.log('   POST http://localhost:5000/api/talib/cycles/BTCUSDT');
console.log('');
