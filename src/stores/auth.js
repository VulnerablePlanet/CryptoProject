import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/auth',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

export const useAuthStore = defineStore('auth', () => {
  const user = useLocalStorage('cryptodev-user', null, {
    serializer: {
      read: (v) => (v ? JSON.parse(v) : null),
      write: (v) => JSON.stringify(v)
    }
  })

  const accessToken = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  const isRefreshing = ref(false)
  let refreshPromise = null

  const isAuthenticated = computed(() => !!accessToken.value && !!user.value && !!user.value?.name)
  const userName = computed(() => user.value?.name || '')
  const userEmail = computed(() => user.value?.email || '')
  const userAvatar = computed(() => user.value?.avatar || null)
  const token = computed(() => accessToken.value)

  const refreshAccessToken = async () => {
    if (isRefreshing.value && refreshPromise) {
      return refreshPromise
    }

    isRefreshing.value = true
    refreshPromise = api.post('/refresh')
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
        console.error('Token refresh failed:', err)
        logout()
        return null
      })
      .finally(() => {
        isRefreshing.value = false
        refreshPromise = null
      })

    return refreshPromise
  }

  api.interceptors.request.use((config) => {
    if (accessToken.value) {
      config.headers.Authorization = `Bearer ${accessToken.value}`
    }
    return config
  })

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config

      if (error.response?.status === 401 && !originalRequest._retry) {
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

  const login = async (email, password) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.post('/login', { email, password })

      if (response.data.success) {
        user.value = response.data.user
        accessToken.value = response.data.accessToken
        return { success: true, user: response.data.user }
      }

      throw new Error(response.data.message || 'Login failed')
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Login failed'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const register = async (name, email, password, confirmPassword) => {
    isLoading.value = true
    error.value = null

    try {
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match')
      }

      const response = await api.post('/register', { name, email, password })

      if (response.data.success) {
        user.value = response.data.user
        accessToken.value = response.data.accessToken
        return { success: true, user: response.data.user }
      }

      throw new Error(response.data.message || 'Registration failed')
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

  const fetchUser = async () => {
    if (!accessToken.value) return null

    try {
      const response = await api.get('/me')

      if (response.data.success) {
        user.value = response.data.user
        return response.data.user
      }
    } catch (err) {
      console.error('Error fetching user:', err)
    }

    return null
  }

  const updateProfile = async (data) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.put('/profile', data)

      if (response.data.success) {
        user.value = response.data.user
        return { success: true, user: response.data.user }
      }

      throw new Error(response.data.message || 'Update failed')
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Update failed'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  const logout = async () => {
    try {
      await api.post('/logout').catch(() => {})
    } finally {
      user.value = null
      accessToken.value = null
      error.value = null
    }
  }

  const logoutAll = async () => {
    try {
      await api.post('/logout-all')
    } finally {
      user.value = null
      accessToken.value = null
      error.value = null
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    user,
    token,
    accessToken,
    isLoading,
    error,
    isAuthenticated,
    userName,
    userEmail,
    userAvatar,
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
