<script setup>
import { onMounted, computed, ref } from 'vue'
import { useCryptoStore } from '@/stores/crypto'
import PriceChart from '@/components/crypto/PriceChart.vue'
import AssetTable from '@/components/crypto/AssetTable.vue'

const cryptoStore = useCryptoStore()

const selectedCoinId = ref('bitcoin')
const chartDays = ref('7')

// Computed
const topCoins = computed(() => cryptoStore.coins.slice(0, 8))
const chartData = computed(() => cryptoStore.chartData)
const portfolioValue = computed(() => {
  return topCoins.value.reduce((acc, coin, index) => {
    const holdings = [0.45, 3.2, 15, 4, 0.5, 2, 100, 50][index] || 1
    return acc + (coin.current_price * holdings)
  }, 0)
})

const portfolioChange = computed(() => {
  const change = cryptoStore.coins[0]?.price_change_percentage_24h || 0
  return {
    value: Math.abs(change).toFixed(2),
    isPositive: change >= 0
  }
})

// Actions
const handleTimeframeChange = async (days) => {
  chartDays.value = days
  await cryptoStore.fetchChartData(selectedCoinId.value, days)
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

// Initialize
onMounted(async () => {
  await cryptoStore.initializeData()
  await cryptoStore.fetchChartData(selectedCoinId.value, chartDays.value)
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Portfolio Card + Security Widget Row -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      <!-- Balance Card with Chart -->
      <div class="lg:col-span-8 bg-surface-light dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6 relative overflow-hidden group">
        <!-- Background Glow -->
        <div class="absolute -right-10 -top-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-all duration-500"></div>
        
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 relative z-10">
          <div>
            <p class="text-text-secondary text-sm font-medium mb-1">Total Portfolio Value</p>
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
          </div>
          
          <!-- Quick Actions -->
          <div class="flex gap-2 mt-4 sm:mt-0">
            <button class="flex items-center justify-center gap-2 h-10 px-4 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-primary/20">
              <span class="material-symbols-outlined text-[18px]">add</span>
              Buy
            </button>
            <button class="flex items-center justify-center gap-2 h-10 px-4 bg-gray-200 dark:bg-border-dark hover:bg-gray-300 dark:hover:bg-gray-700 text-slate-900 dark:text-white text-sm font-bold rounded-lg transition-colors border border-gray-300 dark:border-gray-600">
              <span class="material-symbols-outlined text-[18px]">remove</span>
              Sell
            </button>
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
      
      <!-- Security Widget -->
      <div class="lg:col-span-4 bg-surface-light dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6 flex flex-col relative overflow-hidden">
        <div class="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-2xl -mr-8 -mt-8"></div>
        
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-slate-900 dark:text-white font-bold text-lg">Security Shield</h3>
          <span class="material-symbols-outlined text-success">verified_user</span>
        </div>
        
        <div class="flex flex-col gap-4 flex-1">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-text-secondary text-xs">Security Score</span>
              <span class="text-slate-900 dark:text-white font-mono font-bold text-xl">98/100</span>
            </div>
            <!-- Circular Progress -->
            <div class="relative size-12">
              <svg class="size-full -rotate-90" viewBox="0 0 36 36">
                <path 
                  class="text-gray-200 dark:text-border-dark" 
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-width="3"
                />
                <path 
                  class="text-success" 
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                  fill="none" 
                  stroke="currentColor" 
                  stroke-dasharray="98, 100" 
                  stroke-width="3"
                />
              </svg>
            </div>
          </div>
          
          <div class="space-y-2">
            <div class="flex items-center gap-2 text-sm text-text-secondary">
              <span class="material-symbols-outlined text-[16px] text-success">check_circle</span>
              2FA Enabled
            </div>
            <div class="flex items-center gap-2 text-sm text-text-secondary">
              <span class="material-symbols-outlined text-[16px] text-success">check_circle</span>
              API Keys Rotated
            </div>
            <div class="flex items-center gap-2 text-sm text-text-secondary">
              <span class="material-symbols-outlined text-[16px] text-yellow-500">warning</span>
              Withdrawal Whitelist Off
            </div>
          </div>
        </div>
        
        <button class="w-full mt-4 py-2 border border-gray-200 dark:border-border-dark rounded-lg text-sm font-medium text-slate-900 dark:text-white hover:bg-gray-100 dark:hover:bg-border-dark transition-colors">
          Run Audit
        </button>
      </div>
    </div>
    
    <!-- Assets Table -->
    <AssetTable 
      :coins="topCoins"
      :loading="cryptoStore.loading && topCoins.length === 0"
    />
  </div>
</template>
