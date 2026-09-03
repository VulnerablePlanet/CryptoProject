const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { createLogger } = require('../utils/logger')

const logger = createLogger('auth-middleware')

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      })
    }
    
    const token = authHeader.split(' ')[1]
    
    // Verify token with explicit algorithm restriction
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
    
    // Find user and attach to request
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token may be invalid.'
      })
    }
    
    req.user = user
    req.token = token
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      })
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      })
    }
    
    logger.error('Auth middleware error', error)
    res.status(500).json({
      success: false,
      message: 'Authentication error.'
    })
  }
}

/**
 * Optional auth - doesn't fail if no token, just doesn't attach user
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
      const user = await User.findById(decoded.userId)
      
      if (user) {
        req.user = user
        req.token = token
      }
    }
    
    next()
  } catch {
    // Silently continue without user
    next()
  }
}

/**
 * Authorization middleware — requires administrator privileges.
 * MUST run AFTER `auth` (depends on req.user being attached).
 *
 * Grants access if the user has role 'admin', OR if their id matches
 * AGENT_OWNER_USER_ID (env-based bootstrap so an operator can be granted
 * control without manual DB edits before any admin exists).
 */
const requireAdmin = (req, res, next) => {
  const ownerId = process.env.AGENT_OWNER_USER_ID
  const isOwner = !!ownerId && req.user?._id?.toString() === ownerId
  const isAdmin = req.user?.role === 'admin'

  if (!isAdmin && !isOwner) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator privileges required.'
    })
  }

  next()
}

module.exports = { auth, optionalAuth, requireAdmin }
