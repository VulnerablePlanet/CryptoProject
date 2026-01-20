<script setup>
/**
 * FibonacciCcxtContent View
 * Main view for CCXT-based Fibonacci Analysis with multi-exchange support
 * 
 * Features:
 * - Exchange and symbol selection
 * - Automatic pivot detection (ZigZag algorithm)
 * - Fibonacci retracement and extension levels
 * - Technical indicator confluence (RSI, MACD, BB)
 * - Trade signals generation
 */

import { computed, onMounted, ref } from 'vue'
import { useFibonacciCcxtStore } from '@/stores/fibonacciCcxt'
import FibonacciChart from '@/components/fibonacci/FibonacciChart.vue'
import { formatCOPWithFlag } from '@/utils/currency'

// Store
const store = useFibonacciCcxtStore()

// Local state
const symbolInput = ref('')
const showSymbolDropdown = ref(false)

// Computed
const isLoading = computed(() => store.isLoading)
const hasError = computed(() => !!store.error)
const hasAnalysis = computed(() => !!store.analysis)

const lastUpdatedText = computed(() => {
  if (!store.lastUpdated) return ''
  return new Date(store.lastUpdated).toLocaleTimeString('es-CO')
})

// Candlestick data for chart - FibonacciChart expects 'timestamp' in milliseconds
const candleData = computed(() => {
  return store.candles.map(c => ({
    // FibonacciChart uses new Date(candle.timestamp).getTime() / 1000
    // c.time is in seconds from CCXT, convert to milliseconds for Date
    timestamp: c.time * 1000,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close
  }))
})

// Event handlers
function handleExchangeSelect(exchangeId) {
  store.changeExchange(exchangeId)
}

function handleSymbolSelect(symbol) {
  store.changeSymbol(symbol)
  showSymbolDropdown.value = false
  symbolInput.value = ''
}

function handleTimeframeSelect(timeframe) {
  store.changeTimeframe(timeframe)
}

function handleSymbolInput() {
  if (symbolInput.value.includes('/')) {
    store.changeSymbol(symbolInput.value.toUpperCase())
    symbolInput.value = ''
    showSymbolDropdown.value = false
  }
}

async function handleRefresh() {
  await store.refresh()
}

// Get confluence score color
function getScoreColor(score) {
  if (score >= 70) return 'text-success'
  if (score >= 50) return 'text-warning'
  return 'text-danger'
}

// Get RSI color
function getRsiColor(value) {
  if (value >= 70) return 'text-danger'
  if (value <= 30) return 'text-success'
  return 'text-text-secondary'
}

// Lifecycle
onMounted(async () => {
  await store.initialize()
})
</script>

<template>
  <div class="fibonacci-ccxt-content space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <span class="material-symbols-outlined text-primary text-3xl lg:text-4xl">
            show_chart
          </span>
          Fibonacci Multi-Exchange
        </h1>
        <p class="text-text-secondary mt-1">
          Análisis Fibonacci con datos en tiempo real de exchanges via CCXT
        </p>
      </div>
      
      <!-- Sync Button & Status -->
      <div class="flex items-center gap-3">
        <span 
          v-if="store.cacheHit" 
          class="text-xs px-2 py-1 bg-success/10 text-success rounded-full flex items-center gap-1"
        >
          <span class="material-symbols-outlined text-sm">bolt</span>
          Cache
        </span>
        
        <span v-if="lastUpdatedText" class="text-xs text-text-secondary hidden lg:block">
          Actualizado: {{ lastUpdatedText }}
        </span>
        
        <button
          @click="handleRefresh"
          :disabled="isLoading"
          class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span 
            :class="['material-symbols-outlined text-lg', isLoading ? 'animate-spin' : '']"
          >
            {{ isLoading ? 'progress_activity' : 'calculate' }}
          </span>
          {{ isLoading ? 'Analizando...' : 'Recalcular' }}
        </button>
      </div>
    </div>

    <!-- Controls Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex flex-wrap items-end gap-4 lg:gap-6">
        <!-- Exchange Selector -->
        <div>
          <label class="block text-xs text-text-secondary mb-2">Exchange</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="exchange in store.exchanges"
              :key="exchange.id"
              @click="handleExchangeSelect(exchange.id)"
              :class="[
                'px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                store.selectedExchange === exchange.id
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-slate-700 text-slate-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              ]"
            >
              {{ exchange.name }}
            </button>
          </div>
        </div>

        <div class="h-10 w-px bg-gray-200 dark:bg-border-dark hidden lg:block"></div>

        <!-- Symbol Selector -->
        <div class="relative">
          <label class="block text-xs text-text-secondary mb-2">Par de Trading</label>
          <div class="flex gap-2">
            <!-- Popular symbols buttons -->
            <div class="flex gap-1 flex-wrap max-w-md">
              <button
                v-for="symbol in store.popularSymbols.slice(0, 4)"
                :key="symbol"
                @click="handleSymbolSelect(symbol)"
                :class="[
                  'px-2 py-1.5 text-xs font-medium rounded transition-all',
                  store.selectedSymbol === symbol
                    ? 'bg-secondary text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                ]"
              >
                {{ symbol.split('/')[0] }}
              </button>
            </div>
            <!-- Custom input -->
            <input
              v-model="symbolInput"
              @keyup.enter="handleSymbolInput"
              @focus="showSymbolDropdown = true"
              placeholder="BTC/USDT"
              class="w-24 px-2 py-1.5 text-sm border border-gray-200 dark:border-border-dark rounded-lg bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <p class="text-[10px] text-text-secondary mt-1">
            Activo: <span class="font-bold text-primary">{{ store.selectedSymbol }}</span>
          </p>
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
              :class="[
                'px-2 py-1.5 text-xs font-medium rounded transition-all relative',
                store.selectedTimeframe === tf.value
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
              ]"
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
            <p class="text-xs text-text-secondary">Velas</p>
            <p class="text-lg font-bold text-primary">
              {{ store.analysis.meta.analyzedCandles }}
            </p>
          </div>
          <div v-if="store.analysis?.meta" class="text-right hidden lg:block">
            <p class="text-xs text-text-secondary">Pivotes</p>
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
      <span class="text-danger flex-1">{{ store.error }}</span>
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
              <span class="material-symbols-outlined text-primary">candlestick_chart</span>
              Gráfico Fibonacci - {{ store.selectedSymbol }}
            </h2>
            <div 
              :class="[
                'px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1',
                store.isBullish ? 'bg-success/10 text-success' :
                store.isBearish ? 'bg-danger/10 text-danger' :
                'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-gray-400'
              ]"
            >
              <span class="material-symbols-outlined text-sm">
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
                <span class="material-symbols-outlined text-4xl text-primary animate-spin">
                  progress_activity
                </span>
                <span class="text-text-secondary">Cargando análisis Fibonacci...</span>
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
      </div>

      <!-- Sidebar (1 column) -->
      <div class="space-y-6">
        <!-- Current Price & Levels Card -->
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
          <h3 class="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">payments</span>
            Precio Actual
          </h3>
          
          <div v-if="hasAnalysis" class="space-y-4">
            <!-- Current Price -->
            <div class="text-center py-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl">
              <p class="text-sm text-text-secondary mb-1">{{ store.selectedSymbol }}</p>
              <p class="text-2xl font-bold text-slate-900 dark:text-white">
                ${{ store.currentPrice?.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
              </p>
              <p class="text-sm text-yellow-600 dark:text-yellow-400">
                {{ formatCOPWithFlag(store.currentPrice) }}
              </p>
            </div>

            <!-- Nearest Level -->
            <div v-if="store.nearestLevel" class="text-center py-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <p class="text-xs text-text-secondary">Nivel más cercano</p>
              <p class="font-bold" :class="store.nearestLevel.type === 'retracement' ? 'text-primary' : 'text-secondary'">
                {{ store.nearestLevel.label }}
              </p>
              <p class="text-sm text-text-secondary">
                ${{ store.nearestLevel.price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
                <span class="text-xs">({{ store.nearestLevel.percentDistance }}% away)</span>
              </p>
            </div>

            <!-- Golden Pocket Status -->
            <div 
              v-if="store.goldenPocket"
              :class="[
                'text-center py-2 rounded-lg',
                store.goldenPocket.inZone 
                  ? 'bg-warning/20 border border-warning/50' 
                  : 'bg-gray-50 dark:bg-slate-800'
              ]"
            >
              <p class="text-xs text-text-secondary">Golden Pocket (61.8% - 65%)</p>
              <p v-if="store.goldenPocket.inZone" class="font-bold text-warning">
                ¡Precio en zona dorada!
              </p>
              <p v-else class="text-sm text-text-secondary">
                {{ store.goldenPocket.percentToZone?.toFixed(2) }}% de distancia
              </p>
            </div>

            <!-- Swing Points -->
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="p-2 bg-success/10 rounded-lg text-center">
                <p class="text-xs text-text-secondary">Swing High</p>
                <p class="font-bold text-success">
                  ${{ store.pivots?.swingHigh?.price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
                </p>
              </div>
              <div class="p-2 bg-danger/10 rounded-lg text-center">
                <p class="text-xs text-text-secondary">Swing Low</p>
                <p class="font-bold text-danger">
                  ${{ store.pivots?.swingLow?.price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
                </p>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8 text-text-secondary">
            <span class="material-symbols-outlined text-4xl mb-2">hourglass_empty</span>
            <p>Cargando datos...</p>
          </div>
        </div>

        <!-- Confluence Indicators Card -->
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
          <h3 class="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary">insights</span>
            Indicadores de Confluencia
          </h3>

          <div v-if="store.confluence" class="space-y-4">
            <!-- Confluence Score -->
            <div class="text-center py-3 bg-gradient-to-r from-secondary/10 to-primary/10 rounded-xl">
              <p class="text-xs text-text-secondary mb-1">Puntuación de Confluencia</p>
              <p :class="['text-3xl font-bold', getScoreColor(store.confluenceScore)]">
                {{ store.confluenceScore }}/100
              </p>
              <p class="text-sm font-medium" :class="getScoreColor(store.confluenceScore)">
                {{ store.overallSignal?.replace('_', ' ').toUpperCase() }}
              </p>
            </div>

            <!-- RSI -->
            <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span class="text-sm text-text-secondary">RSI (14)</span>
              <div class="flex items-center gap-2">
                <span :class="['font-bold', getRsiColor(store.rsiValue)]">
                  {{ store.rsiValue?.toFixed(1) || 'N/A' }}
                </span>
                <span 
                  :class="[
                    'text-xs px-2 py-0.5 rounded-full',
                    store.rsiCondition === 'overbought' ? 'bg-danger/10 text-danger' :
                    store.rsiCondition === 'oversold' ? 'bg-success/10 text-success' :
                    'bg-gray-100 dark:bg-slate-700 text-text-secondary'
                  ]"
                >
                  {{ store.rsiCondition === 'overbought' ? 'Sobrecompra' : 
                     store.rsiCondition === 'oversold' ? 'Sobreventa' : 'Neutral' }}
                </span>
              </div>
            </div>

            <!-- MACD -->
            <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span class="text-sm text-text-secondary">MACD</span>
              <div class="flex items-center gap-2">
                <span :class="['font-bold', store.macdHistogram > 0 ? 'text-success' : 'text-danger']">
                  {{ store.macdHistogram?.toFixed(2) || 'N/A' }}
                </span>
                <span 
                  :class="[
                    'text-xs px-2 py-0.5 rounded-full',
                    store.macdCondition.includes('bullish') ? 'bg-success/10 text-success' :
                    store.macdCondition.includes('bearish') ? 'bg-danger/10 text-danger' :
                    'bg-gray-100 dark:bg-slate-700 text-text-secondary'
                  ]"
                >
                  {{ store.macdCondition.includes('crossover') ? 'Cruce!' : 
                     store.macdCondition === 'bullish' ? 'Alcista' : 'Bajista' }}
                </span>
              </div>
            </div>

            <!-- Bollinger Bands -->
            <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span class="text-sm text-text-secondary">BB %B</span>
              <div class="flex items-center gap-2">
                <span class="font-bold text-slate-900 dark:text-white">
                  {{ (store.bbPercentB * 100).toFixed(0) }}%
                </span>
                <span 
                  :class="[
                    'text-xs px-2 py-0.5 rounded-full',
                    store.bbCondition === 'above_upper' || store.bbCondition === 'near_upper' 
                      ? 'bg-danger/10 text-danger' :
                    store.bbCondition === 'below_lower' || store.bbCondition === 'near_lower' 
                      ? 'bg-success/10 text-success' :
                    'bg-gray-100 dark:bg-slate-700 text-text-secondary'
                  ]"
                >
                  {{ store.bbCondition === 'above_upper' ? 'Sobre banda' :
                     store.bbCondition === 'below_lower' ? 'Bajo banda' : 'En rango' }}
                </span>
              </div>
            </div>

            <!-- Volume -->
            <div class="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-800 rounded-lg">
              <span class="text-sm text-text-secondary">Volumen</span>
              <div class="flex items-center gap-2">
                <span :class="['font-bold', store.hasVolumeSpike ? 'text-warning' : 'text-text-secondary']">
                  {{ store.volumeRatio }}x
                </span>
                <span 
                  v-if="store.hasVolumeSpike"
                  class="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning"
                >
                  Spike!
                </span>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-8 text-text-secondary">
            <span class="material-symbols-outlined text-4xl mb-2">analytics</span>
            <p>Calculando indicadores...</p>
          </div>
        </div>

        <!-- Trade Signals Card -->
        <div v-if="store.signals?.length > 0" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
          <h3 class="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-warning">notifications_active</span>
            Señales de Trading
          </h3>

          <div class="space-y-2">
            <div 
              v-for="(signal, index) in store.signals.slice(0, 3)" 
              :key="index"
              :class="[
                'p-3 rounded-lg',
                signal.action === 'buy' ? 'bg-success/10 border border-success/30' :
                signal.action === 'sell' || signal.action === 'take_profit' ? 'bg-danger/10 border border-danger/30' :
                'bg-warning/10 border border-warning/30'
              ]"
            >
              <div class="flex items-center gap-2 mb-1">
                <span 
                  :class="[
                    'material-symbols-outlined text-sm',
                    signal.action === 'buy' ? 'text-success' :
                    signal.action === 'sell' || signal.action === 'take_profit' ? 'text-danger' :
                    'text-warning'
                  ]"
                >
                  {{ signal.action === 'buy' ? 'arrow_upward' : 
                     signal.action === 'sell' ? 'arrow_downward' : 
                     signal.action === 'take_profit' ? 'savings' : 'warning' }}
                </span>
                <span class="font-medium text-sm text-slate-900 dark:text-white">
                  {{ signal.type.toUpperCase() }}
                </span>
              </div>
              <p class="text-xs text-text-secondary">{{ signal.reason }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fibonacci Levels Table -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <div class="p-4 border-b border-gray-200 dark:border-border-dark">
        <h3 class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">table_chart</span>
          Niveles Fibonacci Detallados
        </h3>
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-slate-800">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Nivel</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase">Precio USD</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase">Precio COP</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-text-secondary uppercase">Tipo</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Descripción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-border-dark">
            <tr 
              v-for="level in store.allLevels" 
              :key="level.key"
              :class="[
                'hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors',
                level.isGoldenPocket || level.isGoldenRatio || level.isGoldenExtension 
                  ? 'bg-warning/5' : ''
              ]"
            >
              <td class="px-4 py-3 font-bold" :style="{ color: level.color }">
                {{ level.label }}
                <span v-if="level.isGoldenPocket || level.isGoldenRatio || level.isGoldenExtension" class="ml-1">⭐</span>
              </td>
              <td class="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">
                ${{ level.price?.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}
              </td>
              <td class="px-4 py-3 text-right font-mono text-yellow-600 dark:text-yellow-400 text-xs">
                {{ formatCOPWithFlag(level.price) }}
              </td>
              <td class="px-4 py-3 text-center">
                <span 
                  :class="[
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    level.type === 'retracement' 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-secondary/10 text-secondary'
                  ]"
                >
                  {{ level.type === 'retracement' ? 'Retroceso' : 'Extensión' }}
                </span>
              </td>
              <td class="px-4 py-3 text-text-secondary text-xs">
                {{ level.description }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Methodology Info -->
    <div class="bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/20 rounded-xl p-4">
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined text-primary">info</span>
        <div>
          <h4 class="font-bold text-slate-900 dark:text-white mb-1">Metodología</h4>
          <p class="text-sm text-text-secondary">
            Este análisis utiliza el <strong>algoritmo ZigZag</strong> para detectar pivotes (Swing High/Low),
            calcula niveles de Fibonacci incluyendo la <strong>Zona Dorada (61.8% - 65%)</strong>, y valida las señales 
            con indicadores de confluencia (<strong>RSI, MACD, Bandas de Bollinger, Volumen</strong>).
            Los datos se obtienen en tiempo real via CCXT desde <strong>{{ store.currentExchange?.name || 'Exchange' }}</strong>.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fibonacci-ccxt-content {
  max-width: 100%;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
