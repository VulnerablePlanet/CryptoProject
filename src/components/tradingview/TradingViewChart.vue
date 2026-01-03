<script setup>
/**
 * TradingViewChart Component
 * Core chart component using TradingView Lightweight Charts
 * 
 * Supports:
 * - Candlestick, Line, Area chart types
 * - Volume histogram overlay
 * - Responsive resizing
 * - Dark/Light theme support
 * - Prepared for future technical indicators
 */

import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { createChart, ColorType } from 'lightweight-charts'
import { useThemeStore } from '@/stores/theme'
import {
  getDarkThemeOptions,
  getLightThemeOptions,
  getCandlestickOptions,
  getLineOptions,
  getAreaOptions
} from '@/services/tradingview'

const props = defineProps({
  candleData: {
    type: Array,
    default: () => []
  },
  volumeData: {
    type: Array,
    default: () => []
  },
  lineData: {
    type: Array,
    default: () => []
  },
  chartType: {
    type: String,
    default: 'candlestick', // 'candlestick' | 'line' | 'area'
    validator: (value) => ['candlestick', 'line', 'area'].includes(value)
  },
  height: {
    type: Number,
    default: 400
  },
  showVolume: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#137fec'
  },
  autosize: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['crosshair-move', 'click'])

// Refs
const chartContainer = ref(null)
const themeStore = useThemeStore()

// Chart instances
let chart = null
let mainSeries = null
let volumeSeries = null
let resizeObserver = null

// Computed
const isDarkMode = computed(() => themeStore.isDark)

// ============================================================================
// Chart Initialization
// ============================================================================

const initChart = () => {
  if (!chartContainer.value) return
  
  // Cleanup existing chart
  destroyChart()
  
  // Get theme options
  const themeOptions = isDarkMode.value 
    ? getDarkThemeOptions() 
    : getLightThemeOptions()
  
  // Create chart
  chart = createChart(chartContainer.value, {
    ...themeOptions,
    width: chartContainer.value.clientWidth,
    height: props.height,
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true
    }
  })
  
  // Create main series based on chart type
  createMainSeries()
  
  // Create volume series if enabled
  if (props.showVolume && props.volumeData.length > 0) {
    createVolumeSeries()
  }
  
  // Subscribe to crosshair move
  chart.subscribeCrosshairMove((param) => {
    if (param.time) {
      const data = param.seriesData.get(mainSeries)
      emit('crosshair-move', { time: param.time, data })
    }
  })
  
  // Subscribe to click
  chart.subscribeClick((param) => {
    if (param.time) {
      emit('click', { time: param.time, point: param.point })
    }
  })
  
  // Fit content to visible area
  chart.timeScale().fitContent()
  
  // Setup resize observer
  if (props.autosize) {
    setupResizeObserver()
  }
}

const createMainSeries = () => {
  if (!chart) return
  
  switch (props.chartType) {
    case 'candlestick':
      mainSeries = chart.addCandlestickSeries(getCandlestickOptions())
      if (props.candleData.length > 0) {
        mainSeries.setData(props.candleData)
      }
      break
      
    case 'line':
      mainSeries = chart.addLineSeries(getLineOptions(props.color))
      if (props.lineData.length > 0) {
        mainSeries.setData(props.lineData)
      }
      break
      
    case 'area':
      mainSeries = chart.addAreaSeries(getAreaOptions(props.color))
      if (props.lineData.length > 0) {
        mainSeries.setData(props.lineData)
      }
      break
  }
}

const createVolumeSeries = () => {
  if (!chart) return
  
  volumeSeries = chart.addHistogramSeries({
    color: '#26a69a',
    priceFormat: {
      type: 'volume'
    },
    priceScaleId: '', // Overlay on main chart
    scaleMargins: {
      top: 0.8, // Position at bottom 20%
      bottom: 0
    }
  })
  
  if (props.volumeData.length > 0) {
    volumeSeries.setData(props.volumeData)
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
    mainSeries = null
    volumeSeries = null
  }
}

const setupResizeObserver = () => {
  if (!chartContainer.value) return
  
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (chart) {
        chart.applyOptions({
          width: entry.contentRect.width
        })
      }
    }
  })
  
  resizeObserver.observe(chartContainer.value)
}

// ============================================================================
// Update Functions
// ============================================================================

const updateData = () => {
  if (!mainSeries) return
  
  if (props.chartType === 'candlestick') {
    if (props.candleData.length > 0) {
      mainSeries.setData(props.candleData)
    }
  } else {
    if (props.lineData.length > 0) {
      mainSeries.setData(props.lineData)
    }
  }
  
  if (volumeSeries && props.volumeData.length > 0) {
    volumeSeries.setData(props.volumeData)
  }
  
  // Fit content after data update
  if (chart) {
    chart.timeScale().fitContent()
  }
}

const updateTheme = () => {
  if (!chart) return
  
  const themeOptions = isDarkMode.value 
    ? getDarkThemeOptions() 
    : getLightThemeOptions()
    
  chart.applyOptions(themeOptions)
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  nextTick(() => {
    initChart()
  })
})

onUnmounted(() => {
  destroyChart()
})

// ============================================================================
// Watchers
// ============================================================================

// Watch for chart type changes
watch(() => props.chartType, () => {
  initChart()
})

// Watch for data changes
watch([
  () => props.candleData,
  () => props.lineData,
  () => props.volumeData
], () => {
  updateData()
}, { deep: true })

// Watch for theme changes
watch(isDarkMode, () => {
  updateTheme()
})

// Watch for height changes
watch(() => props.height, (newHeight) => {
  if (chart) {
    chart.applyOptions({ height: newHeight })
  }
})

// ============================================================================
// Expose
// ============================================================================

defineExpose({
  chart: () => chart,
  fitContent: () => chart?.timeScale().fitContent(),
  scrollToRealTime: () => chart?.timeScale().scrollToRealTime()
})
</script>

<template>
  <div class="tradingview-chart-wrapper">
    <div 
      ref="chartContainer" 
      class="tradingview-chart-container"
      :style="{ height: `${height}px` }"
    ></div>
    
    <!-- Loading overlay -->
    <div 
      v-if="candleData.length === 0 && lineData.length === 0" 
      class="chart-empty-state"
    >
      <span class="material-symbols-outlined text-5xl text-gray-300 dark:text-border-dark">
        candlestick_chart
      </span>
      <p class="text-text-secondary mt-2">No chart data available</p>
    </div>
  </div>
</template>

<style scoped>
.tradingview-chart-wrapper {
  position: relative;
  width: 100%;
}

.tradingview-chart-container {
  width: 100%;
}

.chart-empty-state {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(4px);
}

.dark .chart-empty-state {
  background: rgba(26, 29, 41, 0.8);
}
</style>
