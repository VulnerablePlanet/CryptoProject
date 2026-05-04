<script setup>
/**
 * BotStats Component
 * Displays trading bot statistics and performance metrics
 */
import { computed } from 'vue'
import { useBotTradingStore } from '@/stores/botTrading'

const store = useBotTradingStore()

// Computed
const winRateColor = computed(() => {
  const rate = store.stats.winRate
  if (rate >= 60) return 'text-success'
  if (rate >= 40) return 'text-warning'
  return 'text-danger'
})

const pnlColor = computed(() => {
  const pnl = store.stats.totalPnL
  if (pnl > 0) return 'text-success'
  if (pnl < 0) return 'text-danger'
  return 'text-slate-500'
})

// Format helpers
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value)
}

const formatPercent = (value) => {
  return `${value.toFixed(1)}%`
}
</script>

<template>
  <div class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">analytics</span>
        Performance Stats
      </h3>
      <button
        @click="store.runBacktest()"
        :disabled="store.backtestLoading"
        class="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        <span class="material-symbols-outlined text-sm" :class="{ 'animate-spin': store.backtestLoading }">
          sync
        </span>
        {{ store.backtestLoading ? 'Running...' : 'Run Backtest' }}
      </button>
    </div>

    <!-- Main Stats Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      <!-- Total Trades -->
      <div class="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <p class="text-2xl font-bold text-slate-900 dark:text-white">{{ store.stats.totalTrades }}</p>
        <p class="text-xs text-slate-500 dark:text-text-secondary">Total Trades</p>
      </div>

      <!-- Win Rate -->
      <div class="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <p class="text-2xl font-bold" :class="winRateColor">{{ formatPercent(store.stats.winRate) }}</p>
        <p class="text-xs text-slate-500 dark:text-text-secondary">Win Rate</p>
      </div>

      <!-- Total PnL -->
      <div class="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <p class="text-2xl font-bold" :class="pnlColor">
          {{ store.stats.totalPnL >= 0 ? '+' : '' }}{{ formatCurrency(store.stats.totalPnL) }}
        </p>
        <p class="text-xs text-slate-500 dark:text-text-secondary">Total P&L</p>
      </div>

      <!-- Profit Factor -->
      <div class="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <p class="text-2xl font-bold text-slate-900 dark:text-white">
          {{ store.stats.profitFactor?.toFixed(2) || '0.00' }}
        </p>
        <p class="text-xs text-slate-500 dark:text-text-secondary">Profit Factor</p>
      </div>
    </div>

    <!-- Detailed Stats -->
    <div class="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-border-dark">
      <!-- Wins / Losses -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500 dark:text-text-secondary flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-success"></span>
            Wins
          </span>
          <span class="font-medium text-success">{{ store.stats.wins }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500 dark:text-text-secondary flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-danger"></span>
            Losses
          </span>
          <span class="font-medium text-danger">{{ store.stats.losses }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500 dark:text-text-secondary flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-slate-400"></span>
            Breakeven
          </span>
          <span class="font-medium text-slate-500">{{ store.stats.breakevens }}</span>
        </div>
      </div>

      <!-- Averages -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500 dark:text-text-secondary">Avg Win</span>
          <span class="font-medium text-success">+{{ formatCurrency(store.stats.avgWin) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500 dark:text-text-secondary">Avg Loss</span>
          <span class="font-medium text-danger">-{{ formatCurrency(store.stats.avgLoss) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-500 dark:text-text-secondary">Max Drawdown</span>
          <span class="font-medium text-danger">-{{ formatPercent(store.stats.maxDrawdown) }}</span>
        </div>
      </div>
    </div>

    <!-- Backtest Results -->
    <div v-if="store.backtestResults" class="mt-4 pt-4 border-t border-gray-200 dark:border-border-dark">
      <h4 class="text-sm font-medium text-slate-700 dark:text-text-secondary mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-sm">history</span>
        Backtest Results
      </h4>
      
      <div class="grid grid-cols-3 gap-2 text-sm">
        <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded">
          <p class="text-xs text-slate-500 dark:text-text-secondary">Trades</p>
          <p class="font-medium text-slate-900 dark:text-white">{{ store.backtestResults.totalTrades }}</p>
        </div>
        <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded">
          <p class="text-xs text-slate-500 dark:text-text-secondary">Win Rate</p>
          <p class="font-medium text-slate-900 dark:text-white">{{ formatPercent(store.backtestResults.winRate) }}</p>
        </div>
        <div class="p-2 bg-slate-50 dark:bg-slate-800 rounded">
          <p class="text-xs text-slate-500 dark:text-text-secondary">Final Capital</p>
          <p class="font-medium text-slate-900 dark:text-white">{{ formatCurrency(store.backtestResults.finalCapital) }}</p>
        </div>
      </div>
    </div>

    <!-- No Data State -->
    <div v-if="store.stats.totalTrades === 0 && !store.backtestLoading" class="text-center py-8 text-slate-400 dark:text-text-secondary">
      <span class="material-symbols-outlined text-4xl mb-2">query_stats</span>
      <p class="text-sm">No trading data yet</p>
      <p class="text-xs mt-1">Run a backtest to see performance metrics</p>
    </div>
  </div>
</template>
