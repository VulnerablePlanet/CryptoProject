/**
 * ============================================================================
 * DATA CLEANER - Phase 2
 * ============================================================================
 * Detect and handle anomalous data to prevent false signals.
 */

/**
 * Detect price spikes using IQR method
 * @param {object[]} candles - Array of OHLCV candles
 * @param {number} threshold - IQR multiplier (default: 3)
 * @returns {object[]} Candles with spike flags
 */
const detectSpikes = (candles, threshold = 3) => {
  if (!candles || candles.length < 10) return candles

  // Calculate returns
  const returns = []
  for (let i = 1; i < candles.length; i++) {
    const ret = (candles[i].close - candles[i - 1].close) / candles[i - 1].close
    returns.push({ index: i, return: ret })
  }
  
  // Calculate IQR
  const sorted = [...returns].sort((a, b) => a.return - b.return)
  const q1 = sorted[Math.floor(sorted.length * 0.25)].return
  const q3 = sorted[Math.floor(sorted.length * 0.75)].return
  const iqr = q3 - q1
  
  const lowerBound = q1 - (threshold * iqr)
  const upperBound = q3 + (threshold * iqr)
  
  // Flag spikes
  return candles.map((candle, idx) => {
    if (idx === 0) return { ...candle, isSpike: false, spikeScore: 0 }
    
    const ret = returns.find(r => r.index === idx)?.return || 0
    const isSpike = ret < lowerBound || ret > upperBound
    const spikeScore = isSpike ? Math.abs(ret - (ret > 0 ? upperBound : lowerBound)) / iqr : 0
    
    return { ...candle, isSpike, spikeScore }
  })
}

/**
 * Detect candles with zero or missing volume
 * @param {object[]} candles - Array of OHLCV candles
 * @returns {object[]} Candles with volume flags
 */
const detectZeroVolume = (candles) => {
  if (!candles) return []
  
  return candles.map(candle => ({
    ...candle,
    hasZeroVolume: !candle.volume || candle.volume === 0
  }))
}

/**
 * Detect corrupted candles (OHLC logical errors)
 * @param {object[]} candles - Array of OHLCV candles
 * @returns {object[]} Candles with corruption flags
 */
const detectCorruptedCandles = (candles) => {
  if (!candles) return []
  
  return candles.map(candle => {
    const issues = []
    
    // High should be >= Low
    if (candle.high < candle.low) {
      issues.push('high_below_low')
    }
    
    // High should be >= Open and Close
    if (candle.high < candle.open || candle.high < candle.close) {
      issues.push('high_not_highest')
    }
    
    // Low should be <= Open and Close
    if (candle.low > candle.open || candle.low > candle.close) {
      issues.push('low_not_lowest')
    }
    
    // Price should be positive
    if (candle.close <= 0 || candle.open <= 0) {
      issues.push('negative_price')
    }
    
    return {
      ...candle,
      isCorrupted: issues.length > 0,
      corruptionIssues: issues
    }
  })
}

/**
 * Mark all data quality issues
 * @param {object[]} candles - Array of OHLCV candles
 * @returns {object[]} Candles with all quality flags
 */
const markDataQuality = (candles) => {
  if (!candles || candles.length === 0) return []
  
  let result = detectSpikes(candles)
  result = result.map((c, i) => ({
    ...c,
    ...detectZeroVolume([candles[i]])[0],
    ...detectCorruptedCandles([candles[i]])[0]
  }))
  
  // Add overall quality score
  return result.map(c => ({
    ...c,
    qualityScore: calculateQualityScore(c),
    usableForAnalysis: !c.isSpike && !c.isCorrupted
  }))
}

/**
 * Calculate quality score (0-100)
 */
const calculateQualityScore = (candle) => {
  let score = 100
  
  if (candle.isSpike) score -= 30
  if (candle.hasZeroVolume) score -= 20
  if (candle.isCorrupted) score -= 50
  
  return Math.max(0, score)
}

/**
 * Smooth data using simple moving average
 * @param {object[]} candles - Array of candles
 * @param {number} period - Smoothing period
 * @returns {object[]} Smoothed candles (original preserved)
 */
const smoothData = (candles, period = 3) => {
  if (!candles || candles.length < period) return candles
  
  return candles.map((candle, idx) => {
    if (idx < period - 1) {
      return { ...candle, smoothedClose: candle.close }
    }
    
    let sum = 0
    for (let i = 0; i < period; i++) {
      sum += candles[idx - i].close
    }
    
    return {
      ...candle,
      smoothedClose: sum / period,
      originalClose: candle.close
    }
  })
}

/**
 * Filter out bad data for analysis
 * @param {object[]} candles - Candles with quality marks
 * @returns {object[]} Clean candles only
 */
const filterCleanData = (candles) => {
  return candles.filter(c => c.usableForAnalysis !== false)
}

/**
 * Get data quality summary
 * @param {object[]} markedCandles - Candles with quality marks
 * @returns {object} Summary statistics
 */
const getDataQualitySummary = (markedCandles) => {
  const total = markedCandles.length
  const spikes = markedCandles.filter(c => c.isSpike).length
  const zeroVolume = markedCandles.filter(c => c.hasZeroVolume).length
  const corrupted = markedCandles.filter(c => c.isCorrupted).length
  const usable = markedCandles.filter(c => c.usableForAnalysis).length
  
  return {
    total,
    spikes,
    zeroVolume,
    corrupted,
    usable,
    usablePercent: total > 0 ? ((usable / total) * 100).toFixed(2) : 0,
    averageQualityScore: total > 0 
      ? (markedCandles.reduce((sum, c) => sum + (c.qualityScore || 100), 0) / total).toFixed(2)
      : 100
  }
}

module.exports = {
  detectSpikes,
  detectZeroVolume,
  detectCorruptedCandles,
  markDataQuality,
  smoothData,
  filterCleanData,
  getDataQualitySummary
}
