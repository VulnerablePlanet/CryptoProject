<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { useUIStore } from '@/stores/ui'

const route = useRoute()
const uiStore = useUIStore()

// lg breakpoint: sidebar is always visible on desktop, off-canvas below it
const isDesktop = useMediaQuery('(min-width: 1024px)')
// The collapsed (icon-only) preference only applies to the desktop rail
const collapsed = computed(() => uiStore.sidebarCollapsed && isDesktop.value)

const mainNav = [
  { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { name: 'Transactions', path: '/transactions', icon: 'receipt_long' },
  { name: 'Watchlist', path: '/watchlist', icon: 'star' },
  { name: 'TA-Lib Advanced', path: '/talib', icon: 'science' },
  { name: 'Pro Trading', path: '/pro-trading', icon: 'finance_mode' },
  { name: 'Fibonacci CCXT', path: '/fibonacci-ccxt', icon: 'show_chart' },
  { name: 'Predictions', path: '/predictions', icon: 'auto_graph' },
  { name: 'Trading Bot', path: '/bot-trading', icon: 'smart_toy' },
  { name: 'Docs', path: '/docs', icon: 'description' },
]

// Collapsible groups. CoinGecko: modules that use the CoinGecko API.
const navGroups = [
  {
    id: 'coingecko',
    name: 'CoinGecko',
    icon: 'currency_bitcoin',
    items: [
      { name: 'Technical Analysis', path: '/technical-analysis', icon: 'analytics' },
      { name: 'TradingView', path: '/tradingview', icon: 'candlestick_chart' },
      { name: 'Fibonacci', path: '/fibonacci', icon: 'ssid_chart' },
    ],
  },
  {
    id: 'settings',
    name: 'App Settings',
    icon: 'settings',
    items: [
      { name: 'API Keys', path: '/settings/api-keys', icon: 'key' },
      { name: 'Usuarios', path: '/settings/users', icon: 'group' },
    ],
  },
]

const openGroups = ref({ coingecko: false, settings: false })

const isActive = (path) => route.path === path
const isGroupActive = (group) => group.items.some((item) => item.path === route.path)

// Keep the group that contains the current page expanded, so the active item
// is never hidden after navigation or reload.
watch(
  () => route.path,
  () => {
    navGroups.forEach((group) => {
      if (isGroupActive(group)) openGroups.value[group.id] = true
    })
  },
  { immediate: true }
)

const toggleGroup = (group) => {
  // In collapsed mode the submenu has no room: expand the sidebar first
  if (collapsed.value) {
    uiStore.toggleSidebarCollapse()
    openGroups.value[group.id] = true
    return
  }
  openGroups.value[group.id] = !openGroups.value[group.id]
}

const onKeydown = (event) => {
  if (event.key === 'Escape' && uiStore.sidebarOpen && !isDesktop.value) {
    uiStore.closeSidebar()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

// Shared item styles (single source for every nav entry)
const itemBase = 'flex items-center gap-3 rounded-lg transition-colors duration-150'
const itemIdle =
  'text-slate-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-card-dark hover:text-slate-900 dark:hover:text-white'
const itemActive = 'bg-primary/10 text-primary'
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
      class="lg:hidden fixed inset-0 bg-black/50 z-30"
      aria-hidden="true"
      @click="uiStore.closeSidebar"
    ></div>
  </Transition>

  <!-- Sidebar -->
  <aside
    id="app-sidebar"
    class="fixed lg:sticky top-0 left-0 z-40 h-screen flex flex-col border-r transition-all duration-300
           bg-white dark:bg-background-dark
           border-gray-200 dark:border-border-dark"
    :class="[
      uiStore.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      uiStore.sidebarCollapsed ? 'lg:w-20' : 'lg:w-72',
      'w-72'
    ]"
    :inert="!isDesktop && !uiStore.sidebarOpen"
    aria-label="Sidebar"
  >
    <div class="p-4 lg:p-6 flex flex-col gap-6 lg:gap-8 h-full overflow-y-auto">
      <!-- Logo / Brand -->
      <RouterLink
        to="/dashboard"
        class="flex items-center gap-3 rounded-lg"
        :class="{ 'justify-center': collapsed }"
        :aria-label="collapsed ? 'Crypto market anomaly detector — Dashboard' : undefined"
        @click="uiStore.closeSidebar"
      >
        <img src="/logo.png" alt="" class="size-10 shrink-0" width="40" height="40" />
        <span
          v-if="!collapsed"
          class="text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-snug"
        >
          Crypto market anomaly detector
        </span>
      </RouterLink>

      <!-- Main Navigation -->
      <nav class="flex flex-col gap-1 flex-1" aria-label="Main navigation">
        <!--
          Every top-level item reserves the 4px accent border (transparent when
          idle) so the label no longer shifts sideways when it becomes active.
        -->
        <RouterLink
          v-for="link in mainNav"
          :key="link.path"
          :to="link.path"
          class="border-l-4"
          :class="[
            itemBase,
            isActive(link.path) ? `${itemActive} border-primary` : `${itemIdle} border-transparent`,
            collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
          ]"
          :title="collapsed ? link.name : undefined"
          :aria-label="collapsed ? link.name : undefined"
          @click="uiStore.closeSidebar"
        >
          <span class="material-symbols-outlined text-[22px]" aria-hidden="true">{{ link.icon }}</span>
          <span v-if="!collapsed" class="text-sm font-medium">{{ link.name }}</span>
        </RouterLink>

        <!-- Collapsible groups -->
        <div v-for="group in navGroups" :key="group.id">
          <button
            type="button"
            class="w-full border-l-4"
            :class="[
              itemBase,
              isGroupActive(group) ? `${itemActive} border-transparent` : `${itemIdle} border-transparent`,
              collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
            ]"
            :title="collapsed ? group.name : undefined"
            :aria-label="collapsed ? group.name : undefined"
            :aria-expanded="openGroups[group.id] && !collapsed"
            :aria-controls="`nav-group-${group.id}`"
            @click="toggleGroup(group)"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">{{ group.icon }}</span>
            <span v-if="!collapsed" class="text-sm font-medium flex-1 text-left">{{ group.name }}</span>
            <span
              v-if="!collapsed"
              class="material-symbols-outlined text-[18px] transition-transform duration-200"
              :class="{ 'rotate-180': openGroups[group.id] }"
              aria-hidden="true"
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
            <div
              v-if="openGroups[group.id] && !collapsed"
              :id="`nav-group-${group.id}`"
              class="overflow-hidden mt-1 flex flex-col gap-1"
            >
              <RouterLink
                v-for="sublink in group.items"
                :key="sublink.path"
                :to="sublink.path"
                class="px-3 py-2 ml-6 text-sm border-l-2"
                :class="[
                  itemBase,
                  isActive(sublink.path) ? `${itemActive} border-primary` : `${itemIdle} border-transparent`
                ]"
                @click="uiStore.closeSidebar"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">{{ sublink.icon }}</span>
                <span class="font-medium">{{ sublink.name }}</span>
              </RouterLink>
            </div>
          </Transition>
        </div>
      </nav>

      <!-- App Version -->
      <div
        v-if="!collapsed"
        class="pt-4 border-t border-gray-200 dark:border-border-dark text-center"
      >
        <p class="text-xs text-text-secondary">Crypto market anomaly detector v1.0.0</p>
      </div>
    </div>
  </aside>
</template>
