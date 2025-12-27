const ohlcService = require('../services/ohlcService')

/**
 * Get candles for a coin
 * GET /api/ohlc/:coinId/candles
 */
const getCandles = async (req, res) => {
  try {
    const { coinId } = req.params
    const {
      timeframe = '1h',
      vs_currency = 'usd',
      limit = 100,
      from,
      to
    } = req.query

    // Validate timeframe
    const validTimeframes = Object.keys(ohlcService.TIMEFRAME_MS)
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        message: `Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`
      })
    }

    // Validate limit
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500)

    // Parse timestamps
    const options = {
      limit: parsedLimit,
      from: from ? parseInt(from) : null,
      to: to ? parseInt(to) : null,
      autoSync: true
    }

    const candles = await ohlcService.getCandles(
      coinId.toLowerCase(),
      timeframe,
      vs_currency.toLowerCase(),
      options
    )

    res.json({
      success: true,
      coinId,
      timeframe,
      vsCurrency: vs_currency,
      count: candles.length,
      candles: candles.map(c => ({
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        priceChange: c.priceChange,
        priceChangePercent: c.priceChangePercent
      }))
    })
  } catch (error) {
    console.error('Error getting candles:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get candles'
    })
  }
}

/**
 * Sync candles for a coin
 * POST /api/ohlc/:coinId/sync
 */
const syncCoin = async (req, res) => {
  try {
    const { coinId } = req.params
    const { timeframe = '1h', vs_currency = 'usd' } = req.body

    // Validate timeframe
    const validTimeframes = Object.keys(ohlcService.TIMEFRAME_MS)
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        message: `Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`
      })
    }

    const result = await ohlcService.syncCandles(
      coinId.toLowerCase(),
      timeframe,
      vs_currency.toLowerCase()
    )

    res.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Error syncing coin:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync candles'
    })
  }
}

/**
 * Get list of supported coins
 * GET /api/ohlc/coins
 */
const getSupportedCoins = async (req, res) => {
  try {
    const coins = await ohlcService.getSupportedCoins()

    res.json({
      success: true,
      count: coins.length,
      coins
    })
  } catch (error) {
    console.error('Error getting coins:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get coins list'
    })
  }
}

/**
 * Get service status
 * GET /api/ohlc/status
 */
const getStatus = async (req, res) => {
  try {
    const status = ohlcService.getServiceStatus()

    res.json({
      success: true,
      ...status
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get service status'
    })
  }
}

/**
 * Sync multiple timeframes for a coin
 * POST /api/ohlc/:coinId/sync-all
 */
const syncAllTimeframes = async (req, res) => {
  try {
    const { coinId } = req.params
    const { vs_currency = 'usd' } = req.body
    const timeframes = Object.keys(ohlcService.TIMEFRAME_MS)

    const results = []
    
    for (const timeframe of timeframes) {
      try {
        const result = await ohlcService.syncCandles(
          coinId.toLowerCase(),
          timeframe,
          vs_currency.toLowerCase()
        )
        results.push({ timeframe, ...result })
      } catch (error) {
        results.push({ timeframe, success: false, error: error.message })
      }
    }

    res.json({
      success: true,
      coinId,
      vsCurrency: vs_currency,
      results
    })
  } catch (error) {
    console.error('Error syncing all timeframes:', error.message)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync all timeframes'
    })
  }
}

module.exports = {
  getCandles,
  syncCoin,
  getSupportedCoins,
  getStatus,
  syncAllTimeframes
}
