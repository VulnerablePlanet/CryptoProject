<script setup>
defineProps({
  activities: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const getTypeIcon = (type) => {
  const icons = {
    deposit: 'download',
    withdraw: 'upload',
    buy: 'add_circle',
    sell: 'remove_circle',
    transfer: 'swap_horiz'
  }
  return icons[type] || 'receipt_long'
}

const getTypeColor = (type) => {
  const colors = {
    deposit: 'text-success bg-success/10',
    withdraw: 'text-danger bg-danger/10',
    buy: 'text-success bg-success/10',
    sell: 'text-danger bg-danger/10',
    transfer: 'text-primary bg-primary/10'
  }
  return colors[type] || 'text-text-secondary bg-gray-100 dark:bg-border-dark'
}

const formatAmount = (amount, type) => {
  const prefix = ['deposit', 'buy'].includes(type) ? '+' : '-'
  return `${prefix}${amount}`
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 dark:border-border-dark flex justify-between items-center">
      <h3 class="font-bold text-slate-900 dark:text-white">Recent Activity</h3>
      <button class="text-sm text-primary hover:text-blue-400 font-medium">View All</button>
    </div>
    
    <!-- Activity List -->
    <div class="divide-y divide-gray-100 dark:divide-border-dark">
      <!-- Loading State -->
      <template v-if="loading">
        <div v-for="i in 3" :key="i" class="p-4">
          <div class="animate-pulse flex items-center gap-3">
            <div class="size-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
            <div class="flex-1">
              <div class="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
              <div class="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div class="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </template>
      
      <!-- Activity Items -->
      <template v-else-if="activities.length > 0">
        <div 
          v-for="activity in activities" 
          :key="activity.id"
          class="p-4 hover:bg-gray-50 dark:hover:bg-border-dark/30 transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-3">
            <div 
              class="size-10 rounded-full flex items-center justify-center"
              :class="getTypeColor(activity.type)"
            >
              <span class="material-symbols-outlined text-[20px]">{{ getTypeIcon(activity.type) }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-900 dark:text-white">{{ activity.title }}</p>
              <p class="text-xs text-slate-500 dark:text-text-secondary">{{ activity.time }}</p>
            </div>
            <div class="text-right">
              <p 
                class="text-sm font-bold font-mono"
                :class="['deposit', 'buy'].includes(activity.type) ? 'text-success' : 'text-danger'"
              >
                {{ formatAmount(activity.amount, activity.type) }}
              </p>
              <p class="text-xs text-slate-500 dark:text-text-secondary">{{ activity.asset }}</p>
            </div>
          </div>
        </div>
      </template>
      
      <!-- Empty State -->
      <div v-else class="p-8 text-center">
        <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-gray-600 mb-2">receipt_long</span>
        <p class="text-sm text-slate-500 dark:text-text-secondary">No recent activity</p>
      </div>
    </div>
  </div>
</template>
