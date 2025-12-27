const jwt = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const User = require('../models/User')
const Portfolio = require('../models/Portfolio')

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
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
    
    // Generate token
    const token = generateToken(user._id)
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
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
    
    // Generate token
    const token = generateToken(user._id)
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
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
    const { name, avatar, settings } = req.body
    
    const updateData = {}
    if (name) updateData.name = name
    if (avatar !== undefined) updateData.avatar = avatar
    if (settings) updateData.settings = { ...req.user.settings, ...settings }
    
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
      message: 'Error updating profile'
    })
  }
}

module.exports = {
  register,
  login,
  me,
  updateProfile
}
