<script setup>
/**
 * ExchangeSelector Component
 * Dropdown for selecting cryptocurrency exchange
 */

const props = defineProps({
  exchanges: {
    type: Array,
    default: () => []
  },
  selectedExchange: {
    type: String,
    default: 'binance'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select'])

// Exchange icons/logos mapping
const exchangeIcons = {
  binance: '🟡',
  coinbase: '🔵',
  kraken: '🟣',
  kucoin: '🟢',
  bybit: '⚫',
  okx: '⬛'
}

const getExchangeIcon = (id) => {
  return exchangeIcons[id] || '🔶'
}
</script>

<template>
  <div class="exchange-selector">
    <label class="block text-xs text-text-secondary mb-1.5 font-medium">Exchange</label>
    <div class="relative">
      <select
        :value="selectedExchange"
        @change="emit('select', $event.target.value)"
        :disabled="disabled"
        class="w-full appearance-none bg-gray-50 dark:bg-background-dark 
               border border-gray-200 dark:border-border-dark 
               rounded-lg px-3 py-2 pr-8
               text-sm font-medium text-slate-900 dark:text-white
               focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
               disabled:opacity-50 disabled:cursor-not-allowed
               transition-all cursor-pointer"
      >
        <option 
          v-for="exchange in exchanges" 
          :key="exchange.id" 
          :value="exchange.id"
        >
          {{ exchange.name }}
        </option>
      </select>
      <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
        <span class="material-symbols-outlined text-[18px]">expand_more</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exchange-selector {
  min-width: 140px;
}
</style>
