const mongoose = require('mongoose')
const crypto = require('crypto')

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Track device/browser info for security
  userAgent: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  }
})

// Auto-delete expired tokens using TTL index
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

/**
 * Generate a secure random refresh token
 */
refreshTokenSchema.statics.generateToken = function() {
  return crypto.randomBytes(64).toString('hex')
}

/**
 * Create a new refresh token for a user
 */
refreshTokenSchema.statics.createToken = async function(userId, expiresInDays = 7, metadata = {}) {
  const token = this.generateToken()
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
  
  const refreshToken = await this.create({
    token,
    user: userId,
    expiresAt,
    userAgent: metadata.userAgent || null,
    ipAddress: metadata.ipAddress || null
  })
  
  return refreshToken
}

/**
 * Find valid token and return with user
 */
refreshTokenSchema.statics.findValidToken = async function(token) {
  const refreshToken = await this.findOne({
    token,
    expiresAt: { $gt: new Date() }
  }).populate('user')
  
  return refreshToken
}

/**
 * Revoke a specific token
 */
refreshTokenSchema.statics.revokeToken = async function(token) {
  return this.deleteOne({ token })
}

/**
 * Revoke all tokens for a user (logout from all devices)
 */
refreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
  return this.deleteMany({ user: userId })
}

/**
 * Clean up expired tokens (optional manual cleanup)
 */
refreshTokenSchema.statics.cleanupExpired = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } })
}

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema)

module.exports = RefreshToken
