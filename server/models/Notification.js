const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['price_alert', 'transaction', 'security', 'system', 'portfolio', 'welcome'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: 'notifications'
  },
  read: {
    type: Boolean,
    default: false
  },
  // Related data (optional)
  data: {
    coinId: String,
    symbol: String,
    price: Number,
    transactionId: mongoose.Schema.Types.ObjectId,
    alertId: mongoose.Schema.Types.ObjectId,
    link: String
  },
  expiresAt: {
    type: Date,
    default: null // null means never expires
  }
}, {
  timestamps: true
})

// Indexes
notificationSchema.index({ user: 1, createdAt: -1 })
notificationSchema.index({ user: 1, read: 1 })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index

// Static method to create and emit notification
notificationSchema.statics.createAndEmit = async function(userId, data, socketHelpers) {
  const notification = await this.create({
    user: userId,
    ...data
  })
  
  if (socketHelpers) {
    socketHelpers.emitToUser(userId.toString(), 'notification', notification)
  }
  
  return notification
}

// Virtual for time ago display
notificationSchema.virtual('timeAgo').get(function() {
  const seconds = Math.floor((Date.now() - this.createdAt) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return this.createdAt.toLocaleDateString()
})

notificationSchema.set('toJSON', { virtuals: true })
notificationSchema.set('toObject', { virtuals: true })

const Notification = mongoose.model('Notification', notificationSchema)

module.exports = Notification
