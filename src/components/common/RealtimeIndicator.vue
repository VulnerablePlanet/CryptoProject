<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useCryptoStore } from '@/stores/crypto'
import { useSocket } from '@/services/socket'

const cryptoStore = useCryptoStore()
const { isConnected } = useSocket()

// Reactive trigger for time updates
const updateTrigger = ref(0)
let intervalId = null

const lastUpdateText = computed(() => {
  // Use updateTrigger to force reactivity
  updateTrigger.value
  
  if (!cryptoStore.lastUpdated) return 'Never'
  const diff = Date.now() - new Date(cryptoStore.lastUpdated).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
})

// Update the time display every second
onMounted(() => {
  intervalId = setInterval(() => {
    updateTrigger.value++
  }, 1000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all"
       :class="isConnected && cryptoStore.realtimeEnabled 
         ? 'border-success/30 bg-success/5' 
         : 'border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-card-dark'"
  >
    <!-- Connection indicator -->
    <div class="relative">
      <div 
        class="size-2 rounded-full transition-colors"
        :class="isConnected && cryptoStore.realtimeEnabled ? 'bg-success' : 'bg-gray-400'"
      ></div>
      <div 
        v-if="isConnected && cryptoStore.realtimeEnabled"
        class="absolute inset-0 size-2 rounded-full bg-success animate-ping opacity-75"
      ></div>
    </div>
    
    <!-- Status text -->
    <span class="text-xs font-medium"
          :class="isConnected && cryptoStore.realtimeEnabled 
            ? 'text-success' 
            : 'text-slate-500 dark:text-text-secondary'"
    >
      {{ isConnected && cryptoStore.realtimeEnabled ? 'LIVE' : 'OFFLINE' }}
    </span>
    
    <!-- Last update -->
    <span class="text-xs text-slate-400 dark:text-text-secondary font-mono hidden sm:inline">
      {{ lastUpdateText }}
    </span>
  </div>
</template>
