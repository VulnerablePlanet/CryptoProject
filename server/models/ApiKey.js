const mongoose = require('mongoose')
const crypto = require('crypto')

const apiKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
  const randomPart = crypto.randomBytes(24).toString('hex')
  return prefix + randomPart
}

// Create preview from full key
apiKeySchema.statics.createPreview = function(fullKey) {
  if (!fullKey || fullKey.length < 12) return fullKey
  return `${fullKey.substring(0, 8)}...${fullKey.substring(fullKey.length - 4)}`
}

// Hash the API key before storing
apiKeySchema.pre('save', async function(next) {
  if (this.isModified('key')) {
    // Store hashed version for security
    this.key = crypto.createHash('sha256').update(this.key).digest('hex')
  }
  next()
})

// Index for faster queries
apiKeySchema.index({ userId: 1, createdAt: -1 })

const ApiKey = mongoose.model('ApiKey', apiKeySchema)

module.exports = ApiKey
