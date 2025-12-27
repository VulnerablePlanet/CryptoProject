<script setup>
defineProps({
  size: {
    type: String,
    default: 'md' // sm, md, lg
  }
})
</script>

<template>
  <div class="flex items-center justify-center">
    <div 
      class="animate-spin rounded-full border-2 border-primary border-t-transparent"
      :class="{
        'size-4': size === 'sm',
        'size-8': size === 'md',
        'size-12': size === 'lg'
      }"
    ></div>
  </div>
</template>
