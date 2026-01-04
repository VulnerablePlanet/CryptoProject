<script setup>
import { ref, onMounted, computed } from 'vue'
import CandlestickChart from '@/components/crypto/CandlestickChart.vue'
import { calculateAllIndicators, getRSIInterpretation, generateSparklinePath } from '@/utils/technicalIndicators'

// API endpoints for OHLC data
const API_BASE = 'http://localhost:5000/api/ohlc'

// State
const selectedCoin = ref('bitcoin')
const selectedTimeframe = ref('1h')
const loading = ref(false)
const syncing = ref(false)
const error = ref(null)
const candleData = ref([])
const rateLimitMetrics = ref(null)
const supportedCoins = ref([])

// Available timeframes
const timeframes = [
  { value: '5m', label: '5 Min' },
  { value: '15m', label: '15 Min' },
  { value: '30m', label: '30 Min' },
  { value: '1h', label: '1 Hour' },
  { value: '4h', label: '4 Hours' },
  { value: '1d', label: '1 Day' }
]

// Popular coins for quick selection
const popularCoins = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' }
]

// Computed
const currentCoin = computed(() => {
  return popularCoins.find(c => c.id === selectedCoin.value) || { symbol: selectedCoin.value.toUpperCase() }
})

const latestCandle = computed(() => {
  if (candleData.value.length === 0) return null
  return candleData.value[candleData.value.length - 1]
})

const priceChange = computed(() => {
  if (!latestCandle.value) return 0
  return latestCandle.value.priceChangePercent || 0
})

// Technical indicators
const indicators = computed(() => {
  return calculateAllIndicators(candleData.value)
})

const rsiInterpretation = computed(() => {
  return getRSIInterpretation(indicators.value.rsi)
})

// Fetch candle data
const fetchCandles = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await fetch(
      `${API_BASE}/${selectedCoin.value}/candles?timeframe=${selectedTimeframe.value}&limit=100`
    )
    const data = await response.json()
    
    if (data.success) {
      candleData.value = data.candles || []
    } else {
      error.value = data.message || 'Failed to fetch candle data'
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// Sync data from CoinGecko
const syncData = async () => {
  syncing.value = true
  error.value = null
  
  try {
    const response = await fetch(`${API_BASE}/${selectedCoin.value}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeframe: selectedTimeframe.value,
        vs_currency: 'usd'
      })
    })
    const data = await response.json()
    
    if (data.success) {
      // Refresh candles after sync
      await fetchCandles()
    } else {
      error.value = data.message || 'Sync failed'
    }
  } catch (err) {
    error.value = err.message
  } finally {
    syncing.value = false
  }
}

// Fetch rate limit metrics
const fetchMetrics = async () => {
  try {
    const response = await fetch(`${API_BASE}/status`)
    const data = await response.json()
    if (data.success) {
      rateLimitMetrics.value = data.service
    }
  } catch (err) {
    console.error('Failed to fetch metrics:', err)
  }
}

// Exchange rate USD to COP
const copRate = 4400

const formatPrice = (value) => {
  if (!value) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 6 : 2
  }).format(value)
}

const formatCOP = (value) => {
  if (!value) return 'COP $0'
  const cop = value * copRate
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cop)
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString()
}

// Lifecycle
onMounted(() => {
  fetchCandles()
  fetchMetrics()
})

// Watch for changes
const handleCoinChange = () => {
  fetchCandles()
}

const handleTimeframeChange = () => {
  fetchCandles()
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-3xl">analytics</span>
          Technical Analysis
        </h1>
        <p class="text-text-secondary mt-1">
          OHLC candlestick charts and market data powered by CoinGecko
        </p>
      </div>
      
      <div class="flex items-center gap-3">
        <button
          @click="syncData"
          :disabled="syncing"
          class="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <span class="material-symbols-outlined text-[20px]" :class="{ 'animate-spin': syncing }">
            {{ syncing ? 'refresh' : 'sync' }}
          </span>
          {{ syncing ? 'Syncing...' : 'Sync Data' }}
        </button>
      </div>
    </div>

    <!-- Controls -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex flex-wrap items-center gap-4">
        <!-- Coin Selector -->
        <div>
          <label class="block text-xs text-text-secondary mb-1">Coin</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="coin in popularCoins"
              :key="coin.id"
              @click="selectedCoin = coin.id; handleCoinChange()"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              :class="selectedCoin === coin.id 
                ? 'bg-primary text-white' 
                : 'bg-gray-100 dark:bg-background-dark text-slate-600 dark:text-text-secondary hover:bg-gray-200 dark:hover:bg-border-dark'"
            >
              {{ coin.symbol }}
            </button>
          </div>
        </div>
        
        <div class="h-8 w-px bg-gray-200 dark:bg-border-dark hidden lg:block"></div>
        
        <!-- Timeframe Selector -->
        <div>
          <label class="block text-xs text-text-secondary mb-1">Timeframe</label>
          <div class="flex gap-1">
            <button
              v-for="tf in timeframes"
              :key="tf.value"
              @click="selectedTimeframe = tf.value; handleTimeframeChange()"
              class="px-2.5 py-1.5 rounded text-xs font-medium transition-all"
              :class="selectedTimeframe === tf.value 
                ? 'bg-primary/10 text-primary border border-primary/30' 
                : 'bg-gray-50 dark:bg-background-dark text-slate-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-border-dark'"
            >
              {{ tf.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center gap-3">
      <span class="material-symbols-outlined text-danger">error</span>
      <p class="text-danger text-sm">{{ error }}</p>
      <button @click="error = null" class="ml-auto text-danger hover:text-danger/80">
        <span class="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">Current Price</p>
        <p class="text-xl font-bold font-mono text-slate-900 dark:text-white">
          {{ formatPrice(latestCandle?.close) }}
        </p>
        <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
          🇨🇴 {{ formatCOP(latestCandle?.close) }}
        </p>
      </div>
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">24h Change</p>
        <p class="text-xl font-bold font-mono" :class="priceChange >= 0 ? 'text-success' : 'text-danger'">
          {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
        </p>
      </div>
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">High</p>
        <p class="text-xl font-bold font-mono text-success">
          {{ formatPrice(latestCandle?.high) }}
        </p>
        <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
          🇨🇴 {{ formatCOP(latestCandle?.high) }}
        </p>
      </div>
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">Low</p>
        <p class="text-xl font-bold font-mono text-danger">
          {{ formatPrice(latestCandle?.low) }}
        </p>
        <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
          🇨🇴 {{ formatCOP(latestCandle?.low) }}
        </p>
      </div>
    </div>

    <!-- Technical Indicators -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <h3 class="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-primary">show_chart</span>
        Technical Indicators
        <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">{{ currentCoin.symbol }}</span>
      </h3>
      
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- RSI -->
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-xl">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-text-secondary font-medium">RSI (14)</span>
            <div class="flex items-center gap-2">
              <svg v-if="indicators.rsiHistory?.length > 1" width="50" height="20" class="overflow-visible">
                <path 
                  :d="generateSparklinePath(indicators.rsiHistory, 50, 20)" 
                  fill="none" 
                  :stroke="indicators.rsi >= 70 ? '#ef4444' : indicators.rsi <= 30 ? '#10b981' : '#137fec'" 
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span 
                class="text-xs font-bold px-2 py-0.5 rounded"
                :class="{
                  'text-danger bg-danger/10': rsiInterpretation.color === 'danger',
                  'text-success bg-success/10': rsiInterpretation.color === 'success',
                  'text-gray-500 bg-gray-100': rsiInterpretation.color === 'gray'
                }"
              >
                {{ rsiInterpretation.status }}
              </span>
            </div>
          </div>
          <p class="text-2xl font-bold font-mono" :class="{
            'text-danger': indicators.rsi >= 70,
            'text-success': indicators.rsi <= 30,
            'text-slate-900 dark:text-white': indicators.rsi > 30 && indicators.rsi < 70
          }">
            {{ indicators.rsi?.toFixed(2) || 'N/A' }}
          </p>
          <!-- RSI Bar -->
          <div class="mt-2 h-2 bg-gray-200 dark:bg-border-dark rounded-full overflow-hidden">
            <div 
              class="h-full transition-all duration-300"
              :class="{
                'bg-danger': indicators.rsi >= 70,
                'bg-success': indicators.rsi <= 30,
                'bg-primary': indicators.rsi > 30 && indicators.rsi < 70
              }"
              :style="{ width: `${indicators.rsi || 0}%` }"
            ></div>
          </div>
          <p class="text-[10px] text-text-secondary mt-1">{{ rsiInterpretation.description }}</p>
        </div>

        <!-- SMA 7 -->
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-secondary font-medium">SMA (7)</span>
            <svg v-if="indicators.sma7History?.length > 1" width="60" height="24" class="overflow-visible">
              <path 
                :d="generateSparklinePath(indicators.sma7History, 60, 24)" 
                fill="none" 
                stroke="#137fec" 
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
            {{ formatPrice(indicators.sma7) }}
          </p>
          <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
            🇨🇴 {{ formatCOP(indicators.sma7) }}
          </p>
        </div>

        <!-- SMA 14 -->
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-secondary font-medium">SMA (14)</span>
            <svg v-if="indicators.sma14History?.length > 1" width="60" height="24" class="overflow-visible">
              <path 
                :d="generateSparklinePath(indicators.sma14History, 60, 24)" 
                fill="none" 
                stroke="#8b5cf6" 
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
            {{ formatPrice(indicators.sma14) }}
          </p>
          <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
            🇨🇴 {{ formatCOP(indicators.sma14) }}
          </p>
        </div>

        <!-- SMA 30 -->
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-secondary font-medium">SMA (30)</span>
            <svg v-if="indicators.sma30History?.length > 1" width="60" height="24" class="overflow-visible">
              <path 
                :d="generateSparklinePath(indicators.sma30History, 60, 24)" 
                fill="none" 
                stroke="#f59e0b" 
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
            {{ formatPrice(indicators.sma30) }}
          </p>
          <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
            🇨🇴 {{ formatCOP(indicators.sma30) }}
          </p>
        </div>
      </div>

      <!-- EMA Row -->
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        <!-- EMA 12 -->
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-secondary font-medium">EMA (12)</span>
            <svg v-if="indicators.ema12History?.length > 1" width="60" height="24" class="overflow-visible">
              <path 
                :d="generateSparklinePath(indicators.ema12History, 60, 24)" 
                fill="none" 
                stroke="#10b981" 
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
            {{ formatPrice(indicators.ema12) }}
          </p>
          <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
            🇨🇴 {{ formatCOP(indicators.ema12) }}
          </p>
        </div>

        <!-- EMA 26 -->
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-secondary font-medium">EMA (26)</span>
            <svg v-if="indicators.ema26History?.length > 1" width="60" height="24" class="overflow-visible">
              <path 
                :d="generateSparklinePath(indicators.ema26History, 60, 24)" 
                fill="none" 
                stroke="#ef4444" 
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
            {{ formatPrice(indicators.ema26) }}
          </p>
          <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
            🇨🇴 {{ formatCOP(indicators.ema26) }}
          </p>
        </div>

        <!-- MACD -->
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs text-text-secondary font-medium">MACD</span>
            <svg v-if="indicators.macdHistory?.length > 1" width="60" height="24" class="overflow-visible">
              <path 
                :d="generateSparklinePath(indicators.macdHistory, 60, 24)" 
                fill="none" 
                :stroke="indicators.macd?.macd >= 0 ? '#10b981' : '#ef4444'" 
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <p class="text-lg font-bold font-mono mt-1" :class="indicators.macd?.macd >= 0 ? 'text-success' : 'text-danger'">
            {{ indicators.macd?.macd?.toFixed(2) || 'N/A' }}
          </p>
          <p class="text-[10px] text-text-secondary">EMA12 - EMA26</p>
        </div>
      </div>
    </div>

    <!-- Chart -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl">
      <div class="p-4 border-b border-gray-200 dark:border-border-dark flex items-center justify-between">
        <h2 class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">candlestick_chart</span>
          {{ currentCoin.symbol }}/USD - {{ selectedTimeframe.toUpperCase() }}
        </h2>
        <span class="text-xs text-text-secondary">
          {{ candleData.length }} candles
        </span>
      </div>
      
      <div class="min-h-[550px]">
        <div v-if="loading" class="h-[500px] flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p class="text-text-secondary text-sm">Loading chart data...</p>
          </div>
        </div>
        <div v-else-if="candleData.length === 0" class="h-[500px] flex items-center justify-center">
          <div class="text-center">
            <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">insert_chart</span>
            <p class="text-text-secondary mt-2">No data available. Click "Sync Data" to fetch candles.</p>
          </div>
        </div>
        <CandlestickChart
          v-else
          :candles="candleData"
          :height="500"
          :showVolume="true"
        />
      </div>
    </div>

    <!-- Candle Data Table -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <div class="p-4 border-b border-gray-200 dark:border-border-dark">
        <h2 class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">table_chart</span>
          Recent Candles
          <span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
            {{ currentCoin.symbol }}
          </span>
        </h2>
      </div>
      
      <div class="overflow-x-auto max-h-[300px]">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-background-dark text-text-secondary text-xs sticky top-0">
            <tr>
              <th class="px-4 py-3 text-left font-medium">Time</th>
              <th class="px-4 py-3 text-right font-medium">Open</th>
              <th class="px-4 py-3 text-right font-medium">High</th>
              <th class="px-4 py-3 text-right font-medium">Low</th>
              <th class="px-4 py-3 text-right font-medium">Close</th>
              <th class="px-4 py-3 text-right font-medium">Volume</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-border-dark/50">
            <tr 
              v-for="candle in [...candleData].reverse().slice(0, 20)" 
              :key="candle.timestamp"
              class="hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <td class="px-4 py-2 text-slate-500 dark:text-text-secondary font-mono text-xs">
                {{ formatTimestamp(candle.timestamp) }}
              </td>
              <td class="px-4 py-2 text-right">
                <div class="flex flex-col items-end">
                  <span class="font-mono text-slate-900 dark:text-white">{{ formatPrice(candle.open) }}</span>
                  <span class="text-yellow-600 dark:text-yellow-400 text-[10px] font-mono">🇨🇴 {{ formatCOP(candle.open) }}</span>
                </div>
              </td>
              <td class="px-4 py-2 text-right">
                <div class="flex flex-col items-end">
                  <span class="font-mono text-success">{{ formatPrice(candle.high) }}</span>
                  <span class="text-yellow-600 dark:text-yellow-400 text-[10px] font-mono">🇨🇴 {{ formatCOP(candle.high) }}</span>
                </div>
              </td>
              <td class="px-4 py-2 text-right">
                <div class="flex flex-col items-end">
                  <span class="font-mono text-danger">{{ formatPrice(candle.low) }}</span>
                  <span class="text-yellow-600 dark:text-yellow-400 text-[10px] font-mono">🇨🇴 {{ formatCOP(candle.low) }}</span>
                </div>
              </td>
              <td class="px-4 py-2 text-right">
                <div class="flex flex-col items-end">
                  <span class="font-mono font-medium text-slate-900 dark:text-white">{{ formatPrice(candle.close) }}</span>
                  <span class="text-yellow-600 dark:text-yellow-400 text-[10px] font-mono">🇨🇴 {{ formatCOP(candle.close) }}</span>
                </div>
              </td>
              <td class="px-4 py-2 text-right font-mono text-slate-500 dark:text-text-secondary text-xs">
                {{ candle.volume ? (candle.volume / 1e9).toFixed(2) + 'B' : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Rate Limit Status -->
    <div v-if="rateLimitMetrics" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <h3 class="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
        <span class="material-symbols-outlined text-warning">speed</span>
        API Rate Limit Status
      </h3>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p class="text-text-secondary text-xs">Queue Length</p>
          <p class="font-mono font-bold text-slate-900 dark:text-white">{{ rateLimitMetrics.queueLength || 0 }}</p>
        </div>
        <div>
          <p class="text-text-secondary text-xs">Backoff Multiplier</p>
          <p class="font-mono font-bold" :class="rateLimitMetrics.currentBackoffMultiplier > 1 ? 'text-warning' : 'text-success'">
            {{ rateLimitMetrics.currentBackoffMultiplier || 1 }}x
          </p>
        </div>
        <div>
          <p class="text-text-secondary text-xs">Cache Size</p>
          <p class="font-mono font-bold text-slate-900 dark:text-white">{{ rateLimitMetrics.cacheSize || 0 }}</p>
        </div>
        <div>
          <p class="text-text-secondary text-xs">Status</p>
          <p class="font-bold" :class="rateLimitMetrics.isProcessing ? 'text-warning' : 'text-success'">
            {{ rateLimitMetrics.isProcessing ? 'Processing' : 'Ready' }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
