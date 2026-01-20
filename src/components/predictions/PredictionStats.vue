<script setup>
/**
 * PredictionStats Component
 * Display prediction statistics in card format
 */

import { computed } from 'vue'
import { formatCOPWithFlag } from '@/utils/currency'

const props = defineProps({
  currentPrice: {
    type: Number,
    default: 0
  },
  predictedPrice: {
    type: Number,
    default: 0
  },
  priceChange: {
    type: Number,
    default: 0
  },
  confidence: {
    type: Number,
    default: 0
  },
  direction: {
    type: String,
    default: 'NEUTRAL'
  },
  volatility: {
    type: Number,
    default: 0
  },
  momentum: {
    type: Number,
    default: 0
  },
  symbol: {
    type: String,
    default: 'BTC/USDT'
  }
})

// Format price with appropriate decimals
function formatPrice(price) {
  if (!price) return '$0.00'
  if (price >= 1000) return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (price >= 1) return '$' + price.toFixed(2)
  return '$' + price.toFixed(6)
}

// Format percentage
function formatPercent(value) {
  if (!value) return '0.00%'
  const sign = value >= 0 ? '+' : ''
  return sign + value.toFixed(2) + '%'
}

const directionConfig = computed(() => {
  const configs = {
    'LONG': { 
      icon: 'trending_up', 
      text: 'LONG', 
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30'
    },
    'SHORT': { 
      icon: 'trending_down', 
      text: 'SHORT', 
      color: 'text-danger',
      bgColor: 'bg-danger/10',
      borderColor: 'border-danger/30'
    },
    'NEUTRAL': { 
      icon: 'trending_flat', 
      text: 'NEUTRAL', 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30'
    }
  }
  return configs[props.direction] || configs['NEUTRAL']
})

const confidenceLevel = computed(() => {
  if (props.confidence >= 80) return { text: 'High', color: 'text-success' }
  if (props.confidence >= 50) return { text: 'Medium', color: 'text-warning' }
  return { text: 'Low', color: 'text-danger' }
})
</script>

<template>
  <div class="prediction-stats grid grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Current Price -->
    <div class="stat-card bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-primary text-xl">monetization_on</span>
        <span class="text-sm font-medium text-text-secondary">Current Price</span>
      </div>
      <div class="text-2xl font-bold text-slate-900 dark:text-white">
        {{ formatPrice(currentPrice) }}
      </div>
      <div class="text-yellow-600 dark:text-yellow-400 text-xs font-mono mt-0.5">
        {{ formatCOPWithFlag(currentPrice) }}
      </div>
      <div class="text-xs text-text-secondary mt-1">
        {{ symbol }}
      </div>
    </div>

    <!-- Predicted Price -->
    <div class="stat-card bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-secondary text-xl">auto_graph</span>
        <span class="text-sm font-medium text-text-secondary">Predicted Price</span>
      </div>
      <div class="text-2xl font-bold text-slate-900 dark:text-white">
        {{ formatPrice(predictedPrice) }}
      </div>
      <div class="text-yellow-600 dark:text-yellow-400 text-xs font-mono mt-0.5">
        {{ formatCOPWithFlag(predictedPrice) }}
      </div>
      <div 
        :class="[
          'text-xs mt-1 font-medium',
          priceChange >= 0 ? 'text-success' : 'text-danger'
        ]"
      >
        {{ formatPercent(priceChange) }}
      </div>
    </div>

    <!-- Confidence -->
    <div class="stat-card bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="material-symbols-outlined text-warning text-xl">verified</span>
        <span class="text-sm font-medium text-text-secondary">Confidence</span>
      </div>
      <div class="text-2xl font-bold text-slate-900 dark:text-white">
        {{ confidence }}%
      </div>
      <div :class="['text-xs mt-1 font-medium', confidenceLevel.color]">
        {{ confidenceLevel.text }} Confidence
      </div>
    </div>

    <!-- Direction -->
    <div 
      :class="[
        'stat-card rounded-xl p-4 border',
        directionConfig.bgColor,
        directionConfig.borderColor
      ]"
    >
      <div class="flex items-center gap-2 mb-2">
        <span :class="['material-symbols-outlined text-xl', directionConfig.color]">
          {{ directionConfig.icon }}
        </span>
        <span class="text-sm font-medium text-text-secondary">Direction</span>
      </div>
      <div :class="['text-2xl font-bold', directionConfig.color]">
        {{ directionConfig.text }}
      </div>
      <div class="text-xs text-text-secondary mt-1">
        Momentum: {{ formatPercent(momentum * 100) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
</style>
