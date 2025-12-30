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

// Page titles mapping
const pageTitles = {
  '/dashboard': 'Dashboard',
  '/trading': 'Trade',
  '/wallet': 'Wallet',
  '/transactions': 'Transactions',
  '/watchlist': 'Watchlist',
  '/technical-analysis': 'Technical Analysis',
  '/pokemon': 'Pokemon',
  '/learn': 'Learn',
  '/security': 'Security',
  '/api-keys': 'API Keys',
  '/docs': 'Documentation',
  '/profile': 'Profile',
  '/notifications': 'Notifications'
}

const currentPageTitle = computed(() => {
  return pageTitles[route.path] || 'Overview'
})

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

// Handle click outside to close dropdowns
const handleClickOutside = (event) => {
  const notifBtn = document.getElementById('notifications-btn')
  const notifDropdown = document.getElementById('notifications-dropdown')
  const profileBtn = document.getElementById('profile-btn')
  const profileDropdown = document.getElementById('profile-dropdown')

  if (notifBtn && notifDropdown && !notifBtn.contains(event.target) && !notifDropdown.contains(event.target)) {
    uiStore.notificationsOpen = false
  }
  if (profileBtn && profileDropdown && !profileBtn.contains(event.target) && !profileDropdown.contains(event.target)) {
    uiStore.profileMenuOpen = false
  }
}

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
  // Fetch notifications and start realtime listener
  await notificationStore.fetchNotifications()
  notificationStore.initRealtimeListener()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <header class="h-16 border-b border-gray-200 dark:border-border-dark flex items-center justify-between px-6 bg-white dark:bg-background-dark/95 backdrop-blur z-20 shrink-0">
    <div class="flex items-center gap-3">
      <!-- Mobile menu toggle -->
      <button 
        @click="uiStore.toggleSidebar"
        class="lg:hidden flex items-center justify-center size-9 rounded-lg hover:bg-gray-100 dark:hover:bg-card-dark text-slate-900 dark:text-white transition-colors"
      >
        <span class="material-symbols-outlined">menu</span>
      </button>
      
      <!-- Desktop sidebar toggle -->
      <button 
        @click="uiStore.toggleSidebarCollapse"
        class="hidden lg:flex items-center justify-center size-9 rounded-lg hover:bg-gray-100 dark:hover:bg-card-dark text-slate-600 dark:text-text-secondary transition-colors"
      >
        <span class="material-symbols-outlined text-[20px]">
          {{ uiStore.sidebarCollapsed ? 'menu_open' : 'menu' }}
        </span>
      </button>
      
      <div class="flex flex-col">
        <h2 class="text-slate-900 dark:text-white text-base font-bold">{{ currentPageTitle }}</h2>
      </div>
      
      <!-- Realtime Indicator -->
      <RealtimeIndicator class="hidden md:flex ml-4" />
    </div>
    
    <div class="flex items-center gap-2 sm:gap-4">
      <!-- Search -->
      <div class="hidden md:flex items-center bg-gray-100 dark:bg-card-dark rounded-lg px-3 py-1.5 border border-gray-200 dark:border-border-dark focus-within:border-primary transition-colors">
        <span class="material-symbols-outlined text-text-secondary text-[20px]">search</span>
        <input 
          class="bg-transparent border-none text-slate-900 dark:text-white text-sm focus:ring-0 placeholder-text-secondary w-48 outline-none ml-2" 
          placeholder="Search..." 
          type="text"
        />
      </div>
      
      <!-- Theme Toggle -->
      <button
        @click="themeStore.toggleTheme"
        class="flex items-center justify-center size-9 rounded-lg hover:bg-gray-100 dark:hover:bg-card-dark text-slate-600 dark:text-text-secondary hover:text-primary transition-colors"
        :title="themeStore.isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
      >
        <span class="material-symbols-outlined text-[20px]">
          {{ themeStore.isDark ? 'light_mode' : 'dark_mode' }}
        </span>
      </button>
      
      <!-- Notifications -->
      <div class="relative">
        <button 
          id="notifications-btn"
          @click.stop="uiStore.toggleNotifications"
          class="relative flex items-center justify-center size-9 rounded-lg hover:bg-gray-100 dark:hover:bg-card-dark text-slate-600 dark:text-text-secondary hover:text-primary transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]">notifications</span>
          <span 
            v-if="notificationStore.unreadCount > 0"
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
            class="absolute right-0 top-12 w-80 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl shadow-lg shadow-black/10 overflow-hidden z-50"
          >
            <div class="p-4 border-b border-gray-200 dark:border-border-dark flex justify-between items-center">
              <h3 class="font-bold text-slate-900 dark:text-white">Notifications</h3>
              <button 
                v-if="notificationStore.hasUnread"
                @click="handleMarkAllRead" 
                class="text-xs text-primary hover:text-blue-400"
              >
                Mark all read
              </button>
            </div>
            
            <div class="max-h-80 overflow-y-auto">
              <!-- Loading State -->
              <div v-if="notificationStore.loading && notificationStore.notifications.length === 0" class="p-8 text-center">
                <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto"></div>
              </div>
              
              <!-- Empty State -->
              <div v-else-if="notificationStore.notifications.length === 0" class="p-8 text-center">
                <span class="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600">notifications_off</span>
                <p class="text-sm text-text-secondary mt-2">No notifications yet</p>
              </div>
              
              <!-- Notification List -->
              <div 
                v-else
                v-for="notif in notificationStore.recentNotifications" 
                :key="notif._id"
                @click="handleNotificationClick(notif)"
                class="p-4 border-b border-gray-100 dark:border-border-dark/50 hover:bg-gray-50 dark:hover:bg-border-dark/30 cursor-pointer transition-colors"
                :class="{ 'bg-primary/5': !notif.read }"
              >
                <div class="flex items-start gap-3">
                  <div 
                    class="size-8 rounded-full flex items-center justify-center shrink-0"
                    :class="notif.type === 'transaction' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'"
                  >
                    <span class="material-symbols-outlined text-[16px]">{{ getNotificationIcon(notif.type) }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-900 dark:text-white">{{ notif.title }}</p>
                    <p class="text-xs text-text-secondary truncate">{{ notif.message }}</p>
                    <p class="text-xs text-text-secondary mt-1">{{ formatTimeAgo(notif.createdAt) }}</p>
                  </div>
                  <span v-if="!notif.read" class="size-2 rounded-full bg-primary shrink-0"></span>
                </div>
              </div>
            </div>
            
            <div v-if="notificationStore.notifications.length > 0" class="p-3 text-center border-t border-gray-200 dark:border-border-dark">
              <button 
                @click="router.push('/notifications'); uiStore.notificationsOpen = false"
                class="text-sm text-primary hover:text-blue-400 font-medium"
              >
                View all notifications
              </button>
            </div>
          </div>
        </Transition>
      </div>
      
      <!-- Profile Menu -->
      <div class="relative">
        <button 
          id="profile-btn"
          @click.stop="uiStore.toggleProfileMenu"
          class="size-9 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
        >
          <img 
            v-if="authStore.userAvatar" 
            :src="authStore.userAvatar" 
            alt="Profile" 
            class="w-full h-full object-cover"
          />
          <span v-else>{{ authStore.userName.charAt(0).toUpperCase() }}</span>
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
                    alt="Profile" 
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
                @click="goToSettings"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
              >
                <span class="material-symbols-outlined text-[20px] text-text-secondary">settings</span>
                Settings
              </button>
              <button 
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
              >
                <span class="material-symbols-outlined text-[20px] text-text-secondary">help</span>
                Help & Support
              </button>
            </div>
            
            <!-- Logout -->
            <div class="border-t border-gray-200 dark:border-border-dark py-2">
              <button 
                @click="handleLogout"
                class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
              >
                <span class="material-symbols-outlined text-[20px]">logout</span>
                Logout
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
