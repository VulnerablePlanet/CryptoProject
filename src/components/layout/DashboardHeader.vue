<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import RealtimeIndicator from '@/components/common/RealtimeIndicator.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const themeStore = useThemeStore()
const uiStore = useUIStore()
const notificationStore = useNotificationStore()

// Title comes from the route definition (single source of truth, see router meta.title)
const currentPageTitle = computed(() => route.meta.title || 'Overview')

// Format time ago
const formatTimeAgo = (date) => {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Get icon based on notification type
const getNotificationIcon = (type) => {
  const icons = {
    transaction: 'receipt_long',
    price_alert: 'notifications_active',
    security: 'verified_user',
    system: 'info',
    portfolio: 'account_balance_wallet',
    welcome: 'celebration'
  }
  return icons[type] || 'notifications'
}

// Dropdown anchors (template refs instead of document.getElementById)
const notifRoot = ref(null)
const notifButton = ref(null)
const profileRoot = ref(null)
const profileButton = ref(null)

// Close dropdowns on outside click
const handleClickOutside = (event) => {
  if (notifRoot.value && !notifRoot.value.contains(event.target)) {
    uiStore.notificationsOpen = false
  }
  if (profileRoot.value && !profileRoot.value.contains(event.target)) {
    uiStore.profileMenuOpen = false
  }
}

// Escape closes the open dropdown and returns focus to its trigger
const handleKeydown = (event) => {
  if (event.key !== 'Escape') return
  if (uiStore.notificationsOpen) {
    uiStore.notificationsOpen = false
    notifButton.value?.focus()
  } else if (uiStore.profileMenuOpen) {
    uiStore.profileMenuOpen = false
    profileButton.value?.focus()
  }
}

const unreadLabel = computed(() => {
  const n = notificationStore.unreadCount
  return n > 0 ? `Notifications, ${n} unread` : 'Notifications'
})

const handleLogout = () => {
  uiStore.closeAllDropdowns()
  notificationStore.stopRealtimeListener()
  authStore.logout()
  router.push('/')
}

const goToSettings = () => {
  uiStore.closeAllDropdowns()
  router.push('/profile')
}

const goToHelp = () => {
  uiStore.closeAllDropdowns()
  router.push('/docs')
}

const handleMarkAllRead = async () => {
  await notificationStore.markAllAsRead()
}

const handleNotificationClick = async (notification) => {
  if (!notification.read) {
    await notificationStore.markAsRead(notification._id)
  }
  // Navigate based on notification type
  if (notification.data?.link) {
    router.push(notification.data.link)
    uiStore.notificationsOpen = false
  } else if (notification.type === 'transaction') {
    router.push('/transactions')
    uiStore.notificationsOpen = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
  // Fetch notifications and start realtime listener
  await notificationStore.fetchNotifications()
  notificationStore.initRealtimeListener()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <header class="h-16 border-b border-gray-200 dark:border-border-dark flex items-center justify-between gap-3 px-4 md:px-6 lg:px-8 bg-white dark:bg-background-dark/95 backdrop-blur z-20 shrink-0">
    <div class="flex items-center gap-3">
      <!-- Mobile menu toggle -->
      <button 
        type="button"
        @click="uiStore.toggleSidebar"
        aria-label="Open navigation menu"
        aria-controls="app-sidebar"
        :aria-expanded="uiStore.sidebarOpen"
        class="lg:hidden flex items-center justify-center size-9 rounded-lg hover:bg-gray-100 dark:hover:bg-card-dark text-slate-900 dark:text-white transition-colors"
      >
        <span class="material-symbols-outlined" aria-hidden="true">menu</span>
      </button>
      
      <!-- Desktop sidebar toggle -->
      <button 
        type="button"
        @click="uiStore.toggleSidebarCollapse"
        :aria-label="uiStore.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-pressed="uiStore.sidebarCollapsed"
        class="hidden lg:flex items-center justify-center size-9 rounded-lg hover:bg-gray-100 dark:hover:bg-card-dark text-slate-600 dark:text-text-secondary transition-colors"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
          {{ uiStore.sidebarCollapsed ? 'menu_open' : 'menu' }}
        </span>
      </button>
      
      <div class="flex flex-col">
        <p class="text-slate-900 dark:text-white text-base font-bold truncate">{{ currentPageTitle }}</p>
      </div>
      
      <!-- Realtime Indicator -->
      <RealtimeIndicator class="hidden md:flex ml-4" />
    </div>
    
    <div class="flex items-center gap-2 sm:gap-4">
      <!-- Search -->
      <div role="search" class="hidden md:flex items-center bg-gray-100 dark:bg-card-dark rounded-lg px-3 py-1.5 border border-gray-200 dark:border-border-dark focus-within:border-primary transition-colors">
        <span class="material-symbols-outlined text-text-secondary text-[20px]" aria-hidden="true">search</span>
        <input 
          aria-label="Search"
          class="bg-transparent border-none text-slate-900 dark:text-white text-sm focus:ring-0 placeholder-text-secondary w-48 outline-none ml-2" 
          placeholder="Search..." 
          type="text"
        />
      </div>
      
      <!-- Theme Toggle -->
      <button
        type="button"
        @click="themeStore.toggleTheme"
        :aria-label="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        class="flex items-center justify-center size-9 rounded-lg hover:bg-gray-100 dark:hover:bg-card-dark text-slate-600 dark:text-text-secondary hover:text-primary transition-colors"
        :title="themeStore.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
      >
        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
          {{ themeStore.isDark ? 'light_mode' : 'dark_mode' }}
        </span>
      </button>
      
      <!-- Notifications -->
      <div ref="notifRoot" class="relative">
        <button 
          ref="notifButton"
          type="button"
          @click="uiStore.toggleNotifications"
          :aria-label="unreadLabel"
          aria-haspopup="true"
          aria-controls="notifications-dropdown"
          :aria-expanded="uiStore.notificationsOpen"
          class="relative flex items-center justify-center size-9 rounded-lg hover:bg-gray-100 dark:hover:bg-card-dark text-slate-600 dark:text-text-secondary hover:text-primary transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">notifications</span>
          <span 
            v-if="notificationStore.unreadCount > 0"
            aria-hidden="true"
            class="absolute top-1 right-1 size-4 bg-danger rounded-full text-[10px] font-bold text-white flex items-center justify-center"
          >
            {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
          </span>
        </button>
        
        <!-- Notifications Dropdown -->
        <Transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <div 
            v-if="uiStore.notificationsOpen"
            id="notifications-dropdown"
            role="region"
            aria-label="Notifications"
            class="absolute right-0 top-12 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl shadow-lg shadow-black/10 overflow-hidden z-50"
          >
            <div class="p-4 border-b border-gray-200 dark:border-border-dark flex justify-between items-center">
              <h2 class="font-bold text-slate-900 dark:text-white">Notifications</h2>
              <button 
                v-if="notificationStore.hasUnread"
                type="button"
                @click="handleMarkAllRead" 
                class="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            </div>
            
            <div class="max-h-80 overflow-y-auto">
              <!-- Loading State -->
              <div v-if="notificationStore.loading && notificationStore.notifications.length === 0" class="p-8 text-center" role="status">
                <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto" aria-hidden="true"></div>
                <span class="sr-only">Loading notifications</span>
              </div>
              
              <!-- Empty State -->
              <div v-else-if="notificationStore.notifications.length === 0" class="p-8 text-center">
                <span class="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600" aria-hidden="true">notifications_off</span>
                <p class="text-sm text-text-secondary mt-2">No notifications yet</p>
              </div>
              
              <!-- Notification List (buttons: reachable and operable by keyboard) -->
              <ul v-else>
              <li v-for="notif in notificationStore.recentNotifications" :key="notif._id">
              <button
                type="button"
                @click="handleNotificationClick(notif)"
                class="w-full text-left p-4 border-b border-gray-100 dark:border-border-dark/50 hover:bg-gray-50 dark:hover:bg-border-dark/30 transition-colors focus-visible:-outline-offset-2"
                :class="{ 'bg-primary/5': !notif.read }"
              >
                <div class="flex items-start gap-3">
                  <div 
                    class="size-8 rounded-full flex items-center justify-center shrink-0"
                    :class="notif.type === 'transaction' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'"
                  >
                    <span class="material-symbols-outlined text-[16px]" aria-hidden="true">{{ getNotificationIcon(notif.type) }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900 dark:text-white">{{ notif.title }}</p>
                    <p class="text-xs text-text-secondary truncate">{{ notif.message }}</p>
                    <p class="text-xs text-text-secondary mt-1">{{ formatTimeAgo(notif.createdAt) }}</p>
                  </div>
                  <span v-if="!notif.read" class="size-2 rounded-full bg-primary shrink-0" aria-hidden="true"></span>
                  <span v-if="!notif.read" class="sr-only">(unread)</span>
                </div>
              </button>
              </li>
              </ul>
            </div>
          </div>
        </Transition>
      </div>
      
      <!-- Profile Menu -->
      <div ref="profileRoot" class="relative">
        <button 
          ref="profileButton"
          type="button"
          @click="uiStore.toggleProfileMenu"
          aria-label="Account menu"
          aria-haspopup="true"
          aria-controls="profile-dropdown"
          :aria-expanded="uiStore.profileMenuOpen"
          class="size-9 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
        >
          <img 
            v-if="authStore.userAvatar" 
            :src="authStore.userAvatar" 
            alt="" 
            class="w-full h-full object-cover"
          />
          <span v-else aria-hidden="true">{{ authStore.userName.charAt(0).toUpperCase() }}</span>
        </button>
        
        <!-- Profile Dropdown -->
        <Transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <div 
            v-if="uiStore.profileMenuOpen"
            id="profile-dropdown"
            class="absolute right-0 top-12 w-56 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl shadow-lg shadow-black/10 overflow-hidden z-50"
          >
            <!-- User Info -->
            <div class="p-4 border-b border-gray-200 dark:border-border-dark">
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden">
                  <img 
                    v-if="authStore.userAvatar" 
                    :src="authStore.userAvatar" 
                    alt="" 
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ authStore.userName.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-slate-900 dark:text-white truncate">{{ authStore.userName }}</p>
                  <p class="text-xs text-text-secondary truncate">{{ authStore.userEmail }}</p>
                </div>
              </div>
            </div>
            
            <!-- Menu Items -->
            <div class="py-2">
              <button 
                type="button"
                @click="goToSettings"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
              >
                <span class="material-symbols-outlined text-[20px] text-text-secondary" aria-hidden="true">settings</span>
                Settings
              </button>
              <button 
                type="button"
                @click="goToHelp"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
              >
                <span class="material-symbols-outlined text-[20px] text-text-secondary" aria-hidden="true">help</span>
                Help & Support
              </button>
            </div>
            
            <!-- Logout -->
            <div class="border-t border-gray-200 dark:border-border-dark py-2">
              <button 
                type="button"
                @click="handleLogout"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
                Logout
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
