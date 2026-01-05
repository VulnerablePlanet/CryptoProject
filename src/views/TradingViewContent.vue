<script setup>
/**
 * TradingViewContent View
 * Main view for TradingView Lightweight Charts module
 * 
 * Features:
 * - Cryptocurrency price visualization with TradingView charts
 * - Coin selector with dynamic filtering
 * - Timeframe controls
 * - Price display in USD and COP
 * - Responsive design
 */

import { onMounted, computed } from 'vue'
import { useTradingViewStore } from '@/stores/tradingview'
import { formatUSD, formatCOPWithFlag, getCopRate } from '@/utils/currency'

// Components
import TradingViewChart from '@/components/tradingview/TradingViewChart.vue'
import CoinSelector from '@/components/tradingview/CoinSelector.vue'
import TimeframeSelector from '@/components/tradingview/TimeframeSelector.vue'
import ChartTypeSelector from '@/components/tradingview/ChartTypeSelector.vue'
import PriceDisplay from '@/components/tradingview/PriceDisplay.vue'

// Store
const store = useTradingViewStore()

// Computed
const isLoading = computed(() => store.loading)
const isSyncing = computed(() => store.syncing)
const hasError = computed(() => !!store.error)

// Format last updated time
const lastUpdatedText = computed(() => {
  if (!store.lastUpdated) return ''
  return new Date(store.lastUpdated).toLocaleTimeString()
})

// Lifecycle
onMounted(() => {
  store.initialize()
})

// Event Handlers
const handleCoinSelect = (coinId) => {
  store.changeCoin(coinId)
}

const handleTimeframeSelect = (timeframe) => {
  store.changeTimeframe(timeframe)
}

const handleChartTypeSelect = (type) => {
  store.changeChartType(type)
}

const handleSync = () => {
  store.syncData()
}

const handleCrosshairMove = (data) => {
  // Future: Update crosshair display
  console.log('Crosshair move:', data)
}
</script>

<template>
  <div class="tradingview-content space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-3xl">candlestick_chart</span>
          TradingView
        </h1>
        <p class="text-text-secondary mt-1">
          Real-time cryptocurrency charts powered by TradingView Lightweight Charts
        </p>
      </div>
      
      <!-- Sync Button & Status -->
      <div class="flex items-center gap-3">
        <!-- Cache Hit Indicator -->
        <span 
          v-if="store.cacheHit" 
          class="text-xs px-2 py-1 bg-success/10 text-success rounded-full flex items-center gap-1 hidden lg:flex"
        >
          <span class="material-symbols-outlined text-[14px]">bolt</span>
          Cargado desde caché
        </span>
        
        <!-- Last Updated -->
        <span v-if="lastUpdatedText" class="text-xs text-text-secondary hidden lg:block">
          Actualizado: {{ lastUpdatedText }}
        </span>
        
        <!-- Sync Button with Cooldown -->
        <button
          @click="handleSync"
          :disabled="isSyncing || !store.canSync"
          class="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed relative"
          :title="!store.canSync ? `Espera ${store.syncCooldownRemaining}s` : 'Sincronizar datos desde CoinGecko'"
        >
          <span 
            class="material-symbols-outlined text-[20px]" 
            :class="{ 'animate-spin': isSyncing }"
          >
            {{ isSyncing ? 'refresh' : (!store.canSync ? 'hourglass_top' : 'sync') }}
          </span>
          <span v-if="isSyncing">Sincronizando...</span>
          <span v-else-if="!store.canSync">{{ store.syncCooldownRemaining }}s</span>
          <span v-else>Sync Data</span>
        </button>
      </div>
    </div>

    <!-- Controls Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex flex-wrap items-end gap-4 lg:gap-6">
        <!-- Coin Selector -->
        <CoinSelector
          :coins="store.supportedCoins"
          :selected-coin="store.selectedCoin"
          :disabled="isLoading"
          @select="handleCoinSelect"
        />
        
        <div class="h-10 w-px bg-gray-200 dark:bg-border-dark hidden lg:block"></div>
        
        <!-- Timeframe Selector -->
        <TimeframeSelector
          :timeframes="store.timeframes"
          :selected-timeframe="store.selectedTimeframe"
          :disabled="isLoading"
          @select="handleTimeframeSelect"
        />
        
        <div class="h-10 w-px bg-gray-200 dark:bg-border-dark hidden lg:block"></div>
        
        <!-- Chart Type Selector -->
        <ChartTypeSelector
          :chart-types="store.chartTypes"
          :selected-type="store.chartType"
          :disabled="isLoading"
          @select="handleChartTypeSelect"
        />
        
        <!-- Candle Count Badge -->
        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs text-text-secondary">Candles:</span>
          <span class="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
            {{ store.candleCount }}
          </span>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div 
      v-if="hasError" 
      class="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center gap-3"
    >
      <span class="material-symbols-outlined text-danger">error</span>
      <p class="text-danger text-sm flex-1">{{ store.error }}</p>
      <button 
        @click="store.clearError()" 
        class="text-danger hover:text-danger/80 transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>

    <!-- Price Display Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4 lg:p-6">
      <PriceDisplay
        :current-price="store.currentPrice"
        :open-price="store.openPrice"
        :high-price="store.highPrice"
        :low-price="store.lowPrice"
        :volume="store.volume"
        :price-change="store.priceChange"
        :coin-symbol="store.currentCoin.symbol"
        :coin-color="store.currentCoin.color"
      />
    </div>

    <!-- Chart Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <!-- Chart Header -->
      <div class="p-4 border-b border-gray-200 dark:border-border-dark flex items-center justify-between">
        <h2 class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">insert_chart</span>
          {{ store.currentCoin.symbol }}/USD
          <span class="text-xs px-2 py-0.5 bg-gray-100 dark:bg-background-dark text-text-secondary rounded-full font-normal">
            {{ store.currentTimeframe.description }}
          </span>
        </h2>
        
        <!-- COP Exchange Rate Info -->
        <div class="flex items-center gap-2 text-xs text-text-secondary">
          <span>🇨🇴</span>
          <span>1 USD = {{ getCopRate().toLocaleString() }} COP</span>
        </div>
      </div>
      
      <!-- Chart Container -->
      <div class="p-4">
        <!-- Loading State -->
        <div 
          v-if="isLoading" 
          class="flex items-center justify-center"
          :style="{ height: '400px' }"
        >
          <div class="flex flex-col items-center gap-3">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p class="text-text-secondary text-sm">Loading chart data...</p>
          </div>
        </div>
        
        <!-- Chart -->
        <TradingViewChart
          v-else
          :candle-data="store.tvCandleData"
          :volume-data="store.tvVolumeData"
          :line-data="store.tvLineData"
          :chart-type="store.chartType"
          :height="400"
          :show-volume="true"
          :color="store.currentCoin.color"
          @crosshair-move="handleCrosshairMove"
        />
      </div>
    </div>

    <!-- Info Card -->
    <div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-card-dark dark:to-background-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined text-primary text-xl">info</span>
        <div class="text-sm text-text-secondary">
          <p class="font-medium text-slate-700 dark:text-white mb-1">About TradingView Module</p>
          <ul class="list-disc list-inside space-y-1">
            <li>Charts are powered by the <strong>TradingView Lightweight Charts</strong> library</li>
            <li>Data is sourced from <strong>CoinGecko API</strong> and cached locally</li>
            <li>Prices are shown in <strong>USD</strong> and converted to <strong>COP (Colombian Peso)</strong></li>
            <li>Use the <strong>Sync</strong> button to fetch the latest data from CoinGecko</li>
          </ul>
        </div>
      </div>
    </div>


  </div>
</template>

<style scoped>
.tradingview-content {
  @apply max-w-full;
}
</style>
