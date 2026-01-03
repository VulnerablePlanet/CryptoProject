<script setup>
/**
 * CoinSelector Component
 * Reusable coin selection filter with visual indicators
 */

const props = defineProps({
  coins: {
    type: Array,
    required: true
  },
  selectedCoin: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select'])

const handleSelect = (coinId) => {
  if (!props.disabled) {
    emit('select', coinId)
  }
}
</script>

<template>
  <div class="select-none">
    <label v-if="!compact" class="block text-xs text-text-secondary mb-1.5 font-medium">
      Cryptocurrency
    </label>
    <div class="flex gap-2 flex-wrap">
      <button
        v-for="coin in coins"
        :key="coin.id"
        @click="handleSelect(coin.id)"
        :disabled="disabled"
        class="flex items-center gap-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        :class="[
          selectedCoin === coin.id 
            ? 'bg-primary text-white shadow-sm' 
            : 'bg-gray-100 dark:bg-background-dark text-slate-600 dark:text-text-secondary hover:bg-gray-200 dark:hover:bg-border-dark hover:text-slate-900 dark:hover:text-white',
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5'
        ]"
        :title="coin.name"
      >
        <span 
          v-if="!compact"
          class="w-2 h-2 rounded-full shrink-0"
          :style="{ backgroundColor: coin.color }"
        ></span>
        <span class="font-semibold tracking-wide">{{ coin.symbol }}</span>
      </button>
    </div>
  </div>
</template>
