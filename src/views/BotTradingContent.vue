<script setup>
/**
 * ============================================================================
 * BotTradingContent View
 * ============================================================================
 * Main view for the Trading Bot module
 *
 * Features:
 * - Bot status and controls
 * - Real-time signal generation
 * - Configuration panel
 * - Performance statistics
 * - Signal history
 * - Autonomous Agent Monitor (NEW)
 */
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useBotTradingStore } from '@/stores/botTrading'

// Components
import BotStatusPanel from '@/components/bottrading/BotStatusPanel.vue'
import SignalCard from '@/components/bottrading/SignalCard.vue'
import BotConfig from '@/components/bottrading/BotConfig.vue'
import BotStats from '@/components/bottrading/BotStats.vue'
import SignalHistory from '@/components/bottrading/SignalHistory.vue'
import AgentMonitor from '@/components/bottrading/AgentMonitor.vue' // NEW

// Store
const store = useBotTradingStore()

// Local state
const activeTab = ref('agent') // Default to agent monitor
const refreshInterval = ref(null)

// Tabs
const tabs = [
  { id: 'agent', label: 'Agent Monitor', icon: 'smart_toy' }, // NEW tab
  { id: 'signals', label: 'Current Signal', icon: 'sensors' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'stats', label: 'Statistics', icon: 'analytics' }
]

// Computed
const currentTab = computed(() => tabs.find(t => t.id === activeTab.value))

// Methods
const handleRefresh = async () => {
  if (store.isRunning) {
    await store.fetchCurrentSignal()
  }
}

const startAutoRefresh = () => {
  // Refresh every 30 seconds when bot is running
  refreshInterval.value = setInterval(() => {
    if (store.isRunning) {
      store.fetchCurrentSignal().catch(console.error)
    }
  }, 30000)
}

const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

// Lifecycle
onMounted(async () => {
  await store.initialize()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="flex flex-col h-full -m-4 md:-m-6 lg:-m-8">
    <!-- Header -->
    <header class="bg-white dark:bg-card-dark border-b border-gray-200 dark:border-border-dark px-4 lg:px-6 py-4 shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary text-xl">smart_toy</span>
          </div>
          <div>
            <h1 class="text-lg font-bold text-slate-900 dark:text-white">Trading Bot</h1>
            <p class="text-xs text-slate-500 dark:text-text-secondary">
              Automated signal generation & backtesting
            </p>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="flex items-center gap-2">
          <button
            @click="handleRefresh"
            :disabled="store.signalLoading"
            class="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-text-secondary rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <span class="material-symbols-outlined text-lg" :class="{ 'animate-spin': store.signalLoading }">
              sync
            </span>
            <span class="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 mt-4 -mb-4 border-b border-gray-200 dark:border-border-dark">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative"
          :class="[
            activeTab === tab.id
              ? 'text-primary'
              : 'text-slate-500 dark:text-text-secondary hover:text-slate-700 dark:hover:text-white'
          ]"
        >
          <span class="material-symbols-outlined text-lg">{{ tab.icon }}</span>
          {{ tab.label }}
          <span 
            v-if="activeTab === tab.id"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
          ></span>
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-4 lg:p-6 bg-background-light dark:bg-background-dark">
      <div class="max-w-[1400px] mx-auto">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left Column: Status & Config -->
          <div class="lg:col-span-1 space-y-6">
            <!-- Bot Status -->
            <BotStatusPanel />

            <!-- Configuration -->
            <BotConfig />
          </div>

<!-- Right Column: Main Content -->
  <div class="lg:col-span-2 space-y-6">
    <!-- Agent Monitor Tab (NEW) -->
    <div v-if="activeTab === 'agent'">
      <AgentMonitor />
    </div>

    <!-- Signals Tab -->
            <div v-if="activeTab === 'signals'" class="space-y-6">
              <!-- Current Signal -->
              <div>
                <h2 class="text-sm font-medium text-slate-700 dark:text-text-secondary mb-3 flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary">sensors</span>
                  Current Signal
                </h2>

                <!-- Loading State -->
                <div v-if="store.signalLoading" class="flex items-center justify-center py-12">
                  <div class="text-center">
                    <span class="material-symbols-outlined text-4xl text-primary animate-spin">sync</span>
                    <p class="text-sm text-slate-500 dark:text-text-secondary mt-2">Analyzing market...</p>
                  </div>
                </div>

                <!-- Signal Card -->
                <SignalCard 
                  v-else-if="store.currentSignal" 
                  :signal="store.currentSignal" 
                />

                <!-- No Signal State -->
                <div v-else class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-8 text-center">
                  <span class="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-3">
                    signal_cellular_null
                  </span>
                  <p class="text-slate-500 dark:text-text-secondary">No signal generated yet</p>
                  <p class="text-sm text-slate-400 dark:text-text-secondary mt-1">
                    Start the bot to generate trading signals
                  </p>
                </div>
              </div>

              <!-- Quick Stats -->
              <BotStats />
            </div>

            <!-- History Tab -->
            <div v-if="activeTab === 'history'">
              <SignalHistory />
            </div>

            <!-- Stats Tab -->
            <div v-if="activeTab === 'stats'">
              <BotStats />
              
              <!-- Additional Backtest Controls -->
              <div class="mt-6 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
                <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <span class="material-symbols-outlined text-primary">science</span>
                  Backtest Settings
                </h3>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label class="block text-xs text-slate-500 dark:text-text-secondary mb-1">Periods</label>
                    <input 
                      type="number" 
                      value="200" 
                      class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-border-dark rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 dark:text-text-secondary mb-1">Start Index</label>
                    <input 
                      type="number" 
                      value="100" 
                      class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-border-dark rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 dark:text-text-secondary mb-1">Capital</label>
                    <input 
                      type="number" 
                      :value="store.config.capital"
                      class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-border-dark rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-slate-500 dark:text-text-secondary mb-1">Risk %</label>
                    <input 
                      type="number" 
                      :value="store.config.riskPerTrade"
                      class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-border-dark rounded-lg text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  @click="store.runBacktest()"
                  :disabled="store.backtestLoading"
                  class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <span class="material-symbols-outlined" :class="{ 'animate-spin': store.backtestLoading }">
                    {{ store.backtestLoading ? 'sync' : 'play_arrow' }}
                  </span>
                  {{ store.backtestLoading ? 'Running Backtest...' : 'Run Backtest' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
