<script setup>
/**
 * ExchangeSelector Component
 * Dropdown for selecting cryptocurrency exchange
 */

import { computed } from 'vue'

const props = defineProps({
  exchanges: {
    type: Array,
    required: true
  },
  modelValue: {
    type: String,
    default: 'binance'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const selectedExchange = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    emit('change', value)
  }
})

const currentExchange = computed(() => {
  return props.exchanges.find(e => e.id === props.modelValue) || props.exchanges[0]
})
</script>

<template>
  <div class="exchange-selector">
    <label class="block text-sm font-medium text-text-secondary mb-1.5">
      Exchange
    </label>
    <div class="relative">
      <select
        v-model="selectedExchange"
        :disabled="disabled"
        class="w-full appearance-none bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option
          v-for="exchange in exchanges"
          :key="exchange.id"
          :value="exchange.id"
        >
          {{ exchange.icon }} {{ exchange.name }}
        </option>
      </select>
      <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <span class="material-symbols-outlined text-text-secondary text-lg">
          expand_more
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exchange-selector select {
  cursor: pointer;
}

.exchange-selector select:focus {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
</style>
