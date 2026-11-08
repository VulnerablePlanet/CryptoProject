<script setup>
defineProps({
  size: {
    type: String,
    default: 'md' // sm, md, lg
  },
  /** Optional visible label; also announced to assistive technology */
  message: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
    <div 
      class="animate-spin rounded-full border-2 border-primary border-t-transparent"
      :class="{
        'size-4': size === 'sm',
        'size-8': size === 'md',
        'size-12': size === 'lg'
      }"
      aria-hidden="true"
    ></div>
    <p v-if="message" class="text-sm text-text-secondary">{{ message }}</p>
    <span v-else class="sr-only">Loading</span>
  </div>
</template>
