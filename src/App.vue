<script setup>
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/theme'

// Initialize theme on app load
const themeStore = useThemeStore()
themeStore.applyTheme()
</script>

<template>
  <RouterView />
</template>
