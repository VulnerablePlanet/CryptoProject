<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)

const handleLogin = async () => {
  const result = await authStore.login(email.value, password.value)
  if (result.success) {
    router.push('/dashboard')
  }
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark flex">
    <!-- Left Side - Branding -->
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-surface-dark to-background-dark relative overflow-hidden">
      <!-- Background Pattern -->
      <div class="absolute inset-0 opacity-10">
        <div class="absolute top-20 left-20 w-64 h-64 border border-white/30 rounded-full"></div>
        <div class="absolute bottom-20 right-20 w-96 h-96 border border-white/20 rounded-full"></div>
        <div class="absolute top-1/2 left-1/3 w-48 h-48 border border-white/20 rounded-full"></div>
      </div>
      
      <!-- Content -->
      <div class="relative z-10 flex flex-col justify-center px-16">
        <img src="/logo.png" alt="Crypto market anomaly detector" class="size-16 text-white mb-8" />
        <h1 class="text-4xl font-black text-white mb-4">Crypto market anomaly detector</h1>
        <p class="text-xl text-white/80 max-w-md">
          The first crypto exchange built for developers, white hats, and security researchers.
        </p>
        <div class="flex gap-6 mt-12">
          <div class="flex items-center gap-2 text-white/70">
            <span class="material-symbols-outlined text-[20px]">verified_user</span>
            <span class="text-sm">Bank-grade Security</span>
          </div>
          <div class="flex items-center gap-2 text-white/70">
            <span class="material-symbols-outlined text-[20px]">bolt</span>
            <span class="text-sm">&lt;50ms Latency</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side - Login Form -->
    <div class="flex-1 flex items-center justify-center p-8">
      <div class="w-full max-w-md">
        <!-- Mobile Logo -->
        <div class="lg:hidden flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="Crypto market anomaly detector" class="size-10" />
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Crypto market anomaly detector</h1>
        </div>

        <!-- Header -->
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">Welcome back</h2>
          <p class="text-text-secondary">Enter your credentials to access your account</p>
        </div>

        <!-- Error Message -->
        <div 
          v-if="authStore.error"
          class="mb-6 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ authStore.error }}
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin" class="space-y-5">
          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">
                mail
              </span>
              <input
                v-model="email"
                type="email"
                placeholder="you@example.com"
                class="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                       bg-white dark:bg-card-dark text-slate-900 dark:text-white 
                       placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                       transition-all outline-none"
                required
              />
            </div>
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">
                lock
              </span>
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                class="w-full pl-12 pr-12 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                       bg-white dark:bg-card-dark text-slate-900 dark:text-white 
                       placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                       transition-all outline-none"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors"
              >
                <span class="material-symbols-outlined text-[20px]">
                  {{ showPassword ? 'visibility_off' : 'visibility' }}
                </span>
              </button>
            </div>
          </div>

          <!-- Remember & Forgot -->
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" class="size-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span class="text-sm text-slate-600 dark:text-gray-400">Remember me</span>
            </label>
            <a href="#" class="text-sm text-primary hover:text-blue-400 transition-colors">
              Forgot password?
            </a>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="authStore.isLoading"
            class="w-full py-3 px-4 bg-primary hover:bg-blue-600 disabled:bg-primary/50 
                   text-white font-bold rounded-lg transition-colors shadow-lg shadow-primary/25
                   flex items-center justify-center gap-2"
          >
            <span v-if="authStore.isLoading" class="animate-spin rounded-full size-5 border-2 border-white border-t-transparent"></span>
            <span>{{ authStore.isLoading ? 'Signing in...' : 'Sign In' }}</span>
          </button>
        </form>

        <!-- Divider -->
        <div class="relative my-8">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200 dark:border-border-dark"></div>
          </div>
          <div class="relative flex justify-center">
            <span class="px-4 bg-background-light dark:bg-background-dark text-text-secondary text-sm">
              or continue with
            </span>
          </div>
        </div>

        <!-- Social Login -->
        <div class="grid grid-cols-2 gap-4">
          <button class="flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-card-dark transition-colors">
            <svg class="size-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span class="text-sm font-medium text-slate-700 dark:text-gray-300">Google</span>
          </button>
          <button class="flex items-center justify-center gap-2 py-3 px-4 border border-gray-300 dark:border-border-dark rounded-lg hover:bg-gray-50 dark:hover:bg-card-dark transition-colors">
            <svg class="size-5" fill="currentColor" viewBox="0 0 24 24">
              <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/>
            </svg>
            <span class="text-sm font-medium text-slate-700 dark:text-gray-300">GitHub</span>
          </button>
        </div>

        <!-- Sign Up Link -->
        <p class="mt-8 text-center text-text-secondary">
          Don't have an account?
          <RouterLink to="/register" class="text-primary hover:text-blue-400 font-medium transition-colors">
            Create account
          </RouterLink>
        </p>

        <!-- Theme Toggle -->
        <div class="mt-6 flex justify-center">
          <button
            @click="themeStore.toggleTheme"
            class="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">
              {{ themeStore.isDark ? 'light_mode' : 'dark_mode' }}
            </span>
            {{ themeStore.isDark ? 'Light Mode' : 'Dark Mode' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
