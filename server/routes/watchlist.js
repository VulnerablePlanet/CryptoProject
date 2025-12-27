const express = require('express')
const { body } = require('express-validator')
const { 
  getWatchlist, 
  addCoin, 
  removeCoin,
  createAlert,
  deleteAlert,
  getAlerts,
  toggleAlert
} = require('../controllers/watchlistController')
const { auth } = require('../middleware/auth')

const router = express.Router()

// All routes require authentication
router.use(auth)

// Validation rules
const addCoinValidation = [
  body('coinId').trim().notEmpty().withMessage('Coin ID is required'),
  body('symbol').trim().notEmpty().withMessage('Symbol is required'),
  body('name').trim().notEmpty().withMessage('Name is required')
]

const createAlertValidation = [
  body('coinId').trim().notEmpty().withMessage('Coin ID is required'),
  body('symbol').trim().notEmpty().withMessage('Symbol is required'),
  body('targetPrice').isFloat({ min: 0 }).withMessage('Target price must be a positive number'),
  body('condition').isIn(['above', 'below']).withMessage('Condition must be "above" or "below"')
]

// Watchlist routes
router.get('/', getWatchlist)
router.post('/coins', addCoinValidation, addCoin)
router.delete('/coins/:coinId', removeCoin)

// Alert routes
router.get('/alerts', getAlerts)
router.post('/alerts', createAlertValidation, createAlert)
router.delete('/alerts/:alertId', deleteAlert)
router.patch('/alerts/:alertId/toggle', toggleAlert)

module.exports = router
