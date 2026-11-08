<script setup>
import { RouterView } from 'vue-router'
import { onMounted, onUnmounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useCryptoStore } from '@/stores/crypto'
import { useAuthStore } from '@/stores/auth'
import { initSocket, disconnectSocket } from '@/services/socket'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import DashboardHeader from '@/components/layout/DashboardHeader.vue'

// Stores
const themeStore = useThemeStore()
const cryptoStore = useCryptoStore()
const authStore = useAuthStore()

// Initialize socket and realtime features when authenticated layout mounts
onMounted(() => {
  themeStore.applyTheme()
  
  // Initialize socket connection for authenticated users
  if (authStore.isAuthenticated) {
    initSocket(authStore.token)
    // Enable realtime price updates
    cryptoStore.enableRealtimePrices()
  }
})

// Cleanup on unmount
onUnmounted(() => {
  cryptoStore.disableRealtimePrices()
  disconnectSocket()
})
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark flex">
    <!-- Keyboard users can bypass the navigation (WCAG 2.4.1) -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
    >
      Skip to main content
    </a>

    <!-- Sidebar -->
    <AppSidebar />
    
    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Dashboard Header -->
      <DashboardHeader />

      <!-- Page Content -->
      <main id="main-content" tabindex="-1" class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background-light dark:bg-background-dark outline-none">
        <div class="max-w-[1400px] mx-auto">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
