<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  tabs: {
    type: Array,
    default: () => ['Buy', 'Sell', 'Convert']
  }
})

const activeTab = ref(0)
const amount = ref('')
const selectedAsset = ref('BTC')

const assets = [
  { id: 'BTC', name: 'Bitcoin', icon: 'currency_bitcoin', color: 'orange' },
  { id: 'ETH', name: 'Ethereum', icon: 'diamond', color: 'purple' },
  { id: 'SOL', name: 'Solana', icon: 'token', color: 'indigo' },
]

const currentAsset = computed(() => 
  assets.find(a => a.id === selectedAsset.value) || assets[0]
)
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden shadow-sm">
    <!-- Tabs -->
    <div class="flex border-b border-gray-200 dark:border-border-dark">
      <button
        v-for="(tab, index) in tabs"
        :key="tab"
        @click="activeTab = index"
        class="flex-1 py-3 text-sm font-medium transition-colors"
        :class="activeTab === index 
          ? 'text-primary border-b-2 border-primary bg-primary/5 dark:bg-primary/10' 
          : 'text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
      >
        {{ tab }}
      </button>
    </div>
    
    <div class="p-5 flex flex-col gap-5">
      <!-- Amount Input -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-slate-500 dark:text-text-secondary uppercase">
          {{ activeTab === 0 ? 'Amount to spend' : activeTab === 1 ? 'Amount to sell' : 'Amount to convert' }}
        </label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <span class="text-slate-400 dark:text-text-secondary font-bold">$</span>
          </div>
          <input
            v-model="amount"
            class="block w-full rounded-lg border border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark pl-8 pr-16 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-text-secondary focus:border-primary focus:ring-1 focus:ring-primary text-lg font-bold transition-all"
            placeholder="0.00"
            type="number"
          />
          <div class="absolute inset-y-0 right-0 flex items-center pr-3">
            <span class="text-slate-500 dark:text-text-secondary text-sm font-medium">USD</span>
          </div>
        </div>
      </div>
      
      <!-- Asset Selector -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-slate-500 dark:text-text-secondary uppercase">
          {{ activeTab === 0 ? 'Asset to buy' : activeTab === 1 ? 'Asset to sell' : 'From' }}
        </label>
        <div class="relative">
          <select
            v-model="selectedAsset"
            class="block w-full rounded-lg border border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark px-4 py-3 text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary text-sm font-medium appearance-none cursor-pointer"
          >
            <option v-for="asset in assets" :key="asset.id" :value="asset.id">
              {{ asset.name }} ({{ asset.id }})
            </option>
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span class="material-symbols-outlined text-slate-400 dark:text-text-secondary text-[20px]">expand_more</span>
          </div>
        </div>
      </div>
      
      <!-- Preview -->
      <div class="p-4 rounded-lg bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-border-dark">
        <div class="flex justify-between items-center text-sm">
          <span class="text-slate-500 dark:text-text-secondary">You'll receive approx.</span>
          <span class="text-slate-900 dark:text-white font-bold font-mono">
            {{ amount ? (parseFloat(amount) / 98000).toFixed(8) : '0.00000000' }} {{ selectedAsset }}
          </span>
        </div>
        <div class="flex justify-between items-center text-sm mt-2">
          <span class="text-slate-500 dark:text-text-secondary">Fee</span>
          <span class="text-slate-900 dark:text-white font-mono">0.1%</span>
        </div>
      </div>
      
      <!-- Action Button -->
      <button
        class="w-full py-3 rounded-lg font-bold text-white transition-colors"
        :class="activeTab === 1 
          ? 'bg-danger hover:bg-red-600' 
          : 'bg-primary hover:bg-blue-600'"
      >
        {{ activeTab === 0 ? 'Buy' : activeTab === 1 ? 'Sell' : 'Convert' }} {{ currentAsset.name }}
      </button>
    </div>
  </div>
</template>
