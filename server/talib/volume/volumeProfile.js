/**
 * Volume Profile & Advanced Volume Analysis (Priority #4)
 * Institutional-grade volume analysis
 * 
 * @module volume/volumeProfile
 */

const { percentile } = require('../utils/mathHelpers');
const { validateOHLCV } = require('../utils/dataValidator');
const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('VolumeAnalysis');

/**
 * Calculate Volume Profile
 * @param {Object[]} candles - OHLCV candles
 * @param {number} buckets - Number of price buckets
 * @returns {import('../types').VolumeProfile} Volume profile data
 */
function calculateVolumeProfile(candles, buckets = 24) {
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Find price range
  const lows = candles.map(c => c.low);
  const highs = candles.map(c => c.high);
  const minPrice = Math.min(...lows);
  const maxPrice = Math.max(...highs);
  const priceRange = maxPrice - minPrice;
  const bucketSize = priceRange / buckets;

  // Initialize buckets
  const volumeBuckets = Array(buckets).fill(0);
  const priceBuckets = Array(buckets).fill(0).map((_, i) => 
    minPrice + (i + 0.5) * bucketSize
  );

  // Fill buckets with volume
  let totalVolume = 0;
  for (const candle of candles) {
    const candleRange = candle.high - candle.low;
    const candleVolume = candle.volume;
    totalVolume += candleVolume;

    // Distribute volume across buckets that candle touches
    for (let i = 0; i < buckets; i++) {
      const bucketLow = minPrice + i * bucketSize;
      const bucketHigh = bucketLow + bucketSize;
      
      // Calculate overlap
      const overlapLow = Math.max(candle.low, bucketLow);
      const overlapHigh = Math.min(candle.high, bucketHigh);
      
      if (overlapHigh > overlapLow) {
        const overlapRatio = candleRange > 0 ? (overlapHigh - overlapLow) / candleRange : 1;
        volumeBuckets[i] += candleVolume * overlapRatio;
      }
    }
  }

  // Find POC (Point of Control) - price with most volume
  let maxVolumeIdx = 0;
  for (let i = 1; i < buckets; i++) {
    if (volumeBuckets[i] > volumeBuckets[maxVolumeIdx]) {
      maxVolumeIdx = i;
    }
  }
  const poc = priceBuckets[maxVolumeIdx];

  // Calculate Value Area (70% of volume)
  const sortedIndices = volumeBuckets
    .map((vol, idx) => ({ vol, idx }))
    .sort((a, b) => b.vol - a.vol);

  let valueAreaVolume = 0;
  const valueAreaThreshold = totalVolume * 0.70;
  const valueAreaIndices = [];

  for (const { vol, idx } of sortedIndices) {
    valueAreaIndices.push(idx);
    valueAreaVolume += vol;
    if (valueAreaVolume >= valueAreaThreshold) break;
  }

  // Find VAH and VAL
  const vah = priceBuckets[Math.max(...valueAreaIndices)];
  const val = priceBuckets[Math.min(...valueAreaIndices)];

  // Create nodes
  const nodes = priceBuckets.map((price, idx) => ({
    price,
    volume: volumeBuckets[idx],
    percentage: (volumeBuckets[idx] / totalVolume) * 100
  }));

  return {
    poc,
    vah,
    val,
    nodes,
    totalVolume
  };
}

/**
 * Calculate Dynamic VWAP
 * @param {Object[]} candles - OHLCV candles
 * @param {string} type - 'session' or 'rolling'
 * @param {number} period - Period for rolling VWAP
 * @returns {import('../types').VWAPData} VWAP data
 */
function calculateDynamicVWAP(candles, type = 'session', period = 20) {
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  let targetCandles;
  if (type === 'rolling') {
    targetCandles = candles.slice(-period);
  } else {
    targetCandles = candles; // Session VWAP uses all candles
  }

  let sumPV = 0;
  let sumV = 0;
  const typicalPrices = [];

  for (const candle of targetCandles) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    typicalPrices.push(typicalPrice);
    sumPV += typicalPrice * candle.volume;
    sumV += candle.volume;
  }

  const vwap = sumV > 0 ? sumPV / sumV : 0;

  // Calculate standard deviation for bands
  let sumSquaredDiff = 0;
  for (let i = 0; i < targetCandles.length; i++) {
    const diff = typicalPrices[i] - vwap;
    sumSquaredDiff += diff * diff * targetCandles[i].volume;
  }

  const stdDev = sumV > 0 ? Math.sqrt(sumSquaredDiff / sumV) : 0;

  const currentPrice = candles[candles.length - 1].close;
  const distance = (currentPrice - vwap) / vwap;

  return {
    vwap,
    upperBand: vwap + stdDev,
    lowerBand: vwap - stdDev,
    distance
  };
}

/**
 * Calculate Delta Volume (Buy vs Sell pressure)
 * Requires trade data with side information
 * @param {import('../types').Trade[]} trades - Array of trades
 * @returns {import('../types').DeltaVolume} Delta volume data
 */
function calculateDeltaVolume(trades) {
  let buyVolume = 0;
  let sellVolume = 0;

  for (const trade of trades) {
    if (trade.side === 'buy') {
      buyVolume += trade.amount;
    } else {
      sellVolume += trade.amount;
    }
  }

  const totalVolume = buyVolume + sellVolume;
  const delta = buyVolume - sellVolume;
  const ratio = totalVolume > 0 ? buyVolume / totalVolume : 0.5;

  let pressure;
  if (ratio > 0.6) {
    pressure = 'buy';
  } else if (ratio < 0.4) {
    pressure = 'sell';
  } else {
    pressure = 'neutral';
  }

  return {
    buyVolume,
    sellVolume,
    delta,
    ratio,
    pressure
  };
}

/**
 * Detect Volume Absorption
 * High volume with minimal price movement = institutional absorption
 * @param {Object[]} candles - OHLCV candles
 * @param {number} lookback - Lookback period
 * @returns {boolean} Whether absorption detected
 */
function detectAbsorption(candles, lookback = 20) {
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    return false;
  }

  const recent = candles.slice(-lookback);
  const volumes = recent.map(c => c.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  const latest = candles[candles.length - 1];
  const volumeMultiplier = config.volume.absorption.volumeMultiplier;
  const maxPriceChange = config.volume.absorption.priceChangeMax;

  // High volume condition
  const highVolume = latest.volume > avgVolume * volumeMultiplier;

  // Low price movement condition
  const priceChange = Math.abs(latest.close - latest.open) / latest.open;
  const lowMovement = priceChange < maxPriceChange;

  return highVolume && lowMovement;
}

/**
 * Detect Volume Exhaustion
 * Very high volume at end of trend = potential exhaustion
 * @param {Object[]} candles - OHLCV candles
 * @param {number} lookback - Lookback period
 * @returns {boolean} Whether exhaustion detected
 */
function detectExhaustion(candles, lookback = 20) {
  const validation = validateOHLCV(candles);
  if (!validation.valid) {
    return false;
  }

  const recent = candles.slice(-lookback);
  const volumes = recent.map(c => c.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  const latest = candles[candles.length - 1];
  const previousClose = candles[candles.length - 2].close;

  // Extreme volume
  const extremeVolume = latest.volume > avgVolume * 3;

  // Price rejection (wick)
  const bodySize = Math.abs(latest.close - latest.open);
  const totalRange = latest.high - latest.low;
  const wickRatio = totalRange > 0 ? bodySize / totalRange : 0;

  const hasWick = wickRatio < 0.5;

  // Trend context
  const trendUp = latest.close > previousClose;
  const upperWick = latest.high - Math.max(latest.open, latest.close);
  const lowerWick = Math.min(latest.open, latest.close) - latest.low;

  // Exhaustion conditions
  const buyExhaustion = trendUp && hasWick && upperWick > lowerWick && extremeVolume;
  const sellExhaustion = !trendUp && hasWick && lowerWick > upperWick && extremeVolume;

  return buyExhaustion || sellExhaustion;
}

/**
 * Complete volume analysis
 * @param {Object[]} candles - OHLCV candles
 * @param {import('../types').Trade[]} trades - Optional trade data for delta
 * @returns {import('../types').VolumeAnalysis} Complete volume analysis
 */
function analyzeVolume(candles, trades = null) {
  const startTime = Date.now();

  try {
    const profile = calculateVolumeProfile(candles, config.volume.profile.buckets);
    const vwap = calculateDynamicVWAP(candles, config.volume.vwap.type, config.volume.vwap.rollingPeriod);
    const absorption = detectAbsorption(candles);
    const exhaustion = detectExhaustion(candles);

    let delta = null;
    if (trades && trades.length > 0) {
      delta = calculateDeltaVolume(trades);
    }

    const result = {
      profile,
      vwap,
      delta,
      absorption,
      exhaustion,
      timestamp: new Date()
    };

    const duration = Date.now() - startTime;
    logger.performance('analyzeVolume', duration);

    return result;

  } catch (error) {
    logger.error('Volume analysis failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  calculateVolumeProfile,
  calculateDynamicVWAP,
  calculateDeltaVolume,
  detectAbsorption,
  detectExhaustion,
  analyzeVolume
};
