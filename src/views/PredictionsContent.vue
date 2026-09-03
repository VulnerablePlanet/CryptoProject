<script setup>
/**
 * PredictionsContent View
 * Main view for cryptocurrency price predictions module
 * 
 * Features:
 * - Exchange and cryptocurrency selection
 * - Timeframe controls
 * - Real-time price predictions with Kalman + Transformer
 * - Interactive TradingView chart with prediction overlay
 * - Prediction statistics display
 */

import { computed, onMounted, ref } from 'vue'
import { usePredictionsStore } from '@/stores/predictions'
import {
  ExchangeSelector,
  CryptoSelector,
  TimeframeSelector,
  PredictionStats,
  PredictionChart,
  MethodologyInfo
} from '@/components/predictions'
import { formatCOPWithFlag } from '@/utils/currency'

// Store
const store = usePredictionsStore()

// Local state
const crosshairData = ref(null)
const isSyncing = ref(false)
const predictionChartRef = ref(null)

// Computed
const isLoading = computed(() => store.isLoading)
const hasError = computed(() => !!store.error)
const hasData = computed(() => store.ohlcvData.length > 0)

// Format last updated time
const lastUpdatedText = computed(() => {
  if (!store.lastUpdated) return ''
  return new Date(store.lastUpdated).toLocaleTimeString()
})

// Get volume data for chart
const volumeData = computed(() => {
  return store.ohlcvData.map(candle => ({
    time: Math.floor(candle.time / 1000),
    value: candle.volume,
    close: candle.close,
    open: candle.open
  }))
})

// Merge candlestick data with volume
const candlestickWithVolume = computed(() => {
  return store.candlestickData.map((candle, index) => ({
    ...candle,
    volume: store.ohlcvData[index]?.volume || 0
  }))
})

// Get predicted price (first prediction)
const predictedPrice = computed(() => {
  return store.latestPrediction?.price || 0
})

// Lifecycle
onMounted(async () => {
  await store.initialize()
})

// Event Handlers
function handleExchangeChange(exchangeId) {
  store.changeExchange(exchangeId)
}

function handleSymbolChange(symbol) {
  store.changeSymbol(symbol)
}

function handleTimeframeChange(timeframe) {
  store.changeTimeframe(timeframe)
}

async function handleSync() {
  isSyncing.value = true
  await store.refresh()
  isSyncing.value = false
}

function handleCrosshairMove(data) {
  crosshairData.value = data
}

function dismissError() {
  store.clearError()
}
</script>

<template>
  <div class="predictions-content space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-3xl lg:text-4xl">
            auto_graph
          </span>
          Price Predictions
        </h1>
        <p class="text-text-secondary mt-1">
          AI-powered cryptocurrency price predictions using Kalman Filter + Transformers
        </p>
      </div>
      
      <!-- Sync Button & Status -->
      <div class="flex items-center gap-3">
        <!-- Cache Hit Indicator -->
        <span 
          v-if="store.cacheHit" 
          class="text-xs px-2 py-1 bg-success/10 text-success rounded-full flex items-center gap-1 hidden lg:flex"
        >
          <span class="material-symbols-outlined text-sm">bolt</span>
          Cached
        </span>
        
        <!-- Last Updated -->
        <span v-if="lastUpdatedText" class="text-xs text-text-secondary hidden lg:block">
          Updated: {{ lastUpdatedText }}
        </span>
        
        <!-- Sync Button -->
        <button
          @click="handleSync"
          :disabled="isLoading || isSyncing"
          class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span 
            :class="[
              'material-symbols-outlined text-lg',
              isSyncing ? 'animate-spin' : ''
            ]"
          >
            {{ isSyncing ? 'progress_activity' : 'sync' }}
          </span>
          <span v-if="isSyncing">Syncing...</span>
          <span v-else>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Controls Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex flex-wrap items-end gap-4 lg:gap-6">
        <!-- Exchange Selector -->
        <ExchangeSelector
          :model-value="store.selectedExchange"
          :exchanges="store.exchanges"
          :disabled="isLoading"
          @change="handleExchangeChange"
        />
        
        <!-- Crypto Selector -->
        <CryptoSelector
          :model-value="store.selectedSymbol"
          :symbols="store.symbols"
          :loading="store.isLoadingSymbols"
          :disabled="isLoading"
          @change="handleSymbolChange"
        />
        
        <!-- Timeframe Selector -->
        <TimeframeSelector
          :model-value="store.selectedTimeframe"
          :timeframes="store.timeframes"
          :disabled="isLoading"
          @change="handleTimeframeChange"
        />
        
        <!-- Data Points Badge -->
        <div class="flex items-center gap-2 ml-auto">
          <span class="text-xs text-text-secondary">Data Points:</span>
          <span class="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
            {{ store.ohlcvData.length }}
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
      <span class="text-danger flex-1">{{ store.error }}</span>
      <button 
        @click="dismissError"
        class="text-danger hover:text-danger/70 transition-colors"
      >
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>

    <!-- Prediction Stats Cards -->
    <div v-if="hasData && !isLoading">
      <PredictionStats
        :current-price="store.currentPrice"
        :predicted-price="predictedPrice"
        :price-change="store.expectedChange"
        :confidence="store.predictionConfidence"
        :direction="store.predictionDirection"
        :volatility="store.features.volatility || 0"
        :momentum="store.features.momentum || 0"
        :symbol="store.selectedSymbol"
      />
    </div>

    <!-- Chart Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <!-- Chart Header -->
      <div class="p-4 border-b border-gray-200 dark:border-border-dark flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-primary">candlestick_chart</span>
          <div>
            <h2 class="font-semibold text-slate-900 dark:text-white">
              {{ store.selectedSymbol }} Prediction Chart
            </h2>
            <p class="text-xs text-text-secondary">
              {{ store.currentExchange?.name || 'Exchange' }} • {{ store.selectedTimeframe }}
            </p>
          </div>
        </div>
        
        <!-- Model Badge -->
        <div class="flex items-center gap-2">
          <span class="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded-full">
            Kalman + Transformer
          </span>
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
            <span class="material-symbols-outlined text-4xl text-primary animate-spin">
              progress_activity
            </span>
            <span class="text-text-secondary">Loading prediction data...</span>
          </div>
        </div>
        
        <!-- Chart -->
        <PredictionChart
          v-else-if="hasData"
          ref="predictionChartRef"
          :candlestick-data="candlestickWithVolume"
          :kalman-data="store.kalmanLineData"
          :prediction-data="store.predictionLineData"
          :confidence-data="store.confidenceAreaData"
          :height="400"
          :show-volume="true"
          @crosshair-move="handleCrosshairMove"
        />
        
        <!-- No Data State -->
        <div 
          v-else
          class="flex items-center justify-center"
          :style="{ height: '400px' }"
        >
          <div class="flex flex-col items-center gap-3 text-text-secondary">
            <span class="material-symbols-outlined text-4xl">show_chart</span>
            <span>No data available. Try refreshing or selecting a different pair.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Prediction Table -->
    <div 
      v-if="store.predictions.length > 0 && !isLoading"
      class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden"
    >
      <div class="p-4 border-b border-gray-200 dark:border-border-dark">
        <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary">table_chart</span>
          Prediction Details
        </h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-slate-800">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">Step</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Predicted Price</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Change</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Lower Bound</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Upper Bound</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">Confidence</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-border-dark">
            <tr 
              v-for="pred in store.predictions" 
              :key="pred.step"
              class="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">
                +{{ pred.step }} candle{{ pred.step > 1 ? 's' : '' }}
              </td>
              <td class="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">
                ${{ pred.price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
                <span class="text-yellow-600 dark:text-yellow-400 text-xs font-mono block">
                  {{ formatCOPWithFlag(pred.price) }}
                </span>
              </td>
              <td 
                :class="[
                  'px-4 py-3 text-right font-medium',
                  pred.priceChange >= 0 ? 'text-success' : 'text-danger'
                ]"
              >
                {{ pred.priceChange >= 0 ? '+' : '' }}{{ pred.priceChange?.toFixed(2) }}%
              </td>
              <td class="px-4 py-3 text-right font-mono text-text-secondary">
                ${{ pred.lower?.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
                <span class="text-yellow-600 dark:text-yellow-400 text-xs font-mono block">
                  {{ formatCOPWithFlag(pred.lower) }}
                </span>
              </td>
              <td class="px-4 py-3 text-right font-mono text-text-secondary">
                ${{ pred.upper?.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
                <span class="text-yellow-600 dark:text-yellow-400 text-xs font-mono block">
                  {{ formatCOPWithFlag(pred.upper) }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <span 
                  :class="[
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    pred.confidence >= 0.7 ? 'bg-success/10 text-success' :
                    pred.confidence >= 0.4 ? 'bg-warning/10 text-warning' :
                    'bg-danger/10 text-danger'
                  ]"
                >
                  {{ (pred.confidence * 100).toFixed(0) }}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Methodology Info -->
    <MethodologyInfo
      :noise-reduction="store.metadata.noiseReduction || store.features.noiseReduction || 0"
      :model="store.metadata.model || 'kalman+transformer'"
      :data-points="store.ohlcvData.length"
    />

  </div>
</template>

<style scoped>
.predictions-content {
  @apply max-w-full;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
