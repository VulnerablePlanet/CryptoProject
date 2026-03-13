const express = require('express')
const { body } = require('express-validator')
const { 
  register, 
  login, 
  refreshAccessToken,
  logout,
  logoutAll,
  me, 
  updateProfile, 
  getUserCount,
  getAllUsers,
  getChartSettings,
  updateChartSettings
} = require('../controllers/authController')
const { auth } = require('../middleware/auth')
const requireRole = require('../middleware/requireRole')
const { authRateLimiter } = require('../middleware/rateLimit')
const { upload } = require('../middleware/upload')

const router = express.Router()

// Validation rules
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
]

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
]

// Routes
// @route   POST /api/auth/register
router.post('/register', authRateLimiter, registerValidation, register)

// @route   POST /api/auth/login
router.post('/login', authRateLimiter, loginValidation, login)

// @route   POST /api/auth/refresh
router.post('/refresh', authRateLimiter, refreshAccessToken)

// @route   POST /api/auth/logout
router.post('/logout', logout)

// @route   POST /api/auth/logout-all
router.post('/logout-all', auth, logoutAll)

// @route   GET /api/auth/me
router.get('/me', auth, me)

// @route   PUT /api/auth/profile
router.put('/profile', auth, upload.single('avatar'), updateProfile)

// @route   GET /api/auth/user-count
router.get('/user-count', getUserCount)

// @route   GET /api/auth/users
router.get('/users', auth, requireRole('admin'), getAllUsers)

// @route   GET /api/auth/settings/chart/:module - Get chart settings for a module
router.get('/settings/chart/:module', auth, getChartSettings)

// @route   PUT /api/auth/settings/chart - Update chart settings
router.put('/settings/chart', auth, updateChartSettings)

module.exports = router

