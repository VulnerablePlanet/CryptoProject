import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from './auth'

// Create axios instance for transaction requests
const api = axios.create({
  baseURL: '/api/transactions',
  headers: {
    'Content-Type': 'application/json'
  }
})

export const useTransactionStore = defineStore('transactions', () => {
  // State
  const transactions = ref([])
  const currentTransaction = ref(null)
  const stats = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Getters
  const recentTransactions = computed(() => transactions.value.slice(0, 5))
  
  const transactionsByType = computed(() => (type) => 
    transactions.value.filter(t => t.type === type)
  )

  const totalBuys = computed(() => 
    transactions.value
      .filter(t => t.type === 'buy')
      .reduce((sum, t) => sum + t.totalValue, 0)
  )

  const totalSells = computed(() => 
    transactions.value
      .filter(t => t.type === 'sell')
      .reduce((sum, t) => sum + t.totalValue, 0)
  )

  // Axios interceptor to add token
  api.interceptors.request.use((config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  })

  // Response interceptor - handle 401 and refresh token
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const authStore = useAuthStore()
      const originalRequest = error.config

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        
        const newToken = await authStore.refreshAccessToken()
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
   * Fetch user's transactions with optional filters
   */
  const fetchTransactions = async (filters = {}) => {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (filters.page) params.append('page', filters.page)
      if (filters.limit) params.append('limit', filters.limit)
      if (filters.type) params.append('type', filters.type)
      if (filters.coinId) params.append('coinId', filters.coinId)
      if (filters.startDate) params.append('startDate', filters.startDate)
      if (filters.endDate) params.append('endDate', filters.endDate)

      const response = await api.get(`/?${params.toString()}`)
      
      if (response.data.success) {
        transactions.value = response.data.transactions
        pagination.value = response.data.pagination
        return { success: true }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error fetching transactions'
      error.value = message
      console.error('Fetch transactions error:', err)
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch transaction statistics
   */
  const fetchStats = async () => {
    try {
      const response = await api.get('/stats')
      
      if (response.data.success) {
        stats.value = response.data.stats
        return { success: true }
      }
    } catch (err) {
      console.error('Fetch stats error:', err)
      return { success: false }
    }
  }

  /**
   * Create a new transaction
   */
  const createTransaction = async (transactionData) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.post('/', transactionData)
      
      if (response.data.success) {
        // Add to beginning of list
        transactions.value.unshift(response.data.transaction)
        return { 
          success: true, 
          transaction: response.data.transaction,
          portfolio: response.data.portfolio
        }
      }
    } catch (err) {
      const message = err.response?.data?.message 
        || err.response?.data?.errors?.[0]?.msg
        || 'Error creating transaction'
      error.value = message
      console.error('Create transaction error:', err)
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Get a single transaction
   */
  const getTransaction = async (id) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.get(`/${id}`)
      
      if (response.data.success) {
        currentTransaction.value = response.data.transaction
        return { success: true, transaction: response.data.transaction }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error fetching transaction'
      error.value = message
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a transaction
   */
  const deleteTransaction = async (id) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.delete(`/${id}`)
      
      if (response.data.success) {
        transactions.value = transactions.value.filter(t => t._id !== id)
        return { success: true }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error deleting transaction'
      error.value = message
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Add transaction from realtime update
   */
  const addRealtimeTransaction = (transaction) => {
    const exists = transactions.value.find(t => t._id === transaction._id)
    if (!exists) {
      transactions.value.unshift(transaction)
    }
  }

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * Reset store state
   */
  const resetState = () => {
    transactions.value = []
    currentTransaction.value = null
    stats.value = null
    error.value = null
    pagination.value = { page: 1, limit: 20, total: 0, pages: 0 }
  }

  return {
    // State
    transactions,
    currentTransaction,
    stats,
    loading,
    error,
    pagination,
    // Getters
    recentTransactions,
    transactionsByType,
    totalBuys,
    totalSells,
    // Actions
    fetchTransactions,
    fetchStats,
    createTransaction,
    getTransaction,
    deleteTransaction,
    addRealtimeTransaction,
    clearError,
    resetState
  }
})
