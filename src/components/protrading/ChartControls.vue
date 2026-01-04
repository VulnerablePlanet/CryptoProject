<script setup>
/**
 * ChartControls Component
 * Combined controls for timeframe, chart type, and oscillator
 */

const props = defineProps({
  timeframes: {
    type: Array,
    default: () => []
  },
  selectedTimeframe: {
    type: String,
    default: '1h'
  },
  chartTypes: {
    type: Array,
    default: () => []
  },
  selectedChartType: {
    type: String,
    default: 'candlestick'
  },
  oscillatorTypes: {
    type: Array,
    default: () => []
  },
  selectedOscillator: {
    type: String,
    default: 'rsi'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['timeframe-change', 'chart-type-change', 'oscillator-change'])
</script>

<template>
  <div class="flex flex-wrap items-end gap-4 lg:gap-6">
    <!-- Timeframe -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs text-text-secondary font-medium">Timeframe</label>
      <div class="flex gap-1">
        <button
          v-for="tf in timeframes"
          :key="tf.value"
          @click="emit('timeframe-change', tf.value)"
          :disabled="disabled"
          class="px-2.5 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :class="selectedTimeframe === tf.value 
            ? 'bg-primary/10 text-primary border border-primary/30' 
            : 'bg-gray-50 dark:bg-background-dark text-slate-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-border-dark'"
          :title="tf.description"
        >
          {{ tf.label }}
        </button>
      </div>
    </div>
    
    <!-- Chart Type -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs text-text-secondary font-medium">Chart Type</label>
      <div class="flex gap-1">
        <button
          v-for="type in chartTypes"
          :key="type.value"
          @click="emit('chart-type-change', type.value)"
          :disabled="disabled"
          class="px-2 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :class="selectedChartType === type.value 
            ? 'bg-primary/10 text-primary border border-primary/30' 
            : 'bg-gray-50 dark:bg-background-dark text-slate-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-border-dark'"
          :title="type.label"
        >
          <span class="material-symbols-outlined text-[16px]">{{ type.icon }}</span>
        </button>
      </div>
    </div>
    
    <!-- Oscillator -->
    <div class="flex flex-col gap-1.5">
      <label class="text-xs text-text-secondary font-medium">Oscillator</label>
      <div class="flex gap-1">
        <button
          v-for="osc in oscillatorTypes"
          :key="osc.value"
          @click="emit('oscillator-change', osc.value)"
          :disabled="disabled"
          class="px-2.5 py-1.5 rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :class="selectedOscillator === osc.value 
            ? 'bg-primary/10 text-primary border border-primary/30' 
            : 'bg-gray-50 dark:bg-background-dark text-slate-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-border-dark'"
          :title="osc.description"
        >
          {{ osc.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No scoped styles needed - using inline Tailwind classes */
</style>
