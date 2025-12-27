<script setup>
import { computed } from 'vue'

const props = defineProps({
  coin: {
    type: Object,
    required: true
  },
  showSparkline: {
    type: Boolean,
    default: true
  }
})

const priceChange = computed(() => {
  const change = props.coin.price_change_percentage_24h
  return {
    value: change?.toFixed(2) || '0.00',
    isPositive: change >= 0
  }
})

const formatPrice = (price) => {
  if (!price) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: price < 1 ? 6 : 2
  }).format(price)
}

const formatMarketCap = (cap) => {
  if (!cap) return '$0'
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`
  return `$${cap.toLocaleString()}`
}

// Generate sparkline path from data
const sparklinePath = computed(() => {
  const data = props.coin.sparkline_in_7d?.price
  if (!data || data.length === 0) return ''
  
  const width = 100
  const height = 40
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  })
  
  return `M ${points.join(' L ')}`
})
</script>

<template>
  <div 
    class="flex flex-col gap-2 p-4 rounded-xl border border-gray-200 dark:border-border-dark 
           bg-white dark:bg-card-dark hover:border-primary/50 
           transition-all cursor-pointer group"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img 
          :src="coin.image" 
          :alt="coin.name"
          class="size-10 rounded-full"
        />
        <div>
          <h3 class="text-slate-900 dark:text-white font-semibold group-hover:text-primary transition-colors">
            {{ coin.name }}
          </h3>
          <p class="text-text-secondary text-xs uppercase">{{ coin.symbol }}</p>
        </div>
      </div>
      <div class="text-right">
        <p class="text-slate-900 dark:text-white font-mono font-bold">
          {{ formatPrice(coin.current_price) }}
        </p>
        <p 
          class="text-sm font-medium flex items-center justify-end gap-1"
          :class="priceChange.isPositive ? 'text-success' : 'text-danger'"
        >
          <span class="material-symbols-outlined text-[14px]">
            {{ priceChange.isPositive ? 'trending_up' : 'trending_down' }}
          </span>
          {{ priceChange.value }}%
        </p>
      </div>
    </div>

    <!-- Sparkline Chart -->
    <div v-if="showSparkline && sparklinePath" class="h-12 w-full mt-2">
      <svg 
        class="w-full h-full overflow-visible" 
        viewBox="0 0 100 40" 
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient :id="`gradient-${coin.id}`" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="priceChange.isPositive ? '#0bda5b' : '#ff4d4d'" stop-opacity="0.3"/>
            <stop offset="100%" :stop-color="priceChange.isPositive ? '#0bda5b' : '#ff4d4d'" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path 
          :d="sparklinePath + ` L 100,40 L 0,40 Z`"
          :fill="`url(#gradient-${coin.id})`"
        />
        <path 
          :d="sparklinePath"
          fill="none"
          :stroke="priceChange.isPositive ? '#0bda5b' : '#ff4d4d'"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
    </div>

    <!-- Market Cap -->
    <div class="flex justify-between text-xs text-text-secondary mt-1">
      <span>Market Cap</span>
      <span class="font-mono">{{ formatMarketCap(coin.market_cap) }}</span>
    </div>
  </div>
</template>
