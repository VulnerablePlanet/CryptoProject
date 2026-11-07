<script setup>
/**
 * BotConfig Component
 * Configuration panel for trading bot settings
 */
import { ref, computed, useId } from 'vue'
import { useBotTradingStore } from '@/stores/botTrading'

// Unique prefix so label/field ids stay valid with several instances
const uid = useId()

const store = useBotTradingStore()

// Local state for editing
const localConfig = ref({
  riskPerTrade: store.config.riskPerTrade,
  capital: store.config.capital,
  minConfidence: store.config.minConfidence,
  atrMultiplier: store.config.atrMultiplier,
  maxOpenTrades: store.config.maxOpenTrades
})

// Computed
const symbolOptions = computed(() => store.config.symbols)
const timeframeOptions = computed(() => store.config.timeframes)

// Methods
const updateSymbol = (event) => {
  store.changeSymbol(event.target.value)
}

const updateTimeframe = (event) => {
  store.changeTimeframe(event.target.value)
}

const saveSettings = () => {
  store.updateRiskSettings(localConfig.value)
  // Save to localStorage
  localStorage.setItem('botTradingConfig', JSON.stringify(store.config))
}

const resetSettings = () => {
  localConfig.value = {
    riskPerTrade: 2,
    capital: 1000,
    minConfidence: 60,
    atrMultiplier: 2,
    maxOpenTrades: 3
  }
  store.updateRiskSettings(localConfig.value)
}
</script>

<template>
  <div class="bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-border-dark p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">tune</span>
        Bot Configuration
      </h3>
    </div>

    <!-- Symbol & Timeframe -->
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div>
        <label :for="`${uid}-bot-config-trading-pair`" class="block text-sm font-medium text-slate-700 dark:text-text-secondary mb-2">
          Trading Pair
        </label>
        <select :id="`${uid}-bot-config-trading-pair`"
          :value="store.config.symbol"
          @change="updateSymbol"
          class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-border-dark rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option v-for="sym in symbolOptions" :key="sym.id" :value="sym.id">
            {{ sym.symbol }} - {{ sym.name }}
          </option>
        </select>
      </div>

      <div>
        <label :for="`${uid}-bot-config-timeframe`" class="block text-sm font-medium text-slate-700 dark:text-text-secondary mb-2">
          Timeframe
        </label>
        <select :id="`${uid}-bot-config-timeframe`"
          :value="store.config.timeframe"
          @change="updateTimeframe"
          class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-gray-200 dark:border-border-dark rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option v-for="tf in timeframeOptions" :key="tf.value" :value="tf.value">
            {{ tf.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Risk Settings -->
    <div class="space-y-4">
      <h4 class="text-sm font-medium text-slate-700 dark:text-text-secondary flex items-center gap-2">
        <span class="material-symbols-outlined text-warning">shield</span>
        Risk Management
      </h4>

      <!-- Capital -->
      <div>
        <label :for="`${uid}-bot-config-trading-capital`" class="flex items-center justify-between text-sm text-slate-600 dark:text-text-secondary mb-2">
          <span>Trading Capital</span>
          <span class="font-mono font-medium text-slate-900 dark:text-white">${{ localConfig.capital }}</span>
        </label>
        <input :id="`${uid}-bot-config-trading-capital`"
          v-model.number="localConfig.capital"
          type="range"
          min="100"
          max="100000"
          step="100"
          class="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div class="flex justify-between text-xs text-text-secondary mt-1">
          <span>$100</span>
          <span>$100,000</span>
        </div>
      </div>

      <!-- Risk Per Trade -->
      <div>
        <label :for="`${uid}-bot-config-risk-per-trade`" class="flex items-center justify-between text-sm text-slate-600 dark:text-text-secondary mb-2">
          <span>Risk Per Trade</span>
          <span class="font-mono font-medium text-slate-900 dark:text-white">{{ localConfig.riskPerTrade }}%</span>
        </label>
        <input :id="`${uid}-bot-config-risk-per-trade`"
          v-model.number="localConfig.riskPerTrade"
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          class="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div class="flex justify-between text-xs text-text-secondary mt-1">
          <span>0.5%</span>
          <span>10%</span>
        </div>
      </div>

      <!-- Min Confidence -->
      <div>
        <label :for="`${uid}-bot-config-minimum-confidence`" class="flex items-center justify-between text-sm text-slate-600 dark:text-text-secondary mb-2">
          <span>Minimum Confidence</span>
          <span class="font-mono font-medium text-slate-900 dark:text-white">{{ localConfig.minConfidence }}%</span>
        </label>
        <input :id="`${uid}-bot-config-minimum-confidence`"
          v-model.number="localConfig.minConfidence"
          type="range"
          min="30"
          max="90"
          step="5"
          class="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div class="flex justify-between text-xs text-text-secondary mt-1">
          <span>30%</span>
          <span>90%</span>
        </div>
      </div>

      <!-- ATR Multiplier -->
      <div>
        <label :for="`${uid}-bot-config-atr-multiplier-sl-distance`" class="flex items-center justify-between text-sm text-slate-600 dark:text-text-secondary mb-2">
          <span>ATR Multiplier (SL Distance)</span>
          <span class="font-mono font-medium text-slate-900 dark:text-white">{{ localConfig.atrMultiplier }}x</span>
        </label>
        <input :id="`${uid}-bot-config-atr-multiplier-sl-distance`"
          v-model.number="localConfig.atrMultiplier"
          type="range"
          min="1"
          max="5"
          step="0.5"
          class="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div class="flex justify-between text-xs text-text-secondary mt-1">
          <span>1x (Tight)</span>
          <span>5x (Wide)</span>
        </div>
      </div>

      <!-- Max Open Trades -->
      <div>
        <label :for="`${uid}-bot-config-max-open-trades`" class="flex items-center justify-between text-sm text-slate-600 dark:text-text-secondary mb-2">
          <span>Max Open Trades</span>
          <span class="font-mono font-medium text-slate-900 dark:text-white">{{ localConfig.maxOpenTrades }}</span>
        </label>
        <input :id="`${uid}-bot-config-max-open-trades`"
          v-model.number="localConfig.maxOpenTrades"
          type="range"
          min="1"
          max="10"
          step="1"
          class="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <div class="flex justify-between text-xs text-text-secondary mt-1">
          <span>1</span>
          <span>10</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-border-dark">
      <button
        @click="saveSettings"
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
      >
        <span class="material-symbols-outlined text-xl">save</span>
        Save Settings
      </button>
      <button type="button" aria-label="Reset to defaults"
        @click="resetSettings"
        class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-text-secondary rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      >
        <span class="material-symbols-outlined text-xl" aria-hidden="true">restart_alt</span>
      </button>
    </div>

    <!-- Risk Warning -->
    <div class="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
      <p class="text-xs text-warning flex items-start gap-2">
        <span class="material-symbols-outlined text-sm mt-0.5">warning</span>
        <span>
          <strong>Paper Trading Mode:</strong> The bot is currently in simulation mode. 
          No real trades will be executed.
        </span>
      </p>
    </div>
  </div>
</template>
