<script setup>
import { ref } from 'vue'

const props = defineProps({
  currentPrice: {
    type: Number,
    default: 0
  },
  priceChange: {
    type: Number,
    default: 0
  }
})

// Mock order book data
const asks = ref([
  { price: 98245.50, amount: 0.4321, total: 42435 },
  { price: 98242.00, amount: 0.8540, total: 83894 },
  { price: 98240.50, amount: 0.1200, total: 11788 },
  { price: 98238.00, amount: 0.2500, total: 24559 },
  { price: 98235.00, amount: 0.5100, total: 50099 },
])

const bids = ref([
  { price: 98228.00, amount: 1.2045, total: 118258 },
  { price: 98225.50, amount: 0.5000, total: 49112 },
  { price: 98220.00, amount: 2.1000, total: 206262 },
  { price: 98218.50, amount: 0.0500, total: 4910 },
  { price: 98215.00, amount: 0.7800, total: 76607 },
])

const formatPrice = (price) => price.toLocaleString('en-US', { minimumFractionDigits: 2 })
const formatAmount = (amount) => amount.toFixed(4)
const formatTotal = (total) => total.toLocaleString()

const getDepthWidth = (amount, max) => {
  const maxAmount = Math.max(...asks.value.map(a => a.amount), ...bids.value.map(b => b.amount))
  return `${(amount / maxAmount) * 100}%`
}
</script>

<template>
  <div class="flex flex-col h-full border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden bg-white dark:bg-card-dark">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-border-dark flex justify-between items-center">
      <h3 class="text-sm font-bold text-slate-900 dark:text-white">Order Book</h3>
      <div class="flex gap-2">
        <span class="material-symbols-outlined text-slate-400 dark:text-text-secondary text-sm cursor-pointer hover:text-slate-900 dark:hover:text-white">format_align_left</span>
        <span class="material-symbols-outlined text-slate-400 dark:text-text-secondary text-sm cursor-pointer hover:text-slate-900 dark:hover:text-white">more_vert</span>
      </div>
    </div>
    
    <!-- Column Headers -->
    <div class="grid grid-cols-3 px-4 py-2 text-xs text-slate-500 dark:text-text-secondary font-medium">
      <div>Price (USD)</div>
      <div class="text-right">Amount (BTC)</div>
      <div class="text-right">Total</div>
    </div>
    
    <!-- Asks (Sell Orders) -->
    <div class="flex-1 overflow-y-auto">
      <div 
        v-for="(ask, index) in asks" 
        :key="'ask-' + index"
        class="grid grid-cols-3 px-4 py-0.5 text-xs font-mono hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer relative group"
      >
        <div 
          class="absolute right-0 top-0 bottom-0 bg-danger/10"
          :style="{ width: getDepthWidth(ask.amount) }"
        ></div>
        <span class="text-danger relative z-10">{{ formatPrice(ask.price) }}</span>
        <span class="text-right text-slate-900 dark:text-white relative z-10">{{ formatAmount(ask.amount) }}</span>
        <span class="text-right text-slate-500 dark:text-text-secondary relative z-10">{{ formatTotal(ask.total) }}</span>
      </div>
    </div>
    
    <!-- Current Price -->
    <div class="py-2 px-4 border-y border-gray-200 dark:border-border-dark flex items-center justify-between bg-gray-50 dark:bg-background-dark/50">
      <div class="flex items-center gap-2">
        <span 
          class="text-lg font-bold font-mono"
          :class="priceChange >= 0 ? 'text-success' : 'text-danger'"
        >
          {{ formatPrice(currentPrice || 98230.50) }}
        </span>
        <span 
          class="material-symbols-outlined text-sm"
          :class="priceChange >= 0 ? 'text-success' : 'text-danger'"
        >
          {{ priceChange >= 0 ? 'arrow_upward' : 'arrow_downward' }}
        </span>
      </div>
      <span class="text-xs text-slate-500 dark:text-text-secondary font-mono">
        ${{ formatPrice(currentPrice || 98230.50) }}
      </span>
    </div>
    
    <!-- Bids (Buy Orders) -->
    <div class="flex-1 overflow-y-auto">
      <div 
        v-for="(bid, index) in bids" 
        :key="'bid-' + index"
        class="grid grid-cols-3 px-4 py-0.5 text-xs font-mono hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer relative"
      >
        <div 
          class="absolute right-0 top-0 bottom-0 bg-success/10"
          :style="{ width: getDepthWidth(bid.amount) }"
        ></div>
        <span class="text-success relative z-10">{{ formatPrice(bid.price) }}</span>
        <span class="text-right text-slate-900 dark:text-white relative z-10">{{ formatAmount(bid.amount) }}</span>
        <span class="text-right text-slate-500 dark:text-text-secondary relative z-10">{{ formatTotal(bid.total) }}</span>
      </div>
    </div>
  </div>
</template>
