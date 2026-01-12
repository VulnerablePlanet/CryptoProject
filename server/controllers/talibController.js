/**
 * TA-Lib Controller
 * Handles API requests for technical analysis
 */

const talib = require('../talib');
const { defaultLogger } = require('../talib/utils/logger');

const logger = defaultLogger.child('TalibController');

/**
 * Detect market regime
 * POST /api/talib/regime/:symbol
 */
exports.detectRegime = async (req, res) => {
  try {
    const { candles } = req.body;
    const { symbol } = req.params;

    if (!candles || !Array.isArray(candles) || candles.length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or insufficient candle data (minimum 50 required)'
      });
    }

    const result = talib.regime.detect(candles);

    res.json({
      success: true,
      data: {
        symbol,
        ...result,
        recommendedStrategies: talib.regime.getRecommendedStrategy(result.regime)
      }
    });

  } catch (error) {
    logger.error('Regime detection failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Calculate multi-indicator score
 * POST /api/talib/score/:symbol
 */
exports.calculateScore = async (req, res) => {
  try {
    const { candles, regime } = req.body;
    const { symbol } = req.params;

    if (!candles || !Array.isArray(candles) || candles.length < 50) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or insufficient candle data (minimum 50 required)'
      });
    }

    // Detect regime if not provided
    let marketRegime = regime;
    if (!marketRegime) {
      const regimeResult = talib.regime.detect(candles);
      marketRegime = regimeResult.regime;
    }

    // Normalize indicators
    const indicators = talib.scoring.normalize(candles);
    
    // Generate score
    const score = talib.scoring.generateScore(indicators, marketRegime, req.body.options);

    res.json({
      success: true,
      data: {
        symbol,
        regime: marketRegime,
        score,
        indicators
      }
    });

  } catch (error) {
    logger.error('Score calculation failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Multi-timeframe analysis
 * POST /api/talib/mtf/:symbol
 */
exports.analyzeMTF = async (req, res) => {
  try {
    const { candlesByTimeframe } = req.body;
    const { symbol } = req.params;

    if (!candlesByTimeframe || typeof candlesByTimeframe !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'candlesByTimeframe object required'
      });
    }

    const result = talib.mtf.analyze(symbol, candlesByTimeframe);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('MTF analysis failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Volume analysis
 * POST /api/talib/volume/:symbol
 */
exports.analyzeVolume = async (req, res) => {
  try {
    const { candles, trades } = req.body;
    const { symbol } = req.params;

    if (!candles || !Array.isArray(candles)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid candle data'
      });
    }

    const result = talib.volume.analyze(candles, trades);

    res.json({
      success: true,
      data: {
        symbol,
        ...result
      }
    });

  } catch (error) {
    logger.error('Volume analysis failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Order book intelligence
 * POST /api/talib/orderbook/:symbol
 */
exports.analyzeOrderBook = async (req, res) => {
  try {
    const { orderbook, previousOrderbook } = req.body;
    const { symbol } = req.params;

    if (!orderbook) {
      return res.status(400).json({
        success: false,
        error: 'Order book data required'
      });
    }

    const result = talib.orderbook.analyze(orderbook, previousOrderbook);

    res.json({
      success: true,
      data: {
        symbol,
        ...result
      }
    });

  } catch (error) {
    logger.error('OrderBook analysis failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Complete analysis (all features)
 * POST /api/talib/analyze/:symbol
 */
exports.analyzeComplete = async (req, res) => {
  try {
    const { symbol } = req.params;
    const params = { symbol, ...req.body };

    if (!params.candles || !Array.isArray(params.candles)) {
      return res.status(400).json({
        success: false,
        error: 'Candles required for complete analysis'
      });
    }

    const result = await talib.analyzeComplete(params);

    res.json({
      success: true,
      data: {
        symbol,
        ...result
      }
    });

  } catch (error) {
    logger.error('Complete analysis failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get cache statistics
 * GET /api/talib/cache/stats
 */
exports.getCacheStats = async (req, res) => {
  try {
    const stats = talib.regime.cache.getStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Failed to get cache stats', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Clear cache
 * DELETE /api/talib/cache
 */
exports.clearCache = async (req, res) => {
  try {
    const { symbol } = req.query;

    if (symbol) {
      talib.regime.cache.invalidate(symbol);
    } else {
      talib.regime.cache.clear();
    }

    res.json({
      success: true,
      message: symbol ? `Cache cleared for ${symbol}` : 'All cache cleared'
    });

  } catch (error) {
    logger.error('Failed to clear cache', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Detect candlestick patterns
 * POST /api/talib/patterns/:symbol
 */
exports.detectPatterns = async (req, res) => {
  try {
    const { candles, lookback } = req.body;
    const { symbol } = req.params;

    if (!candles || !Array.isArray(candles) || candles.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or insufficient candle data (minimum 3 required)'
      });
    }

    const patterns = require('../talib/patterns/candlestickPatterns');
    const result = patterns.scanAllPatterns(candles, lookback);

    res.json({
      success: true,
      data: {
        symbol,
        ...result
      }
    });

  } catch (error) {
    logger.error('Pattern detection failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
