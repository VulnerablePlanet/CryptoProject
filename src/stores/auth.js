import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import axios from 'axios'
import { logger } from '@/utils/logger'

// Create axios instance for auth requests
const api = axios.create({
  baseURL: '/api/auth',
  headers: {
    'Content-Type': 'application/json'
  }
})

export const useAuthStore = defineStore('auth', () => {
  // State - persisted to localStorage
  const user = useLocalStorage('cryptodev-user', null, {
    serializer: {
      read: (v) => v ? JSON.parse(v) : null,
      write: (v) => JSON.stringify(v)
    }
  })
  const accessToken = useLocalStorage('cryptodev-access-token', null)
  const refreshToken = useLocalStorage('cryptodev-refresh-token', null)
  const isLoading = ref(false)
  const error = ref(null)
  const isRefreshing = ref(false)
  let refreshPromise = null

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value && !!user.value?.name)
  const userName = computed(() => user.value?.name || '')
  const userEmail = computed(() => user.value?.email || '')
  const userAvatar = computed(() => user.value?.avatar || null)
  // Legacy getter for compatibility
  const token = computed(() => accessToken.value)

  /**
   * Refresh the access token using refresh token
   */
  const refreshAccessToken = async () => {
    // If already refreshing, return the existing promise
    if (isRefreshing.value && refreshPromise) {
      return refreshPromise
    }

    if (!refreshToken.value) {
      logout()
      return null
    }

    isRefreshing.value = true
    refreshPromise = api.post('/refresh', { refreshToken: refreshToken.value })
      .then(response => {
        if (response.data.success) {
          accessToken.value = response.data.accessToken
          if (response.data.user) {
            user.value = response.data.user
          }
          return response.data.accessToken
        }
        throw new Error('Refresh failed')
      })
      .catch(err => {
        logger.error('Token refresh failed:', err)
        // Refresh token is invalid, logout user
        logout()
        return null
      })
      .finally(() => {
        isRefreshing.value = false
        refreshPromise = null
      })

    return refreshPromise
  }

  // Axios request interceptor - add token to requests
  api.interceptors.request.use((config) => {
    if (accessToken.value) {
      config.headers.Authorization = `Bearer ${accessToken.value}`
    }
    return config
  })

  // Axios response interceptor - handle 401 and auto-refresh
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config

      // If 401 and we haven't retried yet
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Don't retry on login/register/refresh endpoints
        if (originalRequest.url?.includes('/refresh') || 
            originalRequest.url?.includes('/login') || 
            originalRequest.url?.includes('/register')) {
          return Promise.reject(error)
        }

        originalRequest._retry = true

        const newToken = await refreshAccessToken()
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      }

      return Promise.reject(error)
    }
  )

  // Actions

  /**
   * Login with email and password
   */
  const login = async (email, password) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.post('/login', { email, password })
      
      if (response.data.success) {
        user.value = response.data.user
        accessToken.value = response.data.accessToken
        refreshToken.value = response.data.refreshToken
        return { success: true, user: response.data.user }
      } else {
        throw new Error(response.data.message || 'Login failed')
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Login failed'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Register new user
   */
  const register = async (name, email, password, confirmPassword) => {
    isLoading.value = true
    error.value = null

    try {
      // Client-side validation
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const response = await api.post('/register', { name, email, password })
      
      if (response.data.success) {
        user.value = response.data.user
        accessToken.value = response.data.accessToken
        refreshToken.value = response.data.refreshToken
        return { success: true, user: response.data.user }
      } else {
        throw new Error(response.data.message || 'Registration failed')
      }
    } catch (err) {
      const message = err.response?.data?.message 
        || err.response?.data?.errors?.[0]?.msg
        || err.message 
        || 'Registration failed'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch current user data from server
   */
  const fetchUser = async () => {
    if (!accessToken.value) return null

    try {
      const response = await api.get('/me')
      
      if (response.data.success) {
        user.value = response.data.user
        return response.data.user
      }
    } catch (err) {
      // Token might be expired, the interceptor will handle refresh
      logger.error('Error fetching user:', err)
    }
    
    return null
  }

  /**
   * Update user profile
   */
  const updateProfile = async (data) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.put('/profile', data)
      
      if (response.data.success) {
        user.value = response.data.user
        return { success: true, user: response.data.user }
      } else {
        throw new Error(response.data.message || 'Update failed')
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Update failed'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Logout user and redirect to login
   */
  const logout = async (redirect = true) => {
    try {
      // Revoke refresh token on server
      if (refreshToken.value) {
        await api.post('/logout', { refreshToken: refreshToken.value }).catch(() => {})
      }
    } finally {
      // Clear local state regardless of server response
      user.value = null
      accessToken.value = null
      refreshToken.value = null
      error.value = null
      
      // Lazy import router to avoid circular dependency at module init
      if (redirect) {
        try {
          const router = (await import('@/router')).default
          const currentRoute = router.currentRoute?.value
          if (currentRoute && currentRoute.name !== 'login') {
            router.push({ name: 'login', query: { redirect: currentRoute.fullPath } })
          }
        } catch {
          // Router not available (e.g., during SSR) — silently ignore
        }
      }
    }
  }

  /**
   * Logout from all devices
   */
  const logoutAll = async () => {
    try {
      await api.post('/logout-all')
    } finally {
      user.value = null
      accessToken.value = null
      refreshToken.value = null
      error.value = null
      
      // Lazy import router to avoid circular dependency
      try {
        const router = (await import('@/router')).default
        const currentRoute = router.currentRoute?.value
        if (currentRoute && currentRoute.name !== 'login') {
          router.push({ name: 'login' })
        }
      } catch {
        // Router not available — silently ignore
      }
    }
  }

  /**
   * Clear error
   */
  const clearError = () => {
    error.value = null
  }

  return {
    // State
    user,
    token, // Legacy compatibility
    accessToken,
    refreshToken,
    isLoading,
    error,
    // Getters
    isAuthenticated,
    userName,
    userEmail,
    userAvatar,
    // Actions
    login,
    register,
    logout,
    logoutAll,
    clearError,
    fetchUser,
    updateProfile,
    refreshAccessToken
  }
})
