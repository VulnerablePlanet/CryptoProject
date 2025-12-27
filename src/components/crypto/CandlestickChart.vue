<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const props = defineProps({
  candles: {
    type: Array,
    default: () => []
  },
  height: {
    type: Number,
    default: 400
  },
  showVolume: {
    type: Boolean,
    default: true
  },
  indicators: {
    type: Object,
    default: () => ({})
  }
})

const svgRef = ref(null)
const hoveredCandle = ref(null)
const viewportStart = ref(0)
const candlesPerView = ref(50)

// Exchange rate USD to COP (Colombian Peso)
// Can be updated dynamically or fetched from an external API
const copRate = ref(4400)

// Chart dimensions
const chartWidth = 1000
const chartPadding = { top: 20, right: 60, bottom: 40, left: 10 }
const volumeHeight = props.showVolume ? 60 : 0

// Visible candles based on viewport
const visibleCandles = computed(() => {
  const start = Math.max(0, props.candles.length - candlesPerView.value - viewportStart.value)
  const end = props.candles.length - viewportStart.value
  return props.candles.slice(start, end)
})

// Price range for visible candles
const priceRange = computed(() => {
  if (visibleCandles.value.length === 0) return { min: 0, max: 0, range: 1 }
  
  const highs = visibleCandles.value.map(c => c.high)
  const lows = visibleCandles.value.map(c => c.low)
  const max = Math.max(...highs)
  const min = Math.min(...lows)
  const padding = (max - min) * 0.1
  
  return {
    min: min - padding,
    max: max + padding,
    range: (max - min + padding * 2) || 1
  }
})

// Volume range
const volumeRange = computed(() => {
  if (!props.showVolume || visibleCandles.value.length === 0) return { max: 1 }
  const volumes = visibleCandles.value.map(c => c.volume || 0)
  return { max: Math.max(...volumes) || 1 }
})

// Chart height calculations
const mainChartHeight = computed(() => {
  return props.height - chartPadding.top - chartPadding.bottom - volumeHeight
})

// Price to Y coordinate
const priceToY = (price) => {
  const ratio = (price - priceRange.value.min) / priceRange.value.range
  return chartPadding.top + mainChartHeight.value * (1 - ratio)
}

// Calculate candlestick positions
const candlesticks = computed(() => {
  if (visibleCandles.value.length === 0) return []
  
  const availableWidth = chartWidth - chartPadding.left - chartPadding.right
  const candleWidth = availableWidth / candlesPerView.value
  const bodyWidth = candleWidth * 0.7
  const wickWidth = 1
  
  return visibleCandles.value.map((candle, index) => {
    const x = chartPadding.left + index * candleWidth + candleWidth / 2
    
    // Determine if bullish: if open != close, use traditional logic
    // If open == close, compare with previous candle's close
    let isBullish
    if (candle.close !== candle.open) {
      isBullish = candle.close > candle.open
    } else {
      // When open = close (flat candle), compare with previous close
      const prevCandle = index > 0 ? visibleCandles.value[index - 1] : null
      isBullish = prevCandle ? candle.close >= prevCandle.close : true
    }
    
    return {
      data: candle,
      x,
      bodyX: x - bodyWidth / 2,
      bodyWidth,
      bodyTop: priceToY(Math.max(candle.open, candle.close)),
      bodyHeight: Math.max(4, Math.abs(priceToY(candle.open) - priceToY(candle.close))),
      wickTop: priceToY(candle.high),
      wickBottom: priceToY(candle.low),
      wickX: x,
      wickWidth,
      isBullish,
      color: isBullish ? '#0bda5b' : '#ef4444',
      // Volume bar
      volumeHeight: props.showVolume 
        ? ((candle.volume || 0) / volumeRange.value.max) * volumeHeight * 0.8
        : 0,
      volumeY: props.height - chartPadding.bottom - ((candle.volume || 0) / volumeRange.value.max) * volumeHeight * 0.8
    }
  })
})

// Price labels on Y axis
const priceLabels = computed(() => {
  const labels = []
  const steps = 5
  const { min, max, range } = priceRange.value
  
  for (let i = 0; i <= steps; i++) {
    const price = min + (range * i) / steps
    labels.push({
      price,
      y: priceToY(price),
      label: formatPrice(price)
    })
  }
  return labels
})

// Time labels on X axis
const timeLabels = computed(() => {
  if (visibleCandles.value.length === 0) return []
  
  const labels = []
  const step = Math.ceil(visibleCandles.value.length / 6)
  
  for (let i = 0; i < visibleCandles.value.length; i += step) {
    const candle = visibleCandles.value[i]
    const x = chartPadding.left + (i / candlesPerView.value) * (chartWidth - chartPadding.left - chartPadding.right) + 
              ((chartWidth - chartPadding.left - chartPadding.right) / candlesPerView.value) / 2
    
    labels.push({
      x,
      label: formatTime(candle.timestamp)
    })
  }
  return labels
})

// Format helpers
const formatPrice = (price) => {
  if (!price || isNaN(price)) return '$0'
  if (price >= 1000) {
    return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

const formatPriceCOP = (price) => {
  if (!price || isNaN(price)) return 'COP $0'
  const cop = price * copRate.value
  return 'COP $' + cop.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString()
}

const formatVolume = (vol) => {
  if (!vol) return '0'
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B'
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M'
  if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K'
  return vol.toFixed(0)
}

// Mouse interactions
const handleMouseMove = (event) => {
  if (!svgRef.value) return
  
  const rect = svgRef.value.getBoundingClientRect()
  const mouseX = ((event.clientX - rect.left) / rect.width) * chartWidth
  
  // Find closest candle
  let closest = null
  let minDist = Infinity
  
  for (const cs of candlesticks.value) {
    const dist = Math.abs(mouseX - cs.x)
    if (dist < minDist) {
      minDist = dist
      closest = cs
    }
  }
  
  if (closest && minDist < 30) {
    hoveredCandle.value = closest
  } else {
    hoveredCandle.value = null
  }
}

const handleMouseLeave = () => {
  hoveredCandle.value = null
}

// Scroll/zoom handlers
const handleWheel = (event) => {
  event.preventDefault()
  
  if (event.ctrlKey) {
    // Zoom
    candlesPerView.value = Math.max(20, Math.min(100, candlesPerView.value + (event.deltaY > 0 ? 5 : -5)))
  } else {
    // Scroll
    const maxScroll = Math.max(0, props.candles.length - candlesPerView.value)
    viewportStart.value = Math.max(0, Math.min(maxScroll, viewportStart.value + (event.deltaY > 0 ? -3 : 3)))
  }
}

// Current price info
const currentCandle = computed(() => {
  if (hoveredCandle.value) return hoveredCandle.value.data
  if (props.candles.length === 0) return null
  return props.candles[props.candles.length - 1]
})

const priceChange = computed(() => {
  if (!currentCandle.value) return 0
  return ((currentCandle.value.close - currentCandle.value.open) / currentCandle.value.open) * 100
})
</script>

<template>
  <div class="candlestick-chart">
    <!-- Chart Info Bar -->
    <div class="flex flex-col gap-1 px-4 py-2 border-b border-gray-200 dark:border-border-dark">
      <!-- USD Row -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4 text-sm">
          <span class="text-text-secondary">O: <span class="font-mono text-slate-900 dark:text-white">{{ formatPrice(currentCandle?.open) }}</span></span>
          <span class="text-text-secondary">H: <span class="font-mono text-success">{{ formatPrice(currentCandle?.high) }}</span></span>
          <span class="text-text-secondary">L: <span class="font-mono text-danger">{{ formatPrice(currentCandle?.low) }}</span></span>
          <span class="text-text-secondary">C: <span class="font-mono text-slate-900 dark:text-white">{{ formatPrice(currentCandle?.close) }}</span></span>
          <span class="text-text-secondary">V: <span class="font-mono text-slate-900 dark:text-white">{{ formatVolume(currentCandle?.volume) }}</span></span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-lg font-bold font-mono text-slate-900 dark:text-white">
            {{ formatPrice(currentCandle?.close) }}
          </span>
          <span 
            class="text-sm font-bold px-2 py-0.5 rounded"
            :class="priceChange >= 0 ? 'text-success bg-success/10' : 'text-danger bg-danger/10'"
          >
            {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
          </span>
        </div>
      </div>
      <!-- COP Row -->
      <div class="flex items-center justify-between text-xs opacity-70">
        <div class="flex items-center gap-3">
          <span class="text-yellow-600 dark:text-yellow-400">🇨🇴 COP</span>
          <span class="text-text-secondary">O: <span class="font-mono">{{ formatPriceCOP(currentCandle?.open) }}</span></span>
          <span class="text-text-secondary">C: <span class="font-mono">{{ formatPriceCOP(currentCandle?.close) }}</span></span>
        </div>
        <span class="font-mono text-yellow-600 dark:text-yellow-400 text-sm">
          {{ formatPriceCOP(currentCandle?.close) }}
        </span>
      </div>
    </div>
    
    <!-- SVG Chart -->
    <svg
      ref="svgRef"
      class="w-full cursor-crosshair"
      :viewBox="`0 0 ${chartWidth} ${height}`"
      preserveAspectRatio="none"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @wheel="handleWheel"
    >
      <!-- Grid Lines -->
      <g class="grid">
        <!-- Horizontal lines -->
        <line
          v-for="label in priceLabels"
          :key="'h-' + label.price"
          :x1="chartPadding.left"
          :y1="label.y"
          :x2="chartWidth - chartPadding.right"
          :y2="label.y"
          stroke="currentColor"
          stroke-opacity="0.1"
          stroke-dasharray="4 4"
        />
      </g>
      
      <!-- Volume Bars -->
      <g v-if="showVolume" class="volume-bars">
        <rect
          v-for="(cs, i) in candlesticks"
          :key="'vol-' + i"
          :x="cs.bodyX"
          :y="cs.volumeY"
          :width="cs.bodyWidth"
          :height="cs.volumeHeight"
          :fill="cs.color"
          fill-opacity="0.3"
        />
      </g>
      
      <!-- Candlesticks -->
      <g class="candlesticks">
        <g v-for="(cs, i) in candlesticks" :key="'candle-' + i">
          <!-- Wick -->
          <line
            :x1="cs.wickX"
            :y1="cs.wickTop"
            :x2="cs.wickX"
            :y2="cs.wickBottom"
            :stroke="cs.color"
            :stroke-width="cs.wickWidth"
          />
          <!-- Body -->
          <rect
            :x="cs.bodyX"
            :y="cs.bodyTop"
            :width="cs.bodyWidth"
            :height="cs.bodyHeight"
            :fill="cs.color"
            :stroke="cs.color"
            stroke-width="1"
          />
        </g>
      </g>
      
      <!-- Price Labels (Y Axis) -->
      <g class="y-axis">
        <text
          v-for="label in priceLabels"
          :key="'price-' + label.price"
          :x="chartWidth - chartPadding.right + 5"
          :y="label.y + 4"
          font-size="10"
          fill="currentColor"
          fill-opacity="0.5"
        >
          {{ label.label }}
        </text>
      </g>
      
      <!-- Time Labels (X Axis) -->
      <g class="x-axis">
        <text
          v-for="(label, i) in timeLabels"
          :key="'time-' + i"
          :x="label.x"
          :y="height - chartPadding.bottom + 15"
          font-size="10"
          fill="currentColor"
          fill-opacity="0.5"
          text-anchor="middle"
        >
          {{ label.label }}
        </text>
      </g>
      
      <!-- Hover Crosshair -->
      <g v-if="hoveredCandle">
        <!-- Vertical line -->
        <line
          :x1="hoveredCandle.x"
          :y1="chartPadding.top"
          :x2="hoveredCandle.x"
          :y2="height - chartPadding.bottom"
          stroke="#888"
          stroke-width="1"
          stroke-dasharray="4 4"
          opacity="0.5"
        />
        <!-- Horizontal line -->
        <line
          :x1="chartPadding.left"
          :y1="priceToY(hoveredCandle.data.close)"
          :x2="chartWidth - chartPadding.right"
          :y2="priceToY(hoveredCandle.data.close)"
          stroke="#888"
          stroke-width="1"
          stroke-dasharray="4 4"
          opacity="0.5"
        />
        <!-- Price tag -->
        <rect
          :x="chartWidth - chartPadding.right"
          :y="priceToY(hoveredCandle.data.close) - 10"
          width="55"
          height="20"
          :fill="hoveredCandle.isBullish ? '#0bda5b' : '#ef4444'"
          rx="3"
        />
        <text
          :x="chartWidth - chartPadding.right + 27"
          :y="priceToY(hoveredCandle.data.close) + 4"
          font-size="10"
          fill="white"
          text-anchor="middle"
        >
          {{ formatPrice(hoveredCandle.data.close) }}
        </text>
      </g>
    </svg>
    
    <!-- Hover Tooltip -->
    <div 
      v-if="hoveredCandle"
      class="absolute top-20 left-4 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-lg shadow-lg p-3 text-xs z-10"
    >
      <p class="text-text-secondary mb-2">{{ formatDateTime(hoveredCandle.data.timestamp) }}</p>
      <!-- USD Prices -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
        <span class="text-text-secondary">Open:</span>
        <span class="font-mono text-right">{{ formatPrice(hoveredCandle.data.open) }}</span>
        <span class="text-text-secondary">High:</span>
        <span class="font-mono text-success text-right">{{ formatPrice(hoveredCandle.data.high) }}</span>
        <span class="text-text-secondary">Low:</span>
        <span class="font-mono text-danger text-right">{{ formatPrice(hoveredCandle.data.low) }}</span>
        <span class="text-text-secondary">Close:</span>
        <span class="font-mono text-right">{{ formatPrice(hoveredCandle.data.close) }}</span>
        <span class="text-text-secondary">Volume:</span>
        <span class="font-mono text-right">{{ formatVolume(hoveredCandle.data.volume) }}</span>
      </div>
      <!-- COP Prices -->
      <div class="pt-2 border-t border-gray-200 dark:border-border-dark">
        <p class="text-yellow-600 dark:text-yellow-400 font-bold mb-1">🇨🇴 COP</p>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-yellow-600 dark:text-yellow-400">
          <span>Open:</span>
          <span class="font-mono text-right">{{ formatPriceCOP(hoveredCandle.data.open) }}</span>
          <span>Close:</span>
          <span class="font-mono text-right">{{ formatPriceCOP(hoveredCandle.data.close) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.candlestick-chart {
  position: relative;
  width: 100%;
  background: inherit;
}

svg {
  display: block;
}
</style>
