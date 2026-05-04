<script setup>
/**
 * SignalCard Component
 * Displays a trading signal with entry, SL, TP and confidence
 */
import { computed } from 'vue'
import { SIGNAL_TYPES } from '@/stores/botTrading'

const props = defineProps({
  signal: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

// Computed
const isLong = computed(() => props.signal?.type === SIGNAL_TYPES.LONG)
const isShort = computed(() => props.signal?.type === SIGNAL_TYPES.SHORT)
const isNoTrade = computed(() => props.signal?.type === SIGNAL_TYPES.NO_TRADE || !props.signal?.type)

const signalColor = computed(() => {
  if (isLong.value) return 'success'
  if (isShort.value) return 'danger'
  return 'slate'
})

const confidencePercent = computed(() => {
  if (!props.signal?.confidence) return 0
  return Math.round(props.signal.confidence * 100)
})

const confidenceColor = computed(() => {
  const pct = confidencePercent.value
  if (pct >= 70) return 'text-success'
  if (pct >= 50) return 'text-warning'
  return 'text-danger'
})

const riskRewardRatio = computed(() => {
  if (!props.signal?.riskReward) return 'N/A'
  return `1:${props.signal.riskReward.toFixed(1)}`
})

// Format helpers
const formatPrice = (value) => {
  if (!value) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 6 : 2
  }).format(value)
}

const formatPercent = (value) => {
  if (!value) return 'N/A'
  return `${(value * 100).toFixed(2)}%`
}
</script>

<template>
  <div 
    class="bg-white dark:bg-card-dark rounded-xl border overflow-hidden transition-all"
    :class="[
      compact ? 'p-3' : 'p-4',
      isLong ? 'border-success/30 dark:border-success/20' : '',
      isShort ? 'border-danger/30 dark:border-danger/20' : '',
      isNoTrade ? 'border-gray-200 dark:border-border-dark' : ''
    ]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <span 
          class="px-2 py-1 text-xs font-bold rounded"
          :class="[
            isLong ? 'bg-success/10 text-success' : '',
            isShort ? 'bg-danger/10 text-danger' : '',
            isNoTrade ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-text-secondary' : ''
          ]"
        >
          {{ signal.type || 'NO SIGNAL' }}
        </span>
        <span v-if="signal.symbol" class="text-sm text-slate-500 dark:text-text-secondary">
          {{ signal.symbol }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-400 dark:text-text-secondary">
          {{ confidencePercent }}%
        </span>
        <div class="w-16 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            class="h-full rounded-full transition-all"
            :class="[
              confidencePercent >= 70 ? 'bg-success' : '',
              confidencePercent >= 50 && confidencePercent < 70 ? 'bg-warning' : '',
              confidencePercent < 50 ? 'bg-danger' : ''
            ]"
            :style="{ width: `${confidencePercent}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- No Trade Reason -->
    <div v-if="isNoTrade && signal.reason" class="text-sm text-slate-500 dark:text-text-secondary">
      <span class="material-symbols-outlined text-sm align-middle mr-1">info</span>
      {{ signal.reason }}
    </div>

    <!-- Signal Details -->
    <div v-if="!isNoTrade" class="space-y-3">
      <!-- Entry / SL / TP Row -->
      <div class="grid grid-cols-3 gap-2">
        <div class="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-1">Entry</p>
          <p class="font-mono font-medium text-slate-900 dark:text-white text-sm">
            {{ formatPrice(signal.entry) }}
          </p>
        </div>
        <div class="text-center p-2 bg-danger/5 dark:bg-danger/10 rounded-lg">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-1">Stop Loss</p>
          <p class="font-mono font-medium text-danger text-sm">
            {{ formatPrice(signal.stopLoss) }}
          </p>
        </div>
        <div class="text-center p-2 bg-success/5 dark:bg-success/10 rounded-lg">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-1">Take Profit</p>
          <p class="font-mono font-medium text-success text-sm">
            {{ formatPrice(signal.takeProfit) }}
          </p>
        </div>
      </div>

      <!-- Risk/Reward & Distance -->
      <div v-if="!compact" class="grid grid-cols-2 gap-2 text-sm">
        <div class="flex justify-between">
          <span class="text-slate-500 dark:text-text-secondary">Risk:</span>
          <span class="font-medium text-danger">{{ formatPercent(signal.riskPercent) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500 dark:text-text-secondary">R:R:</span>
          <span class="font-medium text-slate-900 dark:text-white">{{ riskRewardRatio }}</span>
        </div>
      </div>

      <!-- Explanation -->
      <div v-if="!compact && signal.explanation" class="pt-2 border-t border-gray-100 dark:border-border-dark">
        <p class="text-xs text-slate-500 dark:text-text-secondary mb-1">Reasons:</p>
        <ul class="text-xs text-slate-600 dark:text-text-secondary space-y-1">
          <li v-for="(reason, idx) in signal.explanation?.slice(0, 3)" :key="idx" class="flex items-start gap-1">
            <span class="material-symbols-outlined text-xs mt-0.5">check_circle</span>
            {{ reason }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Timestamp -->
    <div v-if="signal.timestamp" class="mt-3 pt-2 border-t border-gray-100 dark:border-border-dark">
      <p class="text-xs text-slate-400 dark:text-text-secondary">
        {{ new Date(signal.timestamp).toLocaleString() }}
      </p>
    </div>
  </div>
</template>
