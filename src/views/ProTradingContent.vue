<script setup>
/**
 * ProTradingContent View
 * Main view for Pro Trading module with CCXT & TA-Lib integration
 * 
 * Features:
 * - Multi-exchange support via CCXT
 * - Candlestick and Heikin-Ashi charts
 * - Technical indicator overlays (Bollinger Bands, SMA, EMA)
 * - Oscillator panels (RSI, MACD)
 * - Order book depth chart
 * - Pattern detection markers
 */

import { onMounted, computed, defineAsyncComponent } from 'vue'
import { useProTradingStore } from '@/stores/proTrading'
import { formatUSD, formatCOPWithFlag, getCopRate, formatCOP, formatCompact } from '@/utils/currency'

// Components
const ProTradingChart = defineAsyncComponent(() => import('@/components/protrading/ProTradingChart.vue'))
import OscillatorPanel from '@/components/protrading/OscillatorPanel.vue'
import DepthChart from '@/components/protrading/DepthChart.vue'
import ExchangeSelector from '@/components/protrading/ExchangeSelector.vue'
import SymbolSelector from '@/components/protrading/SymbolSelector.vue'
import ChartControls from '@/components/protrading/ChartControls.vue'
import IndicatorSettings from '@/components/protrading/IndicatorSettings.vue'

// Store
const store = useProTradingStore()

// Computed
const isLoading = computed(() => store.loading)
const isSyncing = computed(() => store.syncing)
const hasError = computed(() => !!store.error)

// Last updated text
const lastUpdatedText = computed(() => {
  if (!store.lastUpdated) return ''
  return new Date(store.lastUpdated).toLocaleTimeString()
})

// Lifecycle
onMounted(() => {
  store.initialize()
})

// Event Handlers
const handleExchangeSelect = (exchangeId) => {
  store.changeExchange(exchangeId)
}

const handleSymbolSelect = (base, quote) => {
  store.changeSymbol(base, quote)
}

const handleTimeframeChange = (timeframe) => {
  store.changeTimeframe(timeframe)
}

const handleChartTypeChange = (type) => {
  store.changeChartType(type)
}

const handleOscillatorChange = (type) => {
  store.changeOscillator(type)
}

const handleSync = () => {
  store.syncData()
}

const handleIndicatorSettingUpdate = (indicator, setting, value) => {
  store.updateOverlaySetting(indicator, setting, value)
}

// Format helpers

const formatVolume = (value) => {
  if (!value) return '-'
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B'
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M'
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K'
  return value.toFixed(2)
}
</script>

<template>
  <div class="pro-trading-content space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-3xl">finance_mode</span>
          Pro Trading
        </h1>
        <p class="text-text-secondary mt-1">
          Multi-exchange trading charts powered by CCXT & TradingView
        </p>
      </div>
      
      <!-- Actions -->
      <div class="flex items-center gap-3">
        <!-- Cache indicator -->
        <span 
          v-if="store.fromCache" 
          class="text-xs px-2 py-1 bg-success/10 text-success rounded-full flex items-center gap-1 hidden lg:flex"
        >
          <span class="material-symbols-outlined text-[14px]">bolt</span>
          Cached
        </span>
        
        <!-- Last updated -->
        <span v-if="lastUpdatedText" class="text-xs text-text-secondary hidden lg:block">
          Updated: {{ lastUpdatedText }}
        </span>
        
        <!-- Settings button -->
        <button
          @click="store.toggleIndicatorSettings"
          class="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all
                 bg-gray-100 dark:bg-card-dark text-slate-600 dark:text-text-secondary
                 hover:bg-gray-200 dark:hover:bg-border-dark"
          :class="{ 'bg-primary/10 text-primary': store.showIndicatorSettings }"
        >
          <span class="material-symbols-outlined text-[20px]">tune</span>
          <span class="hidden lg:inline">Indicators</span>
        </button>
        
        <!-- Depth chart toggle -->
        <button
          @click="store.toggleDepthChart"
          class="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all
                 bg-gray-100 dark:bg-card-dark text-slate-600 dark:text-text-secondary
                 hover:bg-gray-200 dark:hover:bg-border-dark"
          :class="{ 'bg-primary/10 text-primary': store.showDepthChart }"
        >
          <span class="material-symbols-outlined text-[20px]">waterfall_chart</span>
          <span class="hidden lg:inline">Depth</span>
        </button>
        
        <!-- Sync button -->
        <button
          @click="handleSync"
          :disabled="isSyncing"
          class="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
        >
          <span 
            class="material-symbols-outlined text-[20px]" 
            :class="{ 'animate-spin': isSyncing }"
          >
            {{ isSyncing ? 'refresh' : 'sync' }}
          </span>
          {{ isSyncing ? 'Syncing...' : 'Sync' }}
        </button>
      </div>
    </div>

    <!-- Controls Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex flex-wrap items-end gap-4 lg:gap-6">
        <!-- Exchange Selector -->
        <ExchangeSelector
          :exchanges="store.exchanges"
          :selected-exchange="store.selectedExchange"
          :disabled="isLoading"
          @select="handleExchangeSelect"
        />
        
        <div class="h-10 w-px bg-gray-200 dark:bg-border-dark hidden lg:block"></div>
        
        <!-- Symbol Selector -->
        <SymbolSelector
          :symbols="store.POPULAR_SYMBOLS"
          :selected-base="store.selectedSymbol.base"
          :selected-quote="store.selectedSymbol.quote"
          :disabled="isLoading"
          @select="handleSymbolSelect"
        />
        
        <div class="h-10 w-px bg-gray-200 dark:bg-border-dark hidden lg:block"></div>
        
        <!-- Chart Controls -->
        <ChartControls
          :timeframes="store.TIMEFRAMES"
          :selected-timeframe="store.selectedTimeframe"
          :chart-types="store.CHART_TYPES"
          :selected-chart-type="store.chartType"
          :oscillator-types="store.OSCILLATOR_TYPES"
          :selected-oscillator="store.selectedOscillator"
          :disabled="isLoading"
          @timeframe-change="handleTimeframeChange"
          @chart-type-change="handleChartTypeChange"
          @oscillator-change="handleOscillatorChange"
        />
        
        <!-- Candle count badge -->
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
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <!-- Current Price -->
      <div class="col-span-2 lg:col-span-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">Current Price</p>
        <p class="text-xl lg:text-2xl font-bold font-mono text-slate-900 dark:text-white">
          {{ formatUSD(store.currentPrice) }}
        </p>
        <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono mt-1">
          🇨🇴 {{ formatCOP(store.currentPrice) }}
        </p>
      </div>
      
      <!-- Price Change -->
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">Change</p>
        <p 
          class="text-xl font-bold font-mono"
          :class="store.priceChange >= 0 ? 'text-success' : 'text-danger'"
        >
          {{ store.priceChange >= 0 ? '+' : '' }}{{ store.priceChange.toFixed(2) }}%
        </p>
      </div>
      
      <!-- High -->
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">High</p>
        <p class="text-lg font-bold font-mono text-success">{{ formatUSD(store.highPrice) }}</p>
        <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono mt-1">
          🇨🇴 {{ formatCOP(store.highPrice) }}
        </p>
      </div>
      
      <!-- Low -->
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">Low</p>
        <p class="text-lg font-bold font-mono text-danger">{{ formatUSD(store.lowPrice) }}</p>
        <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono mt-1">
          🇨🇴 {{ formatCOP(store.lowPrice) }}
        </p>
      </div>
      
      <!-- Volume -->
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
        <p class="text-xs text-text-secondary mb-1">Volume</p>
        <p class="text-lg font-bold font-mono text-slate-900 dark:text-white">{{ formatVolume(store.volume) }}</p>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Chart Section (3 columns) -->
      <div class="lg:col-span-3 space-y-0">
        <!-- Main Chart Card -->
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-t-xl overflow-hidden">
          <!-- Chart Header -->
          <div class="p-4 border-b border-gray-200 dark:border-border-dark flex items-center justify-between">
            <h2 class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">candlestick_chart</span>
              {{ store.currentSymbol }}
              <span class="text-xs px-2 py-0.5 bg-gray-100 dark:bg-background-dark text-text-secondary rounded-full font-normal">
                {{ store.currentTimeframe.description }}
              </span>
              <span 
                v-if="store.chartType === 'heikinashi'" 
                class="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full"
              >
                Heikin-Ashi
              </span>
            </h2>
            
            <!-- Exchange badge -->
            <span class="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium capitalize">
              {{ store.selectedExchange }}
            </span>
          </div>
          
          <!-- Chart Container -->
          <div class="p-4">
            <!-- Loading State -->
            <div 
              v-if="isLoading" 
              class="flex items-center justify-center"
              style="height: 400px"
            >
              <div class="flex flex-col items-center gap-3">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                <p class="text-text-secondary text-sm">Loading chart data...</p>
              </div>
            </div>
            
            <!-- Chart -->
            <Suspense v-else>
              <ProTradingChart
                :candle-data="store.tvCandleData"
                :volume-data="store.tvVolumeData"
                :line-data="store.tvLineData"
                :chart-type="store.chartType"
                :height="400"
                :show-volume="true"
                :bollinger-bands="store.bollingerBandsData"
                :sma-lines="store.smaData"
                :ema-lines="store.emaData"
              />
              <template #fallback>
                <div class="flex items-center justify-center" style="height: 400px">
                  <div class="flex flex-col items-center gap-3">
                    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                    <p class="text-text-secondary text-sm">Loading chart library...</p>
                  </div>
                </div>
              </template>
            </Suspense>
          </div>
        </div>
        
        <!-- Oscillator Panel -->
        <div class="bg-white dark:bg-card-dark border-x border-b border-gray-200 dark:border-border-dark rounded-b-xl overflow-hidden">
          <OscillatorPanel
            :type="store.selectedOscillator"
            :rsi-data="store.rsiData"
            :macd-data="store.macdData"
            :height="150"
          />
        </div>
        
        <!-- Heikin-Ashi Trend Indicator -->
        <div 
          v-if="store.chartType === 'heikinashi' && store.haTrend"
          class="mt-4 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4"
        >
          <div class="flex items-center gap-4">
            <span class="material-symbols-outlined text-2xl" :class="{
              'text-success': store.haTrend.trend === 'bullish',
              'text-danger': store.haTrend.trend === 'bearish',
              'text-yellow-500': store.haTrend.trend === 'neutral'
            }">
              {{ store.haTrend.trend === 'bullish' ? 'trending_up' : store.haTrend.trend === 'bearish' ? 'trending_down' : 'trending_flat' }}
            </span>
            <div>
              <p class="font-medium text-slate-900 dark:text-white capitalize">
                {{ store.haTrend.trend }} Trend
              </p>
              <p class="text-xs text-text-secondary">
                Strength: {{ (store.haTrend.strength * 100).toFixed(0) }}% 
                ({{ store.haTrend.bullishCount }} bullish, {{ store.haTrend.bearishCount }} bearish candles)
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Right Sidebar (1 column) -->
      <div class="space-y-6">
        <!-- Indicator Settings Panel -->
        <IndicatorSettings
          v-if="store.showIndicatorSettings"
          :settings="store.overlaySettings"
          @update="handleIndicatorSettingUpdate"
          @close="store.toggleIndicatorSettings"
        />
        
        <!-- Depth Chart -->
        <DepthChart
          v-if="store.showDepthChart"
          :depth-data="store.depthData"
          :height="200"
        />
        
        <!-- RSI Indicator Card -->
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-text-secondary">RSI (14)</span>
            <span 
              class="text-xs font-bold px-2 py-0.5 rounded"
              :class="{
                'text-danger bg-danger/10': store.rsiInterpretation.color === 'danger',
                'text-success bg-success/10': store.rsiInterpretation.color === 'success',
                'text-gray-500 bg-gray-100': store.rsiInterpretation.color === 'gray'
              }"
            >
              {{ store.rsiInterpretation.status }}
            </span>
          </div>
          <p 
            class="text-2xl font-bold font-mono"
            :class="{
              'text-danger': store.currentRSI >= 70,
              'text-success': store.currentRSI <= 30,
              'text-slate-900 dark:text-white': store.currentRSI > 30 && store.currentRSI < 70
            }"
          >
            {{ store.currentRSI?.toFixed(2) || 'N/A' }}
          </p>
          <!-- RSI Bar -->
          <div class="mt-2 h-2 bg-gray-200 dark:bg-border-dark rounded-full overflow-hidden">
            <div 
              class="h-full transition-all duration-300"
              :class="{
                'bg-danger': store.currentRSI >= 70,
                'bg-success': store.currentRSI <= 30,
                'bg-primary': store.currentRSI > 30 && store.currentRSI < 70
              }"
              :style="{ width: `${store.currentRSI || 0}%` }"
            ></div>
          </div>
          <p class="text-[10px] text-text-secondary mt-1">{{ store.rsiInterpretation.description }}</p>
        </div>
        
        <!-- Exchange Info Card -->
        <div class="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 border border-primary/20 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-xl">info</span>
            <div class="text-sm text-text-secondary">
              <p class="font-medium text-slate-700 dark:text-white mb-1">About Pro Trading</p>
              <ul class="list-disc list-inside space-y-1 text-xs">
                <li>Data from <strong>{{ store.selectedExchange }}</strong> via CCXT</li>
                <li>Real-time indicators calculated locally</li>
                <li>Toggle overlays with the <strong>Indicators</strong> button</li>
                <li>View order book with <strong>Depth</strong> button</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pro-trading-content {
  @apply max-w-full;
}
</style>
