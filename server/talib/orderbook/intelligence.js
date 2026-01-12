/**
 * Order Book Intelligence (Priority #5)
 * Real-time order book analysis for institutional-level insights
 * 
 * @module orderbook/intelligence
 */

const { validateOrderBook } = require('../utils/dataValidator');
const { defaultLogger } = require('../utils/logger');
const config = require('../config');

const logger = defaultLogger.child('OrderBookIntelligence');

/**
 * Calculate bid/ask imbalance
 * @param {number[][]} bids - [[price, size], ...]
 * @param {number[][]} asks - [[price, size], ...]
 * @param {number} depth - Number of levels to analyze
 * @returns {import('../types').OrderBookImbalance} Imbalance data
 */
function calculateImbalance(bids, asks, depth = 20) {
  // Take top N levels
  const topBids = bids.slice(0, depth);
  const topAsks = asks.slice(0, depth);

  // Calculate total volume
  const bidVolume = topBids.reduce((sum, [price, size]) => sum + size, 0);
  const askVolume = topAsks.reduce((sum, [price, size]) => sum + size, 0);
  const totalVolume = bidVolume + askVolume;

  // Calculate ratio
  const ratio = totalVolume > 0 ? bidVolume / totalVolume : 0.5;

  // Determine pressure
  let pressure;
  let level;

  const extremeThreshold = config.orderbook.imbalance.extremeThreshold;
  const significantThreshold = config.orderbook.imbalance.significantThreshold;

  if (ratio > extremeThreshold) {
    pressure = 'buy';
    level = 'extreme';
  } else if (ratio > significantThreshold) {
    pressure = 'buy';
    level = 'significant';
  } else if (ratio < (1 - extremeThreshold)) {
    pressure = 'sell';
    level = 'extreme';
  } else if (ratio < (1 - significantThreshold)) {
    pressure = 'sell';
    level = 'significant';
  } else {
    pressure = 'neutral';
    level = 'normal';
  }

  return {
    bidVolume,
    askVolume,
    ratio,
    pressure,
    level
  };
}

/**
 * Detect significant walls in order book
 * @param {Object} orderbook - Order book data
 * @returns {import('../types').OrderBookWall[]} Detected walls
 */
function detectWalls(orderbook) {
  const validation = validateOrderBook(orderbook);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { bids, asks } = orderbook;
  const walls = [];

  // Calculate average order size
  const allOrders = [...bids, ...asks];
  const avgSize = allOrders.reduce((sum, [_, size]) => sum + size, 0) / allOrders.length;
  
  const sizeMultiplier = config.orderbook.walls.sizeMultiplier;
  const minDistance = config.orderbook.walls.minDistance;

  // Calculate mid price
  const bestBid = bids[0][0];
  const bestAsk = asks[0][0];
  const midPrice = (bestBid + bestAsk) / 2;

  // Check bids for walls
  for (const [price, size] of bids) {
    if (size > avgSize * sizeMultiplier) {
      const distance = (midPrice - price) / midPrice;
      if (distance >= minDistance) {
        walls.push({
          side: 'bid',
          price,
          size,
          distance
        });
      }
    }
  }

  // Check asks for walls
  for (const [price, size] of asks) {
    if (size > avgSize * sizeMultiplier) {
      const distance = (price - midPrice) / midPrice;
      if (distance >= minDistance) {
        walls.push({
          side: 'ask',
          price,
          size,
          distance
        });
      }
    }
  }

  // Sort walls by size (largest first)
  walls.sort((a, b) => b.size - a.size);

  logger.debug('Walls detected', { count: walls.length });

  return walls;
}

/**
 * Detect aggressive cancellations (possible spoofing)
 * Compares current and previous order book snapshots
 * @param {Object} currentOB - Current order book
 * @param {Object} previousOB - Previous order book snapshot
 * @returns {boolean} Whether aggressive cancellation detected
 */
function detectCancellations(currentOB, previousOB) {
  if (!previousOB) return false;

  const currentValidation = validateOrderBook(currentOB);
  const previousValidation = validateOrderBook(previousOB);

  if (!currentValidation.valid || !previousValidation.valid) {
    return false;
  }

  // Check for large orders that disappeared
  const prevBids = new Map(previousOB.bids);
  const prevAsks = new Map(previousOB.asks);
  
  let largeOrdersCancelled = 0;
  const avgSize = previousOB.bids.reduce((sum, [_, size]) => sum + size, 0) / previousOB.bids.length;

  // Check if large bids disappeared
  for (const [price, size] of previousOB.bids) {
    if (size > avgSize * 3) { // Large order
      const stillExists = currentOB.bids.some(([p, s]) => 
        Math.abs(p - price) / price < 0.0001 && s > size * 0.5
      );
      if (!stillExists) {
        largeOrdersCancelled++;
      }
    }
  }

  // Check if large asks disappeared
  for (const [price, size] of previousOB.asks) {
    if (size > avgSize * 3) { // Large order
      const stillExists = currentOB.asks.some(([p, s]) => 
        Math.abs(p - price) / price < 0.0001 && s > size * 0.5
      );
      if (!stillExists) {
        largeOrdersCancelled++;
      }
    }
  }

  // Spoofing indication: multiple large orders cancelled rapidly
  return largeOrdersCancelled >= 2;
}

/**
 * Analyze spread and depth
 * @param {Object} orderbook - Order book data
 * @returns {Object} Spread and depth analysis
 */
function analyzeSpreadDepth(orderbook) {
  const validation = validateOrderBook(orderbook);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { bids, asks } = orderbook;
  const bestBid = bids[0][0];
  const bestAsk = asks[0][0];
  const midPrice = (bestBid + bestAsk) / 2;

  // Calculate spread
  const spread = bestAsk - bestBid;
  const spreadPercent = (spread / midPrice) * 100;

  // Determine spread status
  let spreadStatus;
  const spreadThreshold = config.orderbook.depth.spreadThreshold;
  
  if (spreadPercent < spreadThreshold * 50) {
    spreadStatus = 'tight';
  } else if (spreadPercent < spreadThreshold * 200) {
    spreadStatus = 'normal';
  } else {
    spreadStatus = 'wide';
  }

  // Calculate depth (total volume in top N levels)
  const depthLevels = config.orderbook.depth.levels;
  const topBids = bids.slice(0, depthLevels);
  const topAsks = asks.slice(0, depthLevels);

  const bidDepth = topBids.reduce((sum, [_, size]) => sum + size, 0);
  const askDepth = topAsks.reduce((sum, [_, size]) => sum + size, 0);
  const totalDepth = bidDepth + askDepth;

  return {
    spread,
    spreadPercent,
    spreadStatus,
    bidDepth,
    askDepth,
    totalDepth,
    bestBid,
    bestAsk,
    midPrice
  };
}

/**
 * Complete order book intelligence analysis
 * @param {Object} orderbook - Current order book
 * @param {Object} previousOB - Previous order book (for spoofing detection)
 * @returns {import('../types').OrderBookIntelligence} Complete analysis
 */
function analyzeOrderBook(orderbook, previousOB = null) {
  const startTime = Date.now();

  try {
    const validation = validateOrderBook(orderbook);
    if (!validation.valid) {
      throw new Error(`Invalid order book: ${validation.error}`);
    }

    const imbalance = calculateImbalance(
      orderbook.bids, 
      orderbook.asks, 
      config.orderbook.depth.levels
    );

    const walls = detectWalls(orderbook);
    
    const spoofing = previousOB ? detectCancellations(orderbook, previousOB) : false;
    
    const spreadDepth = analyzeSpreadDepth(orderbook);

    const result = {
      imbalance,
      walls,
      spread: spreadDepth.spread,
      spreadPercent: spreadDepth.spreadPercent,
      spreadStatus: spreadDepth.spreadStatus,
      depth: spreadDepth.totalDepth,
      spoofing,
      midPrice: spreadDepth.midPrice,
      timestamp: new Date()
    };

    const duration = Date.now() - startTime;
    logger.performance('analyzeOrderBook', duration);
    logger.debug('OrderBook analysis complete', {
      imbalance: imbalance.ratio.toFixed(2),
      pressure: imbalance.pressure,
      walls: walls.length,
      spreadStatus: spreadDepth.spreadStatus
    });

    return result;

  } catch (error) {
    logger.error('OrderBook analysis failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  calculateImbalance,
  detectWalls,
  detectCancellations,
  analyzeSpreadDepth,
  analyzeOrderBook
};
