<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  pair: {
    type: String,
    default: 'BTC/USD'
  },
  currentPrice: {
    type: Number,
    default: 98230.50
  }
})

const orderType = ref('limit') // limit, market, stop-limit
const side = ref('buy') // buy, sell
const price = ref('')
const amount = ref('')

const estimatedTotal = computed(() => {
  const priceNum = parseFloat(price.value) || props.currentPrice
  const amountNum = parseFloat(amount.value) || 0
  return (priceNum * amountNum).toFixed(2)
})

const setPercentage = (pct) => {
  // Mock balance - in real app would come from store
  const mockBalance = side.value === 'buy' ? 10000 : 0.5
  if (side.value === 'buy') {
    const priceNum = parseFloat(price.value) || props.currentPrice
    amount.value = ((mockBalance * pct / 100) / priceNum).toFixed(8)
  } else {
    amount.value = (mockBalance * pct / 100).toFixed(8)
  }
}
</script>

<template>
  <div class="p-4 flex flex-col gap-4 bg-white dark:bg-card-dark">
    <!-- Buy/Sell Toggle -->
    <div class="flex bg-gray-100 dark:bg-background-dark p-1 rounded-lg">
      <button
        @click="side = 'buy'"
        class="flex-1 py-2 text-sm font-bold rounded transition-colors"
        :class="side === 'buy' 
          ? 'bg-success text-white shadow-sm' 
          : 'text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
      >
        Buy
      </button>
      <button
        @click="side = 'sell'"
        class="flex-1 py-2 text-sm font-bold rounded transition-colors"
        :class="side === 'sell' 
          ? 'bg-danger text-white shadow-sm' 
          : 'text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
      >
        Sell
      </button>
    </div>
    
    <!-- Order Type -->
    <div class="flex gap-4 text-xs font-medium">
      <button 
        @click="orderType = 'limit'"
        :class="orderType === 'limit' ? 'text-primary' : 'text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
      >
        Limit
      </button>
      <button 
        @click="orderType = 'market'"
        :class="orderType === 'market' ? 'text-primary' : 'text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
      >
        Market
      </button>
      <button 
        @click="orderType = 'stop-limit'"
        :class="orderType === 'stop-limit' ? 'text-primary' : 'text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
      >
        Stop Limit
      </button>
    </div>
    
    <!-- Price Input (not for market orders) -->
    <div v-if="orderType !== 'market'" class="flex flex-col gap-1">
      <label class="text-xs text-slate-500 dark:text-text-secondary">Price</label>
      <div class="flex rounded-lg border border-gray-200 dark:border-border-dark overflow-hidden bg-gray-50 dark:bg-background-dark">
        <input 
          v-model="price"
          type="number"
          :placeholder="currentPrice.toString()"
          class="flex-1 bg-transparent border-none text-slate-900 dark:text-white text-sm font-mono px-3 py-2 focus:ring-0"
        />
        <span class="px-3 py-2 text-xs text-slate-500 dark:text-text-secondary border-l border-gray-200 dark:border-border-dark bg-gray-100 dark:bg-border-dark/50">USD</span>
      </div>
    </div>
    
    <!-- Amount Input -->
    <div class="flex flex-col gap-1">
      <div class="flex justify-between">
        <label class="text-xs text-slate-500 dark:text-text-secondary">Amount</label>
        <span class="text-xs text-slate-400 dark:text-text-secondary">
          Available: <span class="text-slate-900 dark:text-white font-mono">{{ side === 'buy' ? '10,000.00 USD' : '0.50000000 BTC' }}</span>
        </span>
      </div>
      <div class="flex rounded-lg border border-gray-200 dark:border-border-dark overflow-hidden bg-gray-50 dark:bg-background-dark">
        <input 
          v-model="amount"
          type="number"
          placeholder="0.00000000"
          class="flex-1 bg-transparent border-none text-slate-900 dark:text-white text-sm font-mono px-3 py-2 focus:ring-0"
        />
        <span class="px-3 py-2 text-xs text-slate-500 dark:text-text-secondary border-l border-gray-200 dark:border-border-dark bg-gray-100 dark:bg-border-dark/50">BTC</span>
      </div>
    </div>
    
    <!-- Percentage Buttons -->
    <div class="flex gap-2">
      <button 
        v-for="pct in [25, 50, 75, 100]" 
        :key="pct"
        @click="setPercentage(pct)"
        class="flex-1 py-1 text-xs font-medium text-slate-500 dark:text-text-secondary bg-gray-100 dark:bg-border-dark rounded hover:text-slate-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        {{ pct }}%
      </button>
    </div>
    
    <!-- Total -->
    <div class="flex justify-between items-center py-2 border-t border-gray-200 dark:border-border-dark">
      <span class="text-xs text-slate-500 dark:text-text-secondary">Total</span>
      <span class="text-sm font-bold font-mono text-slate-900 dark:text-white">{{ estimatedTotal }} USD</span>
    </div>
    
    <!-- Submit Button -->
    <button
      class="w-full py-3 rounded-lg font-bold text-white transition-colors"
      :class="side === 'buy' ? 'bg-success hover:bg-green-600' : 'bg-danger hover:bg-red-600'"
    >
      {{ side === 'buy' ? 'Buy' : 'Sell' }} {{ pair.split('/')[0] }}
    </button>
  </div>
</template>
