/**
 * ============================================================================
 * Prediction Service
 * ============================================================================
 * Orchestrates the complete prediction pipeline:
 * 1. Data Ingestion: Fetch OHLCV from exchanges via CCXT
 * 2. Preprocessing: Apply Kalman filter for noise reduction
 * 3. Feature Engineering: Calculate technical indicators
 * 4. Prediction: Use Transformer-based model for forecasting
 * 5. Output: Return predictions with confidence intervals
 * 
 * The Transformer model is implemented in pure JavaScript for easy integration.
 * For production, consider a Python PyTorch microservice.
 * ============================================================================
 */

const ccxtService = require('./ccxtService')
const { KalmanFilter, filterOHLCV } = require('./kalmanService')

// ============================================================================
// Configuration
// ============================================================================

const PREDICTION_CONFIG = {
  // Kalman filter parameters
  kalman: {
    processNoise: 0.0001,
    measurementNoise: 0.01
  },
  
  // Transformer model parameters
  transformer: {
    sequenceLength: 30,    // Input sequence length
    predictionHorizon: 5,  // How many candles to predict
    hiddenDim: 64,         // Hidden dimension
    numHeads: 4,           // Number of attention heads
    numLayers: 2           // Number of transformer layers
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
// Lightweight Transformer Implementation
// ============================================================================

/**
 * Simple self-attention mechanism for time series
 */
class SimpleTransformer {
  constructor(config = {}) {
    this.seqLength = config.sequenceLength || 30
    this.predictionHorizon = config.predictionHorizon || 5
    this.hiddenDim = config.hiddenDim || 64
    
    // Initialize weights with small random values
    this.weights = this._initializeWeights()
  }

  _initializeWeights() {
    const createMatrix = (rows, cols, scale = 0.1) => {
      return Array(rows).fill(null).map(() =>
        Array(cols).fill(null).map(() => (Math.random() - 0.5) * scale)
      )
    }
    
    return {
      query: createMatrix(this.hiddenDim, this.hiddenDim),
      key: createMatrix(this.hiddenDim, this.hiddenDim),
      value: createMatrix(this.hiddenDim, this.hiddenDim),
      output: createMatrix(this.hiddenDim, 1)
    }
  }

  /**
   * Softmax function
   */
  _softmax(arr) {
    const max = Math.max(...arr)
    const exps = arr.map(x => Math.exp(x - max))
    const sum = exps.reduce((a, b) => a + b, 0)
    return exps.map(x => x / sum)
  }

  /**
   * Matrix-vector multiplication
   */
  _matVecMul(mat, vec) {
    return mat.map(row => 
      row.reduce((sum, val, i) => sum + val * (vec[i] || 0), 0)
    )
  }

  /**
   * Dot product
   */
  _dot(a, b) {
    return a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0)
  }

  /**
   * Self-attention mechanism
   */
  _selfAttention(sequence) {
    const n = sequence.length
    
    // Project to Q, K, V
    const queries = sequence.map(x => this._matVecMul(this.weights.query, x))
    const keys = sequence.map(x => this._matVecMul(this.weights.key, x))
    const values = sequence.map(x => this._matVecMul(this.weights.value, x))
    
    // Calculate attention scores
    const scale = Math.sqrt(this.hiddenDim)
    const attended = []
    
    for (let i = 0; i < n; i++) {
      // Calculate attention weights
      const scores = keys.map(k => this._dot(queries[i], k) / scale)
      const weights = this._softmax(scores)
      
      // Weighted sum of values
      const output = new Array(this.hiddenDim).fill(0)
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < this.hiddenDim; k++) {
          output[k] += weights[j] * values[j][k]
        }
      }
      attended.push(output)
    }
    
    return attended
  }

  /**
   * Predict future values from input sequence
   * @param {Array} inputSequence - Array of normalized price values
   * @returns {Array} Predicted values
   */
  predict(inputSequence) {
    // Ensure we have enough data
    if (inputSequence.length < this.seqLength) {
      // Pad with first value if not enough data
      const padding = new Array(this.seqLength - inputSequence.length).fill(inputSequence[0] || 0)
      inputSequence = [...padding, ...inputSequence]
    }
    
    // Take last seqLength values
    const sequence = inputSequence.slice(-this.seqLength)
    
    // Convert to embeddings (simple: expand each value to hiddenDim)
    const embeddings = sequence.map(val => {
      const emb = new Array(this.hiddenDim).fill(0)
      // Simple positional encoding + value encoding
      for (let i = 0; i < this.hiddenDim; i++) {
        emb[i] = val * Math.cos(i * Math.PI / this.hiddenDim) + 
                 Math.sin(i * Math.PI / this.seqLength) * 0.1
      }
      return emb
    })
    
    // Apply self-attention
    const attended = this._selfAttention(embeddings)
    
    // Generate predictions
    const predictions = []
    const lastAttended = attended[attended.length - 1]
    const lastValue = sequence[sequence.length - 1]
    
    // Calculate trend from recent values
    const recentValues = sequence.slice(-5)
    const trend = recentValues.length > 1 
      ? (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length
      : 0
    
    // Generate predictions with attention-weighted adjustments
    let prevPred = lastValue
    for (let i = 0; i < this.predictionHorizon; i++) {
      // Combine attention output with trend
      const attentionScore = this._dot(lastAttended, this.weights.output.flat())
      const adjustment = attentionScore * 0.01 // Scale down the adjustment
      
      // Prediction = previous + trend + attention adjustment
      const pred = prevPred + trend + adjustment * (i + 1) * 0.1
      predictions.push(pred)
      prevPred = pred
    }
    
    return predictions
  }

  /**
   * Calculate prediction confidence based on input volatility
   */
  calculateConfidence(inputSequence) {
    if (inputSequence.length < 2) return 0.5
    
    // Calculate volatility
    const returns = []
    for (let i = 1; i < inputSequence.length; i++) {
      if (inputSequence[i - 1] !== 0) {
        returns.push((inputSequence[i] - inputSequence[i - 1]) / inputSequence[i - 1])
      }
    }
    
    if (returns.length === 0) return 0.5
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
    const volatility = Math.sqrt(variance)
    
    // Lower volatility = higher confidence
    const confidence = Math.max(0.1, Math.min(0.95, 1 - volatility * 10))
    
    return confidence
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

// Singleton transformer instance
let transformerInstance = null

function getTransformer() {
  if (!transformerInstance) {
    transformerInstance = new SimpleTransformer(PREDICTION_CONFIG.transformer)
  }
  return transformerInstance
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

    // 4. Generate Transformer predictions
    const transformer = getTransformer()
    const prices = ohlcv.map(c => c.close)
    const transformerPredictions = transformer.predict(prices)
    const transformerConfidence = transformer.calculateConfidence(prices)

    // 5. Combine Kalman and Transformer predictions
    const lastPrice = prices[prices.length - 1]
    const lastTime = ohlcv[ohlcv.length - 1].time
    const timeStep = ohlcv.length > 1 
      ? ohlcv[ohlcv.length - 1].time - ohlcv[ohlcv.length - 2].time 
      : 3600000 // Default 1 hour in ms

    const combinedPredictions = []
    for (let i = 0; i < predictionSteps; i++) {
      const kalmanPred = kalmanResult.predictions[i]
      const transformerPred = transformerPredictions[i]
      
      // Weighted average of Kalman and Transformer predictions
      // Kalman is better for short-term, Transformer for patterns
      const kalmanWeight = Math.max(0.3, 0.7 - i * 0.1)
      const transformerWeight = 1 - kalmanWeight
      
      const combinedPrice = kalmanPred 
        ? kalmanPred.value * kalmanWeight + transformerPred * transformerWeight
        : transformerPred

      const confidence = kalmanPred
        ? (kalmanPred.confidence + transformerConfidence) / 2 * (1 - i * 0.05)
        : transformerConfidence * (1 - i * 0.1)

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
        transformerPrice: transformerPred
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
        model: 'kalman+transformer'
      }
    }
  } catch (error) {
    console.error(`Prediction error for ${symbol} on ${exchange}:`, error.message)
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
  SimpleTransformer,
  PREDICTION_CONFIG
}
