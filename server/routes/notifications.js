const express = require('express')
const { 
  getNotifications, 
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount
} = require('../controllers/notificationController')
const { auth } = require('../middleware/auth')

const router = express.Router()

// All routes require authentication
router.use(auth)

// Routes
router.get('/', getNotifications)
router.get('/unread-count', getUnreadCount)
router.patch('/read-all', markAllAsRead)
router.patch('/:id/read', markAsRead)
router.delete('/:id', deleteNotification)
router.delete('/', deleteAllNotifications)

module.exports = router
