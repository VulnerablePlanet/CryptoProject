import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import axios from 'axios'

// Create axios instance for auth requests
const api = axios.create({
  baseURL: '/api/auth',
  headers: {
    'Content-Type': 'application/json'
  }
})

export const useAuthStore = defineStore('auth', () => {
  // State - persisted to localStorage
  const user = useLocalStorage('cryptodev-user', null)
  const token = useLocalStorage('cryptodev-token', null)
  const isLoading = ref(false)
  const error = ref(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)
  const userName = computed(() => user.value?.name || 'Guest')
  const userEmail = computed(() => user.value?.email || '')

  // Axios interceptor to add token to requests
  api.interceptors.request.use((config) => {
    if (token.value) {
      config.headers.Authorization = `Bearer ${token.value}`
    }
    return config
  })

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
        token.value = response.data.token
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
        token.value = response.data.token
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
    if (!token.value) return null

    try {
      const response = await api.get('/me')
      
      if (response.data.success) {
        user.value = response.data.user
        return response.data.user
      }
    } catch (err) {
      // Token might be expired, clear auth
      if (err.response?.status === 401) {
        logout()
      }
      console.error('Error fetching user:', err)
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
   * Logout user
   */
  const logout = () => {
    user.value = null
    token.value = null
    error.value = null
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
    token,
    isLoading,
    error,
    // Getters
    isAuthenticated,
    userName,
    userEmail,
    // Actions
    login,
    register,
    logout,
    clearError,
    fetchUser,
    updateProfile
  }
})
