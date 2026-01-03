<script setup>
/**
 * FibonacciLevels Component
 * Displays Fibonacci levels panel with prices and Take Profit targets
 */

import { computed } from 'vue'
import { formatFibPrice, getTrendColor, getTrendIcon } from '@/utils/fibonacci'
import { formatCOPWithFlag } from '@/utils/currency'

const props = defineProps({
  retracementLevels: {
    type: Object,
    default: () => ({})
  },
  extensionLevels: {
    type: Object,
    default: () => ({})
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  trend: {
    type: String,
    default: 'neutral'
  },
  swingHigh: {
    type: Object,
    default: null
  },
  swingLow: {
    type: Object,
    default: null
  },
  nearestLevel: {
    type: Object,
    default: null
  }
})

// Computed
const trendIcon = computed(() => getTrendIcon(props.trend))
const trendColorClass = computed(() => getTrendColor(props.trend))
const trendLabel = computed(() => {
  switch (props.trend) {
    case 'bullish': return 'Alcista'
    case 'bearish': return 'Bajista'
    default: return 'Neutral'
  }
})

const sortedRetracementLevels = computed(() => {
  return Object.entries(props.retracementLevels)
    .map(([key, level]) => ({ key, ...level }))
    .sort((a, b) => a.ratio - b.ratio)
})

const sortedExtensionLevels = computed(() => {
  return Object.entries(props.extensionLevels)
    .map(([key, level]) => ({ key, ...level }))
    .sort((a, b) => a.ratio - b.ratio)
})

// Format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleDateString('es-CO', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Get level distance from current price
const getLevelDistance = (price) => {
  if (!props.currentPrice || !price) return null
  const distance = ((price - props.currentPrice) / props.currentPrice) * 100
  return distance.toFixed(2)
}

// Check if price is near a level
const isNearLevel = (levelRatio) => {
  return props.nearestLevel?.level === `${(levelRatio * 100).toFixed(1)}%`
}
</script>

<template>
  <div class="fibonacci-levels space-y-4">
    <!-- Trend Indicator -->
    <div class="bg-gray-50 dark:bg-background-dark rounded-xl p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span class="material-symbols-outlined text-primary">analytics</span>
          Tendencia Detectada
        </h3>
        <div 
          class="flex items-center gap-1 px-3 py-1 rounded-full font-bold"
          :class="{
            'bg-success/20 text-success': trend === 'bullish',
            'bg-danger/20 text-danger': trend === 'bearish',
            'bg-gray-200 dark:bg-border-dark text-text-secondary': trend === 'neutral'
          }"
        >
          <span class="material-symbols-outlined text-[18px]">{{ trendIcon }}</span>
          {{ trendLabel }}
        </div>
      </div>

      <!-- Swing Points -->
      <div class="grid grid-cols-2 gap-3 mt-3">
        <div class="p-3 bg-white dark:bg-card-dark rounded-lg border border-gray-200 dark:border-border-dark">
          <p class="text-xs text-text-secondary mb-1">Swing High</p>
          <p class="text-lg font-bold font-mono text-danger">
            ${{ formatFibPrice(swingHigh?.price) }}
          </p>
          <p class="text-xs text-yellow-600 dark:text-yellow-400 font-mono">
            {{ formatCOPWithFlag(swingHigh?.price) }}
          </p>
          <p class="text-[10px] text-text-secondary mt-1">
            {{ formatTimestamp(swingHigh?.timestamp) }}
          </p>
        </div>
        <div class="p-3 bg-white dark:bg-card-dark rounded-lg border border-gray-200 dark:border-border-dark">
          <p class="text-xs text-text-secondary mb-1">Swing Low</p>
          <p class="text-lg font-bold font-mono text-success">
            ${{ formatFibPrice(swingLow?.price) }}
          </p>
          <p class="text-xs text-yellow-600 dark:text-yellow-400 font-mono">
            {{ formatCOPWithFlag(swingLow?.price) }}
          </p>
          <p class="text-[10px] text-text-secondary mt-1">
            {{ formatTimestamp(swingLow?.timestamp) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Current Price -->
    <div class="bg-primary/10 border border-primary/30 rounded-xl p-4">
      <p class="text-xs text-primary mb-1">Precio Actual</p>
      <p class="text-2xl font-bold font-mono text-primary">
        ${{ formatFibPrice(currentPrice) }}
      </p>
      <p class="text-xs text-primary/70 mt-1">
        {{ formatCOPWithFlag(currentPrice) }}
      </p>
      <p v-if="nearestLevel" class="text-xs text-text-secondary mt-2">
        Más cercano al nivel <strong>{{ nearestLevel.level }}</strong>
        ({{ nearestLevel.percentDistance }}% de distancia)
      </p>
    </div>

    <!-- Retracement Levels -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <div class="p-3 border-b border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark">
        <h4 class="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-success text-[18px]">horizontal_rule</span>
          Niveles de Retroceso
        </h4>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-border-dark/50">
        <div 
          v-for="level in sortedRetracementLevels" 
          :key="level.key"
          class="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          :class="{ 'bg-warning/5': level.isGoldenPocket }"
        >
          <div class="flex items-center gap-2">
            <span 
              class="w-2 h-2 rounded-full"
              :class="{
                'bg-warning': level.isGoldenPocket,
                'bg-success': !level.isGoldenPocket && level.ratio <= 0.5,
                'bg-orange-500': !level.isGoldenPocket && level.ratio > 0.5
              }"
            ></span>
            <span class="text-sm font-medium" :class="level.isGoldenPocket ? 'text-warning' : 'text-slate-700 dark:text-white'">
              {{ level.label }}
            </span>
            <span v-if="isNearLevel(level.ratio)" class="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded">
              CERCA
            </span>
          </div>
          <div class="text-right">
            <p class="font-mono text-sm font-bold text-slate-900 dark:text-white">
              ${{ formatFibPrice(level.price) }}
            </p>
            <p class="text-[10px] text-yellow-600 dark:text-yellow-400 font-mono">
              {{ formatCOPWithFlag(level.price) }}
            </p>
            <p class="text-[10px] text-text-secondary">
              {{ getLevelDistance(level.price) > 0 ? '+' : '' }}{{ getLevelDistance(level.price) }}%
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Extension Levels (Take Profits) -->
    <div class="bg-white dark:bg-card-dark border border-purple-500/30 rounded-xl overflow-hidden">
      <div class="p-3 border-b border-purple-500/30 bg-purple-500/10">
        <h4 class="font-bold text-purple-400 text-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">flag</span>
          Take Profits (Extensiones)
        </h4>
      </div>
      <div class="divide-y divide-purple-500/20">
        <div 
          v-for="(level, index) in sortedExtensionLevels" 
          :key="level.key"
          class="flex items-center justify-between p-3 hover:bg-purple-500/5 transition-colors"
          :class="{ 'bg-warning/5': level.isGoldenExtension }"
        >
          <div class="flex items-center gap-2">
            <span 
              class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              :class="{
                'bg-purple-500/20 text-purple-400': !level.isGoldenExtension,
                'bg-warning/20 text-warning': level.isGoldenExtension
              }"
            >
              {{ index + 1 }}
            </span>
            <div>
              <span class="text-sm font-medium" :class="level.isGoldenExtension ? 'text-warning' : 'text-purple-400'">
                {{ level.label }}
              </span>
              <p v-if="level.isGoldenExtension" class="text-[10px] text-warning/70">
                ⭐ Objetivo Áureo
              </p>
            </div>
          </div>
          <div class="text-right">
            <p class="font-mono text-sm font-bold" :class="level.isGoldenExtension ? 'text-warning' : 'text-purple-400'">
              ${{ formatFibPrice(level.price) }}
            </p>
            <p class="text-[10px] text-yellow-600 dark:text-yellow-400 font-mono">
              {{ formatCOPWithFlag(level.price) }}
            </p>
            <p class="text-[10px] text-text-secondary">
              +{{ getLevelDistance(level.price) }}%
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
