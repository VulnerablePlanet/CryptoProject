<script setup>
/**
 * PriceDisplay Component
 * Displays current price with USD/COP conversion
 */

import { computed } from 'vue'
import { formatUSD, formatCOPWithFlag, formatPercentage, formatCompact } from '@/utils/currency'

const props = defineProps({
  currentPrice: {
    type: Number,
    default: 0
  },
  openPrice: {
    type: Number,
    default: 0
  },
  highPrice: {
    type: Number,
    default: 0
  },
  lowPrice: {
    type: Number,
    default: 0
  },
  volume: {
    type: Number,
    default: 0
  },
  priceChange: {
    type: Number,
    default: 0
  },
  coinSymbol: {
    type: String,
    default: 'BTC'
  },
  coinColor: {
    type: String,
    default: '#f7931a'
  },
  compact: {
    type: Boolean,
    default: false
  }
})

// Computed
const priceDirection = computed(() => {
  if (props.priceChange > 0) return 'up'
  if (props.priceChange < 0) return 'down'
  return 'neutral'
})

const directionIcon = computed(() => {
  if (priceDirection.value === 'up') return 'trending_up'
  if (priceDirection.value === 'down') return 'trending_down'
  return 'trending_flat'
})
</script>

<template>
  <div :class="compact ? 'space-y-2' : 'space-y-4'">
    <!-- Main Price -->
    <div class="flex items-center gap-3">
      <!-- Coin Badge -->
      <div 
        class="px-3 py-1.5 rounded-lg text-sm font-bold"
        :style="{ backgroundColor: `${coinColor}20`, color: coinColor }"
      >
        {{ coinSymbol }}
      </div>
      
      <!-- Price Values -->
      <div>
        <div class="flex items-baseline gap-3">
          <!-- USD Price -->
          <span class="text-2xl lg:text-3xl font-bold font-mono text-slate-900 dark:text-white">
            {{ formatUSD(currentPrice) }}
          </span>
          
          <!-- Change Badge -->
          <span 
            class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
            :class="{
              'bg-success/10 text-success': priceDirection === 'up',
              'bg-danger/10 text-danger': priceDirection === 'down',
              'bg-gray-100 dark:bg-border-dark text-slate-500 dark:text-text-secondary': priceDirection === 'neutral'
            }"
          >
            <span class="material-symbols-outlined text-[16px]">{{ directionIcon }}</span>
            {{ formatPercentage(priceChange) }}
          </span>
        </div>
        
        <!-- COP Price -->
        <p class="text-yellow-600 dark:text-yellow-400 text-sm font-mono mt-0.5">
          {{ formatCOPWithFlag(currentPrice) }}
        </p>
      </div>
    </div>
    
    <!-- OHLC Stats Grid -->
    <div v-if="!compact" class="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-border-dark">
      <!-- Open -->
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-text-secondary font-medium">Open</span>
        <span class="font-mono font-semibold text-slate-900 dark:text-white">{{ formatUSD(openPrice) }}</span>
        <span class="text-xs font-mono text-yellow-600 dark:text-yellow-400">{{ formatCOPWithFlag(openPrice) }}</span>
      </div>
      
      <!-- High -->
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-text-secondary font-medium">High</span>
        <span class="font-mono font-semibold text-success">{{ formatUSD(highPrice) }}</span>
        <span class="text-xs font-mono text-yellow-600 dark:text-yellow-400">{{ formatCOPWithFlag(highPrice) }}</span>
      </div>
      
      <!-- Low -->
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-text-secondary font-medium">Low</span>
        <span class="font-mono font-semibold text-danger">{{ formatUSD(lowPrice) }}</span>
        <span class="text-xs font-mono text-yellow-600 dark:text-yellow-400">{{ formatCOPWithFlag(lowPrice) }}</span>
      </div>
      
      <!-- Volume -->
      <div class="flex flex-col gap-0.5">
        <span class="text-xs text-text-secondary font-medium">Volume</span>
        <span class="font-mono font-semibold text-slate-900 dark:text-white">{{ formatCompact(volume) }}</span>
      </div>
    </div>
  </div>
</template>
