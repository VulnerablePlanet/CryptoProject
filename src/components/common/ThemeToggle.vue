<script setup>
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
</script>

<template>
  <button
    @click="themeStore.toggleTheme"
    class="flex items-center justify-center size-9 rounded-lg 
           bg-gray-100 dark:bg-border-dark 
           text-slate-600 dark:text-text-secondary 
           hover:bg-gray-200 dark:hover:bg-gray-700 
           hover:text-primary transition-colors"
    :title="themeStore.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
  >
    <span v-if="themeStore.isDark" class="material-symbols-outlined text-[20px]">light_mode</span>
    <span v-else class="material-symbols-outlined text-[20px]">dark_mode</span>
  </button>
</template>
