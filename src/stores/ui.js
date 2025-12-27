import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

export const useUIStore = defineStore('ui', () => {
  // Sidebar state - persisted
  const sidebarOpen = useLocalStorage('cryptodev-sidebar-open', true)
  const sidebarCollapsed = useLocalStorage('cryptodev-sidebar-collapsed', false)

  // Dropdowns state - not persisted
  const notificationsOpen = ref(false)
  const profileMenuOpen = ref(false)

  // Toggle functions
  const toggleSidebar = () => {
    sidebarOpen.value = !sidebarOpen.value
  }

  const toggleSidebarCollapse = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  const openSidebar = () => {
    sidebarOpen.value = true
  }

  const closeSidebar = () => {
    sidebarOpen.value = false
  }

  const toggleNotifications = () => {
    notificationsOpen.value = !notificationsOpen.value
    // Close other dropdowns
    if (notificationsOpen.value) {
      profileMenuOpen.value = false
    }
  }

  const toggleProfileMenu = () => {
    profileMenuOpen.value = !profileMenuOpen.value
    // Close other dropdowns
    if (profileMenuOpen.value) {
      notificationsOpen.value = false
    }
  }

  const closeAllDropdowns = () => {
    notificationsOpen.value = false
    profileMenuOpen.value = false
  }

  return {
    sidebarOpen,
    sidebarCollapsed,
    notificationsOpen,
    profileMenuOpen,
    toggleSidebar,
    toggleSidebarCollapse,
    openSidebar,
    closeSidebar,
    toggleNotifications,
    toggleProfileMenu,
    closeAllDropdowns
  }
})
