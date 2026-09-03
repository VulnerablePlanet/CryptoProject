const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const User = require('../models/User')
const Portfolio = require('../models/Portfolio')
const RefreshToken = require('../models/RefreshToken')
const { createLogger } = require('../utils/logger')

const logger = createLogger('authController')

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
    const { token: refreshToken } = await RefreshToken.createToken(user._id, refreshExpiresDays, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    })
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      refreshToken,
      user: user.toJSON()
    })
  } catch (error) {
    logger.error('Register failed', { error, email: req.body?.email })
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
    const { token: refreshToken } = await RefreshToken.createToken(user._id, refreshExpiresDays, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    })
    
    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: user.toJSON()
    })
  } catch (error) {
    logger.error('Login failed', { error })
    res.status(500).json({
      success: false,
      message: 'Error logging in'
    })
  }
}

/**
 * @desc    Refresh access token (with token rotation)
 * @route   POST /api/auth/refresh
 * @access  Public
 *
 * TOKEN ROTATION: When a refresh token is used, it is immediately revoked
 * and a NEW refresh token is issued. This prevents stolen refresh tokens
 * from being usable — if a stolen token is used after the legitimate user
 * has already rotated it, the theft is detected.
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
    
    // TOKEN ROTATION: Revoke the old token immediately
    await RefreshToken.revokeToken(refreshToken)
    
    // Generate NEW access token
    const accessToken = generateAccessToken(tokenDoc.user._id)
    
    // Generate NEW refresh token
    const refreshExpiresDays = parseDurationToDays(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    const { token: newRefreshToken } = await RefreshToken.createToken(tokenDoc.user._id, refreshExpiresDays, {
      userAgent: req.headers['user-agent'] || tokenDoc.userAgent,
      ipAddress: req.ip || tokenDoc.ipAddress
    })
    
    res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      user: tokenDoc.user.toJSON()
    })
  } catch (error) {
    logger.error('Refresh token failed', { error })
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
    logger.error('Logout failed', { error })
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
    logger.error('Logout all failed', { error, userId: req.user?._id?.toString() })
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
    // User is already attached by auth middleware — no need to re-fetch
    res.json({
      success: true,
      user: req.user.toJSON()
    })
  } catch (error) {
    logger.error('Get me failed', { error, userId: req.user?._id?.toString() })
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
    
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (birthDate !== undefined) updateData.birthDate = birthDate || null
    if (location !== undefined) updateData.location = location
    if (bio !== undefined) updateData.bio = bio
    
    if (socialLinks) {
      const existingSocialLinks = req.user.socialLinks || {}
      let parsedSocialLinks
      try {
        parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks
      } catch {
        return res.status(400).json({
          success: false,
          message: 'socialLinks must be a valid JSON object'
        })
      }
      if (typeof parsedSocialLinks !== 'object' || parsedSocialLinks === null || Array.isArray(parsedSocialLinks)) {
        return res.status(400).json({
          success: false,
          message: 'socialLinks must be a valid JSON object'
        })
      }
      updateData.socialLinks = { ...existingSocialLinks, ...parsedSocialLinks }
    }
    
    if (settings) {
      updateData.settings = { ...req.user.settings, ...settings }
    }
    
    if (req.file) {
      if (req.user.avatar) {
        const oldAvatarPath = path.join(__dirname, '..', '..', 'public', req.user.avatar)
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath)
        }
      }
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
    logger.error('Update profile failed', { error, userId: req.user?._id?.toString() })
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    })
  }
}

/**
 * @desc    Get total user count (protected — requires auth)
 * @route   GET /api/auth/user-count
 * @access  Private
 */
const getUserCount = async (req, res) => {
  try {
    const count = await User.countDocuments()
    
    res.json({
      success: true,
      count
    })
  } catch (error) {
    logger.error('Get user count failed', { error })
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
    // Do NOT expose email addresses — prevents account/email harvesting.
    const users = await User.find()
      .select('name avatar createdAt')
      .sort({ createdAt: -1 })
      .lean()
    
    res.json({
      success: true,
      users
    })
  } catch (error) {
    logger.error('Get all users failed', { error })
    res.status(500).json({
      success: false,
      message: 'Error fetching users'
    })
  }
}

/**
 * @desc    Get chart settings for a module
 * @route   GET /api/auth/settings/chart/:module
 * @access  Private
 */
const getChartSettings = async (req, res) => {
  try {
    const { module } = req.params
    const validModules = ['predictions', 'fibonacci']
    
    if (!validModules.includes(module)) {
      return res.status(400).json({
        success: false,
        message: `Invalid module. Valid options: ${validModules.join(', ')}`
      })
    }
    
    const user = await User.findById(req.user._id)
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    const chartSettings = user.settings?.chartSettings?.[module] || null
    
    res.json({
      success: true,
      module,
      settings: chartSettings
    })
  } catch (error) {
    logger.error('Get chart settings failed', { error, userId: req.user?._id?.toString(), module: req.params?.module })
    res.status(500).json({
      success: false,
      message: 'Error fetching chart settings'
    })
  }
}

/**
 * @desc    Update chart settings for a module
 * @route   PUT /api/auth/settings/chart
 * @access  Private
 */
const updateChartSettings = async (req, res) => {
  try {
    const { module, chartState, visibleRange, symbol, timeframe } = req.body
    const validModules = ['predictions', 'fibonacci']
    
    if (!module || !validModules.includes(module)) {
      return res.status(400).json({
        success: false,
        message: `Module is required. Valid options: ${validModules.join(', ')}`
      })
    }
    
    const updatePath = `settings.chartSettings.${module}`
    const updateData = {
      [`${updatePath}.updatedAt`]: new Date()
    }
    
    if (chartState) {
      if (chartState.visibleRange) {
        updateData[`${updatePath}.chartState.visibleRange.from`] = chartState.visibleRange.from
        updateData[`${updatePath}.chartState.visibleRange.to`] = chartState.visibleRange.to
        updateData[`${updatePath}.visibleRange.from`] = chartState.visibleRange.from
        updateData[`${updatePath}.visibleRange.to`] = chartState.visibleRange.to
      }
      if (chartState.logicalRange) {
        updateData[`${updatePath}.chartState.logicalRange.from`] = chartState.logicalRange.from
        updateData[`${updatePath}.chartState.logicalRange.to`] = chartState.logicalRange.to
      }
      if (chartState.barSpacing !== undefined) {
        updateData[`${updatePath}.chartState.barSpacing`] = chartState.barSpacing
        updateData[`${updatePath}.barSpacing`] = chartState.barSpacing
      }
      if (chartState.rightOffset !== undefined) {
        updateData[`${updatePath}.chartState.rightOffset`] = chartState.rightOffset
        updateData[`${updatePath}.rightOffset`] = chartState.rightOffset
      }
      if (chartState.scrollPosition !== undefined) {
        updateData[`${updatePath}.chartState.scrollPosition`] = chartState.scrollPosition
        updateData[`${updatePath}.scrollPosition`] = chartState.scrollPosition
      }
    }
    
    if (visibleRange && !chartState) {
      if (visibleRange.from !== undefined) {
        updateData[`${updatePath}.visibleRange.from`] = visibleRange.from
      }
      if (visibleRange.to !== undefined) {
        updateData[`${updatePath}.visibleRange.to`] = visibleRange.to
      }
    }
    
    if (symbol !== undefined) {
      updateData[`${updatePath}.lastSymbol`] = symbol
    }
    
    if (timeframe !== undefined) {
      updateData[`${updatePath}.lastTimeframe`] = timeframe
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true }
    )
    
    const savedSettings = user.settings?.chartSettings?.[module]
    
    res.json({
      success: true,
      message: 'Chart settings saved',
      module,
      settings: savedSettings
    })
  } catch (error) {
    logger.error('Update chart settings failed', { error, userId: req.user?._id?.toString(), module: req.body?.module })
    res.status(500).json({
      success: false,
      message: 'Error saving chart settings'
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
  getAllUsers,
  getChartSettings,
  updateChartSettings
}
