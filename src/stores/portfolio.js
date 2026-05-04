import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createApiClient } from '@/services/api'
import { logger } from '@/utils/logger'

const api = createApiClient('/api/portfolio')

export const usePortfolioStore = defineStore('portfolio', () => {
  // State
  const holdings = ref([])
  const totalInvested = ref(0)
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)

  // Getters
  const holdingsCount = computed(() => holdings.value.length)
  
  const totalValue = computed(() => {
    // This would need current prices to calculate
    // For now, return total invested as placeholder
    return totalInvested.value
  })

  const holdingByCoinId = computed(() => (coinId) =>
    holdings.value.find(h => h.coinId === coinId)
  )

  // Actions

  /**
   * Fetch user's portfolio from server
   */
  const fetchPortfolio = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await api.get('/')
      
      if (response.data.success) {
        holdings.value = response.data.portfolio.holdings || []
        totalInvested.value = response.data.portfolio.totalInvested || 0
        lastUpdated.value = new Date()
        return { success: true }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error fetching portfolio'
      error.value = message
      logger.error('Fetch portfolio error:', err)
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Add a new holding to portfolio
   */
  const addHolding = async (coinData) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.post('/holdings', {
        coinId: coinData.coinId,
        symbol: coinData.symbol,
        name: coinData.name,
        amount: coinData.amount,
        buyPrice: coinData.buyPrice,
        notes: coinData.notes || ''
      })
      
      if (response.data.success) {
        holdings.value = response.data.portfolio.holdings
        totalInvested.value = response.data.portfolio.totalInvested
        lastUpdated.value = new Date()
        return { success: true, message: response.data.message }
      }
    } catch (err) {
      const message = err.response?.data?.message 
        || err.response?.data?.errors?.[0]?.msg
        || 'Error adding holding'
      error.value = message
      logger.error('Add holding error:', err)
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Update an existing holding
   */
  const updateHolding = async (holdingId, updates) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.put(`/holdings/${holdingId}`, updates)
      
      if (response.data.success) {
        holdings.value = response.data.portfolio.holdings
        totalInvested.value = response.data.portfolio.totalInvested
        lastUpdated.value = new Date()
        return { success: true, message: 'Holding updated' }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error updating holding'
      error.value = message
      logger.error('Update holding error:', err)
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a holding from portfolio
   */
  const deleteHolding = async (holdingId) => {
    loading.value = true
    error.value = null

    try {
      const response = await api.delete(`/holdings/${holdingId}`)
      
      if (response.data.success) {
        holdings.value = response.data.portfolio.holdings
        totalInvested.value = response.data.portfolio.totalInvested
        lastUpdated.value = new Date()
        return { success: true, message: 'Holding deleted' }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error deleting holding'
      error.value = message
      logger.error('Delete holding error:', err)
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear all holdings
   */
  const clearPortfolio = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await api.delete('/holdings')
      
      if (response.data.success) {
        holdings.value = []
        totalInvested.value = 0
        lastUpdated.value = new Date()
        return { success: true, message: 'Portfolio cleared' }
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Error clearing portfolio'
      error.value = message
      logger.error('Clear portfolio error:', err)
      return { success: false, error: message }
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * Reset portfolio state (on logout)
   */
  const resetState = () => {
    holdings.value = []
    totalInvested.value = 0
    error.value = null
    lastUpdated.value = null
  }

  return {
    // State
    holdings,
    totalInvested,
    loading,
    error,
    lastUpdated,
    // Getters
    holdingsCount,
    totalValue,
    holdingByCoinId,
    // Actions
    fetchPortfolio,
    addHolding,
    updateHolding,
    deleteHolding,
    clearPortfolio,
    clearError,
    resetState
  }
})
