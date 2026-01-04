<script setup>
/**
 * DepthChart Component
 * Order book depth visualization with bid/ask cumulative areas
 */

import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { createChart } from 'lightweight-charts'
import { useThemeStore } from '@/stores/theme'

const props = defineProps({
  depthData: {
    type: Object,
    default: () => ({ bids: [], asks: [], midPrice: null })
  },
  height: {
    type: Number,
    default: 250
  }
})

// Refs
const chartContainer = ref(null)
const themeStore = useThemeStore()

// Chart instances
let chart = null
let bidSeries = null
let askSeries = null
let resizeObserver = null

// Theme computed
const isDarkMode = computed(() => themeStore.isDark)

// Computed values
const midPrice = computed(() => props.depthData.midPrice)
const totalBidVolume = computed(() => {
  if (props.depthData.bids.length === 0) return 0
  return props.depthData.bids[props.depthData.bids.length - 1]?.cumulative || 0
})
const totalAskVolume = computed(() => {
  if (props.depthData.asks.length === 0) return 0
  return props.depthData.asks[props.depthData.asks.length - 1]?.cumulative || 0
})
const bidAskRatio = computed(() => {
  const total = totalBidVolume.value + totalAskVolume.value
  if (total === 0) return 50
  return (totalBidVolume.value / total) * 100
})

// Get theme options
const getThemeOptions = () => {
  return isDarkMode.value ? {
    layout: {
      background: { type: 'solid', color: '#1a1d29' },
      textColor: '#8b8fa3'
    },
    grid: {
      vertLines: { color: '#2b2f3a' },
      horzLines: { color: '#2b2f3a' }
    },
    crosshair: {
      mode: 1
    },
    rightPriceScale: {
      borderColor: '#2b2f3a'
    },
    timeScale: {
      visible: false
    }
  } : {
    layout: {
      background: { type: 'solid', color: '#ffffff' },
      textColor: '#64748b'
    },
    grid: {
      vertLines: { color: '#e2e8f0' },
      horzLines: { color: '#e2e8f0' }
    },
    crosshair: {
      mode: 1
    },
    rightPriceScale: {
      borderColor: '#e2e8f0'
    },
    timeScale: {
      visible: false
    }
  }
}

// Initialize chart
const initChart = () => {
  if (!chartContainer.value) return
  
  destroyChart()
  
  chart = createChart(chartContainer.value, {
    ...getThemeOptions(),
    width: chartContainer.value.clientWidth,
    height: props.height,
    handleScroll: false,
    handleScale: false
  })
  
  // Create bid area series (green)
  bidSeries = chart.addAreaSeries({
    lineColor: '#10b981',
    topColor: 'rgba(16, 185, 129, 0.4)',
    bottomColor: 'rgba(16, 185, 129, 0.05)',
    lineWidth: 2,
    priceScaleId: 'right'
  })
  
  // Create ask area series (red)
  askSeries = chart.addAreaSeries({
    lineColor: '#ef4444',
    topColor: 'rgba(239, 68, 68, 0.4)',
    bottomColor: 'rgba(239, 68, 68, 0.05)',
    lineWidth: 2,
    priceScaleId: 'right'
  })
  
  updateData()
  setupResizeObserver()
}

const updateData = () => {
  if (!bidSeries || !askSeries) return
  
  // Transform depth data to chart format
  // For depth charts, we want bids on the left (lower indices) and asks on the right
  // Bids are typically sorted descending by price, we reverse to show lowest first
  // Then assign ascending time indices
  
  const bidsReversed = [...props.depthData.bids].reverse()
  const bidData = bidsReversed.map((b, i) => ({
    time: i, // Ascending time values starting from 0
    value: b.cumulative
  }))
  
  const askData = props.depthData.asks.map((a, i) => ({
    time: i + bidsReversed.length, // Continue after bids
    value: a.cumulative
  }))
  
  try {
    if (bidData.length > 0) {
      bidSeries.setData(bidData)
    }
    
    if (askData.length > 0) {
      askSeries.setData(askData)
    }
    
    if (chart) {
      chart.timeScale().fitContent()
    }
  } catch (err) {
    console.error('Error updating depth chart:', err)
  }
}

const destroyChart = () => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  
  if (chart) {
    chart.remove()
    chart = null
    bidSeries = null
    askSeries = null
  }
}

const setupResizeObserver = () => {
  if (!chartContainer.value) return
  
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (chart) {
        chart.applyOptions({ width: entry.contentRect.width })
      }
    }
  })
  
  resizeObserver.observe(chartContainer.value)
}

const updateTheme = () => {
  if (!chart) return
  chart.applyOptions(getThemeOptions())
}

const formatVolume = (value) => {
  if (value >= 1000000) return (value / 1000000).toFixed(2) + 'M'
  if (value >= 1000) return (value / 1000).toFixed(2) + 'K'
  return value.toFixed(2)
}

const formatPrice = (value) => {
  if (!value) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 6 : 2
  }).format(value)
}

// Lifecycle
onMounted(() => {
  nextTick(() => initChart())
})

onUnmounted(() => {
  destroyChart()
})

// Watchers
watch(() => props.depthData, () => {
  if (chart) {
    updateData()
  } else {
    initChart()
  }
}, { deep: true })

watch(isDarkMode, () => updateTheme())

watch(() => props.height, (newHeight) => {
  if (chart) {
    chart.applyOptions({ height: newHeight })
  }
})
</script>

<template>
  <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
    <!-- Header with stats -->
    <div class="flex items-center justify-between p-3 border-b border-gray-200 dark:border-border-dark">
      <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-lg">waterfall_chart</span>
        Order Book Depth
      </h3>
      
      <div class="flex items-center gap-4 text-xs">
        <span v-if="midPrice" class="text-slate-600 dark:text-text-secondary">
          Mid: <span class="font-mono font-medium text-slate-900 dark:text-white">{{ formatPrice(midPrice) }}</span>
        </span>
      </div>
    </div>
    
    <!-- Bid/Ask Ratio Bar -->
    <div class="px-3 py-2 bg-gray-50 dark:bg-background-dark">
      <div class="flex h-5 rounded-full overflow-hidden">
        <div 
          class="bg-success flex items-center justify-start pl-2 transition-all duration-300" 
          :style="{ width: `${bidAskRatio}%` }"
        >
          <span class="text-[10px] font-bold text-white">{{ bidAskRatio.toFixed(1) }}%</span>
        </div>
        <div 
          class="bg-danger flex items-center justify-end pr-2 transition-all duration-300"
          :style="{ width: `${100 - bidAskRatio}%` }"
        >
          <span class="text-[10px] font-bold text-white">{{ (100 - bidAskRatio).toFixed(1) }}%</span>
        </div>
      </div>
      <div class="flex justify-between text-[10px] mt-1">
        <span class="text-success font-medium">Bids: {{ formatVolume(totalBidVolume) }}</span>
        <span class="text-danger font-medium">Asks: {{ formatVolume(totalAskVolume) }}</span>
      </div>
    </div>
    
    <!-- Chart -->
    <div 
      ref="chartContainer" 
      class="w-full"
      :style="{ height: `${height}px` }"
    ></div>
    
    <!-- Empty state -->
    <div 
      v-if="depthData.bids.length === 0 && depthData.asks.length === 0" 
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
    >
      <span class="material-symbols-outlined text-4xl text-gray-300 dark:text-border-dark">
        waterfall_chart
      </span>
      <p class="text-text-secondary text-sm mt-2">No order book data</p>
      <p class="text-text-secondary text-xs">Enable depth chart to fetch data</p>
    </div>
    
    <!-- Legend -->
    <div class="flex items-center justify-center gap-6 p-2 bg-gray-50 dark:bg-background-dark border-t border-gray-200 dark:border-border-dark">
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-success"></span>
        <span class="text-xs text-text-secondary">Bids (Buy Orders)</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-danger"></span>
        <span class="text-xs text-text-secondary">Asks (Sell Orders)</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No scoped styles needed - using inline Tailwind classes */
</style>
