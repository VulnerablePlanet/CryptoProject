<script setup>
/**
 * BotStatusPanel Component
 * Displays the current status of the trading bot with controls
 */
import { computed } from 'vue'
import { useBotTradingStore, BOT_STATUS } from '@/stores/botTrading'

const store = useBotTradingStore()

// Computed
const statusColor = computed(() => {
  switch (store.status) {
    case BOT_STATUS.RUNNING:
      return 'bg-success'
    case BOT_STATUS.PAUSED:
      return 'bg-warning'
    case BOT_STATUS.ERROR:
      return 'bg-danger'
    case BOT_STATUS.STARTING:
      return 'bg-info animate-pulse'
    default:
      return 'bg-slate-400'
  }
})

const statusText = computed(() => {
  switch (store.status) {
    case BOT_STATUS.RUNNING:
      return 'Running'
    case BOT_STATUS.PAUSED:
      return 'Paused'
    case BOT_STATUS.ERROR:
      return 'Error'
    case BOT_STATUS.STARTING:
      return 'Starting...'
    default:
      return 'Stopped'
  }
})

const statusIcon = computed(() => {
  switch (store.status) {
    case BOT_STATUS.RUNNING:
      return 'play_circle'
    case BOT_STATUS.PAUSED:
      return 'pause_circle'
    case BOT_STATUS.ERROR:
      return 'error'
    case BOT_STATUS.STARTING:
      return 'sync'
    default:
      return 'stop_circle'
  }
})

// Methods
const handleStart = () => {
  store.startBot()
}

const handleStop = () => {
  store.stopBot()
}

const handlePause = () => {
  store.pauseBot()
}

const handleResume = () => {
  store.resumeBot()
}
</script>

<template>
  <div class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">smart_toy</span>
        Bot Status
      </h3>
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" :class="statusColor"></span>
        <span class="text-sm font-medium text-slate-600 dark:text-text-secondary">{{ statusText }}</span>
      </div>
    </div>

    <!-- Status Display -->
    <div class="flex items-center justify-center py-6">
      <div class="text-center">
        <span class="material-symbols-outlined text-6xl" :class="{
          'text-success': store.isRunning,
          'text-warning': store.isPaused,
          'text-danger': store.hasError,
          'text-slate-300 dark:text-slate-600': store.isStopped
        }">
          {{ statusIcon }}
        </span>
        <p class="mt-2 text-lg font-medium text-slate-900 dark:text-white">{{ statusText }}</p>
        <p v-if="store.lastUpdate" class="text-xs text-slate-500 dark:text-text-secondary mt-1">
          Last update: {{ new Date(store.lastUpdate).toLocaleTimeString() }}
        </p>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="store.hasError" class="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
      <p class="text-sm text-danger flex items-center gap-2">
        <span class="material-symbols-outlined text-sm">warning</span>
        {{ store.lastError }}
      </p>
    </div>

    <!-- Controls -->
    <div class="flex gap-2">
      <button
        v-if="store.isStopped || store.hasError"
        @click="handleStart"
        :disabled="store.status === BOT_STATUS.STARTING"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success text-white rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50"
      >
        <span class="material-symbols-outlined text-xl">play_arrow</span>
        Start
      </button>

      <button
        v-if="store.isRunning"
        @click="handlePause"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-warning text-white rounded-lg hover:bg-warning/90 transition-colors"
      >
        <span class="material-symbols-outlined text-xl">pause</span>
        Pause
      </button>

      <button
        v-if="store.isPaused"
        @click="handleResume"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success text-white rounded-lg hover:bg-success/90 transition-colors"
      >
        <span class="material-symbols-outlined text-xl">play_arrow</span>
        Resume
      </button>

      <button
        v-if="!store.isStopped"
        @click="handleStop"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors"
      >
        <span class="material-symbols-outlined text-xl">stop</span>
        Stop
      </button>
    </div>

    <!-- Current Symbol Info -->
    <div class="mt-4 pt-4 border-t border-gray-200 dark:border-border-dark">
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-500 dark:text-text-secondary">Symbol</span>
        <span class="font-medium text-slate-900 dark:text-white">
          {{ store.currentSymbol?.symbol }}/{{ store.config.quote || 'USD' }}
        </span>
      </div>
      <div class="flex items-center justify-between text-sm mt-2">
        <span class="text-slate-500 dark:text-text-secondary">Timeframe</span>
        <span class="font-medium text-slate-900 dark:text-white">{{ store.currentTimeframe?.label }}</span>
      </div>
    </div>
  </div>
</template>
