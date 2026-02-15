<script setup>
/**
 * FibonacciContent View
 * Main view for Fibonacci Analysis module
 * 
 * Features:
 * - Automatic pivot detection (ZigZag algorithm)
 * - Fibonacci retracement levels (0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%)
 * - Fibonacci extensions for Take Profits (127.2%, 161.8%, 261.8%)
 * - TradingView chart with level overlays
 */

import { onMounted, computed, ref } from 'vue'
import { useFibonacciStore } from '@/stores/fibonacci'
import FibonacciChart from '@/components/fibonacci/FibonacciChart.vue'
import FibonacciLevels from '@/components/fibonacci/FibonacciLevels.vue'

// Store
const store = useFibonacciStore()

// Local state for candle data (we need OHLC for the chart)
const candleData = ref([])
const loadingCandles = ref(false)

// Computed
const isLoading = computed(() => store.loading || loadingCandles.value)
const hasError = computed(() => !!store.error)
const hasAnalysis = computed(() => !!store.analysis)

// Format last updated
const lastUpdatedText = computed(() => {
  if (!store.lastUpdated) return ''
  return new Date(store.lastUpdated).toLocaleTimeString('es-CO')
})

// Fetch candle data for chart
const fetchCandleData = async () => {
  loadingCandles.value = true
  try {
    const baseUrl = import.meta.env.PROD ? '/api/ohlc' : 'http://localhost:5000/api/ohlc'
    const response = await fetch(`${baseUrl}/${store.selectedCoin}/candles?timeframe=${store.selectedTimeframe}&limit=100`)
    const data = await response.json()
    if (data.success) {
      candleData.value = data.candles || []
    }
  } catch (error) {
    console.error('Error fetching candles:', error)
  } finally {
    loadingCandles.value = false
  }
}

// Event handlers
const handleCoinSelect = async (coinId) => {
  await store.changeCoin(coinId)
  await fetchCandleData()
}

const handleTimeframeSelect = async (timeframe) => {
  await store.changeTimeframe(timeframe)
  await fetchCandleData()
}

const handleRefresh = async () => {
  await store.refresh()
  await fetchCandleData()
}

// Lifecycle
onMounted(async () => {
  await store.initialize()
  await fetchCandleData()
})
</script>

<template>
  <div class="fibonacci-content space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <span class="material-symbols-outlined text-warning text-3xl">ssid_chart</span>
          Análisis Fibonacci
        </h1>
        <p class="text-text-secondary mt-1">
          Detección automática de pivotes y niveles de retroceso/extensión
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <span v-if="lastUpdatedText" class="text-xs text-text-secondary hidden lg:block">
          Actualizado: {{ lastUpdatedText }}
        </span>
        <button
          @click="handleRefresh"
          :disabled="isLoading"
          class="flex items-center gap-2 bg-warning hover:bg-warning/90 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span 
            class="material-symbols-outlined text-[20px]"
            :class="{ 'animate-spin': isLoading }"
          >
            {{ isLoading ? 'refresh' : 'calculate' }}
          </span>
          {{ isLoading ? 'Analizando...' : 'Recalcular' }}
        </button>
      </div>
    </div>

    <!-- Controls Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex flex-wrap items-end gap-4 lg:gap-6">
        <!-- Coin Selector -->
        <div>
          <label class="block text-xs text-text-secondary mb-2">Criptomoneda</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="coin in store.supportedCoins"
              :key="coin.id"
              @click="handleCoinSelect(coin.id)"
              :disabled="isLoading"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
              :class="store.selectedCoin === coin.id
                ? 'bg-warning text-white'
                : 'bg-gray-100 dark:bg-background-dark text-slate-600 dark:text-text-secondary hover:bg-gray-200 dark:hover:bg-border-dark'"
            >
              {{ coin.symbol }}
            </button>
          </div>
        </div>

        <div class="h-10 w-px bg-gray-200 dark:bg-border-dark hidden lg:block"></div>

        <!-- Timeframe Selector -->
        <div>
          <label class="block text-xs text-text-secondary mb-2">Temporalidad</label>
          <div class="flex gap-1">
            <button
              v-for="tf in store.timeframes"
              :key="tf.value"
              @click="handleTimeframeSelect(tf.value)"
              :disabled="isLoading"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 relative"
              :class="store.selectedTimeframe === tf.value
                ? 'bg-warning/10 text-warning border border-warning/30'
                : 'bg-gray-50 dark:bg-background-dark text-slate-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-border-dark'"
            >
              {{ tf.label }}
              <span 
                v-if="tf.recommended" 
                class="absolute -top-1 -right-1 w-2 h-2 bg-warning rounded-full"
              ></span>
            </button>
          </div>
          <p class="text-[10px] text-text-secondary mt-1">
            ⭐ 4H y 1D recomendados para Fibonacci
          </p>
        </div>

        <!-- Analysis Info -->
        <div class="ml-auto flex items-center gap-4">
          <div v-if="store.analysis?.meta" class="text-right hidden lg:block">
            <p class="text-xs text-text-secondary">Velas analizadas</p>
            <p class="text-lg font-bold text-slate-900 dark:text-white">
              {{ store.analysis.meta.analyzedCandles }}
            </p>
          </div>
          <div v-if="store.analysis?.meta" class="text-right hidden lg:block">
            <p class="text-xs text-text-secondary">Pivotes detectados</p>
            <p class="text-lg font-bold text-warning">
              {{ store.analysis.meta.pivotCount }}
            </p>
          </div>
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

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Chart (2 columns) -->
      <div class="lg:col-span-2">
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
          <!-- Chart Header -->
          <div class="p-4 border-b border-gray-200 dark:border-border-dark flex items-center justify-between">
            <h2 class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-warning">candlestick_chart</span>
              {{ store.currentCoin.symbol }}/USD
              <span class="text-xs px-2 py-0.5 bg-gray-100 dark:bg-background-dark text-text-secondary rounded-full font-normal">
                {{ store.currentTimeframe.description }}
              </span>
            </h2>
            
            <!-- Trend Badge -->
            <div 
              v-if="hasAnalysis"
              class="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold"
              :class="{
                'bg-success/20 text-success': store.isBullish,
                'bg-danger/20 text-danger': store.isBearish,
                'bg-gray-200 dark:bg-border-dark text-text-secondary': store.trend === 'neutral'
              }"
            >
              <span class="material-symbols-outlined text-[18px]">
                {{ store.isBullish ? 'trending_up' : store.isBearish ? 'trending_down' : 'trending_flat' }}
              </span>
              {{ store.isBullish ? 'Alcista' : store.isBearish ? 'Bajista' : 'Neutral' }}
            </div>
          </div>

          <!-- Chart Container -->
          <div class="p-4">
            <!-- Loading State -->
            <div 
              v-if="isLoading && !hasAnalysis" 
              class="flex items-center justify-center"
              style="height: 500px"
            >
              <div class="flex flex-col items-center gap-3">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-warning"></div>
                <p class="text-text-secondary text-sm">Detectando pivotes y calculando niveles...</p>
              </div>
            </div>

            <!-- Chart -->
            <FibonacciChart
              v-else
              :candle-data="candleData"
              :fib-levels="store.allLevels"
              :pivots="store.pivots"
              :trend="store.trend"
              :height="500"
            />
          </div>
        </div>

        <!-- Info Card -->
        <div class="mt-4 bg-gradient-to-br from-warning/5 to-warning/10 border border-warning/20 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-warning text-xl">lightbulb</span>
            <div class="text-sm text-text-secondary">
              <p class="font-medium text-slate-700 dark:text-white mb-1">¿Cómo funciona el Auto-Fibonacci?</p>
              <ul class="list-disc list-inside space-y-1 text-xs">
                <li>El algoritmo <strong>ZigZag</strong> detecta automáticamente los Swing High y Swing Low más recientes</li>
                <li>Los niveles de <strong>retroceso</strong> (23.6%, 38.2%, 61.8%) son zonas potenciales de soporte</li>
                <li>El <strong>Golden Pocket</strong> (61.8%) es el nivel más importante para entradas</li>
                <li>Las <strong>extensiones</strong> son objetivos de Take Profit cuando el precio rompe el 100%</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Levels Panel (1 column) -->
      <div class="lg:col-span-1">
        <FibonacciLevels
          v-if="hasAnalysis"
          :retracement-levels="store.retracementLevels"
          :extension-levels="store.extensionLevels"
          :current-price="store.currentPrice"
          :trend="store.trend"
          :swing-high="store.swingHigh"
          :swing-low="store.swingLow"
          :nearest-level="store.nearestLevel"
        />

        <!-- Empty State -->
        <div 
          v-else-if="!isLoading"
          class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-8 text-center"
        >
          <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">ssid_chart</span>
          <p class="text-text-secondary mt-3">
            Selecciona una criptomoneda y temporalidad para ver el análisis Fibonacci
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fibonacci-content {
  @apply max-w-full;
}
</style>
