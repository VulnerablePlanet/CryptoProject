/**
 * TA-Lib API Routes
 * Professional technical analysis endpoints
 */

const express = require('express');
const router = express.Router();
const talibController = require('../controllers/talibController');
const { auth } = require('../middleware/auth');

// All TA-Lib routes require authentication
router.use(auth);

// Market Regime Detection
router.post('/regime/:symbol', talibController.detectRegime);

// Multi-Indicator Scoring
router.post('/score/:symbol', talibController.calculateScore);

// Multi-Timeframe Analysis
router.post('/mtf/:symbol', talibController.analyzeMTF);

// Volume Analysis
router.post('/volume/:symbol', talibController.analyzeVolume);

// Order Book Intelligence
router.post('/orderbook/:symbol', talibController.analyzeOrderBook);

// Complete Analysis (all features)
router.post('/analyze/:symbol', talibController.analyzeComplete);

// Candlestick Pattern Detection
router.post('/patterns/:symbol', talibController.detectPatterns);


// Cache Management
router.get('/cache/stats', talibController.getCacheStats);
router.delete('/cache', talibController.clearCache);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'TA-Lib module is operational',
    features: [
      'Market Regime Detection',
      'Multi-Indicator Scoring',
      'Multi-Timeframe Analysis',
      'Volume Analysis',
      'Order Book Intelligence'
    ],
    timestamp: new Date()
  });
});

module.exports = router;
