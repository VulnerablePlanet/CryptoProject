<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWatchlistStore } from '@/stores/watchlist'
import { useCryptoStore } from '@/stores/crypto'
import { getSupportedExchanges, EXCHANGE_NAMES, QUOTE_CURRENCIES } from '@/services/ccxtPrice'
import { logger } from '@/utils/logger'
import { formatUSD, formatCOP } from '@/utils/currency'

const watchlistStore = useWatchlistStore()
const cryptoStore = useCryptoStore()

// Exchange and prices from CCXT
const exchanges = ref([])
const exchangePrices = ref({})
const selectedExchange = ref('binance')
const selectedQuote = ref('USDT')

// Add coin modal
const showAddModal = ref(false)
const searchQuery = ref('')
const isSearching = ref(false)

// Alert modal
const showAlertModal = ref(false)
const alertForm = ref({
  coinId: '',
  symbol: '',
  targetPrice: '',
  condition: 'above'
})

// Tabs
const activeTab = ref('watchlist')

// Computed
const filteredCoins = computed(() => {
  if (!searchQuery.value || searchQuery.value.length < 2) return []
  const query = searchQuery.value.toLowerCase()
  return cryptoStore.coins
    .filter(coin => 
      (coin.name.toLowerCase().includes(query) || 
       coin.symbol.toLowerCase().includes(query)) &&
      !watchlistStore.isInWatchlist(coin.id)
    )
    .slice(0, 5)
})

// Enhanced watchlist with current prices from CCXT exchanges
const enhancedWatchlist = computed(() => {
  return watchlistStore.coins.map(coin => {
    const marketData = cryptoStore.coins.find(c => c.id === coin.coinId)
    const priceKey = `${coin.exchange || 'binance'}:${coin.tradingPair || coin.symbol + '/USDT'}`
    const ccxtPrice = exchangePrices.value[priceKey]
    
    return {
      ...coin,
      image: marketData?.image || null,
      current_price: ccxtPrice?.price || marketData?.current_price || 0,
      price_change_24h: ccxtPrice?.changePercent24h || marketData?.price_change_percentage_24h || 0,
      exchange: coin.exchange || 'binance',
      tradingPair: coin.tradingPair || `${coin.symbol}/USDT`
    }
  })
})

const formatPercent = (value) => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value?.toFixed(2) || '0.00'}%`
}

const openAddModal = () => {
  searchQuery.value = ''
  showAddModal.value = true
}

const closeAddModal = () => {
  showAddModal.value = false
  searchQuery.value = ''
  isSearching.value = false
}

const addCoin = async (coin) => {
  const tradingPair = `${coin.symbol.toUpperCase()}/${selectedQuote.value}`
  const result = await watchlistStore.addCoin({
    ...coin,
    exchange: selectedExchange.value,
    tradingPair
  })
  if (result.success) {
    closeAddModal()
    // Refresh prices
    refreshExchangePrices()
  }
}

const removeCoin = async (coinId) => {
  if (confirm('Remove this coin from your watchlist?')) {
    await watchlistStore.removeCoin(coinId)
  }
}

const openAlertModal = (coin) => {
  alertForm.value = {
    coinId: coin.coinId,
    symbol: coin.symbol,
    name: coin.name,
    currentPrice: coin.current_price,
    targetPrice: '',
    condition: 'above'
  }
  showAlertModal.value = true
}

const closeAlertModal = () => {
  showAlertModal.value = false
}

// Sanitize price input - removes commas and parses to float
const sanitizePrice = (value) => {
  if (typeof value === 'number') return value
  // Remove commas and other non-numeric chars except decimal point and minus
  const cleaned = String(value).replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}

const createAlert = async () => {
  if (!alertForm.value.targetPrice) return
  
  const sanitizedPrice = sanitizePrice(alertForm.value.targetPrice)
  if (sanitizedPrice <= 0) {
    logger.error('Invalid price entered')
    return
  }
  
  const result = await watchlistStore.createAlert({
    coinId: alertForm.value.coinId,
    symbol: alertForm.value.symbol,
    targetPrice: sanitizedPrice,
    condition: alertForm.value.condition
  })
  
  if (result.success) {
    closeAlertModal()
  }
}

const deleteAlert = async (alertId) => {
  if (confirm('Delete this alert?')) {
    await watchlistStore.deleteAlert(alertId)
  }
}

// Refresh exchange prices for watchlist coins
const refreshExchangePrices = async () => {
  try {
    const prices = await watchlistStore.fetchExchangePrices()
    exchangePrices.value = prices
  } catch (err) {
    logger.error('Error refreshing prices:', err)
  }
}

// Initialize
onMounted(async () => {
  // Load supported exchanges
  try {
    exchanges.value = await getSupportedExchanges()
  } catch (err) {
    exchanges.value = Object.entries(EXCHANGE_NAMES).map(([id, name]) => ({ id, name }))
  }
  
  if (cryptoStore.coins.length === 0) {
    await cryptoStore.fetchCoins()
  }
  await watchlistStore.fetchWatchlist()
  
  // Fetch exchange prices after loading watchlist
  await refreshExchangePrices()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Watchlist</h1>
        <p class="text-slate-500 dark:text-text-secondary text-sm">Track your favorite cryptocurrencies</p>
      </div>
      
      <button
        @click="openAddModal"
        class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
        Add Coin
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 p-1 bg-gray-100 dark:bg-card-dark rounded-lg w-fit">
      <button
        @click="activeTab = 'watchlist'"
        class="px-4 py-2 rounded-md text-sm font-medium transition-all"
        :class="activeTab === 'watchlist' 
          ? 'bg-white dark:bg-background-dark text-slate-900 dark:text-white shadow-sm' 
          : 'text-slate-600 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
      >
        Watchlist ({{ watchlistStore.coins.length }})
      </button>
      <button
        @click="activeTab = 'alerts'"
        class="px-4 py-2 rounded-md text-sm font-medium transition-all"
        :class="activeTab === 'alerts' 
          ? 'bg-white dark:bg-background-dark text-slate-900 dark:text-white shadow-sm' 
          : 'text-slate-600 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white'"
      >
        Price Alerts ({{ watchlistStore.activeAlerts.length }})
      </button>
    </div>

    <!-- Watchlist Tab -->
    <div v-if="activeTab === 'watchlist'" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <!-- Loading -->
      <div v-if="watchlistStore.loading && watchlistStore.coins.length === 0" class="p-8 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
        <p class="text-text-secondary">Loading watchlist...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="enhancedWatchlist.length === 0" class="p-12 text-center">
        <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">star</span>
        <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">No coins in watchlist</h3>
        <p class="text-text-secondary mb-6">Add coins to track their prices</p>
        <button
          @click="openAddModal"
          class="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
          Add Your First Coin
        </button>
      </div>

      <!-- Watchlist Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        <div
          v-for="coin in enhancedWatchlist"
          :key="coin._id"
          v-memo="[coin._id, coin.current_price, coin.price_change_24h]"
          class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-background-dark rounded-xl border border-gray-100 dark:border-border-dark hover:border-primary/30 transition-all group"
        >
          <!-- Coin Info -->
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-10 h-10 rounded-full bg-white dark:bg-card-dark flex items-center justify-center overflow-hidden shadow-sm">
              <img v-if="coin.image" :src="coin.image" :alt="coin.name" class="w-full h-full object-cover" />
              <span v-else class="material-symbols-outlined text-gray-400">monetization_on</span>
            </div>
            <div class="min-w-0">
              <p class="font-medium text-slate-900 dark:text-white truncate">{{ coin.name }}</p>
              <p class="text-xs text-text-secondary uppercase">{{ coin.symbol }}</p>
            </div>
          </div>
          
          <!-- Price -->
          <div class="text-right">
            <p class="font-mono font-bold text-slate-900 dark:text-white">{{ formatUSD(coin.current_price) }}</p>
            <p class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">🇨🇴 {{ formatCOP(coin.current_price) }}</p>
            <p 
              class="text-xs font-medium"
              :class="coin.price_change_24h >= 0 ? 'text-success' : 'text-danger'"
            >
              {{ formatPercent(coin.price_change_24h) }}
            </p>
            <p class="text-[10px] text-text-secondary mt-1">
              <span class="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{{ coin.exchange }}</span>
              <span class="ml-1 opacity-60">{{ coin.tradingPair }}</span>
            </p>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              @click="openAlertModal(coin)"
              class="p-1.5 hover:bg-primary/10 rounded-lg transition-colors"
              title="Set Alert"
            >
              <span class="material-symbols-outlined text-[18px] text-primary">notifications_active</span>
            </button>
            <button
              @click="removeCoin(coin.coinId)"
              class="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              title="Remove"
            >
              <span class="material-symbols-outlined text-[18px] text-slate-400 hover:text-danger">close</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Alerts Tab -->
    <div v-if="activeTab === 'alerts'" class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <!-- Empty State -->
      <div v-if="watchlistStore.alerts.length === 0" class="p-12 text-center">
        <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">notifications</span>
        <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">No price alerts</h3>
        <p class="text-text-secondary">Add a coin to your watchlist and set a price alert</p>
      </div>

      <!-- Alerts List -->
      <div v-else class="divide-y divide-gray-100 dark:divide-border-dark/50">
        <div
          v-for="alert in watchlistStore.alerts"
          :key="alert._id"
          v-memo="[alert._id, alert.active, alert.triggered]"
          class="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <!-- Alert Info -->
          <div 
            class="size-10 rounded-lg flex items-center justify-center"
            :class="alert.condition === 'above' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'"
          >
            <span class="material-symbols-outlined">{{ alert.condition === 'above' ? 'trending_up' : 'trending_down' }}</span>
          </div>
          
          <div class="flex-1">
            <p class="font-medium text-slate-900 dark:text-white">
              {{ alert.symbol }} {{ alert.condition === 'above' ? 'above' : 'below' }} {{ formatUSD(alert.targetPrice) }}
            </p>
            <p class="text-xs text-text-secondary">
              {{ alert.active ? 'Active' : 'Inactive' }}
              <span v-if="alert.triggered" class="text-success ml-2">• Triggered</span>
            </p>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center gap-2">
            <button
              @click="watchlistStore.toggleAlert(alert._id)"
              class="p-1.5 rounded-lg transition-colors"
              :class="alert.active ? 'hover:bg-gray-100 dark:hover:bg-border-dark' : 'bg-gray-100 dark:bg-border-dark'"
              :title="alert.active ? 'Pause' : 'Resume'"
            >
              <span class="material-symbols-outlined text-[18px] text-slate-500">
                {{ alert.active ? 'pause' : 'play_arrow' }}
              </span>
            </button>
            <button
              @click="deleteAlert(alert._id)"
              class="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete"
            >
              <span class="material-symbols-outlined text-[18px] text-slate-400 hover:text-danger">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Coin Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showAddModal" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="closeAddModal"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          
          <div class="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark">
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Add to Watchlist</h2>
              <button @click="closeAddModal" class="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg">
                <span class="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div class="p-6">
              <!-- Exchange and Quote selectors -->
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1">Exchange</label>
                  <select
                    v-model="selectedExchange"
                    class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white text-sm focus:border-primary outline-none"
                  >
                    <option value="binance">Binance</option>
                    <option value="coinbase">Coinbase</option>
                    <option value="kraken">Kraken</option>
                    <option value="kucoin">KuCoin</option>
                    <option value="bybit">Bybit</option>
                    <option value="okx">OKX</option>
                    <option value="bitget">Bitget</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-text-secondary mb-1">Quote Currency</label>
                  <select
                    v-model="selectedQuote"
                    class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white text-sm focus:border-primary outline-none"
                  >
                    <option value="USDT">USDT</option>
                    <option value="USD">USD</option>
                    <option value="BUSD">BUSD</option>
                    <option value="USDC">USDC</option>
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                  </select>
                </div>
              </div>

              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">search</span>
                <input
                  v-model="searchQuery"
                  @focus="isSearching = true"
                  type="text"
                  placeholder="Search cryptocurrencies..."
                  class="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none"
                />
              </div>

              <!-- Search Results -->
              <div v-if="filteredCoins.length > 0" class="mt-4 space-y-2">
                <button
                  v-for="coin in filteredCoins"
                  :key="coin.id"
                  @click="addCoin(coin)"
                  class="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors text-left"
                >
                  <img :src="coin.image" :alt="coin.name" class="w-8 h-8 rounded-full" />
                  <div class="flex-1">
                    <p class="font-medium text-slate-900 dark:text-white">{{ coin.name }}</p>
                    <p class="text-xs text-text-secondary">
                      <span class="uppercase">{{ coin.symbol }}</span>
                      <span class="mx-1">•</span>
                      <span class="text-primary">{{ selectedExchange }}</span>
                      <span class="mx-1">•</span>
                      <span>{{ coin.symbol.toUpperCase() }}/{{ selectedQuote }}</span>
                    </p>
                  </div>
                  <span class="font-mono text-sm text-slate-700 dark:text-gray-300">{{ formatUSD(coin.current_price) }}</span>
                </button>
              </div>

              <p v-else-if="searchQuery.length >= 2" class="mt-4 text-center text-text-secondary">
                No coins found matching "{{ searchQuery }}"
              </p>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Create Alert Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showAlertModal" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="closeAlertModal"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          
          <div class="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark">
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Create Price Alert</h2>
              <button @click="closeAlertModal" class="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg">
                <span class="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div class="p-6 space-y-5">
              <!-- Coin Info -->
              <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
                <span class="material-symbols-outlined text-primary">monetization_on</span>
                <div>
                  <p class="font-medium text-slate-900 dark:text-white">{{ alertForm.name }}</p>
                  <p class="text-xs text-text-secondary">Current: {{ formatUSD(alertForm.currentPrice) }}</p>
                </div>
              </div>

              <!-- Condition -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Alert Condition</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    @click="alertForm.condition = 'above'"
                    class="py-3 px-4 rounded-lg border font-medium transition-all flex items-center gap-2 justify-center"
                    :class="alertForm.condition === 'above' 
                      ? 'border-success bg-success/10 text-success' 
                      : 'border-gray-200 dark:border-border-dark text-slate-600 dark:text-gray-400'"
                  >
                    <span class="material-symbols-outlined text-[20px]">trending_up</span>
                    Price Above
                  </button>
                  <button
                    @click="alertForm.condition = 'below'"
                    class="py-3 px-4 rounded-lg border font-medium transition-all flex items-center gap-2 justify-center"
                    :class="alertForm.condition === 'below' 
                      ? 'border-danger bg-danger/10 text-danger' 
                      : 'border-gray-200 dark:border-border-dark text-slate-600 dark:text-gray-400'"
                  >
                    <span class="material-symbols-outlined text-[20px]">trending_down</span>
                    Price Below
                  </button>
                </div>
              </div>

              <!-- Target Price -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Target Price (USD)</label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <input
                    v-model="alertForm.targetPrice"
                    type="text"
                    inputmode="decimal"
                    placeholder="90000.00"
                    class="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div class="flex gap-3 p-6 border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark">
              <button
                @click="closeAlertModal"
                class="flex-1 py-3 px-4 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
              >
                Cancel
              </button>
              <button
                @click="createAlert"
                :disabled="!alertForm.targetPrice || watchlistStore.loading"
                class="flex-1 py-3 px-4 bg-primary hover:bg-blue-600 disabled:bg-primary/50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              >
                Create Alert
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
