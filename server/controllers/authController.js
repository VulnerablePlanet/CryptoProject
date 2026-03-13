const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const User = require('../models/User')
const Portfolio = require('../models/Portfolio')
const RefreshToken = require('../models/RefreshToken')

const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  )
}

const parseDurationToDays = (duration) => {
  const match = duration.match(/^(\d+)([dhms])$/)
  if (!match) return 7

  const value = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 'd': return value
    case 'h': return value / 24
    case 'm': return value / (24 * 60)
    case 's': return value / (24 * 60 * 60)
    default: return 7
  }
}

const refreshCookieName = 'refreshToken'
const setRefreshCookie = (res, token) => {
  res.cookie(refreshCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: parseDurationToDays(process.env.JWT_REFRESH_EXPIRES_IN || '7d') * 24 * 60 * 60 * 1000
  })
}

const clearRefreshCookie = (res) => {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth'
  })
}

const parseCookies = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...valueParts] = part.split('=')
      if (!key) return acc
      acc[key] = decodeURIComponent(valueParts.join('='))
      return acc
    }, {})
}

const getRefreshTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie || '')
  return cookies[refreshCookieName] || req.body?.refreshToken || null
}

const register = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { name, email, password } = req.body

    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' })
    }

    const user = await User.create({ name, email: email.toLowerCase(), password })
    await Portfolio.create({ user: user._id, holdings: [] })

    const accessToken = generateAccessToken(user._id)
    const refreshExpiresDays = parseDurationToDays(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    const { token: refreshToken } = await RefreshToken.createToken(user._id, refreshExpiresDays, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    })

    setRefreshCookie(res, refreshToken)

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      accessToken,
      user: user.toJSON()
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ success: false, message: 'Error registering user' })
  }
}

const login = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() })
    }

    const { email, password } = req.body
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' })
    }

    const accessToken = generateAccessToken(user._id)
    const refreshExpiresDays = parseDurationToDays(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    const { token: refreshToken } = await RefreshToken.createToken(user._id, refreshExpiresDays, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    })

    setRefreshCookie(res, refreshToken)

    res.json({ success: true, message: 'Login successful', accessToken, user: user.toJSON() })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ success: false, message: 'Error logging in' })
  }
}

const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req)

    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' })
    }

    const refreshExpiresDays = parseDurationToDays(process.env.JWT_REFRESH_EXPIRES_IN || '7d')
    const rotated = await RefreshToken.rotateToken(refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    }, refreshExpiresDays)

    if (!rotated) {
      clearRefreshCookie(res)
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' })
    }

    const tokenDoc = await RefreshToken.findById(rotated.tokenDoc._id).populate('user')
    const accessToken = generateAccessToken(tokenDoc.user._id)
    setRefreshCookie(res, rotated.token)

    res.json({ success: true, accessToken, user: tokenDoc.user.toJSON() })
  } catch (error) {
    console.error('Refresh token error:', error)
    clearRefreshCookie(res)
    res.status(500).json({ success: false, message: 'Error refreshing token' })
  }
}

const logout = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req)
    if (refreshToken) {
      await RefreshToken.revokeToken(refreshToken)
    }

    clearRefreshCookie(res)
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ success: false, message: 'Error logging out' })
  }
}

const logoutAll = async (req, res) => {
  try {
    await RefreshToken.revokeAllUserTokens(req.user._id)
    clearRefreshCookie(res)
    res.json({ success: true, message: 'Logged out from all devices' })
  } catch (error) {
    console.error('Logout all error:', error)
    res.status(500).json({ success: false, message: 'Error logging out from all devices' })
  }
}

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })
    res.json({ success: true, user: user.toJSON() })
  } catch (error) {
    console.error('Get me error:', error)
    res.status(500).json({ success: false, message: 'Error fetching user' })
  }
}

const parseJsonIfString = (value) => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const sanitizeSocialLinks = (incoming, existing = {}) => {
  const allowed = ['github', 'twitter', 'linkedin', 'website']
  const safe = { ...existing }

  if (!incoming || typeof incoming !== 'object') return safe

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      safe[key] = typeof incoming[key] === 'string' ? incoming[key] : ''
    }
  }

  return safe
}

const sanitizeSettings = (incoming, existing = {}) => {
  const safe = { ...existing }
  if (!incoming || typeof incoming !== 'object') return safe

  if (Object.prototype.hasOwnProperty.call(incoming, 'currency') && typeof incoming.currency === 'string') {
    safe.currency = incoming.currency
  }

  if (Object.prototype.hasOwnProperty.call(incoming, 'theme') && ['light', 'dark', 'system'].includes(incoming.theme)) {
    safe.theme = incoming.theme
  }

  if (Object.prototype.hasOwnProperty.call(incoming, 'notifications') && typeof incoming.notifications === 'boolean') {
    safe.notifications = incoming.notifications
  }

  return safe
}

const updateProfile = async (req, res) => {
  try {
    const { name, phone, birthDate, location, bio } = req.body
    const fs = require('fs')
    const path = require('path')

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (birthDate !== undefined) updateData.birthDate = birthDate || null
    if (location !== undefined) updateData.location = location
    if (bio !== undefined) updateData.bio = bio

    const socialLinksInput = parseJsonIfString(req.body.socialLinks)
    if (req.body.socialLinks !== undefined) {
      updateData.socialLinks = sanitizeSocialLinks(socialLinksInput, req.user.socialLinks)
    }

    if (req.body.settings !== undefined) {
      const settingsInput = parseJsonIfString(req.body.settings)
      if (settingsInput === null && typeof req.body.settings === 'string') {
        return res.status(400).json({ success: false, message: 'Invalid settings payload' })
      }

      updateData.settings = sanitizeSettings(settingsInput, req.user.settings)
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

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true })

    res.json({ success: true, message: 'Profile updated', user: user.toJSON() })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ success: false, message: error.message || 'Error updating profile' })
  }
}

const getUserCount = async (req, res) => {
  try {
    const count = await User.countDocuments()
    res.json({ success: true, count })
  } catch (error) {
    console.error('Get user count error:', error)
    res.status(500).json({ success: false, message: 'Error fetching user count' })
  }
}

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('name email avatar createdAt role').sort({ createdAt: -1 })
    res.json({ success: true, users })
  } catch (error) {
    console.error('Get all users error:', error)
    res.status(500).json({ success: false, message: 'Error fetching users' })
  }
}

const getChartSettings = async (req, res) => {
  try {
    const { module } = req.params
    const validModules = ['predictions', 'fibonacci']

    if (!validModules.includes(module)) {
      return res.status(400).json({ success: false, message: `Invalid module. Valid options: ${validModules.join(', ')}` })
    }

    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ success: false, message: 'User not found' })

    const chartSettings = user.settings?.chartSettings?.[module] || null
    res.json({ success: true, module, settings: chartSettings })
  } catch (error) {
    console.error('Get chart settings error:', error)
    res.status(500).json({ success: false, message: 'Error fetching chart settings' })
  }
}

const updateChartSettings = async (req, res) => {
  try {
    const { module, chartState, visibleRange, symbol, timeframe } = req.body
    const validModules = ['predictions', 'fibonacci']

    if (!module || !validModules.includes(module)) {
      return res.status(400).json({ success: false, message: `Module is required. Valid options: ${validModules.join(', ')}` })
    }

    const updatePath = `settings.chartSettings.${module}`
    const updateData = { [`${updatePath}.updatedAt`]: new Date() }

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
      if (visibleRange.from !== undefined) updateData[`${updatePath}.visibleRange.from`] = visibleRange.from
      if (visibleRange.to !== undefined) updateData[`${updatePath}.visibleRange.to`] = visibleRange.to
    }

    if (symbol !== undefined) updateData[`${updatePath}.lastSymbol`] = symbol
    if (timeframe !== undefined) updateData[`${updatePath}.lastTimeframe`] = timeframe

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updateData }, { new: true })
    const savedSettings = user.settings?.chartSettings?.[module]

    res.json({ success: true, message: 'Chart settings saved', module, settings: savedSettings })
  } catch (error) {
    console.error('Update chart settings error:', error)
    res.status(500).json({ success: false, message: 'Error saving chart settings' })
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
