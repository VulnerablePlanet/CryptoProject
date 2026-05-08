<script setup>
/**
 * ============================================================================
 * Agent Monitor - Real-time Trading Agent Dashboard
 * ============================================================================
 * Shows live status of the autonomous trading agent with:
 * - Agent state and phase
 * - Current signal with scoring breakdown
 * - Open positions table
 * - Capital and P&L
 * - Recent events log
 */
import { ref, onMounted, onUnmounted, computed } from 'vue'
import api from '@/services/api'
import { logger } from '@/utils/logger'

// State
const agentStatus = ref(null)
const currentSignal = ref(null)
const positions = ref([])
const agentState = ref(null)
const events = ref([])
const loading = ref(false)
const error = ref(null)
const lastUpdate = ref(null)

// Polling interval
let pollInterval = null

// Computed
const isRunning = computed(() => agentStatus.value?.isRunning)
const currentPhase = computed(() => agentStatus.value?.state || 'IDLE')
const killSwitchActive = computed(() => agentStatus.value?.killSwitchActive)
const capital = computed(() => agentStatus.value?.capital?.toFixed(2) || '0.00')
const apiKeysConfigured = computed(() => agentStatus.value?.apiKeys?.binance || false)
const tradingMode = computed(() => agentStatus.value?.apiKeys?.mode || 'sandbox')

const hasSignal = computed(() => currentSignal.value && currentSignal.value.signal)

const signalDecision = computed(() => {
  if (!hasSignal.value) return null
  const decision = currentSignal.value.signal?.decision
  const score = currentSignal.value.signal?.score
  return { decision, score }
})

// Methods
const fetchAgentStatus = async () => {
  try {
    const response = await api.get('/agent/status')
    agentStatus.value = response.data
    lastUpdate.value = new Date().toLocaleTimeString()
  } catch (err) {
    logger.error('[AgentMonitor] Status error:', err)
  }
}

const fetchSignal = async () => {
  try {
    const response = await api.get('/agent/signal')
    currentSignal.value = response.data
  } catch (err) {
    logger.error('[AgentMonitor] Signal error:', err)
  }
}

const fetchPositions = async () => {
  try {
    const response = await api.get('/agent/positions')
    positions.value = response.data.positions || []
  } catch (err) {
    logger.error('[AgentMonitor] Positions error:', err)
  }
}

const startBot = async () => {
  loading.value = true
  error.value = null
  try {
    await api.post('/agent/start', { symbols: ['BTC/USDT'] })
    await fetchAgentStatus()
    events.value.unshift({
      time: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Agent started'
    })
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
}

const stopBot = async () => {
  loading.value = true
  error.value = null
  try {
    await api.post('/agent/stop')
    await fetchAgentStatus()
    events.value.unshift({
      time: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Agent stopped'
    })
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
}

const verifyApiKeys = async () => {
  try {
    const response = await api.get('/agent/verify-keys')
    if (response.data.configured && response.data.valid) {
      events.value.unshift({
        time: new Date().toLocaleTimeString(),
        type: 'success',
        message: 'API keys verified: ' + response.data.mode
      })
    } else {
      events.value.unshift({
        time: new Date().toLocaleTimeString(),
        type: 'warning',
        message: 'API keys not configured or invalid'
      })
    }
  } catch (err) {
    events.value.unshift({
      time: new Date().toLocaleTimeString(),
      type: 'error',
      message: 'API key verification failed: ' + err.message
    })
  }
}

const refreshAll = async () => {
  await Promise.all([
    fetchAgentStatus(),
    fetchSignal(),
    fetchPositions()
  ])
}

// Lifecycle
onMounted(() => {
  refreshAll()
  // Poll every 5 seconds for live updates
  pollInterval = setInterval(refreshAll, 5000)
})

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})

// Helper for decision color
const getDecisionColor = (decision) => {
  switch (decision) {
    case 'MARKET_ORDER': return 'text-green-600 bg-green-100 dark:bg-green-900/30'
    case 'LIMIT_ORDER': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30'
    case 'NO_TRADE': return 'text-gray-600 bg-gray-100 dark:bg-gray-800'
    default: return 'text-gray-600 bg-gray-100'
  }
}

const getPhaseColor = (phase) => {
  const colors = {
    IDLE: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    RESEARCH: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    ANALYSIS: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    SCORING: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    EXECUTION: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    MONITORING: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400'
  }
  return colors[phase] || colors.IDLE
}

const getEventColor = (type) => {
  const colors = {
    info: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600'
  }
  return colors[type] || colors.info
}
</script>

<template>
  <div class="space-y-6">
    <!-- Agent Status Card -->
    <div class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">smart_toy</span>
          Autonomous Agent
        </h3>
        <span class="text-xs text-slate-500">Last update: {{ lastUpdate }}</span>
      </div>

      <!-- Status Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <!-- Running Status -->
        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-1">Status</p>
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"
            ></span>
            <span class="font-medium text-slate-900 dark:text-white">
              {{ isRunning ? 'Running' : 'Stopped' }}
            </span>
          </div>
        </div>

        <!-- Current Phase -->
        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-1">Phase</p>
          <span
            class="inline-flex px-2 py-1 rounded text-xs font-medium"
            :class="getPhaseColor(currentPhase)"
          >
            {{ currentPhase }}
          </span>
        </div>

        <!-- Capital -->
        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-1">Capital</p>
          <p class="font-medium text-slate-900 dark:text-white">${{ capital }}</p>
        </div>

        <!-- Mode -->
        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-1">Mode</p>
          <span
            class="inline-flex px-2 py-1 rounded text-xs font-medium"
            :class="tradingMode === 'production' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30'"
          >
            {{ tradingMode.toUpperCase() }}
          </span>
        </div>
      </div>

      <!-- Kill Switch Warning -->
      <div
        v-if="killSwitchActive"
        class="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <p class="text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
          <span class="material-symbols-outlined">warning</span>
          KILL SWITCH ACTIVE
        </p>
        <p class="text-sm text-red-500 mt-1">{{ agentStatus?.killReason }}</p>
      </div>

      <!-- API Keys Status -->
      <div class="flex items-center gap-2 mb-4">
        <span
          class="w-2 h-2 rounded-full"
          :class="apiKeysConfigured ? 'bg-green-500' : 'bg-yellow-500'"
        ></span>
        <span class="text-sm text-slate-600 dark:text-text-secondary">
          API Keys: {{ apiKeysConfigured ? 'Configured' : 'Not configured' }}
        </span>
        <button
          @click="verifyApiKeys"
          class="text-xs text-primary hover:underline"
        >
          Verify
        </button>
      </div>

      <!-- Controls -->
      <div class="flex gap-2">
        <button
          @click="startBot"
          :disabled="loading || isRunning"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span class="material-symbols-outlined text-lg">play_arrow</span>
          Start Agent
        </button>
        <button
          @click="stopBot"
          :disabled="loading || !isRunning"
          class="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span class="material-symbols-outlined text-lg">stop</span>
          Stop Agent
        </button>
        <button
          @click="refreshAll"
          :disabled="loading"
          class="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-text-secondary rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
        >
          <span class="material-symbols-outlined text-lg" :class="{ 'animate-spin': loading }">sync</span>
        </button>
      </div>

      <!-- Error -->
      <div v-if="error" class="mt-3 p-2 bg-red-100 dark:bg-red-900/30 rounded text-red-600 text-sm">
        {{ error }}
      </div>
    </div>

    <!-- Current Signal Card -->
    <div class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
      <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-primary">analytics</span>
        Current Signal
      </h3>

      <div v-if="hasSignal" class="space-y-4">
        <!-- Decision Badge -->
        <div class="flex items-center gap-3">
          <span
            class="px-3 py-1 rounded-full text-sm font-medium"
            :class="getDecisionColor(signalDecision.decision)"
          >
            {{ signalDecision.decision }}
          </span>
          <span class="text-slate-600 dark:text-text-secondary">
            Confidence: {{ ((signalDecision.score || 0) * 100).toFixed(1) }}%
          </span>
        </div>

        <!-- Scoring Breakdown -->
        <div v-if="currentSignal.signal?.breakdown" class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-2">Scoring Breakdown</p>
          <div class="grid grid-cols-5 gap-2">
            <div
              v-for="(value, key) in currentSignal.signal.breakdown"
              :key="key"
              class="text-center"
            >
              <p class="text-xs text-slate-500 capitalize">{{ key }}</p>
              <p class="font-medium text-slate-900 dark:text-white">
                {{ typeof value === 'number' ? (value * 100).toFixed(0) + '%' : value }}
              </p>
            </div>
          </div>
        </div>

        <!-- Reasons -->
        <div v-if="currentSignal.signal?.reasons?.length" class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-2">Reasons</p>
          <ul class="space-y-1">
            <li
              v-for="(reason, idx) in currentSignal.signal.reasons.slice(0, 5)"
              :key="idx"
              class="text-sm text-slate-700 dark:text-text-secondary flex items-start gap-2"
            >
              <span class="material-symbols-outlined text-xs text-primary mt-0.5">arrow_right</span>
              {{ reason }}
            </li>
          </ul>
        </div>

        <!-- Research Data -->
        <div v-if="currentSignal.research" class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-2">Research Data</p>
          <div class="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p class="text-slate-500">Fear & Greed</p>
              <p class="font-medium">
                {{ currentSignal.research.fearGreed?.value || 'N/A' }}
                <span class="text-xs text-slate-400">
                  ({{ currentSignal.research.fearGreed?.classification || 'N/A' }})
                </span>
              </p>
            </div>
            <div>
              <p class="text-slate-500">Sentiment</p>
              <p class="font-medium">
                {{ currentSignal.research.sentiment?.sentimentScore?.toFixed(2) || 'N/A' }}
              </p>
            </div>
            <div>
              <p class="text-slate-500">Social Mentions</p>
              <p class="font-medium">
                {{ currentSignal.research.socialMetrics?.totalMentions || 'N/A' }}
              </p>
            </div>
          </div>
        </div>

        <!-- Analysis Data -->
        <div v-if="currentSignal.analysis" class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
          <p class="text-xs text-slate-500 dark:text-text-secondary mb-2">Market Analysis</p>
          <div class="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p class="text-slate-500">Regime</p>
              <p class="font-medium">{{ currentSignal.analysis.regime || 'N/A' }}</p>
            </div>
            <div>
              <p class="text-slate-500">MTF Trend</p>
              <p class="font-medium">{{ currentSignal.analysis.mtfTrend || 'N/A' }}</p>
            </div>
            <div v-if="currentSignal.analysis.indicators">
              <p class="text-slate-500">RSI</p>
              <p class="font-medium">{{ currentSignal.analysis.indicators.rsi?.toFixed(2) || 'N/A' }}</p>
            </div>
            <div v-if="currentSignal.analysis.indicators">
              <p class="text-slate-500">MACD Histogram</p>
              <p class="font-medium">{{ currentSignal.analysis.indicators.macdHistogram?.toFixed(4) || 'N/A' }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8 text-slate-500">
        <span class="material-symbols-outlined text-4xl text-slate-300">smart_toy</span>
        <p class="mt-2">No signal generated yet</p>
        <p class="text-sm">Start the agent to generate signals</p>
      </div>
    </div>

    <!-- Open Positions Table -->
    <div class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
      <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-primary">account_balance_wallet</span>
        Open Positions
      </h3>

      <div v-if="positions.length > 0" class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-border-dark">
              <th class="text-left py-2 px-3 text-xs font-medium text-slate-500">Symbol</th>
              <th class="text-left py-2 px-3 text-xs font-medium text-slate-500">Side</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-slate-500">Size</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-slate-500">Entry</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-slate-500">Current P&L</th>
              <th class="text-right py-2 px-3 text-xs font-medium text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pos in positions"
              :key="pos._id"
              class="border-b border-gray-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <td class="py-3 px-3 font-medium text-slate-900 dark:text-white">{{ pos.symbol }}</td>
              <td class="py-3 px-3">
                <span
                  class="px-2 py-0.5 rounded text-xs font-medium"
                  :class="pos.side === 'LONG' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'"
                >
                  {{ pos.side }}
                </span>
              </td>
              <td class="py-3 px-3 text-right text-slate-700 dark:text-text-secondary">{{ pos.size?.toFixed(6) }}</td>
              <td class="py-3 px-3 text-right text-slate-700 dark:text-text-secondary">${{ pos.entryPrice?.toFixed(2) }}</td>
              <td class="py-3 px-3 text-right font-medium" :class="pos.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ pos.unrealizedPnl >= 0 ? '+' : '' }}${{ pos.unrealizedPnl?.toFixed(2) }}
              </td>
              <td class="py-3 px-3 text-right">
                <span class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-600">
                  {{ pos.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="text-center py-8 text-slate-500">
        <span class="material-symbols-outlined text-4xl text-slate-300">account_balance</span>
        <p class="mt-2">No open positions</p>
      </div>
    </div>

    <!-- Event Log -->
    <div class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
      <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-primary">history</span>
        Event Log
      </h3>

      <div class="max-h-48 overflow-y-auto space-y-1">
        <div
          v-for="(event, idx) in events.slice(0, 20)"
          :key="idx"
          class="flex items-start gap-2 text-sm py-1"
        >
          <span class="text-slate-400 text-xs shrink-0">{{ event.time }}</span>
          <span class="material-symbols-outlined text-xs" :class="getEventColor(event.type)">circle</span>
          <span class="text-slate-700 dark:text-text-secondary">{{ event.message }}</span>
        </div>
        <div v-if="events.length === 0" class="text-center py-4 text-slate-500 text-sm">
          No events yet
        </div>
      </div>
    </div>
  </div>
</template>