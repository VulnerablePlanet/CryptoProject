<script setup>
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import DashboardHeader from '@/components/layout/DashboardHeader.vue'

// Ensure theme is applied on layout mount
const themeStore = useThemeStore()
onMounted(() => {
  themeStore.applyTheme()
})
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark flex">
    <!-- Sidebar -->
    <AppSidebar />
    
    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Dashboard Header -->
      <DashboardHeader />

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background-light dark:bg-background-dark">
        <div class="max-w-[1400px] mx-auto">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
