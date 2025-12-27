const Notification = require('../models/Notification')

/**
 * @desc    Get user's notifications
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query
    
    const query = { user: req.user._id }
    if (unreadOnly === 'true') {
      query.read = false
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit)
    
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, read: false })
    ])
    
    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    })
  }
}

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    )
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }
    
    res.json({
      success: true,
      notification
    })
  } catch (error) {
    console.error('Mark as read error:', error)
    res.status(500).json({
      success: false,
      message: 'Error updating notification'
    })
  }
}

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true }
    )
    
    res.json({
      success: true,
      message: 'All notifications marked as read'
    })
  } catch (error) {
    console.error('Mark all as read error:', error)
    res.status(500).json({
      success: false,
      message: 'Error updating notifications'
    })
  }
}

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    })
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }
    
    res.json({
      success: true,
      message: 'Notification deleted'
    })
  } catch (error) {
    console.error('Delete notification error:', error)
    res.status(500).json({
      success: false,
      message: 'Error deleting notification'
    })
  }
}

/**
 * @desc    Delete all notifications
 * @route   DELETE /api/notifications
 * @access  Private
 */
const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id })
    
    res.json({
      success: true,
      message: 'All notifications deleted'
    })
  } catch (error) {
    console.error('Delete all notifications error:', error)
    res.status(500).json({
      success: false,
      message: 'Error deleting notifications'
    })
  }
}

/**
 * @desc    Get unread count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false
    })
    
    res.json({
      success: true,
      unreadCount: count
    })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching count'
    })
  }
}

/**
 * Create a notification (internal use)
 */
const createNotification = async (userId, data, socketHelpers) => {
  return Notification.createAndEmit(userId, data, socketHelpers)
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount,
  createNotification
}
