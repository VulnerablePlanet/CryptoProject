import { io } from 'socket.io-client'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

// Socket instance
let socket = null

// Reactive state
const isConnected = ref(false)
const connectionError = ref(null)

/**
 * Initialize Socket.io connection
 * Only connects if user is authenticated
 */
export const initSocket = () => {
  if (socket?.connected) {
    return socket
  }

  const authStore = useAuthStore()
  
  // Only connect if user is authenticated
  if (!authStore.isAuthenticated || !authStore.token) {
    console.log('🔌 Socket: Skipping connection (not authenticated)')
    return null
  }
  
  socket = io(window.location.origin, {
    auth: {
      token: authStore.token
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  })

  // Connection events
  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id)
    isConnected.value = true
    connectionError.value = null
  })

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason)
    isConnected.value = false
  })

  socket.on('connect_error', (error) => {
    console.warn('Socket connection error:', error.message)
    connectionError.value = error.message
    isConnected.value = false
  })

  socket.on('connected', (data) => {
    console.log('✅ Server confirmed connection:', data)
  })

  return socket
}

/**
 * Get socket instance (creates if doesn't exist)
 */
export const getSocket = () => {
  if (!socket) {
    return initSocket()
  }
  return socket
}

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    isConnected.value = false
  }
}

/**
 * Subscribe to price updates for specific coins
 */
export const subscribeToPrices = (coinIds) => {
  const s = getSocket()
  if (s && Array.isArray(coinIds)) {
    s.emit('subscribe:prices', coinIds)
  }
}

/**
 * Unsubscribe from price updates
 */
export const unsubscribeFromPrices = (coinIds) => {
  const s = getSocket()
  if (s && Array.isArray(coinIds)) {
    s.emit('unsubscribe:prices', coinIds)
  }
}

/**
 * Listen to price updates
 */
export const onPriceUpdate = (callback) => {
  const s = getSocket()
  if (s) {
    s.on('priceUpdate', callback)
  }
  // Return unsubscribe function
  return () => {
    if (s) {
      s.off('priceUpdate', callback)
    }
  }
}

/**
 * Listen to portfolio updates
 */
export const onPortfolioUpdate = (callback) => {
  const s = getSocket()
  if (s) {
    s.on('portfolioUpdate', callback)
  }
  return () => {
    if (s) {
      s.off('portfolioUpdate', callback)
    }
  }
}

/**
 * Listen to notifications
 */
export const onNotification = (callback) => {
  const s = getSocket()
  if (s) {
    s.on('notification', callback)
  }
  return () => {
    if (s) {
      s.off('notification', callback)
    }
  }
}

/**
 * Composable for using socket state in components
 */
export const useSocket = () => {
  return {
    socket: computed(() => socket),
    isConnected,
    connectionError,
    init: initSocket,
    disconnect: disconnectSocket,
    subscribeToPrices,
    unsubscribeFromPrices,
    onPriceUpdate,
    onPortfolioUpdate,
    onNotification
  }
}

export default {
  initSocket,
  getSocket,
  disconnectSocket,
  subscribeToPrices,
  unsubscribeFromPrices,
  onPriceUpdate,
  onPortfolioUpdate,
  onNotification,
  useSocket
}
