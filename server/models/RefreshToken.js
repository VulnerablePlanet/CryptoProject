const mongoose = require('mongoose')
const crypto = require('crypto')

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const refreshTokenSchema = new mongoose.Schema({
  tokenHash: {
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  userAgent: {
    type: String,
    default: null
  },
  ipAddress: {
    type: String,
    default: null
  }
})

refreshTokenSchema.index({ user: 1 })
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

refreshTokenSchema.statics.generateToken = function() {
  return crypto.randomBytes(64).toString('hex')
}

refreshTokenSchema.statics.createToken = async function(userId, expiresInDays = 7, metadata = {}) {
  const rawToken = this.generateToken()
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

  const tokenDoc = await this.create({
    tokenHash: hashToken(rawToken),
    user: userId,
    expiresAt,
    userAgent: metadata.userAgent || null,
    ipAddress: metadata.ipAddress || null
  })

  return { token: rawToken, tokenDoc }
}

refreshTokenSchema.statics.findValidToken = async function(rawToken) {
  return this.findOne({
    tokenHash: hashToken(rawToken),
    expiresAt: { $gt: new Date() }
  }).populate('user')
}

refreshTokenSchema.statics.rotateToken = async function(rawToken, metadata = {}, expiresInDays = 7) {
  const current = await this.findOne({
    tokenHash: hashToken(rawToken),
    expiresAt: { $gt: new Date() }
  })

  if (!current) return null

  const userId = current.user
  await this.deleteOne({ _id: current._id })

  return this.createToken(userId, expiresInDays, metadata)
}

refreshTokenSchema.statics.revokeToken = async function(rawToken) {
  return this.deleteOne({ tokenHash: hashToken(rawToken) })
}

refreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
  return this.deleteMany({ user: userId })
}

refreshTokenSchema.statics.cleanupExpired = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } })
}

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema)

module.exports = RefreshToken
