<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  data: {
    type: [Array, Object],
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  height: {
    type: Number,
    default: 300
  },
  showToolbar: {
    type: Boolean,
    default: true
  },
  color: {
    type: String,
    default: '#137fec'
  },
  fillOpacity: {
    type: Number,
    default: 0.2
  },
  copRate: {
    type: Number,
    default: 4400
  }
})

const emit = defineEmits(['timeframe-change'])

const timeframes = [
  { label: '1H', value: '0.041666' },
  { label: '1D', value: '1' },
  { label: '1W', value: '7' },
  { label: '1M', value: '30' },
  { label: '3M', value: '90' },
  { label: '1Y', value: '365' },
]

const activeTimeframe = ref('7')
const hoveredPoint = ref(null)
const svgRef = ref(null)

// Extract prices from data (handles both array and CoinGecko object format)
const prices = computed(() => {
  if (!props.data) return []
  
  // If it's a CoinGecko chart response with prices array
  if (props.data && typeof props.data === 'object' && !Array.isArray(props.data)) {
    if (props.data.prices) {
      return props.data.prices.map(([timestamp, price]) => ({ timestamp, price }))
    }
    return []
  }
  
  // If it's already an array of prices (sparkline format)
  if (Array.isArray(props.data)) {
    return props.data.map((price, index) => ({ timestamp: index, price }))
  }
  
  return []
})

// Calculate chart path
const chartPath = computed(() => {
  if (prices.value.length < 2) return { line: '', area: '', points: [] }
  
  // Filter out any invalid values
  const validPrices = prices.value.filter(p => 
    p && typeof p.price === 'number' && !isNaN(p.price) && isFinite(p.price)
  )
  
  if (validPrices.length < 2) return { line: '', area: '', points: [] }
  
  const values = validPrices.map(p => p.price)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  
  const width = 1000
  const height = props.height - 40 // Leave room for labels
  const padding = 10
  
  const points = values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    // Ensure valid numbers
    return { 
      x: isNaN(x) ? padding : x, 
      y: isNaN(y) ? height / 2 : y, 
      value 
    }
  })
  
  // Create line path
  const linePath = points.map((p, i) => {
    if (i === 0) return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
    
    // Use smooth curves
    const prev = points[i - 1]
    const cp1x = prev.x + (p.x - prev.x) / 3
    const cp1y = prev.y
    const cp2x = prev.x + (p.x - prev.x) * 2 / 3
    const cp2y = p.y
    return `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
  }).join(' ')
  
  // Create area path (close to bottom)
  const lastPoint = points[points.length - 1]
  const firstPoint = points[0]
  const areaPath = linePath + ` L ${lastPoint.x.toFixed(2)} ${(height - padding).toFixed(2)} L ${firstPoint.x.toFixed(2)} ${(height - padding).toFixed(2)} Z`
  
  return { line: linePath, area: areaPath, points }
})

// Current price and change
const currentPrice = computed(() => {
  if (prices.value.length === 0) return 0
  return prices.value[prices.value.length - 1].price
})

const priceChange = computed(() => {
  if (prices.value.length < 2) return 0
  const first = prices.value[0].price
  const last = prices.value[prices.value.length - 1].price
  return ((last - first) / first) * 100
})

const isPositive = computed(() => priceChange.value >= 0)

const chartColor = computed(() => {
  if (props.color !== '#137fec') return props.color
  return isPositive.value ? '#0bda5b' : '#ef4444'
})

const formatPrice = (price) => {
  if (price >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  }).format(price)
}

const formatCOP = (price) => {
  const cop = price * props.copRate
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cop)
}

const handleTimeframeChange = (tf) => {
  activeTimeframe.value = tf.value
  emit('timeframe-change', tf.value)
}

const handleMouseMove = (event) => {
  if (!svgRef.value || !chartPath.value.points) return
  
  const rect = svgRef.value.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * 1000
  
  // Find closest point
  const points = chartPath.value.points
  let closest = points[0]
  let minDist = Math.abs(x - closest.x)
  
  for (const point of points) {
    const dist = Math.abs(x - point.x)
    if (dist < minDist) {
      minDist = dist
      closest = point
    }
  }
  
  hoveredPoint.value = closest
}

const handleMouseLeave = () => {
  hoveredPoint.value = null
}
</script>

<template>
  <div class="chart-wrapper rounded-xl overflow-hidden bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark">
    <!-- Toolbar -->
    <div v-if="showToolbar" class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-border-dark">
      <div class="flex gap-1">
        <button
          v-for="tf in timeframes"
          :key="tf.value"
          @click="handleTimeframeChange(tf)"
          class="px-3 py-1.5 text-xs font-bold rounded transition-colors"
          :class="activeTimeframe === tf.value 
            ? 'bg-primary text-white' 
            : 'text-slate-500 dark:text-text-secondary hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'"
        >
          {{ tf.label }}
        </button>
      </div>
      
      <!-- Current Price Display -->
      <div class="flex items-center gap-3">
        <div class="flex flex-col items-end">
          <span class="text-lg font-bold text-slate-900 dark:text-white font-mono">
            {{ formatPrice(hoveredPoint?.value || currentPrice) }}
          </span>
          <span class="text-yellow-600 dark:text-yellow-400 text-xs font-mono">
            🇨🇴 {{ formatCOP(hoveredPoint?.value || currentPrice) }}
          </span>
        </div>
        <span 
          class="text-sm font-bold px-2 py-0.5 rounded"
          :class="isPositive ? 'text-success bg-success/10' : 'text-danger bg-danger/10'"
        >
          {{ isPositive ? '+' : '' }}{{ priceChange.toFixed(2) }}%
        </span>
      </div>
    </div>
    
    <!-- Chart Container -->
    <div class="relative" :style="{ height: `${height}px` }">
      <!-- Loading Overlay -->
      <div 
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-card-dark/80 z-10"
      >
        <div class="animate-spin rounded-full size-8 border-2 border-primary border-t-transparent"></div>
      </div>
      
      <!-- Empty State -->
      <div 
        v-else-if="prices.length === 0"
        class="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-text-secondary"
      >
        <div class="text-center">
          <span class="material-symbols-outlined text-4xl mb-2">show_chart</span>
          <p class="text-sm">No chart data available</p>
        </div>
      </div>
      
      <!-- SVG Chart -->
      <svg 
        v-else
        ref="svgRef"
        class="w-full h-full cursor-crosshair"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
      >
        <defs>
          <linearGradient :id="'chartGradient-' + $.uid" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" :stop-color="chartColor" :stop-opacity="fillOpacity" />
            <stop offset="100%" :stop-color="chartColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        
        <!-- Grid lines -->
        <g class="grid-lines" stroke="currentColor" stroke-opacity="0.1">
          <line x1="0" y1="60" x2="1000" y2="60" />
          <line x1="0" y1="120" x2="1000" y2="120" />
          <line x1="0" y1="180" x2="1000" y2="180" />
          <line x1="0" y1="240" x2="1000" y2="240" />
        </g>
        
        <!-- Area fill -->
        <path 
          :d="chartPath.area" 
          :fill="`url(#chartGradient-${$.uid})`"
        />
        
        <!-- Line -->
        <path 
          :d="chartPath.line" 
          fill="none" 
          :stroke="chartColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        
        <!-- Hover point -->
        <g v-if="hoveredPoint">
          <line 
            :x1="hoveredPoint.x" 
            y1="0" 
            :x2="hoveredPoint.x" 
            y2="300"
            :stroke="chartColor"
            stroke-width="1"
            stroke-dasharray="4 4"
            opacity="0.5"
          />
          <circle 
            :cx="hoveredPoint.x" 
            :cy="hoveredPoint.y" 
            r="6" 
            :fill="chartColor"
            stroke="white"
            stroke-width="2"
          />
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.chart-wrapper {
  --chart-transition: all 0.2s ease;
  width: 100%;
  height: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

svg {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
</style>

