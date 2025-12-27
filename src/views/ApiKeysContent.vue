<script setup>
import { ref, computed } from 'vue'

// API Keys state
const apiKeys = ref([
  {
    id: 1,
    name: 'Trading Bot',
    key: 'sk_live_...a3f5',
    permissions: ['read', 'trade'],
    created: '2024-01-15',
    lastUsed: '2 hours ago',
    active: true
  },
  {
    id: 2,
    name: 'Portfolio Tracker',
    key: 'sk_live_...b2d8',
    permissions: ['read'],
    created: '2024-02-20',
    lastUsed: '1 day ago',
    active: true
  }
])

// Create key modal
const showCreateModal = ref(false)
const newKeyForm = ref({
  name: '',
  permissions: {
    read: true,
    trade: false,
    withdraw: false
  }
})

// Generated key display
const showGeneratedKey = ref(false)
const generatedKey = ref('')

const permissionLabels = {
  read: { label: 'Read', desc: 'View account data and prices', icon: 'visibility' },
  trade: { label: 'Trade', desc: 'Execute buy/sell orders', icon: 'swap_horiz' },
  withdraw: { label: 'Withdraw', desc: 'Withdraw funds (high risk)', icon: 'output' }
}

const createApiKey = () => {
  // Generate fake API key
  const newKey = `sk_live_${Math.random().toString(36).substring(2, 15)}`
  generatedKey.value = newKey
  
  const permissions = Object.entries(newKeyForm.value.permissions)
    .filter(([_, enabled]) => enabled)
    .map(([perm]) => perm)
  
  apiKeys.value.push({
    id: Date.now(),
    name: newKeyForm.value.name,
    key: `${newKey.substring(0, 8)}...${newKey.substring(newKey.length - 4)}`,
    fullKey: newKey,
    permissions,
    created: new Date().toISOString().split('T')[0],
    lastUsed: 'Never',
    active: true
  })
  
  showCreateModal.value = false
  showGeneratedKey.value = true
  
  // Reset form
  newKeyForm.value = {
    name: '',
    permissions: { read: true, trade: false, withdraw: false }
  }
}

const deleteKey = (id) => {
  if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
    apiKeys.value = apiKeys.value.filter(k => k.id !== id)
  }
}

const toggleKey = (id) => {
  const key = apiKeys.value.find(k => k.id === id)
  if (key) {
    key.active = !key.active
  }
}

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
  // TODO: Show toast notification
}

const getPermissionColor = (perm) => {
  const colors = {
    read: 'text-success bg-success/10',
    trade: 'text-warning bg-warning/10',
    withdraw: 'text-danger bg-danger/10'
  }
  return colors[perm] || 'text-gray-500 bg-gray-100'
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h1>
        <p class="text-slate-500 dark:text-text-secondary text-sm">Manage your API keys for programmatic access</p>
      </div>
      <button
        @click="showCreateModal = true"
        class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
        Create New Key
      </button>
    </div>

    <!-- Security Warning -->
    <div class="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-4">
      <span class="material-symbols-outlined text-warning shrink-0">warning</span>
      <div>
        <h4 class="font-medium text-slate-900 dark:text-white">Keep your API keys secure</h4>
        <p class="text-sm text-text-secondary mt-1">Never share your API keys or commit them to version control. Treat them like passwords.</p>
      </div>
    </div>

    <!-- API Keys List -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <!-- Empty State -->
      <div v-if="apiKeys.length === 0" class="p-12 text-center">
        <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">key</span>
        <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">No API keys yet</h3>
        <p class="text-text-secondary mb-6">Create an API key to integrate with external services</p>
        <button
          @click="showCreateModal = true"
          class="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
          Create Your First Key
        </button>
      </div>

      <!-- Keys Table -->
      <table v-else class="w-full">
        <thead class="bg-gray-50 dark:bg-background-dark border-b border-gray-200 dark:border-border-dark">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Key</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase hidden md:table-cell">Permissions</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase hidden lg:table-cell">Last Used</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-border-dark/50">
          <tr 
            v-for="key in apiKeys"
            :key="key.id"
            class="hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <td class="px-6 py-4">
              <p class="font-medium text-slate-900 dark:text-white">{{ key.name }}</p>
              <p class="text-xs text-text-secondary">Created {{ key.created }}</p>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <code class="text-sm font-mono text-slate-600 dark:text-gray-400 bg-gray-100 dark:bg-border-dark px-2 py-1 rounded">{{ key.key }}</code>
                <button 
                  @click="copyToClipboard(key.fullKey || key.key)"
                  class="p-1 hover:bg-gray-100 dark:hover:bg-border-dark rounded"
                  title="Copy"
                >
                  <span class="material-symbols-outlined text-[16px] text-text-secondary">content_copy</span>
                </button>
              </div>
            </td>
            <td class="px-6 py-4 hidden md:table-cell">
              <div class="flex gap-1">
                <span 
                  v-for="perm in key.permissions"
                  :key="perm"
                  class="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  :class="getPermissionColor(perm)"
                >
                  {{ perm }}
                </span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-text-secondary hidden lg:table-cell">{{ key.lastUsed }}</td>
            <td class="px-6 py-4">
              <span 
                class="text-xs px-2 py-1 rounded-full font-medium"
                :class="key.active ? 'bg-success/10 text-success' : 'bg-gray-100 dark:bg-border-dark text-text-secondary'"
              >
                {{ key.active ? 'Active' : 'Disabled' }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button 
                  @click="toggleKey(key.id)"
                  class="p-1.5 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg transition-colors"
                  :title="key.active ? 'Disable' : 'Enable'"
                >
                  <span class="material-symbols-outlined text-[18px] text-text-secondary">
                    {{ key.active ? 'pause' : 'play_arrow' }}
                  </span>
                </button>
                <button 
                  @click="deleteKey(key.id)"
                  class="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <span class="material-symbols-outlined text-[18px] text-slate-400 hover:text-danger">delete</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- API Documentation -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
      <h3 class="font-bold text-slate-900 dark:text-white mb-4">Quick Start</h3>
      <div class="bg-gray-900 dark:bg-background-dark rounded-lg p-4 overflow-x-auto">
        <pre class="text-sm text-gray-300"><code>curl -X GET "https://api.cryptodev.com/v1/account" \
  -H "Authorization: Bearer YOUR_API_KEY"</code></pre>
      </div>
      <p class="text-sm text-text-secondary mt-4">
        View our <a href="#" class="text-primary hover:underline">API documentation</a> for more examples and endpoints.
      </p>
    </div>

    <!-- Create Key Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showCreateModal" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="showCreateModal = false"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark">
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Create API Key</h2>
              <button @click="showCreateModal = false" class="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg">
                <span class="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>
            <div class="p-6 space-y-5">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Key Name</label>
                <input 
                  v-model="newKeyForm.name"
                  type="text"
                  placeholder="e.g., Trading Bot"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">Permissions</label>
                <div class="space-y-3">
                  <label 
                    v-for="(info, perm) in permissionLabels"
                    :key="perm"
                    class="flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors"
                    :class="newKeyForm.permissions[perm] 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-200 dark:border-border-dark'"
                  >
                    <input 
                      type="checkbox" 
                      v-model="newKeyForm.permissions[perm]"
                      class="mt-0.5"
                    />
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-[18px] text-text-secondary">{{ info.icon }}</span>
                        <span class="font-medium text-slate-900 dark:text-white">{{ info.label }}</span>
                      </div>
                      <p class="text-xs text-text-secondary mt-0.5">{{ info.desc }}</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div class="flex gap-3 p-6 border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark">
              <button @click="showCreateModal = false" class="flex-1 py-3 px-4 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors">Cancel</button>
              <button 
                @click="createApiKey" 
                :disabled="!newKeyForm.name"
                class="flex-1 py-3 px-4 bg-primary hover:bg-blue-600 disabled:bg-primary/50 text-white font-bold rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                Create Key
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Generated Key Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showGeneratedKey" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="p-6 text-center">
              <div class="size-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-success text-[32px]">check_circle</span>
              </div>
              <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">API Key Created!</h2>
              <p class="text-sm text-text-secondary mb-4">Copy your key now. You won't be able to see it again.</p>
              <div class="bg-gray-100 dark:bg-border-dark rounded-lg p-4 mb-4">
                <code class="text-sm font-mono text-slate-900 dark:text-white break-all">{{ generatedKey }}</code>
              </div>
              <div class="flex gap-3">
                <button 
                  @click="copyToClipboard(generatedKey)"
                  class="flex-1 py-2 px-4 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span class="material-symbols-outlined text-[18px]">content_copy</span>
                  Copy Key
                </button>
                <button 
                  @click="showGeneratedKey = false"
                  class="flex-1 py-2 px-4 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
