<script setup>
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

const mainNav = [
  { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { name: 'Trade', path: '/trading', icon: 'candlestick_chart' },
  { name: 'Wallet', path: '/wallet', icon: 'account_balance_wallet' },
  { name: 'Transactions', path: '/transactions', icon: 'receipt_long' },
  { name: 'Watchlist', path: '/watchlist', icon: 'star' },
  { name: 'Technical Analysis', path: '/technical-analysis', icon: 'analytics' },
  { name: 'Pokemon', path: '/pokemon', icon: 'pets' },
  { name: 'Learn', path: '/learn', icon: 'school' },
  { name: 'Security', path: '/security', icon: 'verified_user' },
  { name: 'API Keys', path: '/api-keys', icon: 'terminal' },
  { name: 'Docs', path: '/docs', icon: 'description' },
]

const isActive = (path) => route.path === path
</script>

<template>
  <!-- Backdrop for mobile -->
  <Transition
    enter-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-300"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div 
      v-if="uiStore.sidebarOpen" 
      @click="uiStore.closeSidebar"
      class="lg:hidden fixed inset-0 bg-black/50 z-30"
    ></div>
  </Transition>

  <!-- Sidebar -->
  <aside 
    class="fixed lg:sticky top-0 left-0 z-40 h-screen flex flex-col border-r transition-all duration-300
           bg-white dark:bg-background-dark 
           border-gray-200 dark:border-border-dark"
    :class="[
      uiStore.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      uiStore.sidebarCollapsed ? 'lg:w-20' : 'lg:w-72',
      'w-72'
    ]"
  >
    <div class="p-4 lg:p-6 flex flex-col gap-6 lg:gap-8 h-full overflow-y-auto">
      <!-- Logo / Brand -->
      <div class="flex items-center gap-3" :class="{ 'justify-center': uiStore.sidebarCollapsed }">
        <img src="/logo.png" alt="Crypto market anomaly detector" class="size-10 shrink-0" />
        <h1 
          v-if="!uiStore.sidebarCollapsed" 
          class="text-lg font-bold text-slate-900 dark:text-white tracking-tight"
        >
          Crypto market anomaly detector
        </h1>
      </div>

      <!-- User Profile -->
      <div 
        class="flex items-center gap-3 p-3 rounded-xl border
               bg-gray-50 dark:bg-card-dark 
               border-gray-200 dark:border-border-dark"
        :class="{ 'justify-center p-2': uiStore.sidebarCollapsed }"
      >
        <div class="size-10 rounded-full bg-gradient-to-tr from-primary to-purple-500 border-2 border-primary flex items-center justify-center text-white font-bold shrink-0">
          {{ authStore.userName.charAt(0).toUpperCase() }}
        </div>
        <div v-if="!uiStore.sidebarCollapsed" class="flex flex-col min-w-0">
          <h2 class="text-slate-900 dark:text-white text-sm font-bold leading-tight truncate">{{ authStore.userName }}</h2>
          <div class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-success animate-pulse"></span>
            <p class="text-slate-500 dark:text-text-secondary text-xs truncate">Online</p>
          </div>
        </div>
      </div>

      <!-- Main Navigation -->
      <nav class="flex flex-col gap-1 flex-1">
        <RouterLink
          v-for="link in mainNav"
          :key="link.path"
          :to="link.path"
          @click="uiStore.closeSidebar"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
          :class="[
            isActive(link.path) 
              ? 'bg-primary/10 text-primary border-l-4 border-primary' 
              : 'text-slate-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-card-dark hover:text-slate-900 dark:hover:text-white',
            uiStore.sidebarCollapsed ? 'justify-center px-0' : ''
          ]"
          :title="uiStore.sidebarCollapsed ? link.name : ''"
        >
          <span class="material-symbols-outlined text-[22px]">{{ link.icon }}</span>
          <p v-if="!uiStore.sidebarCollapsed" class="text-sm font-medium">{{ link.name }}</p>
        </RouterLink>
      </nav>

      <!-- App Version -->
      <div 
        v-if="!uiStore.sidebarCollapsed"
        class="pt-4 border-t border-gray-200 dark:border-border-dark text-center"
      >
        <p class="text-xs text-slate-400 dark:text-text-secondary">Crypto market anomaly detector v1.0.0</p>
      </div>
    </div>
  </aside>
</template>
