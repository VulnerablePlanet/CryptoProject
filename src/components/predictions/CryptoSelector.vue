<script setup>
/**
 * CryptoSelector Component
 * Dropdown for selecting cryptocurrency trading pair
 */

import { computed, useId } from 'vue'

// Unique prefix so label/field ids stay valid with several instances
const uid = useId()

const props = defineProps({
  symbols: {
    type: Array,
    required: true
  },
  modelValue: {
    type: String,
    default: 'BTC/USDT'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const selectedSymbol = computed({
  get: () => props.modelValue,
  set: (value) => {
    emit('update:modelValue', value)
    emit('change', value)
  }
})

// Get crypto icon based on base currency
function getCryptoIcon(base) {
  const icons = {
    'BTC': '₿',
    'ETH': 'Ξ',
    'BNB': '◆',
    'SOL': '◎',
    'XRP': '✕',
    'ADA': '₳',
    'DOGE': 'Ð',
    'DOT': '●',
    'AVAX': '▲',
    'MATIC': '⬡'
  }
  return icons[base] || '○'
}
</script>

<template>
  <div class="crypto-selector">
    <label :for="`${uid}-crypto-selector-cryptocurrency`" class="block text-sm font-medium text-text-secondary mb-1.5">
      Cryptocurrency
    </label>
    <div class="relative">
      <select :id="`${uid}-crypto-selector-cryptocurrency`"
        v-model="selectedSymbol"
        :disabled="disabled || loading"
        class="w-full appearance-none bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-lg px-4 py-2.5 pr-10 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option
          v-for="sym in symbols"
          :key="sym.symbol"
          :value="sym.symbol"
        >
          {{ sym.symbol }}
        </option>
      </select>
      
      <!-- Loading indicator -->
      <div 
        v-if="loading"
        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"
      >
        <span class="material-symbols-outlined text-primary text-lg animate-spin">
          progress_activity
        </span>
      </div>
      
      <!-- Arrow icon -->
      <div 
        v-else
        class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"
      >
        <span class="material-symbols-outlined text-text-secondary text-lg">
          expand_more
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crypto-selector select {
  cursor: pointer;
  min-width: 160px;
}

.crypto-selector select:focus {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
}
</style>
