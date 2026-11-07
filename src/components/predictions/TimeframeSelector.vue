<script setup>
/**
 * TimeframeSelector Component
 * Pill-style selector for chart timeframe
 */

import { computed } from 'vue'

const props = defineProps({
  timeframes: {
    type: Array,
    required: true
  },
  modelValue: {
    type: String,
    default: '1h'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

function selectTimeframe(value) {
  if (props.disabled || value === props.modelValue) return
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div class="timeframe-selector">
    <span class="block text-sm font-medium text-text-secondary mb-1.5">Timeframe</span>
    <div role="group" aria-label="Timeframe" class="flex flex-wrap gap-1.5">
      <button type="button" :aria-pressed="modelValue === tf.value"
        v-for="tf in timeframes"
        :key="tf.value"
        @click="selectTimeframe(tf.value)"
        :disabled="disabled"
        :class="[
          'px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
          modelValue === tf.value
            ? 'bg-primary text-white shadow-md'
            : 'bg-gray-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
        ]"
        :title="tf.description"
      >
        {{ tf.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.timeframe-selector button {
  cursor: pointer;
}

.timeframe-selector button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.timeframe-selector button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
