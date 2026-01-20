/**
 * ============================================================================
 * Kalman Filter Service
 * ============================================================================
 * Implements the Kalman Filter algorithm for noise reduction in cryptocurrency
 * price signals. The filter estimates the "hidden state" (true price trajectory)
 * from noisy market observations.
 * 
 * State Vector: [price, velocity]
 * - price: current estimated price
 * - velocity: rate of price change (trend)
 * 
 * The filter uses a constant velocity model, assuming price changes at a 
 * relatively constant rate over short periods.
 * 
 * References:
 * - Kalman, R. E. (1960). A New Approach to Linear Filtering and Prediction Problems
 * - Application to financial time series for trend estimation
 * ============================================================================
 */

/**
 * 2D Kalman Filter for price tracking
 * Tracks price and velocity (rate of change)
 */
class KalmanFilter {
  /**
   * Create a new Kalman Filter instance
   * @param {Object} options - Filter configuration
   * @param {number} options.processNoise - Process noise covariance (Q), default 0.0001
   * @param {number} options.measurementNoise - Measurement noise covariance (R), default 0.01
   * @param {number} options.initialPrice - Initial price estimate, default 0
   */
  constructor(options = {}) {
    // Process noise - how much the true state can naturally vary between steps
    // Lower = smoother output, slower to adapt
    // Higher = more responsive, but noisier
    this.Q = options.processNoise || 0.0001
    
    // Measurement noise - noise from exchange data
    // Lower = trust measurements more
    // Higher = trust predictions more
    this.R = options.measurementNoise || 0.01
    
    // State vector [price, velocity]
    this.x = options.initialPrice 
      ? [options.initialPrice, 0] 
      : null
    
    // State covariance matrix (uncertainty in state estimate)
    // Initialized with high uncertainty
    this.P = [
      [1, 0],
      [0, 1]
    ]
    
    // State transition matrix (constant velocity model)
    // x_new = x_old + v * dt
    // v_new = v_old
    this.F = [
      [1, 1],
      [0, 1]
    ]
    
    // Measurement matrix (we only observe price, not velocity)
    this.H = [1, 0]
    
    // History for analysis
    this.history = []
    this.maxHistorySize = 500
  }

  /**
   * Matrix multiplication helper (2x2 * 2x2)
   */
  _matMul2x2(A, B) {
    return [
      [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
      [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]]
    ]
  }

  /**
   * Matrix-vector multiplication (2x2 * 2x1)
   */
  _matVecMul(M, v) {
    return [
      M[0][0] * v[0] + M[0][1] * v[1],
      M[1][0] * v[0] + M[1][1] * v[1]
    ]
  }

  /**
   * Matrix transpose (2x2)
   */
  _transpose(M) {
    return [
      [M[0][0], M[1][0]],
      [M[0][1], M[1][1]]
    ]
  }

  /**
   * Matrix addition (2x2)
   */
  _matAdd(A, B) {
    return [
      [A[0][0] + B[0][0], A[0][1] + B[0][1]],
      [A[1][0] + B[1][0], A[1][1] + B[1][1]]
    ]
  }

  /**
   * Scalar multiplication of matrix
   */
  _matScale(M, s) {
    return [
      [M[0][0] * s, M[0][1] * s],
      [M[1][0] * s, M[1][1] * s]
    ]
  }

  /**
   * Process a new price measurement through the filter
   * @param {number} measurement - The observed price
   * @param {number} timestamp - Unix timestamp of measurement
   * @returns {Object} Filter output with smoothed price, velocity, and confidence
   */
  update(measurement, timestamp = Date.now()) {
    // Initialize state with first measurement
    if (this.x === null) {
      this.x = [measurement, 0]
      this.history.push({
        timestamp,
        measurement,
        smoothedPrice: measurement,
        velocity: 0,
        confidence: 0.5,
        kalmanGain: 0
      })
      return this.getState()
    }

    // ========================================
    // PREDICT STEP (Time Update)
    // ========================================
    
    // Predicted state: x_pred = F * x
    const xPred = this._matVecMul(this.F, this.x)
    
    // Predicted covariance: P_pred = F * P * F' + Q * I
    const FP = this._matMul2x2(this.F, this.P)
    const FT = this._transpose(this.F)
    const FPFT = this._matMul2x2(FP, FT)
    const QI = [[this.Q, 0], [0, this.Q]]
    const PPred = this._matAdd(FPFT, QI)

    // ========================================
    // UPDATE STEP (Measurement Update)  
    // ========================================
    
    // Innovation (measurement residual): y = z - H * x_pred
    const zPred = this.H[0] * xPred[0] + this.H[1] * xPred[1]
    const y = measurement - zPred
    
    // Innovation covariance: S = H * P_pred * H' + R
    const HP = [
      this.H[0] * PPred[0][0] + this.H[1] * PPred[1][0],
      this.H[0] * PPred[0][1] + this.H[1] * PPred[1][1]
    ]
    const S = HP[0] * this.H[0] + HP[1] * this.H[1] + this.R
    
    // Kalman Gain: K = P_pred * H' / S
    const K = [
      (PPred[0][0] * this.H[0] + PPred[0][1] * this.H[1]) / S,
      (PPred[1][0] * this.H[0] + PPred[1][1] * this.H[1]) / S
    ]
    
    // Updated state: x = x_pred + K * y
    this.x = [
      xPred[0] + K[0] * y,
      xPred[1] + K[1] * y
    ]
    
    // Updated covariance: P = (I - K * H) * P_pred
    const KH = [
      [K[0] * this.H[0], K[0] * this.H[1]],
      [K[1] * this.H[0], K[1] * this.H[1]]
    ]
    const I_KH = [
      [1 - KH[0][0], -KH[0][1]],
      [-KH[1][0], 1 - KH[1][1]]
    ]
    this.P = this._matMul2x2(I_KH, PPred)
    
    // Calculate confidence based on Kalman Gain magnitude
    // Higher Kalman Gain = less confidence in predictions
    const confidence = Math.max(0, Math.min(1, 1 - (K[0] * 2)))
    
    // Store in history
    const historyEntry = {
      timestamp,
      measurement,
      smoothedPrice: this.x[0],
      velocity: this.x[1],
      confidence,
      kalmanGain: K[0],
      innovation: y
    }
    
    this.history.push(historyEntry)
    
    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }
    
    return this.getState()
  }

  /**
   * Get current filter state
   * @returns {Object} Current state with price, velocity, and confidence
   */
  getState() {
    if (this.x === null) {
      return {
        smoothedPrice: null,
        velocity: null,
        confidence: 0,
        priceUncertainty: null,
        velocityUncertainty: null
      }
    }
    
    // Calculate confidence from covariance
    const priceStd = Math.sqrt(this.P[0][0])
    const velocityStd = Math.sqrt(this.P[1][1])
    
    return {
      smoothedPrice: this.x[0],
      velocity: this.x[1],
      confidence: Math.max(0, Math.min(1, 1 - priceStd)),
      priceUncertainty: priceStd,
      velocityUncertainty: velocityStd
    }
  }

  /**
   * Get smoothed price
   * @returns {number|null} Current smoothed price estimate
   */
  getSmoothedPrice() {
    return this.x ? this.x[0] : null
  }

  /**
   * Get velocity (rate of price change)
   * @returns {number|null} Current velocity estimate
   */
  getVelocity() {
    return this.x ? this.x[1] : null
  }

  /**
   * Get confidence interval for current price
   * @param {number} sigma - Number of standard deviations (default 2 for 95%)
   * @returns {Object} Confidence interval {lower, upper}
   */
  getConfidenceInterval(sigma = 2) {
    if (this.x === null) {
      return { lower: null, upper: null }
    }
    
    const priceStd = Math.sqrt(this.P[0][0])
    return {
      lower: this.x[0] - sigma * priceStd,
      upper: this.x[0] + sigma * priceStd
    }
  }

  /**
   * Predict future price N steps ahead
   * @param {number} steps - Number of steps to predict
   * @returns {Array} Array of predicted prices with confidence intervals
   */
  predict(steps = 5) {
    if (this.x === null) {
      return []
    }
    
    const predictions = []
    let xPred = [...this.x]
    let PPred = this.P.map(row => [...row])
    
    for (let i = 0; i < steps; i++) {
      // Predict state
      xPred = this._matVecMul(this.F, xPred)
      
      // Predict covariance
      const FP = this._matMul2x2(this.F, PPred)
      const FT = this._transpose(this.F)
      const FPFT = this._matMul2x2(FP, FT)
      const QI = [[this.Q, 0], [0, this.Q]]
      PPred = this._matAdd(FPFT, QI)
      
      const priceStd = Math.sqrt(PPred[0][0])
      predictions.push({
        step: i + 1,
        price: xPred[0],
        velocity: xPred[1],
        confidence: Math.max(0, Math.min(1, 1 - priceStd * (i + 1) * 0.1)),
        lower: xPred[0] - 2 * priceStd,
        upper: xPred[0] + 2 * priceStd
      })
    }
    
    return predictions
  }

  /**
   * Get filter history
   * @param {number} limit - Maximum entries to return
   * @returns {Array} Recent filter history
   */
  getHistory(limit = 100) {
    return this.history.slice(-limit)
  }

  /**
   * Reset filter state
   */
  reset() {
    this.x = null
    this.P = [[1, 0], [0, 1]]
    this.history = []
  }

  /**
   * Get filter statistics
   * @returns {Object} Filter performance statistics
   */
  getStats() {
    if (this.history.length < 2) {
      return {
        samples: this.history.length,
        avgInnovation: 0,
        avgKalmanGain: 0,
        avgConfidence: 0,
        priceReduction: 0
      }
    }
    
    const innovations = this.history.map(h => Math.abs(h.innovation || 0))
    const kalmanGains = this.history.map(h => h.kalmanGain || 0)
    const confidences = this.history.map(h => h.confidence || 0)
    
    // Calculate noise reduction
    const measurements = this.history.map(h => h.measurement)
    const smoothed = this.history.map(h => h.smoothedPrice)
    
    const measurementVar = this._variance(measurements)
    const smoothedVar = this._variance(smoothed)
    const noiseReduction = measurementVar > 0 
      ? ((measurementVar - smoothedVar) / measurementVar) * 100 
      : 0
    
    return {
      samples: this.history.length,
      avgInnovation: innovations.reduce((a, b) => a + b, 0) / innovations.length,
      avgKalmanGain: kalmanGains.reduce((a, b) => a + b, 0) / kalmanGains.length,
      avgConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
      noiseReduction: Math.max(0, noiseReduction)
    }
  }

  /**
   * Calculate variance of an array
   * @private
   */
  _variance(arr) {
    if (arr.length === 0) return 0
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length
    return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length
  }
}

/**
 * Process OHLCV data through Kalman filter
 * @param {Array} ohlcv - Array of OHLCV candles [{time, open, high, low, close, volume}]
 * @param {Object} options - Filter options
 * @returns {Object} Filtered data with original and smoothed series
 */
function filterOHLCV(ohlcv, options = {}) {
  const filter = new KalmanFilter({
    processNoise: options.processNoise || 0.0001,
    measurementNoise: options.measurementNoise || 0.01
  })
  
  const result = {
    original: [],
    filtered: [],
    velocity: [],
    confidence: [],
    predictions: []
  }
  
  // Process each candle
  for (const candle of ohlcv) {
    const state = filter.update(candle.close, candle.time)
    
    result.original.push({
      time: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume
    })
    
    result.filtered.push({
      time: candle.time,
      value: state.smoothedPrice
    })
    
    result.velocity.push({
      time: candle.time,
      value: state.velocity
    })
    
    result.confidence.push({
      time: candle.time,
      value: state.confidence
    })
  }
  
  // Generate predictions for future candles
  const predictions = filter.predict(options.predictionSteps || 5)
  const lastTime = ohlcv[ohlcv.length - 1]?.time || Date.now()
  const timeStep = ohlcv.length > 1 
    ? ohlcv[ohlcv.length - 1].time - ohlcv[ohlcv.length - 2].time 
    : 3600 // Default 1 hour
  
  result.predictions = predictions.map((pred, i) => ({
    time: lastTime + (i + 1) * timeStep,
    value: pred.price,
    lower: pred.lower,
    upper: pred.upper,
    confidence: pred.confidence
  }))
  
  result.stats = filter.getStats()
  result.finalState = filter.getState()
  
  return result
}

module.exports = {
  KalmanFilter,
  filterOHLCV
}
