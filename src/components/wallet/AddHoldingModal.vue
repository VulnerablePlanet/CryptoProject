<script setup>
import { ref, watch, computed } from 'vue'
import { useCryptoStore } from '@/stores/crypto'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  holding: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'save'])

const cryptoStore = useCryptoStore()

// Form state
const searchQuery = ref('')
const selectedCoin = ref(null)
const amount = ref('')
const buyPrice = ref('')
const notes = ref('')
const isSearching = ref(false)

// Computed
const isEditMode = computed(() => !!props.holding)
const formTitle = computed(() => isEditMode.value ? 'Edit Holding' : 'Add Holding')

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

const isValid = computed(() => {
  if (isEditMode.value) {
    return amount.value > 0 && buyPrice.value > 0
  }
  return selectedCoin.value && amount.value > 0 && buyPrice.value > 0
})

// Watch for holding prop changes (edit mode)
watch(() => props.holding, (newHolding) => {
  if (newHolding) {
    selectedCoin.value = {
      id: newHolding.coinId,
      symbol: newHolding.symbol,
      name: newHolding.name
    }
    amount.value = newHolding.amount
    buyPrice.value = newHolding.avgBuyPrice
    notes.value = newHolding.notes || ''
    searchQuery.value = newHolding.name
  }
}, { immediate: true })

// Watch for modal open
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && !props.holding) {
    resetForm()
  }
})

// Methods
const selectCoin = (coin) => {
  selectedCoin.value = coin
  searchQuery.value = coin.name
  buyPrice.value = coin.current_price
  isSearching.value = false
}

const handleSave = () => {
  if (!isValid.value) return

  const data = {
    coinId: selectedCoin.value.id,
    symbol: selectedCoin.value.symbol,
    name: selectedCoin.value.name,
    amount: parseFloat(amount.value),
    buyPrice: parseFloat(buyPrice.value),
    notes: notes.value
  }

  if (isEditMode.value) {
    data.holdingId = props.holding._id
  }

  emit('save', data)
}

const handleClose = () => {
  resetForm()
  emit('close')
}

const resetForm = () => {
  searchQuery.value = ''
  selectedCoin.value = null
  amount.value = ''
  buyPrice.value = ''
  notes.value = ''
  isSearching.value = false
}

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="isOpen" 
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="handleClose"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        
        <!-- Modal -->
        <div class="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark">
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ formTitle }}</h2>
            <button 
              @click="handleClose"
              class="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg transition-colors"
            >
              <span class="material-symbols-outlined text-slate-500 dark:text-text-secondary">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-5">
            <!-- Coin Search -->
            <div v-if="!isEditMode">
              <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Select Cryptocurrency
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">
                  search
                </span>
                <input
                  v-model="searchQuery"
                  @focus="isSearching = true"
                  type="text"
                  placeholder="Search by name or symbol..."
                  class="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                         bg-white dark:bg-background-dark text-slate-900 dark:text-white 
                         placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                         transition-all outline-none"
                />
                
                <!-- Search Results Dropdown -->
                <div 
                  v-if="isSearching && filteredCoins.length > 0"
                  class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto"
                >
                  <button
                    v-for="coin in filteredCoins"
                    :key="coin.id"
                    @click="selectCoin(coin)"
                    class="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-border-dark transition-colors text-left"
                  >
                    <img :src="coin.image" :alt="coin.name" class="w-8 h-8 rounded-full" />
                    <div class="flex-1">
                      <p class="font-medium text-slate-900 dark:text-white">{{ coin.name }}</p>
                      <p class="text-xs text-text-secondary uppercase">{{ coin.symbol }}</p>
                    </div>
                    <span class="text-sm font-mono text-slate-700 dark:text-gray-300">
                      {{ formatCurrency(coin.current_price) }}
                    </span>
                  </button>
                </div>
              </div>
              
              <!-- Selected Coin Display -->
              <div 
                v-if="selectedCoin && !isSearching"
                class="mt-3 flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg"
              >
                <span class="material-symbols-outlined text-primary">check_circle</span>
                <span class="font-medium text-slate-900 dark:text-white">{{ selectedCoin.name }}</span>
                <span class="text-xs text-text-secondary uppercase">({{ selectedCoin.symbol }})</span>
              </div>
            </div>

            <!-- Edit Mode: Show selected coin -->
            <div v-else class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">monetization_on</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white">{{ selectedCoin?.name }}</p>
                <p class="text-xs text-text-secondary uppercase">{{ selectedCoin?.symbol }}</p>
              </div>
            </div>

            <!-- Amount -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Amount
              </label>
              <input
                v-model.number="amount"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                       bg-white dark:bg-background-dark text-slate-900 dark:text-white 
                       placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                       transition-all outline-none font-mono"
              />
            </div>

            <!-- Buy Price -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                {{ isEditMode ? 'Average Buy Price' : 'Buy Price' }} (USD)
              </label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">$</span>
                <input
                  v-model.number="buyPrice"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  class="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                         bg-white dark:bg-background-dark text-slate-900 dark:text-white 
                         placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                         transition-all outline-none font-mono"
                />
              </div>
            </div>

            <!-- Notes (optional) -->
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                Notes <span class="text-text-secondary font-normal">(optional)</span>
              </label>
              <textarea
                v-model="notes"
                rows="2"
                placeholder="Add any notes about this purchase..."
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                       bg-white dark:bg-background-dark text-slate-900 dark:text-white 
                       placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                       transition-all outline-none resize-none"
              ></textarea>
            </div>

            <!-- Total Value Preview -->
            <div v-if="amount && buyPrice" class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg">
              <div class="flex justify-between items-center">
                <span class="text-sm text-text-secondary">Total Value</span>
                <span class="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  {{ formatCurrency(amount * buyPrice) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex gap-3 p-6 border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark">
            <button
              @click="handleClose"
              class="flex-1 py-3 px-4 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 
                     font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleSave"
              :disabled="!isValid"
              class="flex-1 py-3 px-4 bg-primary hover:bg-blue-600 disabled:bg-primary/50 disabled:cursor-not-allowed
                     text-white font-bold rounded-lg transition-colors shadow-lg shadow-primary/25"
            >
              {{ isEditMode ? 'Save Changes' : 'Add Holding' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95) translateY(10px);
}
</style>
