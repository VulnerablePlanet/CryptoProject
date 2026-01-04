<script setup>
/**
 * SymbolSelector Component
 * Symbol button group for quick selection
 */

const props = defineProps({
  symbols: {
    type: Array,
    default: () => []
  },
  selectedBase: {
    type: String,
    default: 'BTC'
  },
  selectedQuote: {
    type: String,
    default: 'USDT'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select'])

const isSelected = (symbol) => {
  return symbol.base === props.selectedBase && symbol.quote === props.selectedQuote
}
</script>

<template>
  <div>
    <label class="block text-xs text-text-secondary mb-1.5 font-medium">Symbol</label>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="symbol in symbols"
        :key="`${symbol.base}-${symbol.quote}`"
        @click="emit('select', symbol.base, symbol.quote)"
        :disabled="disabled"
        class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all
               disabled:opacity-50 disabled:cursor-not-allowed"
        :class="isSelected(symbol) 
          ? 'bg-primary text-white hover:bg-primary/90' 
          : 'bg-gray-100 dark:bg-background-dark text-slate-600 dark:text-text-secondary hover:bg-gray-200 dark:hover:bg-border-dark hover:text-slate-900 dark:hover:text-white'"
        :title="symbol.name"
      >
        {{ symbol.base }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* No scoped styles needed - using inline Tailwind classes */
</style>
