/**
 * Fibonacci Routes
 * Express router for Fibonacci analysis endpoints
 */

const express = require('express')
const router = express.Router()
const fibonacciController = require('../controllers/fibonacciController')

// Get Fibonacci ratios configuration
router.get('/ratios', fibonacciController.getRatios)

// Get pivot points for a coin
router.get('/:coinId/pivots', fibonacciController.getPivots)

// Get full Fibonacci analysis for a coin
router.get('/:coinId', fibonacciController.getAnalysis)

module.exports = router
