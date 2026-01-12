/**
 * Regime Cache
 * Caches regime detection results to avoid recalculation
 */

const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('RegimeCache');

class RegimeCache {
  constructor(ttl = config.regime.cache.ttl) {
    this.cache = new Map();
    this.ttl = ttl; // Time to live in milliseconds
  }

  /**
   * Generate cache key
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe
   * @returns {string} Cache key
   */
  _getKey(symbol, timeframe) {
    return `${symbol}:${timeframe}`;
  }

  /**
   * Get cached regime
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe
   * @returns {Object|null} Cached regime or null if expired/not found
   */
  get(symbol, timeframe) {
    const key = this._getKey(symbol, timeframe);
    const cached = this.cache.get(key);

    if (!cached) {
      logger.debug('Cache miss', { symbol, timeframe });
      return null;
    }

    const age = Date.now() - cached.timestamp;
    
    if (age > this.ttl) {
      logger.debug('Cache expired', { symbol, timeframe, age });
      this.cache.delete(key);
      return null;
    }

    logger.debug('Cache hit', { symbol, timeframe, age });
    return cached.data;
  }

  /**
   * Set cached regime
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe
   * @param {Object} data - Regime data
   */
  set(symbol, timeframe, data) {
    const key = this._getKey(symbol, timeframe);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    logger.debug('Cache set', { symbol, timeframe });
  }

  /**
   * Invalidate cache for symbol/timeframe
   * @param {string} symbol - Trading symbol
   * @param {string} timeframe - Timeframe (optional, clears all timeframes if not provided)
   */
  invalidate(symbol, timeframe = null) {
    if (timeframe) {
      const key = this._getKey(symbol, timeframe);
      this.cache.delete(key);
      logger.debug('Cache invalidated', { symbol, timeframe });
    } else {
      // Invalidate all timeframes for this symbol
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${symbol}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key));
      logger.debug('Cache invalidated for all timeframes', { symbol, count: keysToDelete.length });
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      if (age > this.ttl) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      ttl: this.ttl
    };
  }

  /**
   * Clean expired entries
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      if (age > this.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      logger.info('Cache cleanup', { removed: keysToDelete.length });
    }
  }
}

// Singleton instance
const regimeCache = new RegimeCache();

// Auto-cleanup every minute
setInterval(() => regimeCache.cleanup(), 60000);

module.exports = regimeCache;
