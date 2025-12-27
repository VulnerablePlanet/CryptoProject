const express = require('express')
const { body } = require('express-validator')
const { 
  getTransactions, 
  getTransaction,
  createTransaction, 
  deleteTransaction,
  getTransactionStats 
} = require('../controllers/transactionController')
const { auth } = require('../middleware/auth')

const router = express.Router()

// All routes require authentication
router.use(auth)

// Validation rules
const createTransactionValidation = [
  body('type')
    .isIn(['buy', 'sell', 'transfer_in', 'transfer_out', 'deposit', 'withdraw'])
    .withMessage('Invalid transaction type'),
  body('coinId')
    .trim()
    .notEmpty().withMessage('Coin ID is required'),
  body('symbol')
    .trim()
    .notEmpty().withMessage('Symbol is required'),
  body('coinName')
    .trim()
    .notEmpty().withMessage('Coin name is required'),
  body('amount')
    .isFloat({ min: 0.00000001 }).withMessage('Amount must be a positive number'),
  body('priceAtTransaction')
    .isFloat({ min: 0 }).withMessage('Price must be a positive number')
]

// Routes
// @route   GET /api/transactions/stats
router.get('/stats', getTransactionStats)

// @route   GET /api/transactions
router.get('/', getTransactions)

// @route   GET /api/transactions/:id
router.get('/:id', getTransaction)

// @route   POST /api/transactions
router.post('/', createTransactionValidation, createTransaction)

// @route   DELETE /api/transactions/:id
router.delete('/:id', deleteTransaction)

module.exports = router
