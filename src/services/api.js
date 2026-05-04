import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

/**
 * Shared API client factory with automatic auth interceptors.
 *
 * Usage:
 *   import { createApiClient } from '@/services/api'
 *   const api = createApiClient('/api/watchlist')
 *   const response = await api.get('/')
 *
 * This replaces the old pattern of each store creating its own
 * axios instance + duplicate interceptors.
 */

// Shared refresh state (prevents multiple simultaneous refreshes)
let isRefreshing = false
let refreshPromise = null
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

/**
 * Create an authenticated API client for a specific base URL.
 * Automatically attaches JWT token and handles 401 refresh.
 *
 * @param {string} baseURL - The base URL for the API (e.g. '/api/watchlist')
 * @returns {import('axios').AxiosInstance} Configured axios instance
 */
export function createApiClient(baseURL) {
  const instance = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' }
  })

  // Request interceptor — attach token lazily (authStore may not exist yet at import time)
  instance.interceptors.request.use((config) => {
    const authStore = useAuthStore()
    if (authStore.accessToken) {
      config.headers.Authorization = `Bearer ${authStore.accessToken}`
    }
    return config
  })

  // Response interceptor — handle 401 with token refresh + request queue
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config

      if (error.response?.status === 401 && !originalRequest._retry) {
        // Don't retry on auth endpoints (would cause infinite loop)
        if (originalRequest.url?.includes('/auth/refresh') ||
            originalRequest.url?.includes('/auth/login') ||
            originalRequest.url?.includes('/auth/register')) {
          return Promise.reject(error)
        }

        originalRequest._retry = true

        // If already refreshing, queue this request
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return instance(originalRequest)
          }).catch(err => Promise.reject(err))
        }

        isRefreshing = true

        try {
          const authStore = useAuthStore()
          const newToken = await authStore.refreshAccessToken()

          if (newToken) {
            processQueue(null, newToken)
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return instance(originalRequest)
          } else {
            processQueue(new Error('Refresh failed'), null)
            return Promise.reject(error)
          }
        } catch (refreshError) {
          processQueue(refreshError, null)
          return Promise.reject(refreshError)
        } finally {
          isRefreshing = false
        }
      }

      return Promise.reject(error)
    }
  )

  return instance
}

// Default client for general /api usage (backwards compatible)
const api = createApiClient('/api')

/**
 * Legacy setup function — kept for backwards compatibility.
 * No-op now since interceptors are configured at creation time.
 * @deprecated Use createApiClient() instead
 */
export const setupInterceptors = () => {
  // Interceptors are already set up by createApiClient
}

export default api
