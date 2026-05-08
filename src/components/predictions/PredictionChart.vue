<script setup>
/**
 * PredictionChart Component
 * TradingView Lightweight Charts wrapper for prediction visualization
 * 
 * Features:
 * - Candlestick chart for OHLCV data
 * - Line series for Kalman filtered signal
 * - Area series for prediction confidence zone
 * - Line series for predicted prices
 */

import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { createChart } from 'lightweight-charts'
import { logger } from '@/utils/logger'

const props = defineProps({
  candlestickData: {
    type: Array,
    default: () => []
  },
  kalmanData: {
    type: Array,
    default: () => []
  },
  predictionData: {
    type: Array,
    default: () => []
  },
  confidenceData: {
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
  initialChartState: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['crosshairMove', 'visible-range-change'])

// Refs
const chartContainer = ref(null)
let chart = null
let candlestickSeries = null
let kalmanSeries = null
let predictionSeries = null

// Flag to skip fitContent when restoring saved state
let hasRestoredState = false
// Flag to track if this is the first time data is loaded
let isFirstDataLoad = true
// Flag to block state change emissions during restoration
let isRestoringState = false
// User's locked barSpacing - set after user zooms manually, prevents auto-resize
let userLockedBarSpacing = null
let confidenceUpperSeries = null
let confidenceLowerSeries = null
let volumeSeries = null

// Chart colors
const colors = {
  background: '#ffffff',
  backgroundDark: '#1e293b',
  textColor: '#64748b',
  gridColor: '#e2e8f0',
  gridColorDark: '#334155',
  kalman: '#8b5cf6',      // Purple for Kalman line
  prediction: '#06b6d4',   // Cyan for prediction
  confidenceUp: 'rgba(6, 182, 212, 0.15)',
  confidenceDown: 'rgba(6, 182, 212, 0.15)',
  upColor: '#10b981',      // Green
  downColor: '#ef4444',    // Red
  volumeUp: 'rgba(16, 185, 129, 0.3)',
  volumeDown: 'rgba(239, 68, 68, 0.3)'
}

// Check if dark mode
function isDarkMode() {
  return document.documentElement.classList.contains('dark')
}

// Create chart
function createChartInstance() {
  if (!chartContainer.value) return
  
  const dark = isDarkMode()
  
  chart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: props.height,
    layout: {
      background: { type: 'solid', color: dark ? colors.backgroundDark : colors.background },
      textColor: colors.textColor
    },
    grid: {
      vertLines: { color: dark ? colors.gridColorDark : colors.gridColor },
      horzLines: { color: dark ? colors.gridColorDark : colors.gridColor }
    },
    crosshair: {
      mode: 1, // Magnet mode
      vertLine: {
        width: 1,
        color: 'rgba(99, 102, 241, 0.5)',
        style: 2
      },
      horzLine: {
        width: 1,
        color: 'rgba(99, 102, 241, 0.5)',
        style: 2
      }
    },
    rightPriceScale: {
      borderColor: dark ? colors.gridColorDark : colors.gridColor,
      scaleMargins: {
        top: 0.1,
        bottom: props.showVolume ? 0.25 : 0.1
      }
    },
    timeScale: {
      borderColor: dark ? colors.gridColorDark : colors.gridColor,
      timeVisible: true,
      secondsVisible: false,
      minBarSpacing: 0.5,       // Minimum zoom out level (prevents infinite zoom out)
      rightOffset: 50,          // Space for prediction line (increased to 50 bars to the right)
      shiftVisibleRangeOnNewBar: false,  // Don't auto-shift when new data arrives
      lockVisibleTimeRangeOnResize: true // Keep current view when chart resizes
    },
    handleScroll: {
      vertTouchDrag: false
    }
  })
  
  // Candlestick series (main price data)
  candlestickSeries = chart.addCandlestickSeries({
    upColor: colors.upColor,
    downColor: colors.downColor,
    borderUpColor: colors.upColor,
    borderDownColor: colors.downColor,
    wickUpColor: colors.upColor,
    wickDownColor: colors.downColor
  })
  
  // Kalman filtered line (purple)
  kalmanSeries = chart.addLineSeries({
    color: colors.kalman,
    lineWidth: 2,
    lineStyle: 0, // Solid
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
    lastValueVisible: true,
    priceLineVisible: false,
    title: 'Kalman'
  })
  
  // Prediction line (cyan, dashed)
  predictionSeries = chart.addLineSeries({
    color: colors.prediction,
    lineWidth: 2,
    lineStyle: 2, // Dashed
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4,
    lastValueVisible: true,
    priceLineVisible: false,
    title: 'Prediction'
  })
  
  // Confidence area (upper bound)
  confidenceUpperSeries = chart.addAreaSeries({
    topColor: colors.confidenceUp,
    bottomColor: 'rgba(6, 182, 212, 0)',
    lineColor: 'rgba(6, 182, 212, 0.3)',
    lineWidth: 1,
    lineStyle: 2,
    crosshairMarkerVisible: false,
    lastValueVisible: false,
    priceLineVisible: false
  })
  
  // Confidence area (lower bound)
  confidenceLowerSeries = chart.addAreaSeries({
    topColor: 'rgba(6, 182, 212, 0)',
    bottomColor: colors.confidenceDown,
    lineColor: 'rgba(6, 182, 212, 0.3)',
    lineWidth: 1,
    lineStyle: 2,
    crosshairMarkerVisible: false,
    lastValueVisible: false,
    priceLineVisible: false
  })
  
  // Volume series (if enabled)
  if (props.showVolume) {
    volumeSeries = chart.addHistogramSeries({
      color: colors.volumeUp,
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    })
    
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    })
  }
  
  // Crosshair move handler
  chart.subscribeCrosshairMove((param) => {
    if (param.point) {
      const data = {
        time: param.time,
        point: param.point,
        candlestick: param.seriesData.get(candlestickSeries),
        kalman: param.seriesData.get(kalmanSeries),
        prediction: param.seriesData.get(predictionSeries)
      }
      emit('crosshairMove', data)
    }
  })
  
  // Subscribe to visible TIME range changes (zoom/pan)
  // Use time-based range for reliable state restoration across sessions
  chart.timeScale().subscribeVisibleTimeRangeChange((visibleRange) => {
    // Skip emissions during restoration to prevent overwriting saved state
    if (isRestoringState) {
      logger.debug('📊 [PredictionChart] Skipping state emit during restoration')
      return
    }
    
    // visibleRange can be null when chart has no data
    if (visibleRange !== null && chart) {
      const timeScale = chart.timeScale()
      const options = timeScale.options()
      
      // Gather complete chart state using TIME-based range
      const chartState = {
        visibleRange: {
          from: visibleRange.from,  // Timestamp
          to: visibleRange.to       // Timestamp
        },
        barSpacing: options.barSpacing,
        rightOffset: options.rightOffset,
        scrollPosition: timeScale.scrollPosition()
      }
      
      logger.debug('📊 [PredictionChart] Chart state changed:', chartState)
      emit('visible-range-change', chartState)
    }
  })
  
  // Initial data update
  updateChartData()
}

// Update chart data
function updateChartData() {
  if (!chart) return
  
  // Update candlestick data
  if (props.candlestickData.length > 0) {
    candlestickSeries.setData(props.candlestickData)
    
    // Update volume if enabled
    if (volumeSeries && props.candlestickData.length > 0) {
      const volumeData = props.candlestickData.map(candle => ({
        time: candle.time,
        value: candle.volume || 0,
        color: candle.close >= candle.open ? colors.volumeUp : colors.volumeDown
      }))
      volumeSeries.setData(volumeData)
    }
  }
  
  // Update Kalman data
  if (props.kalmanData.length > 0) {
    kalmanSeries.setData(props.kalmanData)
  }
  
  // Update prediction data
  if (props.predictionData.length > 0) {
    predictionSeries.setData(props.predictionData)
  }
  
  // Update confidence zone
  if (props.confidenceData.length > 0) {
    const upperData = props.confidenceData.map(d => ({
      time: d.time,
      value: d.upper
    }))
    const lowerData = props.confidenceData.map(d => ({
      time: d.time,
      value: d.lower
    }))
    confidenceUpperSeries.setData(upperData)
    confidenceLowerSeries.setData(lowerData)
  }
  
  // Apply initial chart state ONLY on first data load
  // Subsequent data updates should NOT change the user's current view
  if (isFirstDataLoad) {
    isFirstDataLoad = false
    
    if (props.initialChartState && !hasRestoredState) {
      // Apply saved state instead of fitContent
      hasRestoredState = true
      isRestoringState = true  // Block emissions during initial state application
      logger.debug('📊 [PredictionChart] Applying initial state, blocking emissions')
      
      const state = props.initialChartState
      const timeScale = chart.timeScale()
      
      try {
        // Apply timeScale options first (barSpacing affects zoom level)
        if (state.barSpacing) {
          timeScale.applyOptions({
            barSpacing: state.barSpacing,
            rightOffset: state.rightOffset || 0
          })
          logger.debug('📊 [PredictionChart] Applied initial barSpacing:', state.barSpacing)
        }
        
        // Use time-based visible range for restoration (more reliable)
        if (state.visibleRange?.from !== undefined && state.visibleRange?.to !== undefined) {
          timeScale.setVisibleRange({
            from: state.visibleRange.from,
            to: state.visibleRange.to
          })
          logger.debug('📊 [PredictionChart] Applied visibleRange:', state.visibleRange)
        }
        // Fallback to logicalRange for legacy saved states
        else if (state.logicalRange?.from !== undefined && state.logicalRange?.to !== undefined) {
          timeScale.setVisibleLogicalRange({
            from: state.logicalRange.from,
            to: state.logicalRange.to
          })
          logger.debug('📊 [PredictionChart] Applied legacy logicalRange:', state.logicalRange)
        }
        
        logger.debug('📊 [PredictionChart] Applied initialChartState:', state)
        
        // Clear restoration flag after delay
        setTimeout(() => {
          isRestoringState = false
          logger.debug('📊 [PredictionChart] Initial state applied, emissions re-enabled')
        }, 1500)
      } catch (e) {
        logger.warn('📊 [PredictionChart] Could not apply initial state:', e.message)
        isRestoringState = false  // Re-enable on error
        // Fallback: scroll to real time to show latest candles
        chart.timeScale().scrollToRealTime()
      }
    } else if (!hasRestoredState) {
      // No saved state: show latest candles (not all content from the beginning)
      // Use scrollToRealTime to position at the most recent data
      chart.timeScale().scrollToRealTime()
    }
  }
  // After first load, data updates just update the data without changing the view
}

// Handle resize
function handleResize() {
  if (chart && chartContainer.value) {
    chart.applyOptions({
      width: chartContainer.value.clientWidth
    })
  }
}

// Expose methods to parent for saving/restoring complete chart state
defineExpose({
  /**
   * Set flag to skip fitContent when data updates (used for state restoration)
   */
  setSkipFitContent(skip) {
    hasRestoredState = skip
    logger.debug('📊 [PredictionChart] Skip fitContent set to:', skip)
  },
  
  /**
   * Set visible range using time values (legacy)
   */
  setVisibleRange(from, to) {
    if (chart && from && to) {
      try {
        chart.timeScale().setVisibleRange({ from, to })
      } catch (e) {
        logger.warn('Could not restore visible range:', e.message)
      }
    }
  },
  
  /**
   * Restore complete chart state (visible range, bar spacing)
   */
  restoreChartState(state) {
    if (!chart || !state) return
    
    // Set flags to prevent emissions and fitContent from overriding the restored state
    hasRestoredState = true
    isRestoringState = true
    logger.debug('📊 [PredictionChart] Starting state restoration, blocking emissions')
    
    const timeScale = chart.timeScale()
    
    try {
      // Apply timeScale options first (barSpacing affects zoom level)
      if (state.barSpacing) {
        timeScale.applyOptions({
          barSpacing: state.barSpacing,
          rightOffset: state.rightOffset || 0
        })
        logger.debug('📊 [PredictionChart] Applied barSpacing:', state.barSpacing)
      }
      
      // Use time-based visible range for restoration (more reliable)
      if (state.visibleRange?.from !== undefined && state.visibleRange?.to !== undefined) {
        timeScale.setVisibleRange({
          from: state.visibleRange.from,
          to: state.visibleRange.to
        })
        logger.debug('📊 [PredictionChart] Applied visibleRange:', state.visibleRange)
      }
      // Fallback to logicalRange for legacy saved states
      else if (state.logicalRange?.from !== undefined && state.logicalRange?.to !== undefined) {
        timeScale.setVisibleLogicalRange({
          from: state.logicalRange.from,
          to: state.logicalRange.to
        })
        logger.debug('📊 [PredictionChart] Applied legacy logicalRange:', state.logicalRange)
      }
      
      logger.debug('📊 [PredictionChart] Chart state restored:', state)
    } catch (e) {
      logger.warn('Could not restore chart state:', e.message)
    }
    
    // Restore price range (vertical axis) if available
    try {
      if (state.priceRange && candlestickSeries) {
        const priceScale = chart.priceScale('right')
        if (priceScale && state.priceRange.minValue !== undefined && state.priceRange.maxValue !== undefined) {
          // Set the visible price range
          priceScale.applyOptions({
            autoScale: false
          })
          candlestickSeries.applyOptions({
            autoscaleInfoProvider: () => ({
              priceRange: {
                minValue: state.priceRange.minValue,
                maxValue: state.priceRange.maxValue
              }
            })
          })
          logger.debug('📊 [PredictionChart] Restored price range:', state.priceRange)
        }
      }
    } catch (e) {
      logger.warn('Could not restore price range:', e.message)
    }
    
    // Clear restoration flag after a delay to allow chart to stabilize
    // This enables normal state emissions to resume after restoration
    setTimeout(() => {
      isRestoringState = false
      logger.debug('📊 [PredictionChart] Restoration complete, emissions re-enabled')
    }, 1500)
  },
  
  /**
   * Get current chart state for saving
   */
  getChartState() {
    if (!chart) return null
    
    const timeScale = chart.timeScale()
    const logicalRange = timeScale.getVisibleLogicalRange()
    const options = timeScale.options()
    
    // Get visible price range using coordinate conversion
    let priceRange = null
    try {
      if (candlestickSeries && chartContainer.value) {
        const chartHeight = chartContainer.value.clientHeight
        // Get price at top and bottom of visible chart area
        const topPrice = candlestickSeries.coordinateToPrice(0)
        const bottomPrice = candlestickSeries.coordinateToPrice(chartHeight)
        
        if (topPrice !== null && bottomPrice !== null) {
          priceRange = {
            minValue: Math.min(topPrice, bottomPrice),
            maxValue: Math.max(topPrice, bottomPrice)
          }
        }
      }
    } catch (e) {
      // Price range not available, continue without it
    }
    
    return {
      logicalRange: logicalRange ? {
        from: logicalRange.from,
        to: logicalRange.to
      } : null,
      barSpacing: options.barSpacing,
      rightOffset: options.rightOffset,
      scrollPosition: timeScale.scrollPosition(),
      priceRange: priceRange
    }
  }
})

// Watch for data changes
watch(
  () => [props.candlestickData, props.kalmanData, props.predictionData, props.confidenceData],
  () => {
    nextTick(() => updateChartData())
  },
  { deep: true }
)

// Watch for theme changes
const themeObserver = ref(null)

onMounted(() => {
  createChartInstance()
  window.addEventListener('resize', handleResize)
  
  // Watch for dark mode changes
  themeObserver.value = new MutationObserver(() => {
    if (chart) {
      const dark = isDarkMode()
      chart.applyOptions({
        layout: {
          background: { type: 'solid', color: dark ? colors.backgroundDark : colors.background }
        },
        grid: {
          vertLines: { color: dark ? colors.gridColorDark : colors.gridColor },
          horzLines: { color: dark ? colors.gridColorDark : colors.gridColor }
        }
      })
    }
  })
  
  themeObserver.value.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  
  if (themeObserver.value) {
    themeObserver.value.disconnect()
  }
  
  if (chart) {
    chart.remove()
    chart = null
  }
})
</script>

<template>
  <div class="prediction-chart">
    <div ref="chartContainer" class="chart-container rounded-lg overflow-hidden"></div>
    
    <!-- Legend -->
    <div class="chart-legend flex flex-wrap gap-4 mt-3 px-2">
      <div class="flex items-center gap-1.5">
        <span class="w-4 h-0.5 bg-[#10b981] rounded"></span>
        <span class="text-xs text-text-secondary">OHLC Price</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-4 h-0.5 bg-[#8b5cf6] rounded"></span>
        <span class="text-xs text-text-secondary">Kalman Filter</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-4 h-0.5 bg-[#06b6d4] rounded" style="border-style: dashed;"></span>
        <span class="text-xs text-text-secondary">Prediction</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-4 h-2 bg-[#06b6d4]/20 rounded"></span>
        <span class="text-xs text-text-secondary">Confidence Zone</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  width: 100%;
}

.chart-legend span[style*="dashed"] {
  border-top: 2px dashed #06b6d4;
  height: 0 !important;
}
</style>
