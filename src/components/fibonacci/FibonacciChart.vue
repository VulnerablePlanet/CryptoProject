<script setup>
/**
 * FibonacciChart Component
 * Displays OHLC chart with Fibonacci retracement and extension lines
 * using TradingView Lightweight Charts
 */

import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { createChart } from 'lightweight-charts'
import { useThemeStore } from '@/stores/theme'
import { logger } from '@/utils/logger'

const props = defineProps({
  candleData: {
    type: Array,
    default: () => []
  },
  fibLevels: {
    type: Array,
    default: () => []
  },
  pivots: {
    type: Object,
    default: null
  },
  trend: {
    type: String,
    default: 'neutral'
  },
  height: {
    type: Number,
    default: 500
  }
})

const emit = defineEmits(['crosshair-move'])

const chartContainer = ref(null)
let chart = null
let candleSeries = null
let priceLinesMap = new Map()
let resizeObserver = null

const themeStore = useThemeStore()

// Use isDark from theme store
const isDark = computed(() => themeStore.isDark)

// Chart options based on theme
const getChartOptions = () => ({
  layout: {
    background: { type: 'solid', color: isDark.value ? '#1a1d29' : '#ffffff' },
    textColor: isDark.value ? '#a1a7bb' : '#333333'
  },
  grid: {
    vertLines: { color: isDark.value ? '#2d3139' : '#e1e5eb' },
    horzLines: { color: isDark.value ? '#2d3139' : '#e1e5eb' }
  },
  crosshair: {
    mode: 1,
    vertLine: {
      color: isDark.value ? '#758696' : '#9ca3af',
      width: 1,
      style: 3,
      labelBackgroundColor: isDark.value ? '#2d3139' : '#f3f4f6'
    },
    horzLine: {
      color: isDark.value ? '#758696' : '#9ca3af',
      width: 1,
      style: 3,
      labelBackgroundColor: isDark.value ? '#2d3139' : '#f3f4f6'
    }
  },
  rightPriceScale: {
    borderColor: isDark.value ? '#2d3139' : '#e1e5eb'
  },
  timeScale: {
    borderColor: isDark.value ? '#2d3139' : '#e1e5eb',
    timeVisible: true,
    secondsVisible: false
  },
  height: props.height
})

// Fibonacci level colors
const getLevelColor = (level) => {
  if (level.isGolden || level.isGoldenExtension) {
    return '#eab308' // Golden
  }
  if (level.type === 'extension') {
    return '#a855f7' // Purple for extensions
  }
  // Retracement colors by ratio
  if (level.ratio <= 0.236) return '#6b7280'
  if (level.ratio <= 0.382) return '#10b981'
  if (level.ratio <= 0.5) return '#22c55e'
  if (level.ratio <= 0.618) return '#eab308'
  if (level.ratio <= 0.786) return '#f97316'
  return '#ef4444'
}

// Initialize chart
const initChart = () => {
  if (!chartContainer.value) return

  // Destroy existing chart if any
  if (chart) {
    chart.remove()
    chart = null
    candleSeries = null
    priceLinesMap.clear()
  }

  chart = createChart(chartContainer.value, getChartOptions())

  // Create candlestick series
  candleSeries = chart.addCandlestickSeries({
    upColor: '#10b981',
    downColor: '#ef4444',
    borderUpColor: '#10b981',
    borderDownColor: '#ef4444',
    wickUpColor: '#10b981',
    wickDownColor: '#ef4444'
  })

  // Set data if available
  if (props.candleData.length > 0) {
    updateCandleData()
  }

  // Update fib lines
  updateFibLines()

  // Handle crosshair move
  chart.subscribeCrosshairMove((param) => {
    if (param.time) {
      const data = param.seriesData.get(candleSeries)
      if (data) {
        emit('crosshair-move', {
          time: param.time,
          price: data.close,
          data
        })
      }
    }
  })

  // Handle resize
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  resizeObserver = new ResizeObserver(() => {
    if (chart && chartContainer.value) {
      chart.applyOptions({ width: chartContainer.value.clientWidth })
    }
  })
  resizeObserver.observe(chartContainer.value)
}

// Update candle data
const updateCandleData = () => {
  if (!candleSeries || props.candleData.length === 0) return

  // Transform to TradingView format
  const tvData = props.candleData
    .map(candle => ({
      time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }))
    .sort((a, b) => a.time - b.time)

  candleSeries.setData(tvData)
  chart.timeScale().fitContent()
}

// Update Fibonacci price lines
const updateFibLines = () => {
  if (!candleSeries) return

  // Remove existing price lines
  priceLinesMap.forEach((line) => {
    try {
      candleSeries.removePriceLine(line)
    } catch (e) {
      // Ignore if line already removed
    }
  })
  priceLinesMap.clear()

  // Add new price lines for each level
  props.fibLevels.forEach((level) => {
    const color = getLevelColor(level)
    const lineStyle = level.type === 'extension' ? 2 : 0 // Dashed for extensions
    
    const priceLine = candleSeries.createPriceLine({
      price: level.price,
      color,
      lineWidth: level.isGolden || level.isGoldenExtension ? 2 : 1,
      lineStyle,
      axisLabelVisible: true,
      title: level.label || `${(level.ratio * 100).toFixed(1)}%`
    })
    
    priceLinesMap.set(level.ratio, priceLine)
  })
}

// Watch for data changes
watch(() => props.candleData, updateCandleData, { deep: true })
watch(() => props.fibLevels, updateFibLines, { deep: true })

// Watch for theme changes - recreate chart
watch(isDark, async () => {
  logger.debug('📐 [Fibonacci Chart] Theme changed, recreating chart...')
  await nextTick()
  initChart()
})

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (chart) {
    chart.remove()
    chart = null
  }
})
</script>

<template>
  <div class="fibonacci-chart">
    <!-- Chart Container -->
    <div 
      ref="chartContainer" 
      class="w-full rounded-lg overflow-hidden"
      :style="{ height: `${height}px` }"
    ></div>

    <!-- Legend -->
    <div class="flex flex-wrap gap-4 mt-4 text-xs">
      <div class="flex items-center gap-2">
        <div class="w-4 h-0.5 bg-success"></div>
        <span class="text-text-secondary">Retrocesos</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-0.5 bg-warning"></div>
        <span class="text-text-secondary">Golden Pocket (61.8%)</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-4 h-0.5 bg-purple-500 border-dashed"></div>
        <span class="text-text-secondary">Extensiones (Take Profits)</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fibonacci-chart {
  @apply w-full;
}
</style>
