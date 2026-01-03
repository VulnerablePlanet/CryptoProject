<script setup>
/**
 * TimeframeSelector Component
 * Reusable timeframe selection buttons
 */

const props = defineProps({
  timeframes: {
    type: Array,
    required: true
  },
  selectedTimeframe: {
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

const handleSelect = (timeframe) => {
  if (!props.disabled) {
    emit('select', timeframe)
  }
}
</script>

<template>
  <div class="select-none">
    <label v-if="!compact" class="block text-xs text-text-secondary mb-1.5 font-medium">
      Timeframe
    </label>
    <div class="flex gap-1">
      <button
        v-for="tf in timeframes"
        :key="tf.value"
        @click="handleSelect(tf.value)"
        :disabled="disabled"
        class="rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        :class="[
          selectedTimeframe === tf.value 
            ? 'bg-primary/10 text-primary border border-primary/30' 
            : 'bg-gray-50 dark:bg-background-dark text-slate-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-border-dark border border-transparent',
          compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
        ]"
        :title="tf.description"
      >
        {{ tf.label }}
      </button>
    </div>
  </div>
</template>
