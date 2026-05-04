import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getCoinsMarkets, getCoinDetails, getCoinMarketChart, getTrendingCoins, getGlobalStats } from '@/services/coingecko'
import { initSocket, onPriceUpdate } from '@/services/socket'
import { logger } from '@/utils/logger'

export const useCryptoStore = defineStore('crypto', () => {
  // State
  const coins = ref([])
  const selectedCoin = ref(null)
  const chartData = ref(null)
  const trendingCoins = ref([])
  const globalStats = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const realtimeEnabled = ref(false)
  
  // Socket cleanup function
  let unsubscribePrices = null

  // Getters
  const topCoins = computed(() => coins.value.slice(0, 10))
  
  const coinById = computed(() => (id) => 
    coins.value.find(coin => coin.id === id)
  )

  const totalMarketCap = computed(() => 
    globalStats.value?.data?.total_market_cap?.usd || 0
  )

  // Actions
  const fetchCoins = async (params = {}) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await getCoinsMarkets(params)
      if (Array.isArray(data)) {
        coins.value = data
        lastUpdated.value = new Date()
      } else {
        throw new Error('Invalid data format received from API')
      }
    } catch (err) {
      error.value = err.message || 'Error fetching coins'
      logger.error('Error fetching coins:', err)
      // If error occurs, fail silently for now or keep old data
      if (!Array.isArray(coins.value)) coins.value = []
    } finally {
      loading.value = false
    }
  }

  const fetchCoinDetails = async (id) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await getCoinDetails(id)
      selectedCoin.value = data
      return data
    } catch (err) {
      error.value = err.message || 'Error fetching coin details'
      logger.error('Error fetching coin details:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchChartData = async (id, days = '7') => {
    loading.value = true
    error.value = null
    
    try {
      const data = await getCoinMarketChart(id, { days })
      chartData.value = data
      return data
    } catch (err) {
      error.value = err.message || 'Error fetching chart data'
      logger.error('Error fetching chart data:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchTrending = async () => {
    try {
      const data = await getTrendingCoins()
      trendingCoins.value = data.coins || []
    } catch (err) {
      logger.error('Error fetching trending:', err)
    }
  }

  const fetchGlobalStats = async () => {
    try {
      const data = await getGlobalStats()
      globalStats.value = data
    } catch (err) {
      logger.error('Error fetching global stats:', err)
    }
  }

  /**
   * Update coins with realtime price data
   */
  const updatePrices = (priceData) => {
    if (!priceData?.prices || !Array.isArray(priceData.prices)) return
    
    // Ensure coins.value is an array before proceeding
    if (!Array.isArray(coins.value)) {
      logger.warn('coins.value is not an array, initializing as empty array')
      coins.value = []
    }
    
    // Update coins with new prices
    priceData.prices.forEach(newCoin => {
      const existingIndex = coins.value.findIndex(c => c.id === newCoin.id)
      if (existingIndex >= 0) {
        // Merge new data with existing coin data
        coins.value[existingIndex] = {
          ...coins.value[existingIndex],
          current_price: newCoin.current_price,
          price_change_24h: newCoin.price_change_24h,
          price_change_percentage_24h: newCoin.price_change_percentage_24h,
          high_24h: newCoin.high_24h,
          low_24h: newCoin.low_24h,
          total_volume: newCoin.total_volume,
          last_updated: newCoin.last_updated
        }
      } else {
        // Add new coin if not exists
        coins.value.push(newCoin)
      }
    })
    
    lastUpdated.value = new Date(priceData.timestamp)
    logger.debug(`📊 Realtime update: ${priceData.prices.length} coins updated`)
  }

  /**
   * Enable realtime price updates via Socket.io
   */
  const enableRealtimePrices = () => {
    if (realtimeEnabled.value) return
    
    try {
      initSocket()
      unsubscribePrices = onPriceUpdate(updatePrices)
      realtimeEnabled.value = true
      logger.info('🔴 Realtime prices enabled')
    } catch (err) {
      logger.error('Failed to enable realtime prices:', err)
    }
  }

  /**
   * Disable realtime price updates
   */
  const disableRealtimePrices = () => {
    if (unsubscribePrices) {
      unsubscribePrices()
      unsubscribePrices = null
    }
    realtimeEnabled.value = false
    logger.debug('⚪ Realtime prices disabled')
  }

  // Initialize data
  const initializeData = async () => {
    await Promise.allSettled([
      fetchCoins(),
      fetchGlobalStats(),
      fetchTrending()
    ])
    
    // Enable realtime updates after initial fetch
    enableRealtimePrices()
  }

  return {
    // State
    coins,
    selectedCoin,
    chartData,
    trendingCoins,
    globalStats,
    loading,
    error,
    lastUpdated,
    realtimeEnabled,
    // Getters
    topCoins,
    coinById,
    totalMarketCap,
    // Actions
    fetchCoins,
    fetchCoinDetails,
    fetchChartData,
    fetchTrending,
    fetchGlobalStats,
    initializeData,
    updatePrices,
    enableRealtimePrices,
    disableRealtimePrices
  }
})
