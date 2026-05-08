const mongoose = require('mongoose')
const crypto = require('crypto')

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  revoked: {
    type: Boolean,
    default: false
  },
  replacedBy: {
    type: String,
    default: null
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

// Indexes
refreshTokenSchema.index({ user: 1 })
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index for auto-delete

/**
 * Generate a secure random refresh token
 */
refreshTokenSchema.statics.generateToken = function() {
  return crypto.randomBytes(64).toString('hex')
}

/**
 * Hash token for storage (prevents token theft from DB compromise)
 */
refreshTokenSchema.statics.hashToken = function(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Create a new refresh token for a user
 * Returns the PLAINTEXT token (only once) and stores the HASHED version
 */
refreshTokenSchema.statics.createToken = async function(userId, expiresInDays = 7, metadata = {}) {
  const plainToken = this.generateToken()
  const hashedToken = this.hashToken(plainToken)
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
  
  await this.create({
    token: hashedToken,
    user: userId,
    expiresAt,
    userAgent: metadata.userAgent || null,
    ipAddress: metadata.ipAddress || null
  })
  
  return { token: plainToken, expiresAt }
}

/**
 * Find valid token by plaintext (hashes and looks up)
 * Returns token doc with populated user
 */
refreshTokenSchema.statics.findValidToken = async function(plainToken) {
  const hashedToken = this.hashToken(plainToken)
  
  const refreshToken = await this.findOne({
    token: hashedToken,
    revoked: false,
    expiresAt: { $gt: new Date() }
  }).populate('user')
  
  return refreshToken
}

/**
 * Revoke a specific token (by plaintext)
 */
refreshTokenSchema.statics.revokeToken = async function(plainToken) {
  const hashedToken = this.hashToken(plainToken)
  return this.updateOne({ token: hashedToken }, { revoked: true })
}

/**
 * Revoke all tokens for a user (logout from all devices)
 */
refreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
  return this.updateMany({ user: userId, revoked: false }, { revoked: true })
}

/**
 * Clean up expired tokens (optional manual cleanup)
 */
refreshTokenSchema.statics.cleanupExpired = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } })
}

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema)

module.exports = RefreshToken
