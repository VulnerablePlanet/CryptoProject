import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  // Public routes (no layout)
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomePage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginPage.vue'),
    meta: { requiresAuth: false, guestOnly: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterPage.vue'),
    meta: { requiresAuth: false, guestOnly: true }
  },
  
  // Protected routes with AuthLayout
  {
    path: '/',
    component: () => import('@/components/layout/AuthLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardContent.vue')
      },
      {
        path: 'trading',
        name: 'trading',
        component: () => import('@/views/TradingContent.vue')
      },
      {
        path: 'wallet',
        name: 'wallet',
        component: () => import('@/views/WalletContent.vue')
      },
      {
        path: 'transactions',
        name: 'transactions',
        component: () => import('@/views/TransactionsContent.vue')
      },
      {
        path: 'watchlist',
        name: 'watchlist',
        component: () => import('@/views/WatchlistContent.vue')
      },
      {
        path: 'learn',
        name: 'learn',
        component: () => import('@/views/LearnContent.vue')
      },
      {
        path: 'security',
        name: 'security',
        component: () => import('@/views/SecurityContent.vue')
      },
      {
        path: 'settings/api-keys',
        name: 'api-keys',
        component: () => import('@/views/ApiKeysContent.vue')
      },
      {
        path: 'settings/users',
        name: 'users',
        component: () => import('@/views/UsersContent.vue')
      },
      {
        path: 'docs',
        name: 'docs',
        component: () => import('@/views/DocsContent.vue')
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/ProfileContent.vue')
      },
      {
        path: 'pokemon',
        name: 'pokemon',
        component: () => import('@/views/PokemonContent.vue')
      },
      {
        path: 'technical-analysis',
        name: 'technical-analysis',
        component: () => import('@/views/TechnicalAnalysisContent.vue')
      },
      {
        path: 'tradingview',
        name: 'tradingview',
        component: () => import('@/views/TradingViewContent.vue')
      },
      {
        path: 'fibonacci',
        name: 'fibonacci',
        component: () => import('@/views/FibonacciContent.vue')
      },
      {
        path: 'pro-trading',
        name: 'pro-trading',
        component: () => import('@/views/ProTradingContent.vue')
      },
      {
        path: 'talib',
        name: 'talib',
        component: () => import('@/views/TALibContent.vue')
      },
      {
        path: 'predictions',
        name: 'predictions',
        component: () => import('@/views/PredictionsContent.vue')
      },
      {
        path: 'fibonacci-ccxt',
        name: 'fibonacci-ccxt',
        component: () => import('@/views/FibonacciCcxtContent.vue')
      },
      {
        path: 'bot-trading',
        name: 'bot-trading',
        component: () => import('@/views/BotTradingContent.vue')
      }
    ]
  },
  
  // Catch-all redirect
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  }
})

// Navigation guards
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  // Check if route or parent requires authentication
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const guestOnly = to.matched.some(record => record.meta.guestOnly)
  
  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }
  
  if (guestOnly && authStore.isAuthenticated) {
    next({ name: 'dashboard' })
    return
  }
  
  next()
})

export default router
