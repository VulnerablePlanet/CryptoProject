/**
 * Divergence Detection Module
 * Detects price/oscillator divergences for reversal signals
 * 
 * Features:
 * - Regular divergence (trend reversal)
 * - Hidden divergence (trend continuation)
 * - Multi-oscillator divergence (RSI, MACD, Stochastic)
 * - Volume confirmation
 * - Strength scoring
 * 
 * @module divergence/divergenceDetector
 */

const { RSI, MACD, Stochastic } = require('technicalindicators');
const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('DivergenceDetector');

/**
 * Find pivot points in a data series
 * @param {number[]} data - Data series
 * @param {number} leftBars - Bars to left for pivot validation
 * @param {number} rightBars - Bars to right for pivot validation
 * @returns {Object[]} Pivot points with index and value
 */
function findPivots(data, leftBars = 5, rightBars = 3) {
  const pivotHighs = [];
  const pivotLows = [];

  for (let i = leftBars; i < data.length - rightBars; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= leftBars; j++) {
      if (data[i - j] >= data[i]) isHigh = false;
      if (data[i - j] <= data[i]) isLow = false;
    }

    for (let j = 1; j <= rightBars; j++) {
      if (data[i + j] >= data[i]) isHigh = false;
      if (data[i + j] <= data[i]) isLow = false;
    }

    if (isHigh) pivotHighs.push({ index: i, value: data[i] });
    if (isLow) pivotLows.push({ index: i, value: data[i] });
  }

  return { pivotHighs, pivotLows };
}

/**
 * Calculate RSI values
 * @param {Object[]} candles - OHLCV candles
 * @param {number} period - RSI period
 * @returns {number[]} RSI values
 */
function calculateRSI(candles, period = 14) {
  const closes = candles.map(c => c.close);
  const rsi = RSI.calculate({ values: closes, period });
  
  // Pad to match candle length
  const padding = Array(candles.length - rsi.length).fill(null);
  return [...padding, ...rsi];
}

/**
 * Calculate MACD histogram
 * @param {Object[]} candles - OHLCV candles
 * @returns {number[]} MACD histogram values
 */
function calculateMACDHistogram(candles) {
  const closes = candles.map(c => c.close);
  const macd = MACD.calculate({
    values: closes,
    fastPeriod: config.indicators.macd.fast,
    slowPeriod: config.indicators.macd.slow,
    signalPeriod: config.indicators.macd.signal,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  const histogram = macd.map(m => m.histogram);
  const padding = Array(candles.length - histogram.length).fill(null);
  return [...padding, ...histogram];
}

/**
 * Calculate Stochastic %K
 * @param {Object[]} candles - OHLCV candles
 * @returns {number[]} Stochastic K values
 */
function calculateStochastic(candles) {
  const stoch = Stochastic.calculate({
    high: candles.map(c => c.high),
    low: candles.map(c => c.low),
    close: candles.map(c => c.close),
    period: config.indicators.stochastic.k,
    signalPeriod: config.indicators.stochastic.d
  });

  const k = stoch.map(s => s.k);
  const padding = Array(candles.length - k.length).fill(null);
  return [...padding, ...k];
}

/**
 * Detect divergence between price and oscillator
 * @param {Object[]} candles - OHLCV candles
 * @param {number[]} oscillator - Oscillator values
 * @param {string} oscName - Oscillator name
 * @param {Object} params - Detection parameters
 * @returns {import('../types').Divergence[]} Detected divergences
 */
function detectDivergence(candles, oscillator, oscName, params = {}) {
  const {
    lookback = config.divergence.lookback,
    minPivotDistance = config.divergence.minPivotDistance
  } = params;

  const divergences = [];
  const prices = candles.map(c => c.close);
  
  // Get price pivots
  const { pivotHighs: priceHighs, pivotLows: priceLows } = findPivots(prices);
  
  // Get oscillator pivots
  const validOsc = oscillator.map((v, i) => v !== null ? { value: v, index: i } : null).filter(v => v);
  const oscValues = oscillator.filter(v => v !== null);
  const { pivotHighs: oscHighs, pivotLows: oscLows } = findPivots(oscValues);

  // Map oscillator pivots back to original indices
  const mappedOscHighs = oscHighs.map(p => ({
    index: validOsc[p.index].index,
    value: p.value
  }));
  const mappedOscLows = oscLows.map(p => ({
    index: validOsc[p.index].index,
    value: p.value
  }));

  // Look for Regular Bearish Divergence
  // Price makes higher high, oscillator makes lower high
  for (let i = 0; i < priceHighs.length - 1; i++) {
    const current = priceHighs[priceHighs.length - 1 - i];
    const previous = priceHighs[priceHighs.length - 2 - i];

    if (current.index - previous.index < minPivotDistance) continue;
    if (current.index < candles.length - lookback) break;

    // Find corresponding oscillator pivots
    const currentOsc = mappedOscHighs.find(p => Math.abs(p.index - current.index) <= 2);
    const previousOsc = mappedOscHighs.find(p => Math.abs(p.index - previous.index) <= 2);

    if (currentOsc && previousOsc) {
      // Regular bearish: price HH, oscillator LH
      if (current.value > previous.value && currentOsc.value < previousOsc.value) {
        divergences.push({
          type: 'regular',
          direction: 'bearish',
          oscillator: oscName,
          priceStart: previous.value,
          priceEnd: current.value,
          oscStart: previousOsc.value,
          oscEnd: currentOsc.value,
          startIndex: previous.index,
          endIndex: current.index,
          timestamp: candles[current.index].timestamp,
          strength: calculateDivergenceStrength(
            previous.value, current.value,
            previousOsc.value, currentOsc.value
          )
        });
      }
      // Hidden bearish: price LH, oscillator HH
      if (current.value < previous.value && currentOsc.value > previousOsc.value) {
        divergences.push({
          type: 'hidden',
          direction: 'bearish',
          oscillator: oscName,
          priceStart: previous.value,
          priceEnd: current.value,
          oscStart: previousOsc.value,
          oscEnd: currentOsc.value,
          startIndex: previous.index,
          endIndex: current.index,
          timestamp: candles[current.index].timestamp,
          strength: calculateDivergenceStrength(
            previous.value, current.value,
            previousOsc.value, currentOsc.value
          )
        });
      }
    }
  }

  // Look for Regular Bullish Divergence
  // Price makes lower low, oscillator makes higher low
  for (let i = 0; i < priceLows.length - 1; i++) {
    const current = priceLows[priceLows.length - 1 - i];
    const previous = priceLows[priceLows.length - 2 - i];

    if (current.index - previous.index < minPivotDistance) continue;
    if (current.index < candles.length - lookback) break;

    const currentOsc = mappedOscLows.find(p => Math.abs(p.index - current.index) <= 2);
    const previousOsc = mappedOscLows.find(p => Math.abs(p.index - previous.index) <= 2);

    if (currentOsc && previousOsc) {
      // Regular bullish: price LL, oscillator HL
      if (current.value < previous.value && currentOsc.value > previousOsc.value) {
        divergences.push({
          type: 'regular',
          direction: 'bullish',
          oscillator: oscName,
          priceStart: previous.value,
          priceEnd: current.value,
          oscStart: previousOsc.value,
          oscEnd: currentOsc.value,
          startIndex: previous.index,
          endIndex: current.index,
          timestamp: candles[current.index].timestamp,
          strength: calculateDivergenceStrength(
            previous.value, current.value,
            previousOsc.value, currentOsc.value
          )
        });
      }
      // Hidden bullish: price HL, oscillator LL
      if (current.value > previous.value && currentOsc.value < previousOsc.value) {
        divergences.push({
          type: 'hidden',
          direction: 'bullish',
          oscillator: oscName,
          priceStart: previous.value,
          priceEnd: current.value,
          oscStart: previousOsc.value,
          oscEnd: currentOsc.value,
          startIndex: previous.index,
          endIndex: current.index,
          timestamp: candles[current.index].timestamp,
          strength: calculateDivergenceStrength(
            previous.value, current.value,
            previousOsc.value, currentOsc.value
          )
        });
      }
    }
  }

  return divergences;
}

/**
 * Calculate divergence strength score
 * @param {number} priceStart - Starting price
 * @param {number} priceEnd - Ending price
 * @param {number} oscStart - Starting oscillator value
 * @param {number} oscEnd - Ending oscillator value
 * @returns {number} Strength score (0-1)
 */
function calculateDivergenceStrength(priceStart, priceEnd, oscStart, oscEnd) {
  const priceChange = Math.abs((priceEnd - priceStart) / priceStart);
  const oscChange = Math.abs((oscEnd - oscStart) / (Math.abs(oscStart) || 1));
  
  // Larger divergences are stronger
  const strength = Math.min(1, (priceChange + oscChange) * 5);
  return strength;
}

/**
 * Check for volume confirmation of divergence
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} divergence - Divergence to check
 * @returns {boolean} Whether volume confirms
 */
function checkVolumeConfirmation(candles, divergence) {
  const { startIndex, endIndex, direction, type } = divergence;
  
  // Calculate average volume in divergence period
  let sumVolume = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    sumVolume += candles[i].volume;
  }
  const avgVolume = sumVolume / (endIndex - startIndex + 1);
  
  // Calculate average volume before divergence
  const lookback = Math.min(20, startIndex);
  let prevSumVolume = 0;
  for (let i = startIndex - lookback; i < startIndex; i++) {
    prevSumVolume += candles[i].volume;
  }
  const prevAvgVolume = prevSumVolume / lookback;
  
  // For regular divergence, we want increasing volume on reversal
  // For hidden divergence, lower volume is okay
  if (type === 'regular') {
    return avgVolume >= prevAvgVolume * 1.2; // 20% higher volume
  } else {
    return true; // Hidden divergence doesn't require volume confirmation
  }
}

/**
 * Detect divergences across multiple oscillators
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - Detection parameters
 * @returns {Object} Multi-oscillator divergence analysis
 */
function detectMultiOscillatorDivergence(candles, params = {}) {
  const {
    multiOscillatorThreshold = config.divergence.multiOscillatorThreshold,
    volumeConfirmation = config.divergence.volumeConfirmation
  } = params;

  try {
    // Calculate oscillators
    const rsi = calculateRSI(candles);
    const macdHist = calculateMACDHistogram(candles);
    const stoch = calculateStochastic(candles);

    // Detect divergences for each
    const rsiDivs = detectDivergence(candles, rsi, 'RSI', params);
    const macdDivs = detectDivergence(candles, macdHist, 'MACD', params);
    const stochDivs = detectDivergence(candles, stoch, 'Stochastic', params);

    // Add volume confirmation
    if (volumeConfirmation) {
      rsiDivs.forEach(d => d.volumeConfirmed = checkVolumeConfirmation(candles, d));
      macdDivs.forEach(d => d.volumeConfirmed = checkVolumeConfirmation(candles, d));
      stochDivs.forEach(d => d.volumeConfirmed = checkVolumeConfirmation(candles, d));
    }

    // Find multi-oscillator confirmations
    const allDivs = [...rsiDivs, ...macdDivs, ...stochDivs];
    const confirmedSignals = [];

    // Group by approximate end time and direction
    const grouped = {};
    for (const div of allDivs) {
      const key = `${div.direction}_${div.type}_${Math.floor(div.endIndex / 3)}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(div);
    }

    // Find groups with multiple oscillator agreement
    for (const [key, divs] of Object.entries(grouped)) {
      const oscillators = new Set(divs.map(d => d.oscillator));
      if (oscillators.size >= multiOscillatorThreshold) {
        confirmedSignals.push({
          type: divs[0].type,
          direction: divs[0].direction,
          oscillators: Array.from(oscillators),
          count: oscillators.size,
          avgStrength: divs.reduce((sum, d) => sum + d.strength, 0) / divs.length,
          timestamp: divs[0].timestamp,
          endIndex: Math.max(...divs.map(d => d.endIndex)),
          volumeConfirmed: divs.some(d => d.volumeConfirmed)
        });
      }
    }

    logger.debug('Multi-oscillator divergence detection complete', {
      rsi: rsiDivs.length,
      macd: macdDivs.length,
      stoch: stochDivs.length,
      confirmed: confirmedSignals.length
    });

    return {
      rsi: rsiDivs,
      macd: macdDivs,
      stochastic: stochDivs,
      all: allDivs,
      confirmed: confirmedSignals,
      hasStrongSignal: confirmedSignals.some(s => s.count >= 3 && s.avgStrength > 0.5)
    };

  } catch (error) {
    logger.error('Multi-oscillator divergence detection failed', { error: error.message });
    throw error;
  }
}

/**
 * Complete divergence analysis
 * @param {Object[]} candles - OHLCV candles
 * @param {Object} params - Analysis parameters
 * @returns {Object} Complete divergence analysis
 */
function analyzeDivergences(candles, params = {}) {
  const startTime = Date.now();

  try {
    const result = detectMultiOscillatorDivergence(candles, params);

    // Get most recent signal
    let currentSignal = null;
    if (result.confirmed.length > 0) {
      const recent = result.confirmed.sort((a, b) => b.endIndex - a.endIndex)[0];
      if (recent.endIndex >= candles.length - 5) {
        currentSignal = recent;
      }
    }

    const analysis = {
      ...result,
      currentSignal,
      summary: {
        totalDivergences: result.all.length,
        regularBullish: result.all.filter(d => d.type === 'regular' && d.direction === 'bullish').length,
        regularBearish: result.all.filter(d => d.type === 'regular' && d.direction === 'bearish').length,
        hiddenBullish: result.all.filter(d => d.type === 'hidden' && d.direction === 'bullish').length,
        hiddenBearish: result.all.filter(d => d.type === 'hidden' && d.direction === 'bearish').length,
        multiOscillatorConfirmed: result.confirmed.length
      },
      timestamp: new Date(),
      performance: Date.now() - startTime
    };

    logger.info('Divergence analysis complete', {
      total: analysis.summary.totalDivergences,
      confirmed: analysis.summary.multiOscillatorConfirmed,
      hasSignal: !!currentSignal
    });

    return analysis;

  } catch (error) {
    logger.error('Divergence analysis failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  findPivots,
  calculateRSI,
  calculateMACDHistogram,
  calculateStochastic,
  detectDivergence,
  calculateDivergenceStrength,
  checkVolumeConfirmation,
  detectMultiOscillatorDivergence,
  analyzeDivergences
};
