import axios from 'axios'

// Create a shared axios instance with auth interceptors
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// State for refresh handling
let isRefreshing = false
let refreshPromise = null
let failedQueue = []

// Process queued requests after token refresh
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

// Setup interceptors with auth store
export const setupInterceptors = (authStore) => {
  // Request interceptor - add token
  api.interceptors.request.use((config) => {
    const token = authStore.accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  // Response interceptor - handle 401 and refresh
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config

      // If 401 and not a retry
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Don't retry on auth endpoints
        if (originalRequest.url?.includes('/auth/refresh') || 
            originalRequest.url?.includes('/auth/login') || 
            originalRequest.url?.includes('/auth/register')) {
          return Promise.reject(error)
        }

        // If already refreshing, queue this request
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          }).catch(err => Promise.reject(err))
        }

        originalRequest._retry = true
        isRefreshing = true

        try {
          const newToken = await authStore.refreshAccessToken()
          
          if (newToken) {
            processQueue(null, newToken)
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return api(originalRequest)
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
}

export default api
