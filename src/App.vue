<script setup>
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'

// Initialize theme on app load
const themeStore = useThemeStore()
themeStore.applyTheme()
</script>

<template>
  <Suspense>
    <template #default>
      <RouterView />
    </template>
    <template #fallback>
      <div class="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <LoadingSpinner message="Loading..." />
      </div>
    </template>
  </Suspense>
</template>
