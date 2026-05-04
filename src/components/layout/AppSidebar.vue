<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'

const route = useRoute()
const authStore = useAuthStore()
const uiStore = useUIStore()

// Dropdown states
const settingsOpen = ref(false)
const coingeckoOpen = ref(false)

const mainNav = [
  { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { name: 'Transactions', path: '/transactions', icon: 'receipt_long' },
  { name: 'Watchlist', path: '/watchlist', icon: 'star' },
  { name: 'TA-Lib Advanced', path: '/talib', icon: 'science' },
  { name: 'Pro Trading', path: '/pro-trading', icon: 'finance_mode' },
  { name: 'Fibonacci CCXT', path: '/fibonacci-ccxt', icon: 'show_chart' },
  { name: 'Predictions', path: '/predictions', icon: 'auto_graph' },
  { name: 'Trading Bot', path: '/bot-trading', icon: 'smart_toy' },
  { name: 'Pokemon', path: '/pokemon', icon: 'pets' },
  { name: 'Docs', path: '/docs', icon: 'description' },
]

// CoinGecko submenu (modules that use CoinGecko API)
const coingeckoNav = [
  { name: 'Technical Analysis', path: '/technical-analysis', icon: 'analytics' },
  { name: 'TradingView', path: '/tradingview', icon: 'candlestick_chart' },
  { name: 'Fibonacci', path: '/fibonacci', icon: 'ssid_chart' },
]

// App Settings submenu
const settingsNav = [
  { name: 'API Keys', path: '/settings/api-keys', icon: 'key' },
  { name: 'Usuarios', path: '/settings/users', icon: 'group' },
]

const isActive = (path) => route.path === path
const isSettingsActive = () => settingsNav.some(item => route.path === item.path)
const isCoingeckoActive = () => coingeckoNav.some(item => route.path === item.path)

const toggleSettings = () => {
  settingsOpen.value = !settingsOpen.value
}

const toggleCoingecko = () => {
  coingeckoOpen.value = !coingeckoOpen.value
}
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

        <!-- CoinGecko Dropdown -->
        <div>
          <button
            @click="toggleCoingecko"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
            :class="[
              isCoingeckoActive() 
                ? 'bg-primary/10 text-primary' 
                : 'text-slate-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-card-dark hover:text-slate-900 dark:hover:text-white',
              uiStore.sidebarCollapsed ? 'justify-center px-0' : ''
            ]"
            :title="uiStore.sidebarCollapsed ? 'CoinGecko' : ''"
          >
            <span class="material-symbols-outlined text-[22px]">currency_bitcoin</span>
            <p v-if="!uiStore.sidebarCollapsed" class="text-sm font-medium flex-1 text-left">CoinGecko</p>
            <span 
              v-if="!uiStore.sidebarCollapsed" 
              class="material-symbols-outlined text-[18px] transition-transform duration-200"
              :class="{ 'rotate-180': coingeckoOpen }"
            >
              expand_more
            </span>
          </button>

          <!-- CoinGecko Submenu -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-2 max-h-0"
            enter-to-class="opacity-100 translate-y-0 max-h-40"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0 max-h-40"
            leave-to-class="opacity-0 -translate-y-2 max-h-0"
          >
            <div v-if="coingeckoOpen && !uiStore.sidebarCollapsed" class="overflow-hidden">
              <RouterLink
                v-for="sublink in coingeckoNav"
                :key="sublink.path"
                :to="sublink.path"
                @click="uiStore.closeSidebar"
                class="flex items-center gap-3 px-3 py-2 ml-6 rounded-lg transition-all text-sm"
                :class="[
                  isActive(sublink.path) 
                    ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                    : 'text-slate-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-card-dark hover:text-slate-900 dark:hover:text-white'
                ]"
              >
                <span class="material-symbols-outlined text-[18px]">{{ sublink.icon }}</span>
                <p class="font-medium">{{ sublink.name }}</p>
              </RouterLink>
            </div>
          </Transition>
        </div>

        <!-- App Settings Dropdown -->
        <div>
          <button
            @click="toggleSettings"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
            :class="[
              isSettingsActive() 
                ? 'bg-primary/10 text-primary' 
                : 'text-slate-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-card-dark hover:text-slate-900 dark:hover:text-white',
              uiStore.sidebarCollapsed ? 'justify-center px-0' : ''
            ]"
            :title="uiStore.sidebarCollapsed ? 'App Settings' : ''"
          >
            <span class="material-symbols-outlined text-[22px]">settings</span>
            <p v-if="!uiStore.sidebarCollapsed" class="text-sm font-medium flex-1 text-left">App Settings</p>
            <span 
              v-if="!uiStore.sidebarCollapsed" 
              class="material-symbols-outlined text-[18px] transition-transform duration-200"
              :class="{ 'rotate-180': settingsOpen }"
            >
              expand_more
            </span>
          </button>

          <!-- Submenu -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-2 max-h-0"
            enter-to-class="opacity-100 translate-y-0 max-h-40"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0 max-h-40"
            leave-to-class="opacity-0 -translate-y-2 max-h-0"
          >
            <div v-if="settingsOpen && !uiStore.sidebarCollapsed" class="overflow-hidden">
              <RouterLink
                v-for="sublink in settingsNav"
                :key="sublink.path"
                :to="sublink.path"
                @click="uiStore.closeSidebar"
                class="flex items-center gap-3 px-3 py-2 ml-6 rounded-lg transition-all text-sm"
                :class="[
                  isActive(sublink.path) 
                    ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                    : 'text-slate-500 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-card-dark hover:text-slate-900 dark:hover:text-white'
                ]"
              >
                <span class="material-symbols-outlined text-[18px]">{{ sublink.icon }}</span>
                <p class="font-medium">{{ sublink.name }}</p>
              </RouterLink>
            </div>
          </Transition>
        </div>
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

