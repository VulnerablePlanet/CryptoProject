const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'El nombre de la API key es requerido'],
    trim: true,
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  key: {
    type: String,
    required: true,
    unique: true
  },
  keyPreview: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    required: [true, 'El proveedor es requerido'],
    trim: true,
    default: 'Custom'
  },
  rateLimit: {
    type: String,
    trim: true,
    default: 'N/A'
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Generate a new API key
apiKeySchema.statics.generateKey = function() {
  const prefix = 'sk_live_'
  const randomPart = require('crypto').randomBytes(24).toString('hex')
  return prefix + randomPart
}

// Create preview from full key
apiKeySchema.statics.createPreview = function(fullKey) {
  if (!fullKey || fullKey.length < 12) return fullKey
  return `${fullKey.substring(0, 8)}...${fullKey.substring(fullKey.length - 4)}`
}

// Hash the API key with bcrypt before storing (replaces insecure SHA-256)
apiKeySchema.pre('save', async function(next) {
  if (this.isModified('key')) {
    try {
      const salt = await bcrypt.genSalt(12)
      this.key = await bcrypt.hash(this.key, salt)
    } catch (error) {
      return next(error)
    }
  }
  next()
})

// Method to verify an API key against stored hash
apiKeySchema.statics.verifyKey = async function(plainKey, hashedKey) {
  return bcrypt.compare(plainKey, hashedKey)
}

// Index for faster queries (single compound index — removed duplicate on userId)
apiKeySchema.index({ userId: 1, createdAt: -1 })

const ApiKey = mongoose.model('ApiKey', apiKeySchema)

module.exports = ApiKey
