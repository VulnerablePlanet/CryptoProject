<script setup>
import { onMounted, computed, ref } from 'vue'
import { useCryptoStore } from '@/stores/crypto'
import { usePortfolioStore } from '@/stores/portfolio'
import PriceChart from '@/components/crypto/PriceChart.vue'
import AssetTable from '@/components/crypto/AssetTable.vue'

const cryptoStore = useCryptoStore()
const portfolioStore = usePortfolioStore()

const selectedCoinId = ref('bitcoin')
const chartDays = ref('7')

// Computed - Real portfolio data
const chartData = computed(() => cryptoStore.chartData)

// Calculate real portfolio value using holdings from DB + live prices
const portfolioValue = computed(() => {
  if (portfolioStore.holdings.length === 0) return 0
  
  return portfolioStore.holdings.reduce((acc, holding) => {
    // Find current price from CoinGecko data
    const coin = cryptoStore.coins.find(c => c.id === holding.coinId)
    const currentPrice = coin?.current_price || holding.avgBuyPrice
    return acc + (currentPrice * holding.amount)
  }, 0)
})

// Enrich holdings with market data for the table
const enrichedHoldings = computed(() => {
  return portfolioStore.holdings.map(holding => {
    const coin = cryptoStore.coins.find(c => c.id === holding.coinId)
    return {
      ...holding,
      id: holding.coinId,
      name: holding.name,
      symbol: holding.symbol,
      image: coin?.image || '',
      current_price: coin?.current_price || holding.avgBuyPrice,
      price_change_percentage_24h: coin?.price_change_percentage_24h || 0,
      holdings: holding.amount
    }
  })
})

const portfolioChange = computed(() => {
  // Calculate weighted average change based on holdings
  if (enrichedHoldings.value.length === 0) {
    return { value: '0.00', isPositive: true }
  }
  
  let totalValue = 0
  let weightedChange = 0
  
  enrichedHoldings.value.forEach(holding => {
    const value = holding.current_price * holding.holdings
    totalValue += value
    weightedChange += (holding.price_change_percentage_24h || 0) * value
  })
  
  const avgChange = totalValue > 0 ? weightedChange / totalValue : 0
  
  return {
    value: Math.abs(avgChange).toFixed(2),
    isPositive: avgChange >= 0
  }
})

// Actions
const handleTimeframeChange = async (days) => {
  chartDays.value = days
  await cryptoStore.fetchChartData(selectedCoinId.value, days)
}

// Handle coin selection from asset table
const handleCoinSelect = async (coin) => {
  selectedCoinId.value = coin.id || coin.coinId
  await cryptoStore.fetchChartData(selectedCoinId.value, chartDays.value)
}

// Get selected coin data
const selectedCoinData = computed(() => {
  const coinId = selectedCoinId.value
  // First try to find in enriched holdings
  const holding = enrichedHoldings.value.find(h => h.id === coinId || h.coinId === coinId)
  if (holding) return holding
  // Fallback to crypto store
  return cryptoStore.coins.find(c => c.id === coinId) || { name: 'Bitcoin', symbol: 'BTC' }
})

// Exchange rate USD to COP (Colombian Peso)
const copRate = 4400

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const formatCOP = (value) => {
  const cop = value * copRate
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cop)
}

// Initialize - Load both crypto data and user portfolio
onMounted(async () => {
  await Promise.all([
    cryptoStore.initializeData(),
    portfolioStore.fetchPortfolio()
  ])
  await cryptoStore.fetchChartData(selectedCoinId.value, chartDays.value)
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Portfolio Card Row -->
    <div class="grid grid-cols-1 gap-6">
      
      <!-- Balance Card with Chart -->
      <div class="bg-surface-light dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6 relative overflow-hidden group">
        <!-- Background Glow -->
        <div class="absolute -right-10 -top-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-500"></div>
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 relative z-10">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <p class="text-text-secondary text-sm font-medium">Total Portfolio Value</p>
              <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                {{ selectedCoinData?.symbol?.toUpperCase() || 'BTC' }}
              </span>
            </div>
            <div class="flex flex-col gap-1">
              <div class="flex items-baseline gap-3">
                <h3 v-if="!cryptoStore.loading" class="text-slate-900 dark:text-white text-3xl md:text-4xl font-bold tracking-tight font-mono">
                  {{ formatCurrency(portfolioValue) }}
                </h3>
                <div v-else class="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                
                <span 
                  v-if="!cryptoStore.loading"
                  class="flex items-center px-2 py-0.5 rounded text-sm font-medium"
                  :class="portfolioChange.isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'"
                >
                  <span class="material-symbols-outlined text-[16px] mr-1">
                    {{ portfolioChange.isPositive ? 'trending_up' : 'trending_down' }}
                  </span>
                  {{ portfolioChange.isPositive ? '+' : '-' }}{{ portfolioChange.value }}%
                </span>
              </div>
              <!-- COP Value -->
              <p v-if="!cryptoStore.loading" class="text-yellow-600 dark:text-yellow-400 text-sm font-mono">
                🇨🇴 {{ formatCOP(portfolioValue) }}
              </p>
            </div>
          </div>
        </div>
        
        <!-- Chart -->
        <PriceChart 
          :data="chartData"
          :loading="cryptoStore.loading && (!chartData || chartData.length === 0)"
          :height="220"
          @timeframe-change="handleTimeframeChange"
        />
      </div>
    </div>
    
    <!-- Assets Table -->
    <AssetTable 
      :coins="enrichedHoldings"
      :loading="portfolioStore.loading"
      :selected-coin-id="selectedCoinId"
      @coin-click="handleCoinSelect"
    />
  </div>
</template>
