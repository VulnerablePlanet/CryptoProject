<script setup>
import { computed } from 'vue'

const props = defineProps({
  coins: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  selectedCoinId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['coin-click'])

// Exchange rate USD to COP
const copRate = 4400

const formatPrice = (price) => {
  if (!price) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: price < 1 ? 6 : 2
  }).format(price)
}

const formatCOP = (price) => {
  if (!price) return 'COP $0'
  const cop = price * copRate
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cop)
}

const formatBalance = (value) => {
  if (!value) return '0'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(value)
}

const handleCoinClick = (coin) => {
  emit('coin-click', coin)
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
    <!-- Header -->
    <div class="p-6 border-b border-gray-200 dark:border-border-dark flex justify-between items-center">
      <h3 class="text-slate-900 dark:text-white font-bold text-lg">My Assets</h3>
      <button class="text-primary text-sm font-medium hover:text-blue-400 transition-colors">View All</button>
    </div>
    
    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead class="bg-gray-50 dark:bg-border-dark/30">
          <tr>
            <th class="py-3 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider">Asset</th>
            <th class="py-3 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Price</th>
            <th class="py-3 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Balance</th>
            <th class="py-3 px-6 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">24h</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-border-dark">
          <!-- Loading State -->
          <template v-if="loading">
            <tr v-for="i in 4" :key="i">
              <td class="py-4 px-6" colspan="4">
                <div class="animate-pulse flex items-center gap-3">
                  <div class="size-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div class="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
          
          <!-- Data Rows -->
          <template v-else>
            <tr 
              v-for="coin in coins" 
              :key="coin.id"
              @click="handleCoinClick(coin)"
              class="transition-colors cursor-pointer group"
              :class="[
                (coin.id === selectedCoinId || coin.coinId === selectedCoinId)
                  ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-primary'
                  : 'hover:bg-gray-50 dark:hover:bg-border-dark/20'
              ]"
            >
              <td class="py-4 px-6">
                <div class="flex items-center gap-3">
                  <img 
                    :src="coin.image" 
                    :alt="coin.name" 
                    class="size-8 rounded-full"
                  />
                  <div class="flex flex-col">
                    <span class="text-slate-900 dark:text-white font-medium group-hover:text-primary transition-colors">
                      {{ coin.name }}
                    </span>
                    <span class="text-text-secondary text-xs uppercase">{{ coin.symbol }}</span>
                  </div>
                </div>
              </td>
              <td class="py-4 px-6 text-right">
                <div class="flex flex-col items-end">
                  <span class="font-mono text-slate-900 dark:text-white">{{ formatPrice(coin.current_price) }}</span>
                  <span class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">🇨🇴 {{ formatCOP(coin.current_price) }}</span>
                </div>
              </td>
              <td class="py-4 px-6 text-right">
                <div class="flex flex-col items-end">
                  <span class="text-slate-900 dark:text-white font-mono font-medium">
                    {{ formatBalance(coin.holdings) }} {{ coin.symbol?.toUpperCase() }}
                  </span>
                  <span class="text-text-secondary text-xs">
                    {{ formatPrice(coin.holdings * coin.current_price) }}
                  </span>
                  <span class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
                    🇨🇴 {{ formatCOP(coin.holdings * coin.current_price) }}
                  </span>
                </div>
              </td>
              <td class="py-4 px-6 text-right">
                <span 
                  class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold"
                  :class="coin.price_change_percentage_24h >= 0 
                    ? 'text-success bg-success/10' 
                    : 'text-danger bg-danger/10'"
                >
                  <span class="material-symbols-outlined text-[12px]">
                    {{ coin.price_change_percentage_24h >= 0 ? 'arrow_upward' : 'arrow_downward' }}
                  </span>
                  {{ Math.abs(coin.price_change_percentage_24h || 0).toFixed(2) }}%
                </span>
              </td>
            </tr>
          </template>
          
          <!-- Empty State -->
          <tr v-if="!loading && coins.length === 0">
            <td colspan="4" class="py-12 text-center text-text-secondary">
              <span class="material-symbols-outlined text-4xl mb-2 block">inbox</span>
              No assets to display
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
