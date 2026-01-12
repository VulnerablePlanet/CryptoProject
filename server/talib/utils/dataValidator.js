/**
 * Data Validator
 * Validates input data for TA-Lib functions
 */

/**
 * Validate OHLCV candle data
 * @param {Object|Object[]} data - Single candle or array of candles
 * @returns {{valid: boolean, error: string|null}}
 */
function validateOHLCV(data) {
  const candles = Array.isArray(data) ? data : [data];
  
  if (candles.length === 0) {
    return { valid: false, error: 'Empty candle array' };
  }
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    
    if (!candle) {
      return { valid: false, error: `Candle at index ${i} is null/undefined` };
    }
    
    const required = ['open', 'high', 'low', 'close', 'volume'];
    for (const field of required) {
      if (typeof candle[field] !== 'number' || isNaN(candle[field])) {
        return { valid: false, error: `Invalid ${field} at index ${i}` };
      }
    }
    
    // Validate high is highest
    if (candle.high < candle.low) {
      return { valid: false, error: `High < Low at index ${i}` };
    }
    
    if (candle.high < candle.open || candle.high < candle.close) {
      return { valid: false, error: `High not highest at index ${i}` };
    }
    
    // Validate low is lowest
    if (candle.low > candle.open || candle.low > candle.close) {
      return { valid: false, error: `Low not lowest at index ${i}` };
    }
    
    // Validate volume is positive
    if (candle.volume < 0) {
      return { valid: false, error: `Negative volume at index ${i}` };
    }
  }
  
  return { valid: true, error: null };
}

/**
 * Validate order book data
 * @param {Object} orderbook - Order book with bids and asks
 * @returns {{valid: boolean, error: string|null}}
 */
function validateOrderBook(orderbook) {
  if (!orderbook) {
    return { valid: false, error: 'Order book is null/undefined' };
  }
  
  if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
    return { valid: false, error: 'Bids and asks must be arrays' };
  }
  
  if (orderbook.bids.length === 0 || orderbook.asks.length === 0) {
    return { valid: false, error: 'Empty bids or asks' };
  }
  
  // Validate bid format [price, size]
  for (let i = 0; i < orderbook.bids.length; i++) {
    const bid = orderbook.bids[i];
    if (!Array.isArray(bid) || bid.length < 2) {
      return { valid: false, error: `Invalid bid format at index ${i}` };
    }
    if (typeof bid[0] !== 'number' || typeof bid[1] !== 'number') {
      return { valid: false, error: `Invalid bid values at index ${i}` };
    }
  }
  
  // Validate ask format [price, size]
  for (let i = 0; i < orderbook.asks.length; i++) {
    const ask = orderbook.asks[i];
    if (!Array.isArray(ask) || ask.length < 2) {
      return { valid: false, error: `Invalid ask format at index ${i}` };
    }
    if (typeof ask[0] !== 'number' || typeof ask[1] !== 'number') {
      return { valid: false, error: `Invalid ask values at index ${i}` };
    }
  }
  
  // Validate bid/ask spread
  const bestBid = orderbook.bids[0][0];
  const bestAsk = orderbook.asks[0][0];
  
  if (bestBid >= bestAsk) {
    return { valid: false, error: 'Best bid >= best ask (crossed market)' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate trades data
 * @param {Object[]} trades - Array of trade objects
 * @returns {{valid: boolean, error: string|null}}
 */
function validateTrades(trades) {
  if (!Array.isArray(trades)) {
    return { valid: false, error: 'Trades must be an array' };
  }
  
  if (trades.length === 0) {
    return { valid: false, error: 'Empty trades array' };
  }
  
  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    
    if (!trade) {
      return { valid: false, error: `Trade at index ${i} is null/undefined` };
    }
    
    if (typeof trade.price !== 'number' || isNaN(trade.price)) {
      return { valid: false, error: `Invalid price at index ${i}` };
    }
    
    if (typeof trade.amount !== 'number' || isNaN(trade.amount)) {
      return { valid: false, error: `Invalid amount at index ${i}` };
    }
    
    if (!['buy', 'sell'].includes(trade.side)) {
      return { valid: false, error: `Invalid side at index ${i}` };
    }
  }
  
  return { valid: true, error: null };
}

/**
 * Validate period parameter
 * @param {number} period - Period value
 * @param {number} dataLength - Length of data array
 * @returns {{valid: boolean, error: string|null}}
 */
function validatePeriod(period, dataLength) {
  if (typeof period !== 'number' || isNaN(period)) {
    return { valid: false, error: 'Period must be a number' };
  }
  
  if (period <= 0) {
    return { valid: false, error: 'Period must be positive' };
  }
  
  if (!Number.isInteger(period)) {
    return { valid: false, error: 'Period must be an integer' };
  }
  
  if (period > dataLength) {
    return { valid: false, error: `Period (${period}) exceeds data length (${dataLength})` };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate symbol format
 * @param {string} symbol - Trading symbol (e.g., 'BTC/USDT')
 * @returns {{valid: boolean, error: string|null}}
 */
function validateSymbol(symbol) {
  if (typeof symbol !== 'string') {
    return { valid: false, error: 'Symbol must be a string' };
  }
  
  if (symbol.length === 0) {
    return { valid: false, error: 'Symbol cannot be empty' };
  }
  
  // Basic format check (BASE/QUOTE)
  if (!symbol.includes('/')) {
    return { valid: false, error: 'Symbol must be in BASE/QUOTE format' };
  }
  
  const parts = symbol.split('/');
  if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
    return { valid: false, error: 'Invalid symbol format' };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate timeframe
 * @param {string} timeframe - Timeframe string (e.g., '1h', '4h', '1d')
 * @returns {{valid: boolean, error: string|null}}
 */
function validateTimeframe(timeframe) {
  const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d', '3d', '1w'];
  
  if (typeof timeframe !== 'string') {
    return { valid: false, error: 'Timeframe must be a string' };
  }
  
  if (!validTimeframes.includes(timeframe)) {
    return { valid: false, error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}` };
  }
  
  return { valid: true, error: null };
}

/**
 * Validate numeric value in range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {string} name - Name of the parameter
 * @returns {{valid: boolean, error: string|null}}
 */
function validateRange(value, min, max, name = 'value') {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: `${name} must be a number` };
  }
  
  if (value < min || value > max) {
    return { valid: false, error: `${name} must be between ${min} and ${max}` };
  }
  
  return { valid: true, error: null };
}

/**
 * Sanitize and validate indicator parameters
 * @param {Object} params - Indicator parameters
 * @param {Object} schema - Validation schema
 * @returns {{valid: boolean, error: string|null, sanitized: Object}}
 */
function validateParams(params, schema) {
  const sanitized = {};
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = params[key];
    
    // Check required
    if (rules.required && (value === undefined || value === null)) {
      return { valid: false, error: `Missing required parameter: ${key}`, sanitized: null };
    }
    
    // Use default if not provided
    if (value === undefined || value === null) {
      sanitized[key] = rules.default;
      continue;
    }
    
    // Type check
    if (rules.type && typeof value !== rules.type) {
      return { valid: false, error: `Invalid type for ${key}: expected ${rules.type}`, sanitized: null };
    }
    
    // Range check
    if (rules.min !== undefined && value < rules.min) {
      return { valid: false, error: `${key} must be >= ${rules.min}`, sanitized: null };
    }
    
    if (rules.max !== undefined && value > rules.max) {
      return { valid: false, error: `${key} must be <= ${rules.max}`, sanitized: null };
    }
    
    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      return { valid: false, error: `${key} must be one of: ${rules.enum.join(', ')}`, sanitized: null };
    }
    
    sanitized[key] = value;
  }
  
  return { valid: true, error: null, sanitized };
}

module.exports = {
  validateOHLCV,
  validateOrderBook,
  validateTrades,
  validatePeriod,
  validateSymbol,
  validateTimeframe,
  validateRange,
  validateParams
};
