<script setup>
import { ref } from 'vue'

const searchQuery = ref('')

const emit = defineEmits(['search'])

const handleSearch = () => {
  emit('search', searchQuery.value)
}
</script>

<template>
  <div class="relative">
    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">
      search
    </span>
    <input
      v-model="searchQuery"
      @keyup.enter="handleSearch"
      type="text"
      placeholder="Search hash, txID, or asset..."
      class="w-full bg-card-dark border border-border-dark rounded-lg 
             pl-10 pr-4 py-2 text-sm text-white placeholder-text-secondary
             focus:border-primary focus:ring-1 focus:ring-primary 
             transition-colors outline-none"
    />
    <span 
      v-if="searchQuery"
      @click="searchQuery = ''"
      class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 
             text-text-secondary text-[16px] cursor-pointer hover:text-white"
    >
      close
    </span>
  </div>
</template>
