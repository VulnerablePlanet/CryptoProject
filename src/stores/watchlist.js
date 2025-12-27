import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from './auth'

const api = axios.create({
  baseURL: '/api/watchlist',
  headers: { 'Content-Type': 'application/json' }
})

export const useWatchlistStore = defineStore('watchlist', () => {
  // State
  const coins = ref([])
  const alerts = ref([])
  const loading = ref(false)
  const error = ref(null)

  // Getters
  const coinIds = computed(() => coins.value.map(c => c.coinId))
  const activeAlerts = computed(() => alerts.value.filter(a => a.active && !a.triggered))
  const triggeredAlerts = computed(() => alerts.value.filter(a => a.triggered))
  
  const isInWatchlist = computed(() => (coinId) => 
    coins.value.some(c => c.coinId === coinId)
  )

  // Axios interceptor
  api.interceptors.request.use((config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  })

  // Actions
  const fetchWatchlist = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await api.get('/')
      if (response.data.success) {
        coins.value = response.data.watchlist.coins || []
        alerts.value = response.data.watchlist.alerts || []
        return { success: true }
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Error fetching watchlist'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const addCoin = async (coinData) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.post('/coins', {
        coinId: coinData.id || coinData.coinId,
        symbol: coinData.symbol,
        name: coinData.name,
        notes: coinData.notes || ''
      })
      
      if (response.data.success) {
        coins.value = response.data.watchlist.coins
        return { success: true, message: 'Added to watchlist' }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error adding coin'
      error.value = message
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  const removeCoin = async (coinId) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.delete(`/coins/${coinId}`)
      
      if (response.data.success) {
        coins.value = response.data.watchlist.coins
        alerts.value = response.data.watchlist.alerts
        return { success: true, message: 'Removed from watchlist' }
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Error removing coin'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const createAlert = async (alertData) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.post('/alerts', {
        coinId: alertData.coinId,
        symbol: alertData.symbol,
        targetPrice: alertData.targetPrice,
        condition: alertData.condition
      })
      
      if (response.data.success) {
        alerts.value = response.data.watchlist.alerts
        return { success: true, message: 'Alert created' }
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Error creating alert'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const deleteAlert = async (alertId) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.delete(`/alerts/${alertId}`)
      
      if (response.data.success) {
        alerts.value = response.data.watchlist.alerts
        return { success: true }
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Error deleting alert'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  const toggleAlert = async (alertId) => {
    try {
      const response = await api.patch(`/alerts/${alertId}/toggle`)
      
      if (response.data.success) {
        const index = alerts.value.findIndex(a => a._id === alertId)
        if (index >= 0) {
          alerts.value[index].active = response.data.alert.active
        }
        return { success: true }
      }
    } catch (err) {
      return { success: false }
    }
  }

  const resetState = () => {
    coins.value = []
    alerts.value = []
    error.value = null
  }

  return {
    coins,
    alerts,
    loading,
    error,
    coinIds,
    activeAlerts,
    triggeredAlerts,
    isInWatchlist,
    fetchWatchlist,
    addCoin,
    removeCoin,
    createAlert,
    deleteAlert,
    toggleAlert,
    resetState
  }
})
