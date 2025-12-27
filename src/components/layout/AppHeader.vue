<script setup>
import { RouterLink, useRoute } from 'vue-router'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const route = useRoute()

const navLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { name: 'Trading', path: '/trading', icon: 'candlestick_chart' },
  { name: 'Wallet', path: '/wallet', icon: 'account_balance_wallet' },
  { name: 'Profile', path: '/profile', icon: 'person' },
]

const isActive = (path) => route.path === path
</script>

<template>
  <header class="h-16 border-b border-gray-200 dark:border-border-dark bg-white/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-50">
    <div class="h-full px-4 md:px-6 lg:px-10 flex items-center justify-between max-w-7xl mx-auto">
      <!-- Logo -->
      <RouterLink to="/" class="flex items-center gap-3">
        <img src="/logo.png" alt="Crypto market anomaly detector" class="size-8" />
        <h1 class="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Crypto market anomaly detector</h1>
      </RouterLink>

      <!-- Desktop Navigation -->
      <nav class="hidden lg:flex items-center gap-6">
        <RouterLink
          v-for="link in navLinks"
          :key="link.path"
          :to="link.path"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="isActive(link.path) 
            ? 'text-primary bg-primary/10' 
            : 'text-slate-600 dark:text-text-secondary hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-800'"
        >
          <span class="material-symbols-outlined text-[18px]">{{ link.icon }}</span>
          {{ link.name }}
        </RouterLink>
      </nav>

      <!-- Right Side -->
      <div class="flex items-center gap-3">
        <ThemeToggle />
        
        <!-- Notifications -->
        <button class="relative flex items-center justify-center size-9 rounded-lg bg-gray-100 dark:bg-border-dark text-slate-600 dark:text-text-secondary hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-[20px]">notifications</span>
          <span class="absolute top-1 right-1 size-2 bg-danger rounded-full border-2 border-white dark:border-background-dark"></span>
        </button>

        <!-- User Avatar -->
        <div class="size-9 rounded-full bg-gradient-to-tr from-primary to-purple-500 border-2 border-white dark:border-border-dark cursor-pointer"></div>

        <!-- Mobile Menu Button -->
        <button class="lg:hidden flex items-center justify-center size-9 rounded-lg text-slate-900 dark:text-white">
          <span class="material-symbols-outlined">menu</span>
        </button>
      </div>
    </div>
  </header>
</template>
