<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppHeader from '@/components/layout/AppHeader.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'

const authStore = useAuthStore()
const userCount = ref(0)

onMounted(async () => {
  // Only fetch user count if authenticated (endpoint requires auth)
  if (authStore.isAuthenticated) {
    try {
      const response = await fetch('/api/auth/user-count', {
        headers: {
          'Authorization': `Bearer ${authStore.accessToken}`
        }
      })
      const data = await response.json()
      if (data.success) {
        userCount.value = data.count
      }
    } catch (error) {
      // Silently fail — user count is cosmetic on landing page
    }
  }
})
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark">
    <!-- Header -->
    <header class="h-16 border-b border-gray-200 dark:border-border-dark bg-white/80 dark:bg-background-dark/80 backdrop-blur-md sticky top-0 z-50">
      <div class="h-full px-4 md:px-6 lg:px-10 flex items-center justify-between max-w-7xl mx-auto">
        <!-- Logo -->
        <RouterLink to="/" class="flex items-center gap-3">
          <img src="/logo.png" alt="Crypto market anomaly detector" class="size-8" />
          <h1 class="text-lg font-bold leading-tight tracking-tight text-slate-900 dark:text-white">Crypto market anomaly detector</h1>
        </RouterLink>

        <!-- Right Side -->
        <div class="flex items-center gap-4">
          <ThemeToggle />
          
          <!-- Auth Buttons / User Menu -->
          <template v-if="authStore.isAuthenticated">
            <RouterLink 
              to="/dashboard"
              class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">dashboard</span>
              Dashboard
            </RouterLink>
          </template>
          <template v-else>
            <RouterLink 
              to="/login"
              class="hidden sm:block px-4 py-2 text-slate-700 dark:text-gray-300 text-sm font-medium hover:text-primary transition-colors"
            >
              Sign In
            </RouterLink>
            <RouterLink 
              to="/register"
              class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-primary/25"
            >
              Get Started
            </RouterLink>
          </template>
        </div>
      </div>
    </header>
    
    <!-- Hero Section -->
    <main class="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-16">
      <div class="text-center max-w-3xl">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
          <span class="material-symbols-outlined text-[16px]">verified_user</span>
          {{ userCount ? `${userCount} registered ${userCount === 1 ? 'user' : 'users'}` : 'Join our community' }}
        </div>
        
        <!-- Logo -->
        <img src="/logo.png" alt="Crypto market anomaly detector" class="size-20 mx-auto mb-8" />
        
        <h1 class="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
          Analyze Markets with <br/>
          <span class="text-gradient">Intelligent Data</span>
        </h1>
        
        <p class="text-lg md:text-xl text-text-secondary mb-10 max-w-2xl mx-auto">
          Advanced trading analysis platform that detects market anomalies and identifies patterns. 
          Real-time insights, data-driven decisions, and smarter trading strategies.
        </p>
        
        <!-- CTA Buttons -->
        <div class="flex flex-wrap gap-4 justify-center mb-16">
          <template v-if="authStore.isAuthenticated">
            <RouterLink 
              to="/dashboard"
              class="flex items-center gap-2 h-14 px-8 bg-primary hover:bg-blue-600 text-white text-lg font-bold rounded-xl transition-colors shadow-lg shadow-primary/25"
            >
              <span class="material-symbols-outlined text-[24px]">dashboard</span>
              Go to Dashboard
            </RouterLink>
          </template>
          <template v-else>
            <RouterLink 
              to="/register"
              class="flex items-center gap-2 h-14 px-8 bg-primary hover:bg-blue-600 text-white text-lg font-bold rounded-xl transition-colors shadow-lg shadow-primary/25"
            >
              <span class="material-symbols-outlined text-[24px]">rocket_launch</span>
              Start Trading
            </RouterLink>
            <RouterLink 
              to="/login"
              class="flex items-center gap-2 h-14 px-8 bg-gray-200 dark:bg-card-dark border border-gray-300 dark:border-border-dark text-slate-900 dark:text-white text-lg font-bold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <span class="material-symbols-outlined text-[24px]">login</span>
              Sign In
            </RouterLink>
          </template>
        </div>

      </div>
    </main>
    
    <!-- Features Section -->
    <section class="py-20 px-4 bg-gray-50 dark:bg-surface-dark">
      <div class="max-w-6xl mx-auto">
        <h2 class="text-3xl font-bold text-center text-slate-900 dark:text-white mb-4">Módulos del Sistema</h2>
        <p class="text-center text-text-secondary mb-12 max-w-2xl mx-auto">Herramientas avanzadas para análisis de mercado y detección de anomalías en criptomonedas</p>
        <div class="grid md:grid-cols-3 gap-8">
          <div class="p-6 rounded-xl bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark">
            <div class="size-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
              <span class="material-symbols-outlined">analytics</span>
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Análisis Técnico</h3>
            <p class="text-text-secondary text-sm">Indicadores RSI, MACD, SMA, EMA y niveles Fibonacci. Gráficos de velas OHLC con datos históricos de CoinGecko.</p>
          </div>
          <div class="p-6 rounded-xl bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark">
            <div class="size-12 flex items-center justify-center rounded-lg bg-success/10 text-success mb-4">
              <span class="material-symbols-outlined">show_chart</span>
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Trading en Tiempo Real</h3>
            <p class="text-text-secondary text-sm">Precios en vivo via WebSocket, gráficos interactivos con TradingView y seguimiento de portafolio con alertas.</p>
          </div>
          <div class="p-6 rounded-xl bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark">
            <div class="size-12 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 mb-4">
              <span class="material-symbols-outlined">key</span>
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Gestión de API Keys</h3>
            <p class="text-text-secondary text-sm">Almacena y gestiona claves API de CoinGecko, Binance y otros proveedores para uso dinámico en la aplicación.</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
