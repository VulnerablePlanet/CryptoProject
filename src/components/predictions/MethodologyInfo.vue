<script setup>
/**
 * MethodologyInfo Component
 * Informational panel explaining the prediction methodology
 */

const props = defineProps({
  noiseReduction: {
    type: Number,
    default: 0
  },
  model: {
    type: String,
    default: 'kalman+transformer'
  },
  dataPoints: {
    type: Number,
    default: 0
  }
})
</script>

<template>
  <div class="methodology-info bg-gradient-to-br from-slate-50 to-slate-100 dark:from-card-dark dark:to-background-dark border border-gray-200 dark:border-border-dark rounded-xl p-4">
    <div class="flex items-start gap-3">
      <span class="material-symbols-outlined text-primary text-2xl flex-shrink-0">
        psychology
      </span>
      <div class="flex-1">
        <h3 class="font-semibold text-slate-900 dark:text-white mb-2">
          Prediction Methodology
        </h3>
        <div class="space-y-2 text-sm text-text-secondary">
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-secondary text-base mt-0.5">filter_alt</span>
            <div>
              <strong class="text-slate-700 dark:text-slate-300">Kalman Filter:</strong>
              Reduces market noise using recursive Bayesian estimation. 
              <span v-if="noiseReduction > 0" class="text-success font-medium">
                {{ noiseReduction.toFixed(1) }}% noise reduction achieved
              </span>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-secondary text-base mt-0.5">hub</span>
            <div>
              <strong class="text-slate-700 dark:text-slate-300">Transformer Model:</strong>
              Uses self-attention mechanism to capture long-range dependencies and pattern recognition in price movements.
            </div>
          </div>
          <div class="flex items-start gap-2">
            <span class="material-symbols-outlined text-secondary text-base mt-0.5">timeline</span>
            <div>
              <strong class="text-slate-700 dark:text-slate-300">Combined Forecast:</strong>
              Weighted ensemble of Kalman (short-term accuracy) and Transformer (pattern detection) predictions.
            </div>
          </div>
        </div>
        
        <!-- Stats -->
        <div class="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-200 dark:border-border-dark">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-text-secondary text-sm">database</span>
            <span class="text-xs text-text-secondary">{{ dataPoints }} data points</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-text-secondary text-sm">memory</span>
            <span class="text-xs text-text-secondary">{{ model }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-text-secondary text-sm">speed</span>
            <span class="text-xs text-text-secondary">Real-time processing</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.methodology-info {
  transition: box-shadow 0.2s ease;
}

.methodology-info:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
</style>
