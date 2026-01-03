<script setup>
/**
 * ChartTypeSelector Component
 * Toggle between different chart visualization types
 */

const props = defineProps({
  chartTypes: {
    type: Array,
    required: true
  },
  selectedType: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select'])

const handleSelect = (type) => {
  if (!props.disabled) {
    emit('select', type)
  }
}
</script>

<template>
  <div class="select-none">
    <label class="block text-xs text-text-secondary mb-1.5 font-medium">
      Chart Type
    </label>
    <div class="flex gap-1 bg-gray-100 dark:bg-background-dark p-1 rounded-lg">
      <button
        v-for="type in chartTypes"
        :key="type.value"
        @click="handleSelect(type.value)"
        :disabled="disabled"
        class="flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        :class="selectedType === type.value 
          ? 'bg-white dark:bg-card-dark text-primary shadow-sm' 
          : 'text-slate-500 dark:text-text-secondary hover:text-slate-700 dark:hover:text-white'"
        :title="type.label"
      >
        <span class="material-symbols-outlined text-[18px]">{{ type.icon }}</span>
        <span class="hidden sm:inline ml-1">{{ type.label }}</span>
      </button>
    </div>
  </div>
</template>
