<script setup>
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const agreeTerms = ref(false)

const handleRegister = async () => {
  if (!agreeTerms.value) {
    authStore.error = 'You must agree to the terms and conditions'
    return
  }
  
  const result = await authStore.register(
    name.value, 
    email.value, 
    password.value, 
    confirmPassword.value
  )
  
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
        <div class="absolute top-20 right-20 w-64 h-64 border border-white/30 rounded-full"></div>
        <div class="absolute bottom-20 left-20 w-96 h-96 border border-white/20 rounded-full"></div>
        <div class="absolute top-1/3 left-1/2 w-48 h-48 border border-white/20 rounded-full"></div>
      </div>
      
      <!-- Content -->
      <div class="relative z-10 flex flex-col justify-center px-16">
        <img src="/logo.png" alt="Crypto market anomaly detector" class="size-16 text-white mb-8" />
        <h1 class="text-4xl font-black text-white mb-4">Join Crypto market anomaly detector</h1>
        <p class="text-xl text-white/80 max-w-md">
          Start your crypto journey with an exchange designed for those who understand security.
        </p>
        
        <div class="mt-12 space-y-4">
          <div class="flex items-center gap-3 text-white/70">
            <span class="material-symbols-outlined text-[20px] text-success">check_circle</span>
            <span>No hidden fees on trading</span>
          </div>
          <div class="flex items-center gap-3 text-white/70">
            <span class="material-symbols-outlined text-[20px] text-success">check_circle</span>
            <span>Full API access from day one</span>
          </div>
          <div class="flex items-center gap-3 text-white/70">
            <span class="material-symbols-outlined text-[20px] text-success">check_circle</span>
            <span>Cold storage for 95% of assets</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Side - Register Form -->
    <div class="flex-1 flex items-center justify-center p-8 overflow-y-auto">
      <div class="w-full max-w-md py-8">
        <!-- Mobile Logo -->
        <div class="lg:hidden flex items-center gap-3 mb-8">
          <img src="/logo.png" alt="Crypto market anomaly detector" class="size-10" />
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Crypto market anomaly detector</h1>
        </div>

        <!-- Header -->
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-slate-900 dark:text-white mb-2">Create account</h2>
          <p class="text-text-secondary">Get started with your free account today</p>
        </div>

        <!-- Error Message -->
        <div 
          v-if="authStore.error"
          class="mb-6 p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ authStore.error }}
        </div>

        <!-- Register Form -->
        <form @submit.prevent="handleRegister" class="space-y-5">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">
                person
              </span>
              <input
                v-model="name"
                type="text"
                placeholder="John Doe"
                class="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                       bg-white dark:bg-card-dark text-slate-900 dark:text-white 
                       placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                       transition-all outline-none"
                required
              />
            </div>
          </div>

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
                placeholder="Min. 6 characters"
                class="w-full pl-12 pr-12 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                       bg-white dark:bg-card-dark text-slate-900 dark:text-white 
                       placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                       transition-all outline-none"
                required
                minlength="6"
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

          <!-- Confirm Password -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">
                lock
              </span>
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Repeat your password"
                class="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark 
                       bg-white dark:bg-card-dark text-slate-900 dark:text-white 
                       placeholder-text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 
                       transition-all outline-none"
                required
              />
            </div>
          </div>

          <!-- Terms -->
          <div class="flex items-start gap-3">
            <input 
              v-model="agreeTerms"
              type="checkbox" 
              class="mt-1 size-4 rounded border-gray-300 text-primary focus:ring-primary" 
            />
            <span class="text-sm text-slate-600 dark:text-gray-400">
              I agree to the 
              <a href="#" class="text-primary hover:text-blue-400">Terms of Service</a> 
              and 
              <a href="#" class="text-primary hover:text-blue-400">Privacy Policy</a>
            </span>
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
            <span>{{ authStore.isLoading ? 'Creating account...' : 'Create Account' }}</span>
          </button>
        </form>

        <!-- Sign In Link -->
        <p class="mt-8 text-center text-text-secondary">
          Already have an account?
          <RouterLink to="/login" class="text-primary hover:text-blue-400 font-medium transition-colors">
            Sign in
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
