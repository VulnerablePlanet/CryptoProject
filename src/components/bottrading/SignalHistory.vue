<script setup>
/**
 * SignalHistory Component
 * Displays history of generated signals
 */
import { ref, computed } from 'vue'
import { useBotTradingStore, SIGNAL_TYPES } from '@/stores/botTrading'

const store = useBotTradingStore()

// Local state
const expanded = ref(false)

// Computed
const displaySignals = computed(() => {
  const signals = store.signalHistory
  return expanded.value ? signals : signals.slice(0, 5)
})

const hasMore = computed(() => store.signalHistory.length > 5)

// Methods
const toggleExpand = () => {
  expanded.value = !expanded.value
}

const getSignalIcon = (type) => {
  switch (type) {
    case SIGNAL_TYPES.LONG:
      return 'trending_up'
    case SIGNAL_TYPES.SHORT:
      return 'trending_down'
    default:
      return 'remove'
  }
}

const getSignalColor = (type) => {
  switch (type) {
    case SIGNAL_TYPES.LONG:
      return 'text-success bg-success/10'
    case SIGNAL_TYPES.SHORT:
      return 'text-danger bg-danger/10'
    default:
      return 'text-slate-400 bg-slate-100 dark:bg-slate-800'
  }
}

const formatTime = (timestamp) => {
  if (!timestamp) return 'N/A'
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatPrice = (value) => {
  if (!value) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 6 : 2
  }).format(value)
}
</script>

<template>
  <div class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">history</span>
        Signal History
      </h3>
      <span class="text-xs text-slate-500 dark:text-text-secondary">
        {{ store.signalHistory.length }} signals
      </span>
    </div>

    <!-- Signal List -->
    <div v-if="store.signalHistory.length > 0" class="space-y-2">
      <div
        v-for="(signal, idx) in displaySignals"
        :key="idx"
        class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <!-- Signal Type Icon -->
        <div 
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          :class="getSignalColor(signal.type)"
        >
          <span class="material-symbols-outlined text-xl">{{ getSignalIcon(signal.type) }}</span>
        </div>

        <!-- Signal Details -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span 
              class="text-xs font-bold px-1.5 py-0.5 rounded"
              :class="getSignalColor(signal.type)"
            >
              {{ signal.type }}
            </span>
            <span class="text-sm font-medium text-slate-900 dark:text-white truncate">
              {{ signal.symbol || 'BTC' }}
            </span>
            <span class="text-xs text-slate-400 dark:text-text-secondary">
              {{ Math.round(signal.confidence * 100) }}% conf
            </span>
          </div>
          <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-text-secondary">
            <span>Entry: {{ formatPrice(signal.entry) }}</span>
            <span>SL: {{ formatPrice(signal.stopLoss) }}</span>
            <span>TP: {{ formatPrice(signal.takeProfit) }}</span>
          </div>
        </div>

        <!-- Timestamp -->
        <div class="text-right shrink-0">
          <p class="text-xs text-slate-400 dark:text-text-secondary">
            {{ formatTime(signal.timestamp) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8 text-slate-400 dark:text-text-secondary">
      <span class="material-symbols-outlined text-4xl mb-2">signal_cellular_null</span>
      <p class="text-sm">No signals generated yet</p>
      <p class="text-xs mt-1">Start the bot to generate signals</p>
    </div>

    <!-- Show More Button -->
    <button
      v-if="hasMore"
      @click="toggleExpand"
      class="w-full mt-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors flex items-center justify-center gap-1"
    >
      <span>{{ expanded ? 'Show Less' : `Show All (${store.signalHistory.length})` }}</span>
      <span class="material-symbols-outlined text-sm">
        {{ expanded ? 'expand_less' : 'expand_more' }}
      </span>
    </button>
  </div>
</template>
