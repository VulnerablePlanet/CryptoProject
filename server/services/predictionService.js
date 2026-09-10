/**
 * ============================================================================
 * Prediction Service
 * ============================================================================
 * Orchestrates the complete prediction pipeline:
 * 1. Data Ingestion: Fetch OHLCV from exchanges via CCXT
 * 2. Preprocessing: Apply Kalman filter for noise reduction
 * 3. Feature Engineering: Calculate technical indicators
 * 4. Prediction: Combine Kalman filter with Holt-Winters exponential smoothing
 * 5. Output: Return predictions with confidence intervals
 *
 * Forecasting uses Holt's linear trend method (double exponential smoothing),
 * a deterministic statistical model — as opposed to the previous pseudo-random
 * "Transformer" that produced different outputs on every server restart.
 * ============================================================================
 */

const ccxtService = require('./ccxtService')
const { KalmanFilter, filterOHLCV } = require('./kalmanService')
const { createLogger } = require('../utils/logger')

const logger = createLogger('services:prediction')

// ============================================================================
// Configuration
// ============================================================================

const PREDICTION_CONFIG = {
  // Kalman filter parameters
  kalman: {
    processNoise: 0.0001,
    measurementNoise: 0.01
  },

  // Holt-Winters (Holt linear trend) forecasting parameters
  holtWinters: {
    alpha: 0.25,           // Level smoothing factor
    beta: 0.10,            // Trend smoothing factor
    predictionHorizon: 5   // How many candles to predict
  },

  // Feature engineering
  features: {
    useReturns: true,      // Use log returns
    useVolume: true,       // Include volume features
    useVolatility: true,   // Include volatility features
    useMomentum: true      // Include momentum features
  }
}

// ============================================================================
// Holt-Winters (Holt linear trend) forecasting
// ============================================================================

/**
 * Deterministic time-series forecaster using Holt's linear trend method
 * (double exponential smoothing). Unlike the previous "Transformer" (which
 * seeded its weights with Math.random and produced different forecasts on
 * every run), this model is fully reproducible and statistically grounded.
 */
class HoltWintersForecaster {
  constructor(config = {}) {
    this.alpha = config.alpha ?? 0.25 // Level smoothing factor
    this.beta = config.beta ?? 0.10   // Trend smoothing factor
    this.predictionHorizon = config.predictionHorizon || 5
  }

  /**
   * Fit level + trend via double exponential smoothing.
   * @param {Array<number>} series - Historical values (chronological order)
   * @returns {{ level: number, trend: number }} Final smoothed state
   */
  _fit(series) {
    if (series.length === 0) return { level: 0, trend: 0 }
    if (series.length === 1) return { level: series[0], trend: 0 }

    let level = series[0]
    let trend = series[1] - series[0]

    for (let i = 1; i < series.length; i++) {
      const prevLevel = level
      level = this.alpha * series[i] + (1 - this.alpha) * (prevLevel + trend)
      trend = this.beta * (level - prevLevel) + (1 - this.beta) * trend
    }

    return { level, trend }
  }

  /**
   * Predict future values from an input sequence.
   * @param {Array<number>} inputSequence - Historical values (chronological)
   * @returns {Array<number>} Predicted values (length = predictionHorizon)
   */
  predict(inputSequence) {
    const series = inputSequence.slice()
    const { level, trend } = this._fit(series)

    const predictions = []
    for (let h = 1; h <= this.predictionHorizon; h++) {
      predictions.push(level + trend * h)
    }
    return predictions
  }

  /**
   * Confidence derived from one-step-ahead in-sample error (RMSE normalized by
   * price level) combined with volatility. Lower error + lower volatility →
   * higher confidence. Fully deterministic.
   * @param {Array<number>} inputSequence - Historical values
   * @returns {number} Confidence in [0.1, 0.95]
   */
  calculateConfidence(inputSequence) {
    const series = inputSequence.slice()
    if (series.length < 3) return 0.5

    // One-step-ahead in-sample forecasts via Holt's method.
    let level = series[0]
    let trend = series[1] - series[0]
    const squaredErrors = []

    for (let i = 1; i < series.length; i++) {
      const prevLevel = level
      level = this.alpha * series[i] + (1 - this.alpha) * (prevLevel + trend)
      trend = this.beta * (level - prevLevel) + (1 - this.beta) * trend

      const oneStepForecast = prevLevel + trend
      squaredErrors.push(Math.pow(series[i] - oneStepForecast, 2))
    }

    const rmse = Math.sqrt(squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length)
    const meanPrice = series.reduce((a, b) => a + b, 0) / series.length

    // Normalized error — lower is better. Clamp to avoid division by zero.
    const normalizedError = meanPrice > 0 ? rmse / meanPrice : 1
    const confidence = 1 / (1 + normalizedError)

    return Math.max(0.1, Math.min(0.95, confidence))
  }
}

// ============================================================================
// Feature Engineering
// ============================================================================

/**
 * Calculate technical features from OHLCV data
 */
function calculateFeatures(ohlcv) {
  if (ohlcv.length < 2) {
    return { returns: [], volatility: 0, momentum: 0, volumeRatio: 1 }
  }

  // Log returns
  const returns = []
  for (let i = 1; i < ohlcv.length; i++) {
    const prev = ohlcv[i - 1].close
    const curr = ohlcv[i].close
    if (prev > 0) {
      returns.push(Math.log(curr / prev))
    }
  }

  // Volatility (standard deviation of returns)
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
  const volatility = Math.sqrt(variance)

  // Momentum (recent vs older prices)
  const recentPrices = ohlcv.slice(-5).map(c => c.close)
  const olderPrices = ohlcv.slice(-20, -5).map(c => c.close)
  const recentAvg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length
  const olderAvg = olderPrices.length > 0 
    ? olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length 
    : recentAvg
  const momentum = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0

  // Volume ratio (recent vs average)
  const recentVolume = ohlcv.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5
  const avgVolume = ohlcv.reduce((sum, c) => sum + c.volume, 0) / ohlcv.length
  const volumeRatio = avgVolume > 0 ? recentVolume / avgVolume : 1

  return {
    returns,
    volatility,
    momentum,
    volumeRatio,
    lastPrice: ohlcv[ohlcv.length - 1].close,
    priceChange24h: ohlcv.length >= 24 
      ? (ohlcv[ohlcv.length - 1].close - ohlcv[ohlcv.length - 24].close) / ohlcv[ohlcv.length - 24].close
      : 0
  }
}

// ============================================================================
// Main Prediction Functions
// ============================================================================

// Singleton forecaster instance
let forecasterInstance = null

function getForecaster() {
  if (!forecasterInstance) {
    forecasterInstance = new HoltWintersForecaster(PREDICTION_CONFIG.holtWinters)
  }
  return forecasterInstance
}

/**
 * Get complete prediction for a trading pair
 * @param {string} exchange - Exchange ID (e.g., 'binance')
 * @param {string} symbol - Trading pair (e.g., 'BTC/USDT')
 * @param {string} timeframe - Candle timeframe (e.g., '1h')
 * @param {Object} options - Additional options
 * @returns {Object} Complete prediction result
 */
async function getPrediction(exchange, symbol, timeframe = '1h', options = {}) {
  const limit = options.limit || 100
  const predictionSteps = options.predictionSteps || 5

  try {
    // 1. Fetch OHLCV data from exchange via CCXT
    const result = await ccxtService.fetchOHLCV(exchange, symbol, timeframe, limit)
    
    if (!result.candles || result.candles.length === 0) {
      throw new Error(`No data available for ${symbol} on ${exchange}`)
    }

    const ohlcv = result.candles

    // 2. Apply Kalman filter for noise reduction
    const kalmanResult = filterOHLCV(ohlcv, {
      processNoise: PREDICTION_CONFIG.kalman.processNoise,
      measurementNoise: PREDICTION_CONFIG.kalman.measurementNoise,
      predictionSteps
    })

    // 3. Calculate technical features
    const features = calculateFeatures(ohlcv)

    // 4. Generate Holt-Winters forecasts
    const forecaster = getForecaster()
    const prices = ohlcv.map(c => c.close)
    const holtWintersPredictions = forecaster.predict(prices)
    const holtWintersConfidence = forecaster.calculateConfidence(prices)

    // 5. Combine Kalman and Holt-Winters predictions
    const lastPrice = prices[prices.length - 1]
    const lastTime = ohlcv[ohlcv.length - 1].time
    const timeStep = ohlcv.length > 1 
      ? ohlcv[ohlcv.length - 1].time - ohlcv[ohlcv.length - 2].time 
      : 3600000 // Default 1 hour in ms

    const combinedPredictions = []
    for (let i = 0; i < predictionSteps; i++) {
      const kalmanPred = kalmanResult.predictions[i]
      const holtWintersPred = holtWintersPredictions[i]
      
      // Weighted average of Kalman and Holt-Winters predictions
      // Kalman is better for short-term, Holt-Winters for trend continuation
      const kalmanWeight = Math.max(0.3, 0.7 - i * 0.1)
      const holtWintersWeight = 1 - kalmanWeight
      
      const combinedPrice = kalmanPred 
        ? kalmanPred.value * kalmanWeight + holtWintersPred * holtWintersWeight
        : holtWintersPred

      const confidence = kalmanPred
        ? (kalmanPred.confidence + holtWintersConfidence) / 2 * (1 - i * 0.05)
        : holtWintersConfidence * (1 - i * 0.1)

      // Calculate bounds
      const uncertainty = lastPrice * (1 - confidence) * 0.05 * (i + 1)
      
      combinedPredictions.push({
        time: lastTime + (i + 1) * timeStep,
        step: i + 1,
        price: combinedPrice,
        priceChange: ((combinedPrice - lastPrice) / lastPrice) * 100,
        lower: combinedPrice - uncertainty,
        upper: combinedPrice + uncertainty,
        confidence: Math.max(0.1, Math.min(0.99, confidence)),
        kalmanPrice: kalmanPred?.value || null,
        holtWintersPrice: holtWintersPred
      })
    }

    // 6. Determine overall direction
    const avgPredictedPrice = combinedPredictions.reduce((sum, p) => sum + p.price, 0) / combinedPredictions.length
    const direction = avgPredictedPrice > lastPrice ? 'LONG' : avgPredictedPrice < lastPrice ? 'SHORT' : 'NEUTRAL'
    const directionConfidence = Math.abs(avgPredictedPrice - lastPrice) / lastPrice

    // 7. Build response
    return {
      success: true,
      exchange,
      symbol,
      timeframe,
      timestamp: Date.now(),
      
      // Current state
      current: {
        price: lastPrice,
        time: lastTime,
        volume: ohlcv[ohlcv.length - 1].volume
      },
      
      // Kalman filtered data
      kalman: {
        smoothedData: kalmanResult.filtered,
        velocity: kalmanResult.velocity,
        stats: kalmanResult.stats,
        finalState: kalmanResult.finalState
      },
      
      // Technical features
      features,
      
      // Predictions
      predictions: combinedPredictions,
      
      // Summary
      summary: {
        direction,
        directionConfidence: Math.min(0.99, directionConfidence * 10),
        avgConfidence: combinedPredictions.reduce((sum, p) => sum + p.confidence, 0) / combinedPredictions.length,
        expectedChange: ((avgPredictedPrice - lastPrice) / lastPrice) * 100,
        volatility: features.volatility,
        momentum: features.momentum
      },
      
      // Original data (for charting)
      ohlcv: ohlcv,
      
      // Metadata
      metadata: {
        dataPoints: ohlcv.length,
        predictionHorizon: predictionSteps,
        fromCache: result.fromCache,
        model: 'kalman+holt-winters'
      }
    }
  } catch (error) {
    logger.error('Prediction error', error, { exchange, symbol, timeframe })
    return {
      success: false,
      error: error.message,
      exchange,
      symbol,
      timeframe
    }
  }
}

/**
 * Get Kalman-filtered data only (faster, no ML)
 */
async function getKalmanFiltered(exchange, symbol, timeframe = '1h', limit = 100) {
  try {
    const result = await ccxtService.fetchOHLCV(exchange, symbol, timeframe, limit)
    
    if (!result.candles || result.candles.length === 0) {
      throw new Error(`No data available for ${symbol} on ${exchange}`)
    }

    const kalmanResult = filterOHLCV(result.candles, PREDICTION_CONFIG.kalman)

    return {
      success: true,
      exchange,
      symbol,
      timeframe,
      timestamp: Date.now(),
      original: result.candles,
      filtered: kalmanResult.filtered,
      velocity: kalmanResult.velocity,
      confidence: kalmanResult.confidence,
      stats: kalmanResult.stats,
      fromCache: result.fromCache
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      exchange,
      symbol,
      timeframe
    }
  }
}

/**
 * Get quick forecast without full analysis
 */
async function getQuickForecast(exchange, symbol, timeframe = '1h', steps = 3) {
  try {
    const result = await ccxtService.fetchOHLCV(exchange, symbol, timeframe, 50)
    
    if (!result.candles || result.candles.length === 0) {
      throw new Error(`No data available for ${symbol} on ${exchange}`)
    }

    const ohlcv = result.candles
    const prices = ohlcv.map(c => c.close)
    const lastPrice = prices[prices.length - 1]
    
    // Simple Kalman prediction
    const filter = new KalmanFilter(PREDICTION_CONFIG.kalman)
    prices.forEach(p => filter.update(p))
    const kalmanPredictions = filter.predict(steps)

    return {
      success: true,
      exchange,
      symbol,
      timeframe,
      currentPrice: lastPrice,
      predictions: kalmanPredictions.map(p => ({
        step: p.step,
        price: p.price,
        change: ((p.price - lastPrice) / lastPrice) * 100,
        confidence: p.confidence
      })),
      direction: kalmanPredictions[0].price > lastPrice ? 'UP' : 'DOWN'
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      exchange,
      symbol,
      timeframe
    }
  }
}

module.exports = {
  getPrediction,
  getKalmanFiltered,
  getQuickForecast,
  calculateFeatures,
  HoltWintersForecaster,
  PREDICTION_CONFIG
}
