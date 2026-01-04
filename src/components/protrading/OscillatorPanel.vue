<script setup>
/**
 * OscillatorPanel Component
 * Sub-chart for oscillator indicators (RSI, MACD)
 * Synchronized with main chart time scale
 */

import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { createChart } from 'lightweight-charts'
import { useThemeStore } from '@/stores/theme'

const props = defineProps({
  type: {
    type: String,
    default: 'rsi',
    validator: (v) => ['rsi', 'macd'].includes(v)
  },
  rsiData: {
    type: Array,
    default: () => []
  },
  macdData: {
    type: Object,
    default: () => ({ macd: [], signal: [], histogram: [] })
  },
  height: {
    type: Number,
    default: 150
  }
})

const emit = defineEmits(['crosshair-move'])

// Refs
const chartContainer = ref(null)
const themeStore = useThemeStore()

// Chart instances
let chart = null
let rsiSeries = null
let macdLineSeries = null
let signalLineSeries = null
let histogramSeries = null
let resizeObserver = null

// Theme computed
const isDarkMode = computed(() => themeStore.isDark)

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
      mode: 1,
      vertLine: { color: '#4b5563', width: 1, style: 2 },
      horzLine: { color: '#4b5563', width: 1, style: 2 }
    },
    rightPriceScale: {
      borderColor: '#2b2f3a'
    },
    timeScale: {
      borderColor: '#2b2f3a',
      visible: true
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
      visible: true
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
    handleScale: { axisPressedMouseMove: true, mouseWheel: true }
  })
  
  if (props.type === 'rsi') {
    createRSISeries()
  } else if (props.type === 'macd') {
    createMACDSeries()
  }
  
  // Subscribe to crosshair
  chart.subscribeCrosshairMove((param) => {
    if (param.time) {
      emit('crosshair-move', { time: param.time })
    }
  })
  
  chart.timeScale().fitContent()
  setupResizeObserver()
}

const createRSISeries = () => {
  if (!chart) return
  
  // RSI line
  rsiSeries = chart.addLineSeries({
    color: '#8b5cf6',
    lineWidth: 2,
    priceScaleId: 'right',
    title: 'RSI'
  })
  
  // Set RSI scale to 0-100
  chart.priceScale('right').applyOptions({
    autoScale: false,
    scaleMargins: { top: 0.1, bottom: 0.1 }
  })
  
  if (props.rsiData.length > 0) {
    rsiSeries.setData(props.rsiData)
  }
  
  // Add overbought/oversold lines as markers using createPriceLine
  if (rsiSeries) {
    rsiSeries.createPriceLine({
      price: 70,
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Overbought'
    })
    
    rsiSeries.createPriceLine({
      price: 30,
      color: '#10b981',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Oversold'
    })
    
    rsiSeries.createPriceLine({
      price: 50,
      color: '#64748b',
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: false
    })
  }
}

const createMACDSeries = () => {
  if (!chart) return
  
  // Histogram
  histogramSeries = chart.addHistogramSeries({
    priceScaleId: 'right',
    priceFormat: { type: 'price' }
  })
  
  // MACD line
  macdLineSeries = chart.addLineSeries({
    color: '#3b82f6',
    lineWidth: 2,
    priceScaleId: 'right',
    title: 'MACD'
  })
  
  // Signal line
  signalLineSeries = chart.addLineSeries({
    color: '#f97316',
    lineWidth: 1,
    lineStyle: 1,
    priceScaleId: 'right',
    title: 'Signal'
  })
  
  updateMACDData()
}

const updateMACDData = () => {
  if (props.macdData.histogram?.length > 0 && histogramSeries) {
    histogramSeries.setData(props.macdData.histogram)
  }
  
  if (props.macdData.macd?.length > 0 && macdLineSeries) {
    macdLineSeries.setData(props.macdData.macd)
  }
  
  if (props.macdData.signal?.length > 0 && signalLineSeries) {
    signalLineSeries.setData(props.macdData.signal)
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
    rsiSeries = null
    macdLineSeries = null
    signalLineSeries = null
    histogramSeries = null
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
  if (props.type === 'rsi' && rsiSeries && props.rsiData.length > 0) {
    rsiSeries.setData(props.rsiData)
  } else if (props.type === 'macd') {
    updateMACDData()
  }
  
  if (chart) {
    chart.timeScale().fitContent()
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
watch(() => props.type, () => initChart())

// Watch for RSI data changes - reinit chart if data arrives and series has no data
watch(() => props.rsiData, (newData, oldData) => {
  if (props.type === 'rsi') {
    // If chart exists and we had no data before but now have data, reinit
    if ((!oldData || oldData.length === 0) && newData && newData.length > 0) {
      initChart()
    } else {
      updateData()
    }
  }
}, { deep: true })

// Watch for MACD data changes - reinit chart if data arrives and series has no data
watch(() => props.macdData, (newData, oldData) => {
  if (props.type === 'macd') {
    const hadData = oldData && oldData.macd && oldData.macd.length > 0
    const hasData = newData && newData.macd && newData.macd.length > 0
    // If chart exists and we had no data before but now have data, reinit
    if (!hadData && hasData) {
      initChart()
    } else {
      updateData()
    }
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
  fitContent: () => chart?.timeScale().fitContent()
})
</script>

<template>
  <div class="oscillator-panel">
    <!-- Header -->
    <div class="oscillator-header">
      <span class="text-xs font-medium text-text-secondary uppercase tracking-wide">
        {{ type === 'rsi' ? 'RSI (14)' : 'MACD (12, 26, 9)' }}
      </span>
    </div>
    
    <!-- Chart container -->
    <div 
      ref="chartContainer" 
      class="oscillator-chart"
      :style="{ height: `${height}px` }"
    ></div>
    
    <!-- Empty state -->
    <div 
      v-if="(type === 'rsi' && rsiData.length === 0) || (type === 'macd' && macdData.macd?.length === 0)" 
      class="oscillator-empty"
    >
      <p class="text-text-secondary text-xs">No data available</p>
    </div>
  </div>
</template>

<style scoped>
.oscillator-panel {
  position: relative;
  width: 100%;
  border-top: 1px solid #e5e7eb;
}

:deep(.dark) .oscillator-panel,
.dark .oscillator-panel {
  border-top-color: #2b2f3a;
}

.oscillator-header {
  padding: 0.5rem 1rem;
  background: linear-gradient(to right, rgba(139, 92, 246, 0.1), transparent);
  border-bottom: 1px solid #f3f4f6;
}

:deep(.dark) .oscillator-header,
.dark .oscillator-header {
  border-bottom-color: rgba(43, 47, 58, 0.5);
}

.oscillator-chart {
  width: 100%;
}

.oscillator-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
