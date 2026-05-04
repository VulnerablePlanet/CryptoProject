import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createApiClient } from '@/services/api'
import { onNotification } from '@/services/socket'
import { logger } from '@/utils/logger'

const api = createApiClient('/api/notifications')

export const useNotificationStore = defineStore('notifications', () => {
  // State
  const notifications = ref([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const error = ref(null)
  const pagination = ref({ page: 1, limit: 20, total: 0, pages: 0 })
  
  // Socket cleanup
  let unsubscribe = null

  // Getters
  const hasUnread = computed(() => unreadCount.value > 0)
  const recentNotifications = computed(() => notifications.value.slice(0, 5))

  // Actions
  const fetchNotifications = async (params = {}) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.get('/', { params })
      if (response.data.success) {
        notifications.value = response.data.notifications
        unreadCount.value = response.data.unreadCount
        pagination.value = response.data.pagination
        return { success: true }
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Error fetching notifications'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const markAsRead = async (id) => {
    try {
      const response = await api.patch(`/${id}/read`)
      if (response.data.success) {
        const notification = notifications.value.find(n => n._id === id)
        if (notification && !notification.read) {
          notification.read = true
          unreadCount.value = Math.max(0, unreadCount.value - 1)
        }
        return { success: true }
      }
    } catch (err) {
      return { success: false }
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await api.patch('/read-all')
      if (response.data.success) {
        notifications.value.forEach(n => n.read = true)
        unreadCount.value = 0
        return { success: true }
      }
    } catch (err) {
      return { success: false }
    }
  }

  const deleteNotification = async (id) => {
    try {
      const response = await api.delete(`/${id}`)
      if (response.data.success) {
        const notification = notifications.value.find(n => n._id === id)
        if (notification && !notification.read) {
          unreadCount.value = Math.max(0, unreadCount.value - 1)
        }
        notifications.value = notifications.value.filter(n => n._id !== id)
        return { success: true }
      }
    } catch (err) {
      return { success: false }
    }
  }

  const deleteAllNotifications = async () => {
    try {
      const response = await api.delete('/')
      if (response.data.success) {
        notifications.value = []
        unreadCount.value = 0
        return { success: true }
      }
    } catch (err) {
      return { success: false }
    }
  }

  /**
   * Add notification from realtime Socket.io event
   */
  const addRealtimeNotification = (notification) => {
    notifications.value.unshift(notification)
    if (!notification.read) {
      unreadCount.value++
    }
  }

  /**
   * Initialize realtime notification listener
   */
  const initRealtimeListener = () => {
    if (unsubscribe) return
    
    unsubscribe = onNotification((notification) => {
      logger.debug('🔔 New notification:', notification.title)
      addRealtimeNotification(notification)
    })
  }

  /**
   * Stop realtime listener
   */
  const stopRealtimeListener = () => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  const resetState = () => {
    notifications.value = []
    unreadCount.value = 0
    error.value = null
    stopRealtimeListener()
  }

  return {
    notifications,
    unreadCount,
    loading,
    error,
    pagination,
    hasUnread,
    recentNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    addRealtimeNotification,
    initRealtimeListener,
    stopRealtimeListener,
    resetState
  }
})
