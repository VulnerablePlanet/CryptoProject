<script setup>
import { ref, computed, onMounted } from 'vue'
import { useCryptoStore } from '@/stores/crypto'
import { usePortfolioStore } from '@/stores/portfolio'
import BalanceCard from '@/components/wallet/BalanceCard.vue'
import QuickTradeWidget from '@/components/wallet/QuickTradeWidget.vue'
import ActivityList from '@/components/wallet/ActivityList.vue'
import AddHoldingModal from '@/components/wallet/AddHoldingModal.vue'

const cryptoStore = useCryptoStore()
const portfolioStore = usePortfolioStore()

// Modal state
const showAddModal = ref(false)
const editingHolding = ref(null)

// Mock activity data (could be moved to a transactions store later)
const recentActivities = ref([
  { id: 1, type: 'buy', title: 'Bought Bitcoin', amount: '$500.00', asset: 'BTC', time: '2 hours ago' },
  { id: 2, type: 'deposit', title: 'Deposit', amount: '$1,000.00', asset: 'USD', time: '1 day ago' },
  { id: 3, type: 'sell', title: 'Sold Ethereum', amount: '$250.00', asset: 'ETH', time: '2 days ago' },
])

// Computed
const walletBalance = computed(() => {
  // Calculate total value based on current prices
  return portfolioStore.holdings.reduce((total, holding) => {
    const coin = cryptoStore.coins.find(c => c.id === holding.coinId)
    const price = coin?.current_price || holding.avgBuyPrice
    return total + (holding.amount * price)
  }, 0)
})

const balanceChange = computed(() => {
  // Calculate % change based on average buy price vs current price
  if (portfolioStore.totalInvested === 0) return 0
  const change = ((walletBalance.value - portfolioStore.totalInvested) / portfolioStore.totalInvested) * 100
  return change
})

// Enhanced holdings with current prices
const enhancedHoldings = computed(() => {
  return portfolioStore.holdings.map(holding => {
    const coin = cryptoStore.coins.find(c => c.id === holding.coinId)
    const currentPrice = coin?.current_price || holding.avgBuyPrice
    const currentValue = holding.amount * currentPrice
    const investment = holding.amount * holding.avgBuyPrice
    const profitLoss = currentValue - investment
    const profitLossPercent = investment > 0 ? (profitLoss / investment) * 100 : 0
    
    return {
      ...holding,
      image: coin?.image || null,
      currentPrice,
      currentValue,
      profitLoss,
      profitLossPercent
    }
  })
})

// Actions
const openAddModal = () => {
  editingHolding.value = null
  showAddModal.value = true
}

const openEditModal = (holding) => {
  editingHolding.value = holding
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  editingHolding.value = null
}

const handleSave = async (data) => {
  let result
  
  if (data.holdingId) {
    // Update existing
    result = await portfolioStore.updateHolding(data.holdingId, {
      amount: data.amount,
      avgBuyPrice: data.buyPrice,
      notes: data.notes
    })
  } else {
    // Add new
    result = await portfolioStore.addHolding(data)
  }
  
  if (result.success) {
    closeModal()
  }
}

const handleDelete = async (holdingId) => {
  if (confirm('Are you sure you want to delete this holding?')) {
    await portfolioStore.deleteHolding(holdingId)
  }
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

const formatNumber = (value, decimals = 4) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(value)
}

// Initialize
onMounted(async () => {
  // Fetch coins for prices
  if (cryptoStore.coins.length === 0) {
    await cryptoStore.fetchCoins()
  }
  // Fetch user's portfolio
  await portfolioStore.fetchPortfolio()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Page Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Wallet</h1>
        <p class="text-slate-500 dark:text-text-secondary text-sm">Manage your crypto portfolio</p>
      </div>
      <button
        @click="openAddModal"
        class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
        Add Holding
      </button>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <!-- Left Column: Balance + Holdings -->
      <div class="lg:col-span-8 flex flex-col gap-6">
        <!-- Balance Card -->
        <BalanceCard 
          :balance="walletBalance"
          :change="balanceChange"
          :loading="portfolioStore.loading && portfolioStore.holdings.length === 0"
        />

        <!-- Holdings Table -->
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-border-dark">
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">My Holdings</h2>
            <span class="text-sm text-text-secondary">{{ portfolioStore.holdingsCount }} assets</span>
          </div>
          
          <!-- Loading State -->
          <div v-if="portfolioStore.loading && portfolioStore.holdings.length === 0" class="p-8 text-center">
            <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
            <p class="text-text-secondary">Loading portfolio...</p>
          </div>
          
          <!-- Empty State -->
          <div v-else-if="portfolioStore.holdings.length === 0" class="p-12 text-center">
            <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">account_balance_wallet</span>
            <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">No holdings yet</h3>
            <p class="text-text-secondary mb-6">Start building your portfolio by adding your first holding</p>
            <button
              @click="openAddModal"
              class="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
            >
              <span class="material-symbols-outlined text-[20px]">add</span>
              Add Your First Holding
            </button>
          </div>
          
          <!-- Holdings List -->
          <div v-else class="divide-y divide-gray-100 dark:divide-border-dark/50">
            <div
              v-for="holding in enhancedHoldings"
              :key="holding._id"
              class="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <!-- Coin Info -->
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-border-dark flex items-center justify-center overflow-hidden">
                  <img v-if="holding.image" :src="holding.image" :alt="holding.name" class="w-full h-full object-cover" />
                  <span v-else class="material-symbols-outlined text-gray-400">monetization_on</span>
                </div>
                <div class="min-w-0">
                  <p class="font-medium text-slate-900 dark:text-white truncate">{{ holding.name }}</p>
                  <p class="text-xs text-text-secondary uppercase">{{ holding.symbol }}</p>
                </div>
              </div>
              
              <!-- Amount -->
              <div class="text-right hidden sm:block">
                <p class="font-mono font-medium text-slate-900 dark:text-white">{{ formatNumber(holding.amount) }}</p>
                <p class="text-xs text-text-secondary">{{ holding.symbol }}</p>
              </div>
              
              <!-- Current Price -->
              <div class="text-right hidden md:block">
                <p class="text-sm text-text-secondary">Price</p>
                <p class="font-mono text-slate-700 dark:text-gray-300">{{ formatCurrency(holding.currentPrice) }}</p>
              </div>
              
              <!-- Current Value -->
              <div class="text-right">
                <p class="font-mono font-bold text-slate-900 dark:text-white">{{ formatCurrency(holding.currentValue) }}</p>
                <p 
                  class="text-xs font-medium"
                  :class="holding.profitLoss >= 0 ? 'text-success' : 'text-danger'"
                >
                  {{ holding.profitLoss >= 0 ? '+' : '' }}{{ formatCurrency(holding.profitLoss) }}
                  ({{ holding.profitLossPercent >= 0 ? '+' : '' }}{{ holding.profitLossPercent.toFixed(2) }}%)
                </p>
              </div>
              
              <!-- Actions -->
              <div class="flex items-center gap-1">
                <button
                  @click="openEditModal(holding)"
                  class="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg transition-colors"
                  title="Edit"
                >
                  <span class="material-symbols-outlined text-[18px] text-slate-500 dark:text-text-secondary">edit</span>
                </button>
                <button
                  @click="handleDelete(holding._id)"
                  class="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <span class="material-symbols-outlined text-[18px] text-slate-500 dark:text-text-secondary hover:text-danger">delete</span>
                </button>
              </div>
            </div>
          </div>
          
          <!-- Portfolio Summary -->
          <div v-if="portfolioStore.holdings.length > 0" class="p-4 bg-gray-50 dark:bg-background-dark border-t border-gray-200 dark:border-border-dark">
            <div class="flex justify-between items-center">
              <span class="text-sm text-text-secondary">Total Invested</span>
              <span class="font-mono font-bold text-slate-900 dark:text-white">
                {{ formatCurrency(portfolioStore.totalInvested) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Quick Trade + Activity -->
      <div class="lg:col-span-4 flex flex-col gap-6">
        <!-- Quick Trade -->
        <QuickTradeWidget :tabs="['Buy', 'Sell', 'Convert']" />

        <!-- Recent Activity -->
        <ActivityList 
          :activities="recentActivities"
          :loading="false"
        />
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <AddHoldingModal 
      :isOpen="showAddModal"
      :holding="editingHolding"
      @close="closeModal"
      @save="handleSave"
    />
  </div>
</template>
