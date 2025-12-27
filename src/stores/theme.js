import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export const useThemeStore = defineStore('theme', () => {
  // Use localStorage to persist theme preference
  const isDark = useLocalStorage('cryptodev-theme-dark', true)

  // Apply theme to document
  const applyTheme = () => {
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // Toggle theme
  const toggleTheme = () => {
    isDark.value = !isDark.value
  }

  // Set specific theme
  const setTheme = (dark) => {
    isDark.value = dark
  }

  // Watch for changes and apply
  watch(isDark, applyTheme, { immediate: true })

  return {
    isDark,
    toggleTheme,
    setTheme,
    applyTheme
  }
})
