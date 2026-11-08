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
    meta: { title: 'Sign In', requiresAuth: false, guestOnly: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterPage.vue'),
    meta: { title: 'Create Account', requiresAuth: false, guestOnly: true }
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
        component: () => import('@/views/DashboardContent.vue'),
        meta: { title: 'Dashboard' }
      },
      {
        path: 'trading',
        name: 'trading',
        component: () => import('@/views/TradingContent.vue'),
        meta: { title: 'Trade' }
      },
      {
        path: 'wallet',
        name: 'wallet',
        component: () => import('@/views/WalletContent.vue'),
        meta: { title: 'Wallet' }
      },
      {
        path: 'transactions',
        name: 'transactions',
        component: () => import('@/views/TransactionsContent.vue'),
        meta: { title: 'Transactions' }
      },
      {
        path: 'watchlist',
        name: 'watchlist',
        component: () => import('@/views/WatchlistContent.vue'),
        meta: { title: 'Watchlist' }
      },
      {
        path: 'learn',
        name: 'learn',
        component: () => import('@/views/LearnContent.vue'),
        meta: { title: 'Learn' }
      },
      {
        path: 'security',
        name: 'security',
        component: () => import('@/views/SecurityContent.vue'),
        meta: { title: 'Security' }
      },
      {
        path: 'settings/api-keys',
        name: 'api-keys',
        component: () => import('@/views/ApiKeysContent.vue'),
        meta: { title: 'API Keys' }
      },
      {
        path: 'settings/users',
        name: 'users',
        component: () => import('@/views/UsersContent.vue'),
        meta: { title: 'Usuarios' }
      },
      {
        path: 'docs',
        name: 'docs',
        component: () => import('@/views/DocsContent.vue'),
        meta: { title: 'Documentation' }
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('@/views/ProfileContent.vue'),
        meta: { title: 'Profile' }
      },
      {
        path: 'technical-analysis',
        name: 'technical-analysis',
        component: () => import('@/views/TechnicalAnalysisContent.vue'),
        meta: { title: 'Technical Analysis' }
      },
      {
        path: 'tradingview',
        name: 'tradingview',
        component: () => import('@/views/TradingViewContent.vue'),
        meta: { title: 'TradingView Charts' }
      },
      {
        path: 'fibonacci',
        name: 'fibonacci',
        component: () => import('@/views/FibonacciContent.vue'),
        meta: { title: 'Análisis Fibonacci' }
      },
      {
        path: 'pro-trading',
        name: 'pro-trading',
        component: () => import('@/views/ProTradingContent.vue'),
        meta: { title: 'Pro Trading' }
      },
      {
        path: 'talib',
        name: 'talib',
        component: () => import('@/views/TALibContent.vue'),
        meta: { title: 'TA-Lib Advanced' }
      },
      {
        path: 'predictions',
        name: 'predictions',
        component: () => import('@/views/PredictionsContent.vue'),
        meta: { title: 'Predictions' }
      },
      {
        path: 'fibonacci-ccxt',
        name: 'fibonacci-ccxt',
        component: () => import('@/views/FibonacciCcxtContent.vue'),
        meta: { title: 'Fibonacci Multi-Exchange' }
      },
      {
        path: 'bot-trading',
        name: 'bot-trading',
        component: () => import('@/views/BotTradingContent.vue'),
        meta: { title: 'Trading Bot' }
      }
    ]
  },
  
  // 404 Not Found
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundContent.vue'),
    meta: { title: 'Page Not Found' }
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

// Keep the browser tab in sync with the current module
const APP_NAME = 'Crypto market anomaly detector'
router.afterEach((to) => {
  const title = to.meta.title
  document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
})

export default router
