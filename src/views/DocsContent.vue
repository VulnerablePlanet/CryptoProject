<script setup>
import { ref } from 'vue'

const activeSection = ref('overview')

const sections = [
  { id: 'overview', name: 'Overview', icon: 'info' },
  { id: 'structure', name: 'Project Structure', icon: 'folder' },
  { id: 'database', name: 'Database', icon: 'database' },
  { id: 'api', name: 'API Endpoints', icon: 'api' },
  { id: 'frontend', name: 'Frontend Modules', icon: 'web' },
  { id: 'realtime', name: 'Real-time Features', icon: 'bolt' },
]

// Database models info
const databaseModels = [
  {
    name: 'User',
    collection: 'users',
    fields: [
      { name: '_id', type: 'ObjectId', desc: 'Unique identifier' },
      { name: 'name', type: 'String', desc: 'User display name' },
      { name: 'email', type: 'String', desc: 'Unique email address' },
      { name: 'password', type: 'String', desc: 'Hashed password (bcrypt)' },
      { name: 'createdAt', type: 'Date', desc: 'Account creation date' },
      { name: 'updatedAt', type: 'Date', desc: 'Last update date' },
    ]
  },
  {
    name: 'Portfolio',
    collection: 'portfolios',
    fields: [
      { name: '_id', type: 'ObjectId', desc: 'Unique identifier' },
      { name: 'user', type: 'ObjectId', desc: 'Reference to User' },
      { name: 'holdings', type: 'Array', desc: 'Array of holding objects' },
      { name: 'holdings.coinId', type: 'String', desc: 'CoinGecko coin ID' },
      { name: 'holdings.symbol', type: 'String', desc: 'Coin symbol (BTC, ETH)' },
      { name: 'holdings.name', type: 'String', desc: 'Coin name' },
      { name: 'holdings.amount', type: 'Number', desc: 'Quantity held' },
      { name: 'holdings.avgBuyPrice', type: 'Number', desc: 'Average purchase price' },
      { name: 'totalInvested', type: 'Number', desc: 'Total USD invested' },
    ]
  },
  {
    name: 'Transaction',
    collection: 'transactions',
    fields: [
      { name: '_id', type: 'ObjectId', desc: 'Unique identifier' },
      { name: 'user', type: 'ObjectId', desc: 'Reference to User' },
      { name: 'type', type: 'Enum', desc: 'buy, sell, transfer_in, transfer_out, deposit, withdraw' },
      { name: 'coinId', type: 'String', desc: 'CoinGecko coin ID' },
      { name: 'symbol', type: 'String', desc: 'Coin symbol' },
      { name: 'coinName', type: 'String', desc: 'Coin name' },
      { name: 'amount', type: 'Number', desc: 'Transaction quantity' },
      { name: 'priceAtTransaction', type: 'Number', desc: 'Price per coin at transaction' },
      { name: 'totalValue', type: 'Number', desc: 'Total transaction value' },
      { name: 'fee', type: 'Number', desc: 'Transaction fee' },
      { name: 'status', type: 'Enum', desc: 'pending, completed, failed, cancelled' },
    ]
  },
  {
    name: 'Watchlist',
    collection: 'watchlists',
    fields: [
      { name: '_id', type: 'ObjectId', desc: 'Unique identifier' },
      { name: 'user', type: 'ObjectId', desc: 'Reference to User' },
      { name: 'coins', type: 'Array', desc: 'Array of watched coins' },
      { name: 'coins.coinId', type: 'String', desc: 'CoinGecko coin ID' },
      { name: 'coins.symbol', type: 'String', desc: 'Coin symbol' },
      { name: 'coins.name', type: 'String', desc: 'Coin name' },
      { name: 'alerts', type: 'Array', desc: 'Price alert configurations' },
      { name: 'alerts.targetPrice', type: 'Number', desc: 'Target price for alert' },
      { name: 'alerts.condition', type: 'Enum', desc: 'above or below' },
    ]
  },
  {
    name: 'Notification',
    collection: 'notifications',
    fields: [
      { name: '_id', type: 'ObjectId', desc: 'Unique identifier' },
      { name: 'user', type: 'ObjectId', desc: 'Reference to User' },
      { name: 'type', type: 'Enum', desc: 'transaction, price_alert, security, system, welcome' },
      { name: 'title', type: 'String', desc: 'Notification title' },
      { name: 'message', type: 'String', desc: 'Notification body' },
      { name: 'read', type: 'Boolean', desc: 'Read status' },
      { name: 'data', type: 'Object', desc: 'Related data (coinId, transactionId, etc)' },
    ]
  }
]

// API endpoints
const apiEndpoints = [
  {
    category: 'Authentication',
    prefix: '/api/auth',
    endpoints: [
      { method: 'POST', path: '/register', desc: 'Create new user account' },
      { method: 'POST', path: '/login', desc: 'Authenticate user and get JWT' },
      { method: 'GET', path: '/me', desc: 'Get current user profile' },
      { method: 'PUT', path: '/profile', desc: 'Update user profile' },
    ]
  },
  {
    category: 'Portfolio',
    prefix: '/api/portfolio',
    endpoints: [
      { method: 'GET', path: '/', desc: 'Get user portfolio' },
      { method: 'POST', path: '/holdings', desc: 'Add new holding' },
      { method: 'PUT', path: '/holdings/:coinId', desc: 'Update holding' },
      { method: 'DELETE', path: '/holdings/:coinId', desc: 'Remove holding' },
    ]
  },
  {
    category: 'Transactions',
    prefix: '/api/transactions',
    endpoints: [
      { method: 'GET', path: '/', desc: 'Get all transactions (with filters)' },
      { method: 'GET', path: '/:id', desc: 'Get single transaction' },
      { method: 'POST', path: '/', desc: 'Create new transaction' },
      { method: 'DELETE', path: '/:id', desc: 'Delete transaction' },
      { method: 'GET', path: '/stats', desc: 'Get transaction statistics' },
    ]
  },
  {
    category: 'Watchlist',
    prefix: '/api/watchlist',
    endpoints: [
      { method: 'GET', path: '/', desc: 'Get user watchlist' },
      { method: 'POST', path: '/coins', desc: 'Add coin to watchlist' },
      { method: 'DELETE', path: '/coins/:coinId', desc: 'Remove coin' },
      { method: 'POST', path: '/alerts', desc: 'Create price alert' },
      { method: 'DELETE', path: '/alerts/:alertId', desc: 'Delete alert' },
      { method: 'PATCH', path: '/alerts/:alertId/toggle', desc: 'Toggle alert' },
    ]
  },
  {
    category: 'Notifications',
    prefix: '/api/notifications',
    endpoints: [
      { method: 'GET', path: '/', desc: 'Get all notifications' },
      { method: 'PATCH', path: '/:id/read', desc: 'Mark as read' },
      { method: 'PATCH', path: '/read-all', desc: 'Mark all as read' },
      { method: 'DELETE', path: '/:id', desc: 'Delete notification' },
    ]
  },
  {
    category: 'CoinGecko API (External)',
    prefix: 'https://api.coingecko.com/api/v3',
    isExternal: true,
    endpoints: [
      { method: 'GET', path: '/coins/markets', desc: 'List coins with market data (price, volume, cap)' },
      { method: 'GET', path: '/coins/{id}', desc: 'Get detailed coin data by ID' },
      { method: 'GET', path: '/coins/{id}/market_chart', desc: 'Historical market data (prices, caps, volumes)' },
      { method: 'GET', path: '/simple/price', desc: 'Simple price lookup for multiple coins' },
      { method: 'GET', path: '/search', desc: 'Search coins, exchanges, categories' },
      { method: 'GET', path: '/coins/{id}/ohlc', desc: 'OHLC candlestick data for charts' },
      { method: 'GET', path: '/global', desc: 'Global cryptocurrency stats' },
      { method: 'GET', path: '/search/trending', desc: 'Top 7 trending coins' },
    ]
  }
]

// Frontend stores
const frontendStores = [
  { name: 'auth', file: 'stores/auth.js', desc: 'User authentication, JWT token management, login/register' },
  { name: 'crypto', file: 'stores/crypto.js', desc: 'Cryptocurrency data from CoinGecko API, real-time price updates' },
  { name: 'portfolio', file: 'stores/portfolio.js', desc: 'User portfolio holdings, CRUD operations' },
  { name: 'transactions', file: 'stores/transactions.js', desc: 'Transaction history, filters, pagination' },
  { name: 'watchlist', file: 'stores/watchlist.js', desc: 'Favorite coins, price alerts management' },
  { name: 'notifications', file: 'stores/notifications.js', desc: 'Real-time notifications, read status' },
  { name: 'theme', file: 'stores/theme.js', desc: 'Dark/light mode toggle, theme persistence' },
  { name: 'ui', file: 'stores/ui.js', desc: 'UI state, sidebar, dropdowns, modals' },
]

const methodColors = {
  GET: 'bg-success text-white',
  POST: 'bg-primary text-white',
  PUT: 'bg-warning text-white',
  PATCH: 'bg-purple-500 text-white',
  DELETE: 'bg-danger text-white',
}
</script>

<template>
  <div class="flex flex-col lg:flex-row gap-6">
    <!-- Sidebar Navigation -->
    <div class="lg:w-64 shrink-0">
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-4 lg:sticky lg:top-6">
        <h3 class="font-bold text-slate-900 dark:text-white mb-4">Documentation</h3>
        <nav class="space-y-1">
          <button
            v-for="section in sections"
            :key="section.id"
            @click="activeSection = section.id"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left"
            :class="activeSection === section.id 
              ? 'bg-primary/10 text-primary font-medium' 
              : 'text-slate-600 dark:text-text-secondary hover:bg-gray-100 dark:hover:bg-border-dark'"
          >
            <span class="material-symbols-outlined text-[20px]">{{ section.icon }}</span>
            {{ section.name }}
          </button>
        </nav>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 min-w-0">
      <!-- Overview Section -->
      <div v-if="activeSection === 'overview'" class="space-y-6">
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-4">Crypto market anomaly detector Documentation</h1>
          <p class="text-text-secondary mb-6">
            A full-stack cryptocurrency portfolio management application built with Vue.js, Node.js, Express, MongoDB, and Socket.io.
          </p>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg text-center">
              <div class="text-3xl font-bold text-primary mb-1">5</div>
              <div class="text-xs text-text-secondary">Database Models</div>
            </div>
            <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg text-center">
              <div class="text-3xl font-bold text-success mb-1">20+</div>
              <div class="text-xs text-text-secondary">API Endpoints</div>
            </div>
            <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg text-center">
              <div class="text-3xl font-bold text-warning mb-1">8</div>
              <div class="text-xs text-text-secondary">Pinia Stores</div>
            </div>
            <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg text-center">
              <div class="text-3xl font-bold text-purple-500 mb-1">10+</div>
              <div class="text-xs text-text-secondary">Vue Pages</div>
            </div>
          </div>

          <h3 class="font-bold text-slate-900 dark:text-white mb-3">Tech Stack</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="text-2xl">⚡</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Vue 3</p>
                <p class="text-xs text-text-secondary">Frontend</p>
              </div>
            </div>
            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="text-2xl">🍍</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Pinia</p>
                <p class="text-xs text-text-secondary">State</p>
              </div>
            </div>
            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="text-2xl">🟢</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Node.js</p>
                <p class="text-xs text-text-secondary">Backend</p>
              </div>
            </div>
            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="text-2xl">🍃</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">MongoDB</p>
                <p class="text-xs text-text-secondary">Database</p>
              </div>
            </div>
            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="text-2xl">🔌</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Socket.io</p>
                <p class="text-xs text-text-secondary">Real-time</p>
              </div>
            </div>
            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="text-2xl">🔐</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">JWT</p>
                <p class="text-xs text-text-secondary">Auth</p>
              </div>
            </div>
            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="text-2xl">🎨</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Tailwind</p>
                <p class="text-xs text-text-secondary">Styling</p>
              </div>
            </div>
            <div class="flex items-center gap-2 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="text-2xl">🦎</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">CoinGecko</p>
                <p class="text-xs text-text-secondary">API</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Project Structure Section -->
      <div v-if="activeSection === 'structure'" class="space-y-6">
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4">Project Structure</h2>
          
          <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto font-mono text-sm">
            <pre class="text-gray-300">crypto-market-anomaly-detector/
├── <span class="text-yellow-400">server/</span>                    # Backend Node.js
│   ├── <span class="text-blue-400">config/</span>
│   │   └── db.js              # MongoDB connection
│   ├── <span class="text-blue-400">controllers/</span>
│   │   ├── authController.js
│   │   ├── portfolioController.js
│   │   ├── transactionController.js
│   │   ├── watchlistController.js
│   │   └── notificationController.js
│   ├── <span class="text-blue-400">middleware/</span>
│   │   └── auth.js            # JWT authentication
│   ├── <span class="text-blue-400">models/</span>
│   │   ├── User.js
│   │   ├── Portfolio.js
│   │   ├── Transaction.js
│   │   ├── Watchlist.js
│   │   └── Notification.js
│   ├── <span class="text-blue-400">routes/</span>
│   │   ├── auth.js
│   │   ├── portfolio.js
│   │   ├── transactions.js
│   │   ├── watchlist.js
│   │   └── notifications.js
│   ├── <span class="text-blue-400">services/</span>
│   │   └── priceService.js    # CoinGecko price fetching
│   ├── <span class="text-blue-400">socket/</span>
│   │   └── index.js           # Socket.io configuration
│   ├── index.js               # Server entry point
│   └── .env                   # Environment variables
│
├── <span class="text-green-400">src/</span>                       # Frontend Vue.js
│   ├── <span class="text-blue-400">components/</span>
│   │   ├── <span class="text-purple-400">common/</span>            # Shared components
│   │   ├── <span class="text-purple-400">layout/</span>            # Layout components
│   │   └── <span class="text-purple-400">wallet/</span>            # Wallet-specific
│   ├── <span class="text-blue-400">services/</span>
│   │   ├── coingecko.js       # API service
│   │   └── socket.js          # Socket.io client
│   ├── <span class="text-blue-400">stores/</span>                # Pinia stores
│   │   ├── auth.js
│   │   ├── crypto.js
│   │   ├── portfolio.js
│   │   ├── transactions.js
│   │   ├── watchlist.js
│   │   ├── notifications.js
│   │   ├── theme.js
│   │   └── ui.js
│   ├── <span class="text-blue-400">views/</span>                 # Page components
│   │   ├── DashboardContent.vue
│   │   ├── TradingContent.vue
│   │   ├── WalletContent.vue
│   │   ├── TransactionsContent.vue
│   │   ├── WatchlistContent.vue
│   │   ├── LearnContent.vue
│   │   ├── SecurityContent.vue
│   │   ├── ApiKeysContent.vue
│   │   └── ProfileContent.vue
│   ├── <span class="text-blue-400">router/</span>
│   │   └── index.js           # Vue Router config
│   ├── App.vue
│   └── main.js
│
├── vite.config.js             # Vite configuration
├── tailwind.config.js         # Tailwind CSS config
└── package.json</pre>
          </div>
        </div>
      </div>

      <!-- Database Section -->
      <div v-if="activeSection === 'database'" class="space-y-6">
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Database Schema</h2>
          <p class="text-text-secondary mb-6">MongoDB collections and their document structure</p>
          
          <div class="space-y-6">
            <div 
              v-for="model in databaseModels"
              :key="model.name"
              class="border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden"
            >
              <div class="bg-gray-50 dark:bg-background-dark p-4 border-b border-gray-200 dark:border-border-dark">
                <h3 class="font-bold text-slate-900 dark:text-white">{{ model.name }}</h3>
                <p class="text-xs text-text-secondary font-mono">Collection: {{ model.collection }}</p>
              </div>
              <div class="divide-y divide-gray-100 dark:divide-border-dark/50">
                <div 
                  v-for="field in model.fields"
                  :key="field.name"
                  class="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <div class="flex items-center gap-3">
                    <code class="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{{ field.name }}</code>
                    <span class="text-xs text-text-secondary">{{ field.desc }}</span>
                  </div>
                  <span class="text-xs font-mono text-slate-500 dark:text-gray-400 bg-gray-100 dark:bg-border-dark px-2 py-0.5 rounded">{{ field.type }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Endpoints Section -->
      <div v-if="activeSection === 'api'" class="space-y-6">
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">API Endpoints</h2>
          <p class="text-text-secondary mb-6">RESTful API endpoints available on the backend</p>
          
          <div class="space-y-6">
            <div 
              v-for="category in apiEndpoints"
              :key="category.category"
              class="border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden"
            >
              <div class="bg-gray-50 dark:bg-background-dark p-4 border-b border-gray-200 dark:border-border-dark">
                <h3 class="font-bold text-slate-900 dark:text-white">{{ category.category }}</h3>
                <p class="text-xs text-text-secondary font-mono">{{ category.prefix }}</p>
              </div>
              <div class="divide-y divide-gray-100 dark:divide-border-dark/50">
                <div 
                  v-for="endpoint in category.endpoints"
                  :key="endpoint.path"
                  class="flex items-center gap-4 p-3 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <span 
                    class="text-xs font-bold px-2 py-1 rounded w-16 text-center"
                    :class="methodColors[endpoint.method]"
                  >
                    {{ endpoint.method }}
                  </span>
                  <code class="text-sm font-mono text-slate-700 dark:text-gray-300 flex-1">{{ category.prefix }}{{ endpoint.path }}</code>
                  <span class="text-xs text-text-secondary hidden md:block">{{ endpoint.desc }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Frontend Modules Section -->
      <div v-if="activeSection === 'frontend'" class="space-y-6">
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Frontend Modules</h2>
          <p class="text-text-secondary mb-6">Pinia stores for state management</p>
          
          <div class="space-y-3">
            <div 
              v-for="store in frontendStores"
              :key="store.name"
              class="flex items-start gap-4 p-4 bg-gray-50 dark:bg-background-dark rounded-xl"
            >
              <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-primary">inventory_2</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h4 class="font-bold text-slate-900 dark:text-white">{{ store.name }}</h4>
                  <code class="text-xs text-text-secondary bg-gray-200 dark:bg-border-dark px-2 py-0.5 rounded">{{ store.file }}</code>
                </div>
                <p class="text-sm text-text-secondary">{{ store.desc }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
          <h3 class="font-bold text-slate-900 dark:text-white mb-4">Vue Pages</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">dashboard</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Dashboard</p>
                <p class="text-xs text-text-secondary">/dashboard</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">candlestick_chart</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Trading</p>
                <p class="text-xs text-text-secondary">/trading</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">account_balance_wallet</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Wallet</p>
                <p class="text-xs text-text-secondary">/wallet</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">receipt_long</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Transactions</p>
                <p class="text-xs text-text-secondary">/transactions</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">star</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Watchlist</p>
                <p class="text-xs text-text-secondary">/watchlist</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">school</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Learn</p>
                <p class="text-xs text-text-secondary">/learn</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">verified_user</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">Security</p>
                <p class="text-xs text-text-secondary">/security</p>
              </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-background-dark rounded-lg">
              <span class="material-symbols-outlined text-primary">terminal</span>
              <div>
                <p class="font-medium text-slate-900 dark:text-white text-sm">API Keys</p>
                <p class="text-xs text-text-secondary">/api-keys</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Real-time Features Section -->
      <div v-if="activeSection === 'realtime'" class="space-y-6">
        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
          <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Real-time Features</h2>
          <p class="text-text-secondary mb-6">Socket.io events and real-time functionality</p>
          
          <div class="space-y-4">
            <div class="p-4 border border-gray-200 dark:border-border-dark rounded-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="size-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-success">trending_up</span>
                </div>
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white">Price Updates</h4>
                  <p class="text-xs text-text-secondary">Event: priceUpdate</p>
                </div>
              </div>
              <p class="text-sm text-text-secondary">Broadcasts cryptocurrency prices from CoinGecko every 30 seconds to all connected clients.</p>
            </div>

            <div class="p-4 border border-gray-200 dark:border-border-dark rounded-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-primary">account_balance_wallet</span>
                </div>
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white">Portfolio Updates</h4>
                  <p class="text-xs text-text-secondary">Event: portfolioUpdate</p>
                </div>
              </div>
              <p class="text-sm text-text-secondary">Sends portfolio changes to specific user after transactions are recorded.</p>
            </div>

            <div class="p-4 border border-gray-200 dark:border-border-dark rounded-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="size-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-warning">notifications</span>
                </div>
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white">Notifications</h4>
                  <p class="text-xs text-text-secondary">Event: notification</p>
                </div>
              </div>
              <p class="text-sm text-text-secondary">Pushes real-time notifications to users (transaction alerts, price alerts, etc).</p>
            </div>

            <div class="p-4 border border-gray-200 dark:border-border-dark rounded-xl">
              <div class="flex items-center gap-3 mb-3">
                <div class="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-purple-500">swap_horiz</span>
                </div>
                <div>
                  <h4 class="font-bold text-slate-900 dark:text-white">New Transactions</h4>
                  <p class="text-xs text-text-secondary">Event: newTransaction</p>
                </div>
              </div>
              <p class="text-sm text-text-secondary">Notifies client when a new transaction is created for real-time list updates.</p>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
          <h3 class="font-bold text-slate-900 dark:text-white mb-4">Socket.io Architecture</h3>
          <div class="bg-gray-900 rounded-lg p-4 overflow-x-auto font-mono text-sm">
            <pre class="text-gray-300"><span class="text-green-400">// Server-side emission</span>
socketHelpers.emitToUser(userId, 'notification', data)
socketHelpers.emitPortfolioUpdate(userId, portfolio)
io.emit('priceUpdate', prices) <span class="text-gray-500">// Broadcast to all</span>

<span class="text-green-400">// Client-side listening</span>
socket.on('notification', (data) => { ... })
socket.on('priceUpdate', (prices) => { ... })
socket.on('portfolioUpdate', (portfolio) => { ... })</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
