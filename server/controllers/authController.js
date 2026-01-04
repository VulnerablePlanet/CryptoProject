const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const User = require('../models/User')
const Portfolio = require('../models/Portfolio')
const RefreshToken = require('../models/RefreshToken')

/**
 * Generate Access Token (short-lived)
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  )
}

/**
 * Parse duration string to days (e.g., '7d' -> 7)
 */
const parseDurationToDays = (duration) => {
  const match = duration.match(/^(\d+)([dhms])$/)
  if (!match) return 7 // default 7 days
  
  const value = parseInt(match[1])
  const unit = match[2]
  
  switch (unit) {
    case 'd': return value
    case 'h': return value / 24
    case 'm': return value / (24 * 60)
    case 's': return value / (24 * 60 * 60)
    default: return 7
  }
}

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }
    
    const { name, email, password } = req.body
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      })
    }
    
    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password
    })
    
    // Create empty portfolio for user
    await Portfolio.create({ user: user._id, holdings: [] })
    
    // Generate tokens
    const accessToken = generateAccessToken(user._id)
    const refreshExpiresDays = parseDurationToDays(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    const refreshTokenDoc = await RefreshToken.createToken(user._id, refreshExpiresDays, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    })
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      refreshToken: refreshTokenDoc.token,
      user: user.toJSON()
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({
      success: false,
      message: 'Error registering user'
    })
  }
}

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      })
    }
    
    const { email, password } = req.body
    
    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }
    
    // Check password
    const isMatch = await user.comparePassword(password)
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }
    
    // Generate tokens
    const accessToken = generateAccessToken(user._id)
    const refreshExpiresDays = parseDurationToDays(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    const refreshTokenDoc = await RefreshToken.createToken(user._id, refreshExpiresDays, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    })
    
    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken: refreshTokenDoc.token,
      user: user.toJSON()
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    })
  }
}

/**
 * @desc    Refresh access token
 * @route   POST /api/auth/refresh
 * @access  Public
 */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      })
    }
    
    // Find valid refresh token
    const tokenDoc = await RefreshToken.findValidToken(refreshToken)
    
    if (!tokenDoc) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      })
    }
    
    // Generate new access token
    const accessToken = generateAccessToken(tokenDoc.user._id)
    
    res.json({
      success: true,
      accessToken,
      user: tokenDoc.user.toJSON()
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(500).json({
      success: false,
      message: 'Error refreshing token'
    })
  }
}

/**
 * @desc    Logout user (revoke refresh token)
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body
    
    if (refreshToken) {
      await RefreshToken.revokeToken(refreshToken)
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      message: 'Error logging out'
    })
  }
}

/**
 * @desc    Logout from all devices
 * @route   POST /api/auth/logout-all
 * @access  Private
 */
const logoutAll = async (req, res) => {
  try {
    await RefreshToken.revokeAllUserTokens(req.user._id)
    
    res.json({
      success: true,
      message: 'Logged out from all devices'
    })
  } catch (error) {
    console.error('Logout all error:', error)
    res.status(500).json({
      success: false,
      message: 'Error logging out from all devices'
    })
  }
}

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
const me = async (req, res) => {
  try {
    // User is already attached by auth middleware
    const user = await User.findById(req.user._id)
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    res.json({
      success: true,
      user: user.toJSON()
    })
  } catch (error) {
    console.error('Get me error:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching user'
    })
  }
}

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { name, phone, birthDate, location, bio, socialLinks, settings } = req.body
    const fs = require('fs')
    const path = require('path')
    
    const updateData = {}
    
    // Basic info fields
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (birthDate !== undefined) updateData.birthDate = birthDate || null
    if (location !== undefined) updateData.location = location
    if (bio !== undefined) updateData.bio = bio
    
    // Social links - merge with existing (parse JSON if string from FormData)
    if (socialLinks) {
      const existingSocialLinks = req.user.socialLinks || {}
      const parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks
      updateData.socialLinks = { ...existingSocialLinks, ...parsedSocialLinks }
    }
    
    // Settings - merge with existing
    if (settings) {
      updateData.settings = { ...req.user.settings, ...settings }
    }
    
    // Handle avatar upload
    if (req.file) {
      // Delete old avatar if exists
      if (req.user.avatar) {
        const oldAvatarPath = path.join(__dirname, '..', '..', 'public', req.user.avatar)
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath)
        }
      }
      // Set new avatar path (relative to public folder)
      updateData.avatar = `/uploads/avatars/${req.file.filename}`
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    )
    
    res.json({
      success: true,
      message: 'Profile updated',
      user: user.toJSON()
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating profile'
    })
  }
}

/**
 * @desc    Get total user count
 * @route   GET /api/auth/user-count
 * @access  Public
 */
const getUserCount = async (req, res) => {
  try {
    const count = await User.countDocuments()
    
    res.json({
      success: true,
      count
    })
  } catch (error) {
    console.error('Get user count error:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching user count'
    })
  }
}

/**
 * @desc    Get all users
 * @route   GET /api/auth/users
 * @access  Private
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('name email avatar createdAt')
      .sort({ createdAt: -1 })
    
    res.json({
      success: true,
      users
    })
  } catch (error) {
    console.error('Get all users error:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    })
  }
}

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  me,
  updateProfile,
  getUserCount,
  getAllUsers
}
