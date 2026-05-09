<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useTransactionStore } from '@/stores/transactions'
import { useCryptoStore } from '@/stores/crypto'
import { getPrice, EXCHANGE_NAMES } from '@/services/ccxtPrice'
import { logger } from '@/utils/logger'
import { formatUSD, formatCOP } from '@/utils/currency'

const transactionStore = useTransactionStore()
const cryptoStore = useCryptoStore()

// Filters
const typeFilter = ref('')
const dateFilter = ref('all')

// Exchange state
const selectedExchange = ref('binance')
const selectedQuote = ref('USDT')
const fetchingPrice = ref(false)

// Modal state
const showRecordModal = ref(false)
const recordForm = ref({
  type: 'buy',
  coinId: '',
  symbol: '',
  coinName: '',
  amount: '',
  priceAtTransaction: '',
  notes: '',
  exchange: 'binance',
  tradingPair: ''
})
const searchQuery = ref('')
const isSearching = ref(false)
const selectedCoin = ref(null)

// Computed
const filteredTransactions = computed(() => {
  let result = transactionStore.transactions
  
  if (typeFilter.value) {
    result = result.filter(t => t.type === typeFilter.value)
  }
  
  return result
})

const filteredCoins = computed(() => {
  if (!searchQuery.value || searchQuery.value.length < 2) return []
  const query = searchQuery.value.toLowerCase()
  return cryptoStore.coins
    .filter(coin => 
      coin.name.toLowerCase().includes(query) || 
      coin.symbol.toLowerCase().includes(query)
    )
    .slice(0, 5)
})

const isFormValid = computed(() => {
  return selectedCoin.value && 
         recordForm.value.amount > 0 && 
         recordForm.value.priceAtTransaction > 0
})

const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

const formatNumber = (value, decimals = 4) => {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals
  }).format(value)
}

const getTypeIcon = (type) => {
  const icons = {
    buy: 'arrow_downward',
    sell: 'arrow_upward',
    transfer_in: 'call_received',
    transfer_out: 'call_made',
    deposit: 'add_circle',
    withdraw: 'remove_circle'
  }
  return icons[type] || 'swap_horiz'
}

const getTypeColor = (type) => {
  const colors = {
    buy: 'text-success bg-success/10',
    sell: 'text-danger bg-danger/10',
    transfer_in: 'text-blue-500 bg-blue-500/10',
    transfer_out: 'text-orange-500 bg-orange-500/10',
    deposit: 'text-success bg-success/10',
    withdraw: 'text-danger bg-danger/10'
  }
  return colors[type] || 'text-gray-500 bg-gray-500/10'
}

const selectCoin = async (coin) => {
  selectedCoin.value = coin
  searchQuery.value = coin.name
  recordForm.value.coinId = coin.id
  recordForm.value.symbol = coin.symbol
  recordForm.value.coinName = coin.name
  recordForm.value.exchange = selectedExchange.value
  recordForm.value.tradingPair = `${coin.symbol.toUpperCase()}/${selectedQuote.value}`
  isSearching.value = false
  
  // Fetch real price from selected exchange
  fetchingPrice.value = true
  try {
    const priceData = await getPrice(
      selectedExchange.value,
      coin.symbol.toUpperCase(),
      selectedQuote.value
    )
    recordForm.value.priceAtTransaction = priceData.price || coin.current_price
  } catch (err) {
    logger.warn('Could not fetch exchange price, using fallback:', err)
    recordForm.value.priceAtTransaction = coin.current_price
  } finally {
    fetchingPrice.value = false
  }
}

const openRecordModal = () => {
  resetForm()
  showRecordModal.value = true
}

const closeRecordModal = () => {
  showRecordModal.value = false
  resetForm()
}

const resetForm = () => {
  recordForm.value = {
    type: 'buy',
    coinId: '',
    symbol: '',
    coinName: '',
    amount: '',
    priceAtTransaction: '',
    notes: '',
    exchange: selectedExchange.value,
    tradingPair: ''
  }
  searchQuery.value = ''
  selectedCoin.value = null
  isSearching.value = false
}

const handleSubmit = async () => {
  if (!isFormValid.value) return

  const result = await transactionStore.createTransaction({
    type: recordForm.value.type,
    coinId: recordForm.value.coinId,
    symbol: recordForm.value.symbol,
    coinName: recordForm.value.coinName,
    amount: parseFloat(recordForm.value.amount),
    priceAtTransaction: parseFloat(recordForm.value.priceAtTransaction),
    notes: recordForm.value.notes,
    exchange: recordForm.value.exchange,
    tradingPair: recordForm.value.tradingPair
  })

  if (result.success) {
    closeRecordModal()
  }
}

const handleDelete = async (id) => {
  if (confirm('Are you sure you want to delete this transaction?')) {
    await transactionStore.deleteTransaction(id)
  }
}

const loadMore = async () => {
  if (transactionStore.pagination.page < transactionStore.pagination.pages) {
    await transactionStore.fetchTransactions({
      page: transactionStore.pagination.page + 1
    })
  }
}

// Initialize
onMounted(async () => {
  if (cryptoStore.coins.length === 0) {
    await cryptoStore.fetchCoins()
  }
  await transactionStore.fetchTransactions()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Transaction History</h1>
        <p class="text-slate-500 dark:text-text-secondary text-sm">View and manage your trading activity</p>
      </div>
      
      <button
        @click="openRecordModal"
        class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
        Record Transaction
      </button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3">
      <select
        v-model="typeFilter"
        class="px-4 py-2 rounded-lg border border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark text-slate-900 dark:text-white text-sm focus:border-primary outline-none"
      >
        <option value="">All Types</option>
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
        <option value="transfer_in">Received</option>
        <option value="transfer_out">Sent</option>
        <option value="deposit">Deposit</option>
        <option value="withdraw">Withdrawal</option>
      </select>
    </div>

    <!-- Transactions List -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <!-- Loading -->
      <div v-if="transactionStore.loading && transactionStore.transactions.length === 0" class="p-8 text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
        <p class="text-text-secondary">Loading transactions...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredTransactions.length === 0" class="p-12 text-center">
        <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">receipt_long</span>
        <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">No transactions yet</h3>
        <p class="text-text-secondary mb-6">Record your first transaction to start tracking your activity</p>
        <button
          @click="openRecordModal"
          class="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
          Record Transaction
        </button>
      </div>

      <!-- Transactions Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 dark:bg-background-dark border-b border-gray-200 dark:border-border-dark">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Type</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Asset</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Amount</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Price</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Total</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Date</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-border-dark/50">
            <tr 
              v-for="tx in filteredTransactions"
              :key="tx._id"
              v-memo="[tx._id]"
              class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <!-- Type -->
              <td class="px-4 py-4">
                <div class="flex items-center gap-2">
                  <div 
                    class="size-8 rounded-lg flex items-center justify-center"
                    :class="getTypeColor(tx.type)"
                  >
                    <span class="material-symbols-outlined text-[18px]">{{ getTypeIcon(tx.type) }}</span>
                  </div>
                  <span class="font-medium text-slate-900 dark:text-white capitalize">{{ tx.typeLabel }}</span>
                </div>
              </td>
              
              <!-- Asset -->
              <td class="px-4 py-4">
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-slate-900 dark:text-white">{{ tx.coinName }}</span>
                    <span class="text-xs text-text-secondary uppercase">{{ tx.symbol }}</span>
                  </div>
                  <p class="text-[10px] text-text-secondary">
                    <span class="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">{{ tx.exchange || 'binance' }}</span>
                    <span class="ml-1 opacity-60">{{ tx.tradingPair || (tx.symbol + '/USDT') }}</span>
                  </p>
                </div>
              </td>
              
              <!-- Amount -->
              <td class="px-4 py-4 text-right">
                <span class="font-mono text-slate-900 dark:text-white">{{ formatNumber(tx.amount) }}</span>
                <span class="text-xs text-text-secondary ml-1">{{ tx.symbol }}</span>
              </td>
              
              <!-- Price -->
              <td class="px-4 py-4 text-right">
                <div class="flex flex-col items-end">
                  <span class="font-mono text-slate-700 dark:text-gray-300">{{ formatUSD(tx.priceAtTransaction) }}</span>
                  <span class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">🇨🇴 {{ formatCOP(tx.priceAtTransaction) }}</span>
                </div>
              </td>
              
              <!-- Total -->
              <td class="px-4 py-4 text-right">
                <div class="flex flex-col items-end">
                  <span 
                    class="font-mono font-medium"
                    :class="tx.type === 'buy' || tx.type === 'transfer_in' || tx.type === 'deposit' 
                      ? 'text-success' 
                      : 'text-danger'"
                  >
                    {{ tx.type === 'sell' || tx.type === 'transfer_out' || tx.type === 'withdraw' ? '-' : '+' }}{{ formatUSD(tx.totalValue) }}
                  </span>
                  <span class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
                    🇨🇴 {{ formatCOP(tx.totalValue) }}
                  </span>
                </div>
              </td>
              
              <!-- Date -->
              <td class="px-4 py-4 text-right text-sm text-text-secondary">
                {{ formatDate(tx.createdAt) }}
              </td>
              
              <!-- Actions -->
              <td class="px-4 py-4 text-right">
                <button
                  @click="handleDelete(tx._id)"
                  class="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <span class="material-symbols-outlined text-[18px] text-slate-400 hover:text-danger">delete</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div 
        v-if="transactionStore.pagination.pages > 1"
        class="flex justify-center p-4 border-t border-gray-200 dark:border-border-dark"
      >
        <button
          v-if="transactionStore.pagination.page < transactionStore.pagination.pages"
          @click="loadMore"
          :disabled="transactionStore.loading"
          class="px-6 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
        >
          {{ transactionStore.loading ? 'Loading...' : 'Load More' }}
        </button>
      </div>
    </div>

    <!-- Record Transaction Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showRecordModal" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="closeRecordModal"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          
          <div class="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <!-- Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark">
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Record Transaction</h2>
              <button @click="closeRecordModal" class="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg">
                <span class="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <!-- Body -->
            <div class="p-6 space-y-5">
              <!-- Type -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Transaction Type</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    v-for="type in ['buy', 'sell']"
                    :key="type"
                    @click="recordForm.type = type"
                    class="py-2 px-4 rounded-lg border font-medium transition-all capitalize"
                    :class="recordForm.type === type 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-gray-200 dark:border-border-dark text-slate-600 dark:text-gray-400 hover:border-primary/50'"
                  >
                    {{ type }}
                  </button>
                </div>
              </div>

              <!-- Exchange and Quote selectors -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Exchange</label>
                  <select
                    v-model="selectedExchange"
                    class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none"
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
                  <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Quote Currency</label>
                  <select
                    v-model="selectedQuote"
                    class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none"
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

              <!-- Coin Search -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Cryptocurrency</label>
                <div class="relative">
                  <input
                    v-model="searchQuery"
                    @focus="isSearching = true"
                    type="text"
                    placeholder="Search coin..."
                    class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none"
                  />
                  
                  <div 
                    v-if="isSearching && filteredCoins.length > 0"
                    class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto"
                  >
                    <button
                      v-for="coin in filteredCoins"
                      :key="coin.id"
                      @click="selectCoin(coin)"
                      class="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-border-dark text-left"
                    >
                      <img :src="coin.image" :alt="coin.name" class="w-8 h-8 rounded-full" />
                      <div class="flex-1">
                        <p class="font-medium text-slate-900 dark:text-white">{{ coin.name }}</p>
                        <p class="text-xs text-text-secondary uppercase">{{ coin.symbol }}</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Amount -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Amount</label>
                <input
                  v-model.number="recordForm.amount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none font-mono"
                />
              </div>

              <!-- Price -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Price at Transaction (USD)</label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                  <input
                    v-model.number="recordForm.priceAtTransaction"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    class="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none font-mono"
                  />
                </div>
              </div>

              <!-- Notes -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  Notes <span class="text-text-secondary font-normal">(optional)</span>
                </label>
                <textarea
                  v-model="recordForm.notes"
                  rows="2"
                  placeholder="Add notes..."
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none resize-none"
                ></textarea>
              </div>

              <!-- Total Preview -->
              <div v-if="recordForm.amount && recordForm.priceAtTransaction" class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg">
                <div class="flex justify-between items-center">
                  <span class="text-sm text-text-secondary">Total Value</span>
                  <span class="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {{ formatUSD(recordForm.amount * recordForm.priceAtTransaction) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex gap-3 p-6 border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark">
              <button
                @click="closeRecordModal"
                class="flex-1 py-3 px-4 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleSubmit"
                :disabled="!isFormValid || transactionStore.loading"
                class="flex-1 py-3 px-4 bg-primary hover:bg-blue-600 disabled:bg-primary/50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              >
                {{ transactionStore.loading ? 'Recording...' : 'Record Transaction' }}
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
