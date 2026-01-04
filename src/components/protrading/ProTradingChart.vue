<script setup>
/**
 * ProTradingChart Component
 * Advanced chart component using TradingView Lightweight Charts
 * Supports candlestick, Heikin-Ashi, line, and area chart types
 * with overlay indicators (Bollinger Bands, SMA, EMA)
 */

import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { createChart } from 'lightweight-charts'
import { useThemeStore } from '@/stores/theme'

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
    default: 'candlestick'
  },
  height: {
    type: Number,
    default: 400
  },
  showVolume: {
    type: Boolean,
    default: true
  },
  // Overlay data
  bollingerBands: {
    type: Object,
    default: null
  },
  smaLines: {
    type: Object,
    default: () => ({})
  },
  emaLines: {
    type: Object,
    default: () => ({})
  },
  // Markers for patterns
  markers: {
    type: Array,
    default: () => []
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
let bbUpperSeries = null
let bbMiddleSeries = null
let bbLowerSeries = null
let smaSeriesMap = {}
let emaSeriesMap = {}
let resizeObserver = null
let currentSeriesType = null // Track current series type to prevent mismatched updates

// Theme computed
const isDarkMode = computed(() => themeStore.isDark)

// SMA colors
const SMA_COLORS = {
  7: '#fbbf24',    // Yellow
  14: '#8b5cf6',   // Purple
  30: '#ef4444'    // Red
}

// EMA colors
const EMA_COLORS = {
  12: '#10b981',   // Green
  26: '#3b82f6'    // Blue
}

// Theme options
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
      mode: 1,
      vertLine: { color: '#4b5563', width: 1, style: 2 },
      horzLine: { color: '#4b5563', width: 1, style: 2 }
    },
    rightPriceScale: {
      borderColor: '#2b2f3a'
    },
    timeScale: {
      borderColor: '#2b2f3a',
      timeVisible: true,
      secondsVisible: false
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
      mode: 1,
      vertLine: { color: '#94a3b8', width: 1, style: 2 },
      horzLine: { color: '#94a3b8', width: 1, style: 2 }
    },
    rightPriceScale: {
      borderColor: '#e2e8f0'
    },
    timeScale: {
      borderColor: '#e2e8f0',
      timeVisible: true,
      secondsVisible: false
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
    handleScroll: { mouseWheel: true, pressedMouseMove: true },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
  })
  
  // Create main series
  createMainSeries()
  
  // Create volume series
  if (props.showVolume && props.volumeData.length > 0) {
    createVolumeSeries()
  }
  
  // Create overlay series
  createOverlaySeries()
  
  // Subscribe to events
  chart.subscribeCrosshairMove((param) => {
    if (param.time) {
      const data = param.seriesData.get(mainSeries)
      emit('crosshair-move', { time: param.time, data })
    }
  })
  
  chart.subscribeClick((param) => {
    if (param.time) {
      emit('click', { time: param.time, point: param.point })
    }
  })
  
  // Fit content
  chart.timeScale().fitContent()
  
  // Setup resize observer
  setupResizeObserver()
}

const createMainSeries = () => {
  if (!chart) return
  
  const isCandle = props.chartType === 'candlestick' || props.chartType === 'heikinashi'
  
  if (isCandle) {
    currentSeriesType = 'candle'
    mainSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      borderVisible: false
    })
    if (props.candleData.length > 0) {
      mainSeries.setData(props.candleData)
    }
  } else if (props.chartType === 'line') {
    currentSeriesType = 'line'
    mainSeries = chart.addLineSeries({
      color: '#137fec',
      lineWidth: 2
    })
    if (props.lineData.length > 0) {
      mainSeries.setData(props.lineData)
    }
  } else if (props.chartType === 'area') {
    currentSeriesType = 'area'
    mainSeries = chart.addAreaSeries({
      lineColor: '#137fec',
      topColor: 'rgba(19, 127, 236, 0.4)',
      bottomColor: 'rgba(19, 127, 236, 0.05)',
      lineWidth: 2
    })
    if (props.lineData.length > 0) {
      mainSeries.setData(props.lineData)
    }
  }
  
  // Set markers
  if (props.markers.length > 0 && mainSeries) {
    mainSeries.setMarkers(props.markers)
  }
}

const createVolumeSeries = () => {
  if (!chart) return
  
  volumeSeries = chart.addHistogramSeries({
    color: '#26a69a',
    priceFormat: { type: 'volume' },
    priceScaleId: '',
    scaleMargins: { top: 0.8, bottom: 0 }
  })
  
  if (props.volumeData.length > 0) {
    volumeSeries.setData(props.volumeData)
  }
}

const createOverlaySeries = () => {
  if (!chart) return
  
  // Bollinger Bands
  if (props.bollingerBands) {
    bbUpperSeries = chart.addLineSeries({
      color: 'rgba(139, 92, 246, 0.6)',
      lineWidth: 1,
      lineStyle: 2
    })
    bbMiddleSeries = chart.addLineSeries({
      color: 'rgba(139, 92, 246, 0.8)',
      lineWidth: 1
    })
    bbLowerSeries = chart.addLineSeries({
      color: 'rgba(139, 92, 246, 0.6)',
      lineWidth: 1,
      lineStyle: 2
    })
    
    if (props.bollingerBands.upper?.length > 0) {
      bbUpperSeries.setData(props.bollingerBands.upper)
    }
    if (props.bollingerBands.middle?.length > 0) {
      bbMiddleSeries.setData(props.bollingerBands.middle)
    }
    if (props.bollingerBands.lower?.length > 0) {
      bbLowerSeries.setData(props.bollingerBands.lower)
    }
  }
  
  // SMA Lines
  for (const [period, data] of Object.entries(props.smaLines)) {
    if (data && data.length > 0) {
      const series = chart.addLineSeries({
        color: SMA_COLORS[period] || '#64748b',
        lineWidth: 1,
        title: `SMA ${period}`
      })
      series.setData(data)
      smaSeriesMap[period] = series
    }
  }
  
  // EMA Lines
  for (const [period, data] of Object.entries(props.emaLines)) {
    if (data && data.length > 0) {
      const series = chart.addLineSeries({
        color: EMA_COLORS[period] || '#64748b',
        lineWidth: 1,
        lineStyle: 0,
        title: `EMA ${period}`
      })
      series.setData(data)
      emaSeriesMap[period] = series
    }
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
    bbUpperSeries = null
    bbMiddleSeries = null
    bbLowerSeries = null
    smaSeriesMap = {}
    emaSeriesMap = {}
    currentSeriesType = null
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

const updateData = () => {
  if (!mainSeries || !currentSeriesType) return
  
  const isCandle = props.chartType === 'candlestick' || props.chartType === 'heikinashi'
  const expectedType = isCandle ? 'candle' : props.chartType
  
  // Don't update if series type doesn't match (chart is being recreated)
  if (currentSeriesType !== expectedType) {
    return
  }
  
  try {
    if (currentSeriesType === 'candle') {
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
    
    // Update markers
    if (props.markers.length > 0 && mainSeries) {
      mainSeries.setMarkers(props.markers)
    }
    
    if (chart) {
      chart.timeScale().fitContent()
    }
  } catch (err) {
    console.error('Error updating chart data:', err)
  }
}

const updateTheme = () => {
  if (!chart) return
  chart.applyOptions(getThemeOptions())
}

// Lifecycle
onMounted(() => {
  nextTick(() => initChart())
})

onUnmounted(() => {
  destroyChart()
})

// Watchers
watch(() => props.chartType, () => initChart())

watch([
  () => props.candleData,
  () => props.lineData,
  () => props.volumeData
], () => updateData(), { deep: true })

watch(() => props.bollingerBands, () => initChart(), { deep: true })
watch(() => props.smaLines, () => initChart(), { deep: true })
watch(() => props.emaLines, () => initChart(), { deep: true })
watch(() => props.markers, () => {
  if (mainSeries && props.markers.length > 0) {
    mainSeries.setMarkers(props.markers)
  }
}, { deep: true })

watch(isDarkMode, () => updateTheme())

watch(() => props.height, (newHeight) => {
  if (chart) {
    chart.applyOptions({ height: newHeight })
  }
})

// Expose
defineExpose({
  chart: () => chart,
  fitContent: () => chart?.timeScale().fitContent(),
  scrollToRealTime: () => chart?.timeScale().scrollToRealTime()
})
</script>

<template>
  <div class="pro-trading-chart-wrapper">
    <div 
      ref="chartContainer" 
      class="pro-trading-chart-container"
      :style="{ height: `${height}px` }"
    ></div>
    
    <!-- Empty state -->
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
.pro-trading-chart-wrapper {
  position: relative;
  width: 100%;
}

.pro-trading-chart-container {
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
