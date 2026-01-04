<script setup>
/**
 * IndicatorSettings Component
 * Panel for configuring indicator overlays
 */

import { ref, computed } from 'vue'

const props = defineProps({
  settings: {
    type: Object,
    default: () => ({
      bollingerBands: { enabled: false, period: 20, stdDev: 2 },
      sma: { enabled: true, periods: [7, 14, 30] },
      ema: { enabled: true, periods: [12, 26] }
    })
  }
})

const emit = defineEmits(['update', 'close'])

// Local state for editing
const localSettings = ref({ ...props.settings })

const toggleIndicator = (indicator) => {
  localSettings.value[indicator].enabled = !localSettings.value[indicator].enabled
  emit('update', indicator, 'enabled', localSettings.value[indicator].enabled)
}

const updateSetting = (indicator, setting, value) => {
  localSettings.value[indicator][setting] = value
  emit('update', indicator, setting, value)
}
</script>

<template>
  <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-border-dark">
      <h3 class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">tune</span>
        Indicator Settings
      </h3>
      <button 
        @click="emit('close')" 
        class="p-1 rounded-lg text-text-secondary hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
      >
        <span class="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
    
    <!-- Settings content -->
    <div class="p-4 space-y-4">
      <!-- Bollinger Bands -->
      <div class="p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
        <div class="flex items-center justify-between">
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox"
              :checked="localSettings.bollingerBands.enabled"
              @change="toggleIndicator('bollingerBands')"
              class="w-4 h-4 rounded border-gray-300 dark:border-border-dark text-primary focus:ring-primary/30"
            />
            <span class="font-medium text-sm text-slate-900 dark:text-white">Bollinger Bands</span>
          </label>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">BB</span>
        </div>
        <div v-if="localSettings.bollingerBands.enabled" class="mt-3 pt-3 border-t border-gray-200 dark:border-border-dark/50">
          <div class="flex items-center justify-between py-1">
            <span class="text-xs text-text-secondary">Period</span>
            <input 
              type="number" 
              :value="localSettings.bollingerBands.period"
              @change="updateSetting('bollingerBands', 'period', parseInt($event.target.value))"
              min="5" max="100"
              class="w-16 px-2 py-1 text-xs text-right font-mono bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div class="flex items-center justify-between py-1">
            <span class="text-xs text-text-secondary">Std Dev</span>
            <input 
              type="number" 
              :value="localSettings.bollingerBands.stdDev"
              @change="updateSetting('bollingerBands', 'stdDev', parseFloat($event.target.value))"
              min="0.5" max="5" step="0.5"
              class="w-16 px-2 py-1 text-xs text-right font-mono bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>
      
      <!-- SMA -->
      <div class="p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
        <div class="flex items-center justify-between">
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox"
              :checked="localSettings.sma.enabled"
              @change="toggleIndicator('sma')"
              class="w-4 h-4 rounded border-gray-300 dark:border-border-dark text-primary focus:ring-primary/30"
            />
            <span class="font-medium text-sm text-slate-900 dark:text-white">Simple Moving Average</span>
          </label>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">SMA</span>
        </div>
        <div v-if="localSettings.sma.enabled" class="mt-3 pt-3 border-t border-gray-200 dark:border-border-dark/50">
          <div class="flex flex-wrap gap-2">
            <span 
              v-for="period in localSettings.sma.periods" 
              :key="period"
              class="text-[10px] font-medium px-2 py-1 rounded"
              :style="{ backgroundColor: period === 20 ? 'rgba(251, 191, 36, 0.2)' : period === 50 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)' }"
            >
              SMA {{ period }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- EMA -->
      <div class="p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
        <div class="flex items-center justify-between">
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox"
              :checked="localSettings.ema.enabled"
              @change="toggleIndicator('ema')"
              class="w-4 h-4 rounded border-gray-300 dark:border-border-dark text-primary focus:ring-primary/30"
            />
            <span class="font-medium text-sm text-slate-900 dark:text-white">Exponential Moving Average</span>
          </label>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">EMA</span>
        </div>
        <div v-if="localSettings.ema.enabled" class="mt-3 pt-3 border-t border-gray-200 dark:border-border-dark/50">
          <div class="flex flex-wrap gap-2">
            <span 
              v-for="period in localSettings.ema.periods" 
              :key="period"
              class="text-[10px] font-medium px-2 py-1 rounded"
              :style="{ backgroundColor: period === 9 ? 'rgba(16, 185, 129, 0.2)' : period === 21 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(249, 115, 22, 0.2)' }"
            >
              EMA {{ period }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No scoped styles needed - using inline Tailwind classes */
</style>
