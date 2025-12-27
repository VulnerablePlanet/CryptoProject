<script setup>
import { ref, computed } from 'vue'

defineProps({
  balance: {
    type: Number,
    default: 0
  },
  change: {
    type: Number,
    default: 0
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const balanceHidden = ref(false)

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark p-6 relative overflow-hidden">
    <!-- Background Gradient -->
    <div class="absolute -right-10 -top-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
    
    <div class="relative z-10">
      <!-- Header -->
      <div class="flex items-center gap-2 mb-2">
        <p class="text-slate-500 dark:text-text-secondary text-sm font-medium">Estimated Total Balance</p>
        <button 
          @click="balanceHidden = !balanceHidden"
          class="text-slate-400 dark:text-text-secondary hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">
            {{ balanceHidden ? 'visibility' : 'visibility_off' }}
          </span>
        </button>
      </div>
      
      <!-- Balance -->
      <div class="flex items-baseline gap-4 mb-6">
        <template v-if="!loading">
          <h2 class="text-slate-900 dark:text-white text-3xl md:text-4xl font-black tracking-tight font-mono">
            {{ balanceHidden ? '••••••••' : formatCurrency(balance) }}
          </h2>
          <span 
            v-if="!balanceHidden"
            class="flex items-center px-2 py-0.5 rounded text-sm font-bold"
            :class="change >= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'"
          >
            <span class="material-symbols-outlined text-[14px] mr-0.5">
              {{ change >= 0 ? 'trending_up' : 'trending_down' }}
            </span>
            {{ change >= 0 ? '+' : '' }}{{ change.toFixed(2) }}% (24h)
          </span>
        </template>
        <template v-else>
          <div class="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </template>
      </div>
      
      <!-- Quick Actions -->
      <div class="flex flex-wrap gap-3">
        <button class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors">
          <span class="material-symbols-outlined text-[18px]">download</span>
          Deposit
        </button>
        <button class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-border-dark hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-900 dark:text-white text-sm font-bold rounded-lg transition-colors border border-gray-200 dark:border-gray-600">
          <span class="material-symbols-outlined text-[18px]">upload</span>
          Withdraw
        </button>
        <button class="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-border-dark hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-900 dark:text-white text-sm font-bold rounded-lg transition-colors border border-gray-200 dark:border-gray-600">
          <span class="material-symbols-outlined text-[18px]">swap_horiz</span>
          Transfer
        </button>
      </div>
    </div>
  </div>
</template>
