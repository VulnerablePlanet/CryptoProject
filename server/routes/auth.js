const express = require('express')
const rateLimit = require('express-rate-limit')
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
const { upload } = require('../middleware/upload')

const router = express.Router()

// ============================================================================
// RATE LIMITING — Anti brute-force
// ============================================================================

// Login: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.'
  }
})

// Register: 3 attempts per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again in 1 hour.'
  }
})

// Refresh token: 10 per minute per IP
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many refresh attempts. Please try again later.'
  }
})

// ============================================================================
// VALIDATION RULES
// ============================================================================

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
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must include uppercase, lowercase, and number')
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

// ============================================================================
// ROUTES
// ============================================================================

// @route   POST /api/auth/register
router.post('/register', registerLimiter, registerValidation, register)

// @route   POST /api/auth/login
router.post('/login', loginLimiter, loginValidation, login)

// @route   POST /api/auth/refresh
router.post('/refresh', refreshLimiter, refreshAccessToken)

// @route   POST /api/auth/logout
router.post('/logout', logout)

// @route   POST /api/auth/logout-all
router.post('/logout-all', auth, logoutAll)

// @route   GET /api/auth/me
router.get('/me', auth, me)

// @route   PUT /api/auth/profile
router.put('/profile', auth, upload.single('avatar'), updateProfile)

// @route   GET /api/auth/user-count — PROTECTED, requires auth
router.get('/user-count', auth, getUserCount)

// @route   GET /api/auth/users
router.get('/users', auth, getAllUsers)

// @route   GET /api/auth/settings/chart/:module
router.get('/settings/chart/:module', auth, getChartSettings)

// @route   PUT /api/auth/settings/chart
router.put('/settings/chart', auth, updateChartSettings)

module.exports = router
