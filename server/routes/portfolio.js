const express = require('express')
const { body } = require('express-validator')
const { 
  getPortfolio, 
  addHolding, 
  updateHolding, 
  deleteHolding,
  clearPortfolio 
} = require('../controllers/portfolioController')
const { auth } = require('../middleware/auth')

const router = express.Router()

// All routes require authentication
router.use(auth)

// Validation rules
const addHoldingValidation = [
  body('coinId')
    .trim()
    .notEmpty().withMessage('Coin ID is required'),
  body('symbol')
    .trim()
    .notEmpty().withMessage('Symbol is required'),
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required'),
  body('amount')
    .isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('buyPrice')
    .isFloat({ min: 0 }).withMessage('Buy price must be a positive number')
]

const updateHoldingValidation = [
  body('amount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('avgBuyPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Average buy price must be a positive number')
]

// Routes
// @route   GET /api/portfolio
router.get('/', getPortfolio)

// @route   POST /api/portfolio/holdings
router.post('/holdings', addHoldingValidation, addHolding)

// @route   PUT /api/portfolio/holdings/:holdingId
router.put('/holdings/:holdingId', updateHoldingValidation, updateHolding)

// @route   DELETE /api/portfolio/holdings/:holdingId
router.delete('/holdings/:holdingId', deleteHolding)

// @route   DELETE /api/portfolio/holdings (clear all)
router.delete('/holdings', clearPortfolio)

module.exports = router
