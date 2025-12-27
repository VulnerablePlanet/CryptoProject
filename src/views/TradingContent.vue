<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCryptoStore } from '@/stores/crypto'
import PriceChart from '@/components/crypto/PriceChart.vue'
import OrderBook from '@/components/trading/OrderBook.vue'
import TradePanel from '@/components/trading/TradePanel.vue'

const cryptoStore = useCryptoStore()

// Trading pair selection
const selectedPair = ref({ base: 'bitcoin', quote: 'USD', symbol: 'BTC/USD' })

// Mock price data
const currentPrice = ref(98230.50)
const priceChange = ref(2.4)
const high24h = ref(99102.00)
const low24h = ref(97200.00)
const volume24h = ref(24500000000)

// Open orders (mock)
const openOrders = ref([
  { id: 1, date: '2024-12-10 14:20:11', pair: 'BTC/USD', type: 'Limit', side: 'buy', price: 97500.00, amount: 0.04500, total: 4387.50 },
  { id: 2, date: '2024-12-10 10:15:45', pair: 'BTC/USD', type: 'Limit', side: 'sell', price: 99800.00, amount: 0.12000, total: 11976.00 },
])

const tabs = ref(['Open Orders', 'Order History', 'Trade History', 'Funds'])
const activeTab = ref(0)

// Fetch chart data
onMounted(async () => {
  await cryptoStore.fetchChartData(selectedPair.value.base, 7)
})

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value)
}

const formatVolume = (value) => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  return value.toLocaleString()
}
</script>

<template>
  <div class="flex flex-col h-full -m-4 md:-m-6 lg:-m-8">
    <!-- Trading Header -->
    <header class="h-16 border-b border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark px-4 lg:px-6 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-6">
        <!-- Pair Selector -->
        <div class="flex items-center gap-2">
          <div class="flex">
            <div class="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center border-2 border-white dark:border-card-dark z-10">
              <span class="material-symbols-outlined text-orange-500 text-xs">currency_bitcoin</span>
            </div>
            <div class="w-7 h-7 -ml-2 rounded-full bg-green-500/20 flex items-center justify-center border-2 border-white dark:border-card-dark">
              <span class="material-symbols-outlined text-green-500 text-xs">attach_money</span>
            </div>
          </div>
          <div>
            <h1 class="font-bold text-base leading-tight flex items-center gap-1 text-slate-900 dark:text-white">
              {{ selectedPair.symbol }}
              <span class="material-symbols-outlined text-slate-400 dark:text-text-secondary text-base">expand_more</span>
            </h1>
          </div>
        </div>
        
        <div class="h-6 w-px bg-gray-200 dark:bg-border-dark mx-2 hidden sm:block"></div>
        
        <!-- Price Stats -->
        <div class="hidden sm:flex gap-6 text-sm">
          <div>
            <p class="text-slate-500 dark:text-text-secondary text-xs">Price</p>
            <p class="font-mono font-medium text-success text-sm">{{ formatCurrency(currentPrice) }}</p>
          </div>
          <div>
            <p class="text-slate-500 dark:text-text-secondary text-xs">24h Change</p>
            <p class="font-mono font-medium text-sm" :class="priceChange >= 0 ? 'text-success' : 'text-danger'">
              {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
            </p>
          </div>
          <div class="hidden lg:block">
            <p class="text-slate-500 dark:text-text-secondary text-xs">24h High</p>
            <p class="font-mono font-medium text-sm text-slate-900 dark:text-white">{{ formatCurrency(high24h) }}</p>
          </div>
          <div class="hidden lg:block">
            <p class="text-slate-500 dark:text-text-secondary text-xs">24h Low</p>
            <p class="font-mono font-medium text-sm text-slate-900 dark:text-white">{{ formatCurrency(low24h) }}</p>
          </div>
          <div class="hidden xl:block">
            <p class="text-slate-500 dark:text-text-secondary text-xs">24h Volume</p>
            <p class="font-mono font-medium text-sm text-slate-900 dark:text-white">{{ formatVolume(volume24h) }} USD</p>
          </div>
        </div>
      </div>
      
      <div class="flex items-center gap-4">
        <!-- Search -->
        <div class="relative hidden md:block">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-text-secondary text-[18px]">search</span>
          <input
            class="bg-gray-50 dark:bg-background-dark border border-gray-200 dark:border-border-dark rounded-md pl-10 pr-4 py-1.5 text-sm focus:border-primary focus:ring-0 w-44 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-text-secondary"
            placeholder="Search pair..."
            type="text"
          />
        </div>
        <button class="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-primary/20">
          <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          <span class="hidden sm:inline">Connect Wallet</span>
        </button>
      </div>
    </header>

    <!-- Main Trading Layout -->
    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <!-- Left: Chart + Orders -->
      <div class="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-border-dark overflow-hidden">
        <!-- Chart -->
        <div class="flex-1 min-h-[350px] max-h-[400px] overflow-hidden">
          <PriceChart 
            :data="cryptoStore.chartData"
            :loading="cryptoStore.loading"
            :height="350"
            :showToolbar="true"
            type="area"
          />
        </div>
        
        <!-- Orders Table -->
        <div class="flex-1 bg-white dark:bg-card-dark border-t border-gray-200 dark:border-border-dark flex flex-col min-h-[200px]">
          <!-- Tabs -->
          <div class="flex items-center px-4 border-b border-gray-200 dark:border-border-dark">
            <button
              v-for="(tab, index) in tabs"
              :key="tab"
              @click="activeTab = index"
              class="px-4 py-3 text-sm font-medium transition-colors"
              :class="activeTab === index 
                ? 'text-slate-900 dark:text-white border-b-2 border-primary' 
                : 'text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
            >
              {{ tab }}{{ index === 0 ? ` (${openOrders.length})` : '' }}
            </button>
          </div>
          
          <!-- Orders Content -->
          <div class="flex-1 overflow-auto p-4">
            <table class="w-full text-left text-sm">
              <thead class="text-slate-500 dark:text-text-secondary font-normal text-xs sticky top-0 bg-white dark:bg-card-dark">
                <tr>
                  <th class="pb-3 pl-2 font-normal">Date</th>
                  <th class="pb-3 font-normal">Pair</th>
                  <th class="pb-3 font-normal">Type</th>
                  <th class="pb-3 font-normal">Side</th>
                  <th class="pb-3 font-normal">Price</th>
                  <th class="pb-3 font-normal">Amount</th>
                  <th class="pb-3 font-normal text-right">Total</th>
                  <th class="pb-3 font-normal text-right pr-2">Action</th>
                </tr>
              </thead>
              <tbody class="font-mono text-xs">
                <tr 
                  v-for="order in openOrders" 
                  :key="order.id"
                  class="border-b border-gray-100 dark:border-border-dark/50 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <td class="py-3 pl-2 text-slate-500 dark:text-text-secondary">{{ order.date }}</td>
                  <td class="py-3 font-bold text-slate-900 dark:text-white">{{ order.pair }}</td>
                  <td class="py-3 text-slate-600 dark:text-gray-300">{{ order.type }}</td>
                  <td class="py-3" :class="order.side === 'buy' ? 'text-success' : 'text-danger'">
                    {{ order.side.charAt(0).toUpperCase() + order.side.slice(1) }}
                  </td>
                  <td class="py-3 text-slate-900 dark:text-white">{{ formatCurrency(order.price) }}</td>
                  <td class="py-3 text-slate-900 dark:text-white">{{ order.amount.toFixed(5) }}</td>
                  <td class="py-3 text-right text-slate-900 dark:text-white">{{ formatCurrency(order.total) }}</td>
                  <td class="py-3 text-right pr-2">
                    <button class="text-slate-400 dark:text-text-secondary hover:text-danger text-xs">Cancel</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- Right: Order Book + Trade Panel -->
      <div class="w-full lg:w-[360px] xl:w-[400px] flex flex-col shrink-0 bg-gray-50 dark:bg-background-dark">
        <!-- Order Book -->
        <div class="flex-1 min-h-[300px]">
          <OrderBook 
            :currentPrice="currentPrice"
            :priceChange="priceChange"
          />
        </div>
        
        <!-- Trade Panel -->
        <div class="border-t border-gray-200 dark:border-border-dark">
          <TradePanel 
            :pair="selectedPair.symbol"
            :currentPrice="currentPrice"
          />
        </div>
      </div>
    </div>
  </div>
</template>
