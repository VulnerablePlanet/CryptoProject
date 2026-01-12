<script setup>
/**
 * TA-Lib Advanced Analysis View
 * Professional technical analysis with institutional-grade features
 * 
 * Features:
 * - Market Regime Detection
 * - Multi-Indicator Scoring
 * - Multi-Timeframe Analysis
 * - Volume Analysis
 * - Order Book Intelligence
 */

import { onMounted, computed } from 'vue'
import { useTALibStore } from '@/stores/talib'
import { useProTradingStore } from '@/stores/proTrading'

const talibStore = useTALibStore()
const proTradingStore = useProTradingStore()

// Computed
const isLoading = computed(() => talibStore.loading)
const hasError = computed(() => !!talibStore.error)
const hasData = computed(() => talibStore.hasData)

// Lifecycle
onMounted(async () => {
  await talibStore.initialize()
  // Initialize ProTrading store to get candle data
  await proTradingStore.initialize()
})

// Event Handlers
const handleSymbolSelect = async (base, quote) => {
  talibStore.changeSymbol(base, quote)
  // Auto-analyze when symbol changes
  await handleAnalyze()
}

const handleTabChange = (tab) => {
  talibStore.switchTab(tab)
}

const handleAnalyze = async () => {
  // Get candles from Pro Trading Store
  const rawCandles = proTradingStore.candles || []
  
  if (!rawCandles || rawCandles.length < 50) {
    talibStore.error = 'No candle data available. Please load historical data in Pro Trading first.'
    return
  }
  
  // Transform candle format from ProTrading to TA-Lib
  const candles = rawCandles.map(c => ({
    timestamp: c.timestamp || c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume
  }))
  
  // Fetch complete analysis
  await talibStore.fetchCompleteAnalysis(candles)
  
  // NEW: Fetch pattern recognition
  await talibStore.fetchPatterns(candles)
}

// Format helpers
const formatTime = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleTimeString()
}

const formatPercent = (value) => {
  if (value === null || value === undefined) return '-'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return '-'
  return value.toFixed(decimals)
}
</script>

<template>
  <div class="talib-content space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-3xl">science</span>
          TA-Lib Advanced Analysis
        </h1>
        <p class="text-text-secondary mt-1">
          Institutional-grade technical analysis with 5 advanced features
        </p>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Last updated -->
        <span v-if="talibStore.lastUpdated" class="text-xs text-text-secondary hidden lg:block">
          Updated: {{ formatTime(talibStore.lastUpdated) }}
        </span>
        
        <!-- Analyze button -->
        <button
          @click="handleAnalyze"
          :disabled="isLoading"
          class="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
        >
          <span class="material-symbols-outlined text-[20px]" :class="{ 'animate-spin': isLoading }">
            {{ isLoading ? 'refresh' : 'psychology' }}
          </span>
          {{ isLoading ? `Analyzing ${talibStore.currentSymbol}...` : 'Analyze' }}
        </button>
      </div>
    </div>

    <!-- Symbol Selector -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex flex-wrap items-center gap-4">
        <label class="text-sm text-text-secondary font-medium">Select Symbol:</label>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="symbol in talibStore.POPULAR_SYMBOLS"
            :key="`${symbol.base}${symbol.quote}`"
            @click="handleSymbolSelect(symbol.base, symbol.quote)"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            :class="talibStore.selectedSymbol.base === symbol.base && talibStore.selectedSymbol.quote === symbol.quote
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-background-dark text-slate-600 dark:text-text-secondary hover:bg-gray-200 dark:hover:bg-border-dark'"
          >
            {{ symbol.base }}/{{ symbol.quote }}
          </button>
        </div>
        
        <div class="ml-auto flex items-center gap-2">
          <span class="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full font-medium">
            {{ talibStore.currentSymbol }}
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
      <p class="text-danger text-sm flex-1">{{ talibStore.error }}</p>
      <button 
        @click="talibStore.clearError()" 
        class="text-danger hover:text-danger/80 transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>

    <!-- Health Status -->
    <div v-if="talibStore.health" class="bg-gradient-to-br from-success/5 to-success/10 border border-success/20 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined text-success text-xl">check_circle</span>
        <div class="text-sm">
          <p class="font-medium text-slate-700 dark:text-white mb-1">{{ talibStore.health.message }}</p>
          <p class="text-text-secondary text-xs mb-2">
            Available features: {{ talibStore.health.features?.length || 0 }}/5
          </p>
          <ul v-if="talibStore.health.features" class="list-disc list-inside space-y-0.5 text-xs text-text-secondary">
            <li v-for="feature in talibStore.health.features" :key="feature">{{ feature }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <div class="flex overflow-x-auto border-b border-gray-200 dark:border-border-dark">
        <button
          @click="handleTabChange('complete')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'complete'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">dashboard</span>
            Complete Analysis
          </span>
        </button>
        <button
          @click="handleTabChange('regime')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'regime'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">trending_up</span>
            Market Regime
          </span>
        </button>
        <button
          @click="handleTabChange('scoring')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'scoring'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">stars</span>
            Indicator Score
          </span>
        </button>
        <button
          @click="handleTabChange('mtf')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'mtf'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">layers</span>
            Multi-Timeframe
          </span>
        </button>
        <button
          @click="handleTabChange('volume')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'volume'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">equalizer</span>
            Volume
          </span>
        </button>
        <button
          @click="handleTabChange('orderbook')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'orderbook'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">menu_book</span>
            Order Book
          </span>
        </button>
        
        <!-- NEW: Advanced Features Tabs -->
        <button
          @click="handleTabChange('patterns')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'patterns'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">candlestick_chart</span>
            Patterns
          </span>
        </button>
        <button
          @click="handleTabChange('adaptive')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'adaptive'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">show_chart</span>
            Adaptive MA
          </span>
        </button>
        <button
          @click="handleTabChange('cycles')"
          class="px-4 py-3 text-sm font-medium transition-all whitespace-nowrap"
          :class="talibStore.currentTab === 'cycles'
            ? 'text-primary border-b-2 border-primary bg-primary/5'
            : 'text-text-secondary hover:bg-gray-50 dark:hover:bg-background-dark'"
        >
          <span class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">cycle</span>
            Cycles
          </span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="p-6">
        <!-- Empty State -->
        <div v-if="!hasData" class="text-center py-12">
          <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">psychology</span>
          <p class="text-text-secondary mt-3">No analysis data available</p>
          <p class="text-text-secondary text-sm mt-1">Select a symbol and click "Analyze" to start</p>
        </div>

        <!-- Complete Analysis Tab -->
        <div v-else-if="talibStore.currentTab === 'complete' && talibStore.completeAnalysis" class="space-y-6">
          <!-- Overview Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Regime Card -->
            <div class="bg-gray-50 dark:bg-background-dark rounded-xl p-4">
              <p class="text-xs text-text-secondary mb-2">Market Regime</p>
              <div class="flex items-center gap-2">
                <span 
                  class="material-symbols-outlined text-2xl"
                  :class="{
                    'text-success': talibStore.regimeInterpretation.color === 'success',
                    'text-warning': talibStore.regimeInterpretation.color === 'warning',
                    'text-gray-400': talibStore.regimeInterpretation.color === 'gray'
                  }"
                >
                  {{ talibStore.regimeInterpretation.color === 'success' ? 'trending_up' : 'trending_flat' }}
                </span>
                <div>
                  <p class="font-bold text-lg text-slate-900 dark:text-white">
                    {{ talibStore.regimeInterpretation.label }}
                  </p>
                  <p class="text-[10px] text-text-secondary">{{ talibStore.regimeInterpretation.description }}</p>
                </div>
              </div>
            </div>

            <!-- Signal Score Card -->
            <div class="bg-gray-50 dark:bg-background-dark rounded-xl p-4">
              <p class="text-xs text-text-secondary mb-2">Signal Score</p>
              <div class="flex items-center gap-2">
                <div class="flex-1">
                  <p class="font-bold text-2xl font-mono" :class="{
                    'text-success': talibStore.scoreInterpretation.color === 'success',
                    'text-danger': talibStore.scoreInterpretation.color === 'danger',
                    'text-gray-500': talibStore.scoreInterpretation.color === 'gray'
                  }">
                    {{ formatNumber(talibStore.completeAnalysis.signal?.score, 0) || 'N/A' }}
                  </p>
                  <p class="text-xs font-medium" :class="{
                    'text-success': talibStore.scoreInterpretation.color === 'success',
                    'text-danger': talibStore.scoreInterpretation.color === 'danger',
                    'text-gray-500': talibStore.scoreInterpretation.color === 'gray'
                  }">
                    {{ talibStore.scoreInterpretation.label }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Performance Card -->
            <div class="bg-gray-50 dark:bg-background-dark rounded-xl p-4">
              <p class="text-xs text-text-secondary mb-2">Analysis Time</p>
              <p class="font-bold text-2xl font-mono text-slate-900 dark:text-white">
                {{ talibStore.completeAnalysis.performance }}ms
              </p>
              <p class="text-[10px] text-text-secondary">Processing duration</p>
            </div>
          </div>

          <!-- Detailed Sections -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Regime Details -->
            <div v-if="talibStore.completeAnalysis.regime" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
              <h3 class="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">trending_up</span>
                Regime Metrics
              </h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-text-secondary">ADX:</span>
                  <span class="font-mono font-medium">{{ formatNumber(talibStore.completeAnalysis.regime.adx) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">ATR:</span>
                  <span class="font-mono font-medium">{{ formatNumber(talibStore.completeAnalysis.regime.atr) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-text-secondary">Volatility:</span>
                  <span class="font-mono font-medium">{{ formatPercent(talibStore.completeAnalysis.regime.volatility * 100) }}</span>
                </div>
              </div>
            </div>

            <!-- Recommended Strategies -->
            <div v-if="talibStore.completeAnalysis.recommendedStrategies" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
              <h3 class="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">lightbulb</span>
                Recommended Strategies
              </h3>
              <ul class="space-y-1 text-sm">
                <li 
                  v-for="(strategy, index) in talibStore.completeAnalysis.recommendedStrategies"
                  :key="index"
                  class="flex items-start gap-2"
                >
                  <span class="material-symbols-outlined text-success text-[16px] mt-0.5">check_circle</span>
                  <span>{{ strategy }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Market Regime Tab -->
        <div v-else-if="talibStore.currentTab === 'regime' && talibStore.regimeAnalysis" class="space-y-4">
          <div class="text-center py-8">
            <span class="material-symbols-outlined text-6xl" :class="{
              'text-success': talibStore.regimeInterpretation.color === 'success',
              'text-warning': talibStore.regimeInterpretation.color === 'warning',
              'text-gray-400': talibStore.regimeInterpretation.color === 'gray'
            }">
              {{ talibStore.regimeInterpretation.color === 'success' ? 'trending_up' : 'trending_flat' }}
            </span>
            <h3 class="text-2xl font-bold mt-3 text-slate-900 dark:text-white">{{ talibStore.regimeInterpretation.label }}</h3>
            <p class="text-text-secondary mt-1">{{ talibStore.regimeInterpretation.description }}</p>
          </div>
        </div>

        <!-- Indicator Scoring Tab -->
        <div v-else-if="talibStore.currentTab === 'scoring' && talibStore.scoringAnalysis" class="space-y-6">
          <div class="text-center py-8">
            <div class="inline-block">
              <div class="text-6xl font-bold font-mono" :class="{
                'text-success': talibStore.scoreInterpretation.color === 'success',
                'text-danger': talibStore.scoreInterpretation.color === 'danger',
                'text-gray-500': talibStore.scoreInterpretation.color === 'gray'
              }">
                {{ formatNumber(talibStore.scoringAnalysis.score, 0) }}
              </div>
              <p class="text-lg font-medium mt-2" :class="{
                'text-success': talibStore.scoreInterpretation.color === 'success',
                'text-danger': talibStore.scoreInterpretation.color === 'danger',
                'text-gray-500': talibStore.scoreInterpretation.color === 'gray'
              }">
                {{ talibStore.scoreInterpretation.label }}
              </p>
              <p class="text-text-secondary text-sm mt-1">{{ talibStore.scoreInterpretation.description }}</p>
            </div>
          </div>

          <!-- Individual Indicators -->
          <div v-if="talibStore.scoringAnalysis.components" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- RSI Indicator -->
            <div v-if="talibStore.scoringAnalysis.components.rsi !== undefined" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-slate-700 dark:text-white">RSI</p>
                <span class="text-xs px-2 py-1 rounded-full font-medium" :class="{
                  'bg-success/10 text-success': talibStore.scoringAnalysis.components.rsi > 0.3,
                  'bg-danger/10 text-danger': talibStore.scoringAnalysis.components.rsi < -0.3,
                  'bg-gray-100 dark:bg-background-dark text-text-secondary': Math.abs(talibStore.scoringAnalysis.components.rsi) <= 0.3
                }">
                  {{ formatNumber(talibStore.scoringAnalysis.components.rsi * 100, 0) }}
                </span>
              </div>
              <p class="text-xs text-text-secondary">
                {{ talibStore.scoringAnalysis.components.rsi > 0.3 ? 'Overbought' : talibStore.scoringAnalysis.components.rsi < -0.3 ? 'Oversold' : 'Neutral' }}
              </p>
            </div>

            <!-- MACD Indicator -->
            <div v-if="talibStore.scoringAnalysis.components.macd !== undefined" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-slate-700 dark:text-white">MACD</p>
                <span class="text-xs px-2 py-1 rounded-full font-medium" :class="{
                  'bg-success/10 text-success': talibStore.scoringAnalysis.components.macd > 0.3,
                  'bg-danger/10 text-danger': talibStore.scoringAnalysis.components.macd < -0.3,
                  'bg-gray-100 dark:bg-background-dark text-text-secondary': Math.abs(talibStore.scoringAnalysis.components.macd) <= 0.3
                }">
                  {{ formatNumber(talibStore.scoringAnalysis.components.macd * 100, 0) }}
                </span>
              </div>
              <p class="text-xs text-text-secondary">
                {{ talibStore.scoringAnalysis.components.macd > 0 ? 'Bullish' : talibStore.scoringAnalysis.components.macd < 0 ? 'Bearish' : 'Neutral' }}
              </p>
            </div>

            <!-- EMA Indicator -->
            <div v-if="talibStore.scoringAnalysis.components.ema20 !== undefined" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-slate-700 dark:text-white">EMA (20/50)</p>
                <span class="text-xs px-2 py-1 rounded-full font-medium" :class="{
                  'bg-success/10 text-success': talibStore.scoringAnalysis.components.ema20 > 0.3,
                  'bg-danger/10 text-danger': talibStore.scoringAnalysis.components.ema20 < -0.3,
                  'bg-gray-100 dark:bg-background-dark text-text-secondary': Math.abs(talibStore.scoringAnalysis.components.ema20) <= 0.3
                }">
                  {{ formatNumber(talibStore.scoringAnalysis.components.ema20 * 100, 0) }}
                </span>
              </div>
              <p class="text-xs text-text-secondary">
                {{ talibStore.scoringAnalysis.components.ema20 > 0 ? 'Above EMA' : talibStore.scoringAnalysis.components.ema20 < 0 ? 'Below EMA' : 'At EMA' }}
              </p>
            </div>

            <!-- Stochastic Indicator -->
            <div v-if="talibStore.scoringAnalysis.components.stochastic !== undefined" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-slate-700 dark:text-white">Stochastic</p>
                <span class="text-xs px-2 py-1 rounded-full font-medium" :class="{
                  'bg-success/10 text-success': talibStore.scoringAnalysis.components.stochastic > 0.3,
                  'bg-danger/10 text-danger': talibStore.scoringAnalysis.components.stochastic < -0.3,
                  'bg-gray-100 dark:bg-background-dark text-text-secondary': Math.abs(talibStore.scoringAnalysis.components.stochastic) <= 0.3
                }">
                  {{ formatNumber(talibStore.scoringAnalysis.components.stochastic * 100, 0) }}
                </span>
              </div>
              <p class="text-xs text-text-secondary">
                {{ talibStore.scoringAnalysis.components.stochastic > 0.3 ? 'Overbought' : talibStore.scoringAnalysis.components.stochastic < -0.3 ? 'Oversold' : 'Neutral' }}
              </p>
            </div>

            <!-- Bollinger Bands Indicator -->
            <div v-if="talibStore.scoringAnalysis.components.bbands !== undefined" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-slate-700 dark:text-white">Bollinger Bands</p>
                <span class="text-xs px-2 py-1 rounded-full font-medium" :class="{
                  'bg-success/10 text-success': talibStore.scoringAnalysis.components.bbands > 0.3,
                  'bg-danger/10 text-danger': talibStore.scoringAnalysis.components.bbands < -0.3,
                  'bg-gray-100 dark:bg-background-dark text-text-secondary': Math.abs(talibStore.scoringAnalysis.components.bbands) <= 0.3
                }">
                  {{ formatNumber(talibStore.scoringAnalysis.components.bbands * 100, 0) }}
                </span>
              </div>
              <p class="text-xs text-text-secondary">
                {{ talibStore.scoringAnalysis.components.bbands > 0 ? 'Upper Band' : talibStore.scoringAnalysis.components.bbands < 0 ? 'Lower Band' : 'Middle Band' }}
              </p>
            </div>

            <!-- Volume Indicator -->
            <div v-if="talibStore.scoringAnalysis.components.volume !== undefined" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <p class="text-sm font-medium text-slate-700 dark:text-white">Volume</p>
                <span class="text-xs px-2 py-1 rounded-full font-medium" :class="{
                  'bg-success/10 text-success': talibStore.scoringAnalysis.components.volume > 0.3,
                  'bg-danger/10 text-danger': talibStore.scoringAnalysis.components.volume < -0.3,
                  'bg-gray-100 dark:bg-background-dark text-text-secondary': Math.abs(talibStore.scoringAnalysis.components.volume) <= 0.3
                }">
                  {{ formatNumber(talibStore.scoringAnalysis.components.volume * 100, 0) }}
                </span>
              </div>
              <p class="text-xs text-text-secondary">
                {{ talibStore.scoringAnalysis.components.volume > 0 ? 'Above Average' : talibStore.scoringAnalysis.components.volume < 0 ? 'Below Average' : 'Average' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Multi-Timeframe Tab -->
        <div v-else-if="talibStore.currentTab === 'mtf'" class="text-center py-12">
          <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">layers</span>
          <p class="text-text-secondary mt-3">Multi-Timeframe Analysis</p>
          <p class="text-text-secondary text-sm mt-1">Feature requires multi-timeframe data</p>
        </div>

        <!-- Volume Tab -->
        <div v-else-if="talibStore.currentTab === 'volume'" class="text-center py-12">
          <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">equalizer</span>
          <p class="text-text-secondary mt-3">Volume Analysis</p>
          <p class="text-text-secondary text-sm mt-1">VPOC, VWAP, Delta Volume analysis</p>
        </div>

        <!-- OrderBook Tab -->
        <div v-else-if="talibStore.currentTab === 'orderbook'" class="text-center py-12">
          <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">menu_book</span>
          <p class="text-text-secondary mt-3">Order Book Intelligence</p>
          <p class="text-text-secondary text-sm mt-1">Feature requires real-time orderbook data</p>
        </div>

        <!-- NEW: Pattern Recognition Tab -->
        <div v-else-if="talibStore.currentTab === 'patterns'">
          <div v-if="!talibStore.patterns" class="text-center py-12">
            <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">candlestick_chart</span>
            <p class="text-text-secondary mt-3">Pattern Recognition</p>
            <p class="text-text-secondary text-sm mt-1">Click "Analyze" to detect candlestick patterns</p>
          </div>
          <div v-else>
            <!-- Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
                <p class="text-xs text-text-secondary mb-1">Total Patterns</p>
                <p class="text-2xl font-bold text-slate-900 dark:text-white">{{ talibStore.patterns.summary.total }}</p>
              </div>
              <div class="bg-white dark:bg-card-dark border border-success/20 dark:border-success/30 rounded-xl p-4">
                <p class="text-xs text-text-secondary mb-1">Bullish</p>
                <p class="text-2xl font-bold text-success">{{ talibStore.patterns.summary.bullish }}</p>
              </div>
              <div class="bg-white dark:bg-card-dark border border-danger/20 dark:border-danger/30 rounded-xl p-4">
                <p class="text-xs text-text-secondary mb-1">Bearish</p>
                <p class="text-2xl font-bold text-danger">{{ talibStore.patterns.summary.bearish }}</p>
              </div>
              <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
                <p class="text-xs text-text-secondary mb-1">Neutral</p>
                <p class="text-2xl font-bold text-slate-500">{{ talibStore.patterns.summary.neutral }}</p>
              </div>
            </div>

            <!-- Pattern List -->
            <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4">Detected Patterns</h3>
              <div v-if="talibStore.patterns.patterns.length === 0" class="text-center py-8 text-text-secondary">
                No patterns detected in recent candles
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="(pattern, index) in talibStore.patterns.patterns.slice(0, 10)"
                  :key="index"
                  class="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-border-dark hover:bg-gray-50 dark:hover:bg-background-dark transition-colors"
                >
                  <div class="flex items-center gap-4">
                    <div class="text-3xl">
                      {{ pattern.pattern === 'DOJI' ? '➕' : pattern.pattern === 'HAMMER' || pattern.pattern === 'HANGING_MAN' ? '🔨' : pattern.pattern.includes('ENGULFING') ? '🌊' : '⭐' }}
                    </div>
                    <div>
                      <p class="font-medium text-slate-900 dark:text-white">{{ pattern.pattern.replace(/_/g, ' ') }}</p>
                      <p class="text-sm text-text-secondary">{{ pattern.description }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <span
                      class="inline-block px-3 py-1 rounded-full text-xs font-medium mb-1"
                      :class="{
                        'bg-success/10 text-success': pattern.type.includes('BULLISH'),
                        'bg-danger/10 text-danger': pattern.type.includes('BEARISH'),
                        'bg-gray-100 dark:bg-background-dark text-text-secondary': pattern.type === 'NEUTRAL'
                      }"
                    >
                      {{ pattern.type.replace(/_/g, ' ') }}
                    </span>
                    <p class="text-xs text-text-secondary">{{ (pattern.confidence * 100).toFixed(0) }}% confidence</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- NEW: Adaptive MA Tab -->
        <div v-else-if="talibStore.currentTab === 'adaptive'" class="text-center py-12">
          <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">show_chart</span>
          <p class="text-text-secondary mt-3">Adaptive Moving Average (KAMA)</p>
          <p class="text-text-secondary text-sm mt-1">Feature coming soon - KAMA calculation ready on backend</p>
          <div class="mt-4 text-left max-w-md mx-auto bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
            <p class="text-sm text-text-secondary mb-2">Available features:</p>
            <ul class="text-sm text-text-secondary space-y-1">
              <li>• KAMA (Kaufman Adaptive Moving Average)</li>
              <li>• Efficiency Ratio calculation</li>
              <li>• Market mode detection (Trending/Ranging)</li>
              <li>• Comparison with traditional EMA</li>
            </ul>
          </div>
        </div>

        <!-- NEW: Cycle Analysis Tab -->
        <div v-else-if="talibStore.currentTab === 'cycles'" class="text-center py-12">
          <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-border-dark">cycle</span>
          <p class="text-text-secondary mt-3">Cycle Analysis</p>
          <p class="text-text-secondary text-sm mt-1">Feature coming soon - Linear Regression & Squeeze detection ready on backend</p>
          <div class="mt-4 text-left max-w-md mx-auto bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
            <p class="text-sm text-text-secondary mb-2">Available features:</p>
            <ul class="text-sm text-text-secondary space-y-1">
              <li>• Linear Regression with R² confidence</li>
              <li>• Regression channel (±1 std dev)</li>
              <li>• Price projections</li>
              <li>• Bollinger Band Squeeze detection</li>
              <li>• Breakout prediction</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Card -->
    <div class="bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5 border border-primary/20 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined text-primary text-xl">info</span>
        <div class="text-sm text-text-secondary">
          <p class="font-medium text-slate-700 dark:text-white mb-1">About TA-Lib Advanced</p>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li>Institutional-grade analysis powered by the TA-Lib module</li>
            <li>Select a symbol and click <strong>Analyze</strong> to generate insights</li>
            <li>Analysis uses data from the Pro Trading module's current state</li>
            <li>Navigate between tabs to explore different analysis features</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.talib-content {
  @apply max-w-full;
}
</style>
