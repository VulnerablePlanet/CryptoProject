<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// API Keys state
const apiKeys = ref([])
const isLoading = ref(false)
const error = ref('')

// Create key modal
const showCreateModal = ref(false)
const isCreating = ref(false)
const newKeyForm = ref({
  name: '',
  apiKey: '',
  provider: 'CoinGecko',
  rateLimit: '30 calls/min'
})

// Success message
const showSuccessMessage = ref(false)

// Provider options
const providerOptions = ['CoinGecko', 'Binance', 'Coinbase', 'Kraken', 'Custom']
const rateLimitOptions = ['10 calls/min', '30 calls/min', '60 calls/min', '100 calls/min', 'Unlimited', 'N/A']

// Load API keys from backend
const loadApiKeys = async () => {
  if (!authStore.isAuthenticated) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    const response = await fetch('/api/apikeys', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      apiKeys.value = data.map(key => ({
        ...key,
        id: key._id,
        key: key.keyPreview
      }))
    } else {
      error.value = 'Error al cargar las API keys'
    }
  } catch (err) {
    console.error('Error loading API keys:', err)
    error.value = 'Error de conexión'
  } finally {
    isLoading.value = false
  }
}

const createApiKey = async () => {
  if (!newKeyForm.value.name.trim() || !newKeyForm.value.apiKey.trim()) return
  
  isCreating.value = true
  error.value = ''
  
  try {
    const response = await fetch('/api/apikeys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        name: newKeyForm.value.name,
        apiKey: newKeyForm.value.apiKey,
        provider: newKeyForm.value.provider,
        rateLimit: newKeyForm.value.rateLimit
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      
      // Add to local state
      apiKeys.value.unshift({
        id: data._id,
        name: data.name,
        key: data.keyPreview,
        fullKey: data.fullKey,
        provider: data.provider,
        rateLimit: data.rateLimit,
        active: data.active,
        createdAt: data.createdAt
      })
      
      // Show success message
      showCreateModal.value = false
      showSuccessMessage.value = true
      setTimeout(() => showSuccessMessage.value = false, 3000)
      
      // Reset form
      newKeyForm.value = {
        name: '',
        apiKey: '',
        provider: 'CoinGecko',
        rateLimit: '30 calls/min'
      }
    } else {
      const errData = await response.json()
      error.value = errData.message || 'Error al crear la API key'
    }
  } catch (err) {
    console.error('Error creating API key:', err)
    error.value = 'Error de conexión'
  } finally {
    isCreating.value = false
  }
}

const deleteKey = async (id) => {
  if (!confirm('¿Estás seguro de que deseas eliminar esta API key? Esta acción no se puede deshacer.')) {
    return
  }
  
  try {
    const response = await fetch(`/api/apikeys/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      apiKeys.value = apiKeys.value.filter(k => k.id !== id)
    } else {
      error.value = 'Error al eliminar la API key'
    }
  } catch (err) {
    console.error('Error deleting API key:', err)
    error.value = 'Error de conexión'
  }
}

const toggleKey = async (id) => {
  try {
    const response = await fetch(`/api/apikeys/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      const key = apiKeys.value.find(k => k.id === id)
      if (key) {
        key.active = data.active
      }
    } else {
      error.value = 'Error al actualizar la API key'
    }
  } catch (err) {
    console.error('Error toggling API key:', err)
    error.value = 'Error de conexión'
  }
}

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text)
}

const getProviderLogo = (provider) => {
  if (provider === 'CoinGecko') return '/images/coingecko-logo.png'
  return null
}

onMounted(() => {
  loadApiKeys()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h1>
        <p class="text-slate-500 dark:text-text-secondary text-sm">Gestiona tus claves API para usar en la aplicación</p>
      </div>
      <button
        @click="showCreateModal = true"
        :disabled="!authStore.isAuthenticated"
        class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 disabled:bg-primary/50 text-white font-medium rounded-lg transition-colors shadow-lg shadow-primary/20"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
        Agregar API Key
      </button>
    </div>

    <!-- Error message -->
    <div v-if="error" class="bg-danger/10 border border-danger/30 rounded-xl p-4 flex gap-4">
      <span class="material-symbols-outlined text-danger shrink-0">error</span>
      <p class="text-sm text-danger">{{ error }}</p>
    </div>

    <!-- Not authenticated warning -->
    <div v-if="!authStore.isAuthenticated" class="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-4">
      <span class="material-symbols-outlined text-warning shrink-0">warning</span>
      <div>
        <h4 class="font-medium text-slate-900 dark:text-white">Inicia sesión para gestionar tus API keys</h4>
        <p class="text-sm text-text-secondary mt-1">Necesitas estar autenticado para crear y gestionar tus claves API.</p>
      </div>
    </div>

    <!-- Security Warning -->
    <div v-else class="bg-warning/10 border border-warning/30 rounded-xl p-4 flex gap-4">
      <span class="material-symbols-outlined text-warning shrink-0">warning</span>
      <div>
        <h4 class="font-medium text-slate-900 dark:text-white">Mantén tus API keys seguras</h4>
        <p class="text-sm text-text-secondary mt-1">Nunca compartas tus API keys ni las guardes en control de versiones. Trátalas como contraseñas.</p>
      </div>
    </div>

    <!-- API Keys List -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="p-12 text-center">
        <span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
        <p class="text-text-secondary mt-4">Cargando API keys...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="apiKeys.length === 0 && authStore.isAuthenticated" class="p-12 text-center">
        <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">key</span>
        <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">No tienes API keys guardadas</h3>
        <p class="text-text-secondary mb-6">Agrega tus claves API de CoinGecko u otros proveedores</p>
        <button
          @click="showCreateModal = true"
          class="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
          Agregar Tu Primera Key
        </button>
      </div>

      <!-- Keys Table -->
      <table v-else-if="apiKeys.length > 0" class="w-full">
        <thead class="bg-gray-50 dark:bg-background-dark border-b border-gray-200 dark:border-border-dark">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Nombre</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">API Key</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase hidden md:table-cell">Proveedor</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase hidden lg:table-cell">Rate Limit</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Estado</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-text-secondary uppercase">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-border-dark/50">
          <tr 
            v-for="key in apiKeys"
            :key="key.id"
            class="hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <img v-if="getProviderLogo(key.provider)" :src="getProviderLogo(key.provider)" :alt="key.provider" class="size-6 rounded" />
                <div>
                  <p class="font-medium text-slate-900 dark:text-white">{{ key.name }}</p>
                  <p class="text-xs text-text-secondary">{{ key.provider || 'Custom' }}</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-2">
                <code class="text-sm font-mono text-slate-600 dark:text-gray-400 bg-gray-100 dark:bg-border-dark px-2 py-1 rounded">{{ key.key }}</code>
                <button 
                  @click="copyToClipboard(key.fullKey || key.key)"
                  class="p-1 hover:bg-gray-100 dark:hover:bg-border-dark rounded"
                  title="Copiar"
                >
                  <span class="material-symbols-outlined text-[16px] text-text-secondary">content_copy</span>
                </button>
              </div>
            </td>
            <td class="px-6 py-4 hidden md:table-cell">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-primary">{{ key.provider || 'Custom' }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-text-secondary hidden lg:table-cell">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                {{ key.rateLimit || 'N/A' }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span 
                class="text-xs px-2 py-1 rounded-full font-medium"
                :class="key.active ? 'bg-success/10 text-success' : 'bg-gray-100 dark:bg-border-dark text-text-secondary'"
              >
                {{ key.active ? 'Activa' : 'Inactiva' }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button 
                  @click="toggleKey(key.id)"
                  class="p-1.5 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg transition-colors"
                  :title="key.active ? 'Desactivar' : 'Activar'"
                >
                  <span class="material-symbols-outlined text-[18px] text-text-secondary">
                    {{ key.active ? 'pause' : 'play_arrow' }}
                  </span>
                </button>
                <button 
                  @click="deleteKey(key.id)"
                  class="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <span class="material-symbols-outlined text-[18px] text-slate-400 hover:text-danger">delete</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CoinGecko API Documentation -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
      <h3 class="font-bold text-slate-900 dark:text-white mb-4">CoinGecko API - Inicio Rápido</h3>
      <p class="text-sm text-text-secondary mb-4">
        Esta aplicación utiliza la API de CoinGecko para obtener datos de mercado en tiempo real.
      </p>
      <div class="bg-gray-900 dark:bg-background-dark rounded-lg p-4 overflow-x-auto mb-4">
        <pre class="text-sm text-gray-300"><code># Obtener precios de mercado
curl -X GET "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd" \
  -H "x-cg-demo-api-key: YOUR_COINGECKO_API_KEY"

# Obtener datos OHLC de Bitcoin
curl -X GET "https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=7"</code></pre>
      </div>
      <div class="flex flex-wrap gap-4 text-sm">
        <div class="flex items-center gap-2 text-text-secondary">
          <span class="material-symbols-outlined text-[16px]">schedule</span>
          <span>Rate Limit: 30 calls/min (Demo)</span>
        </div>
        <div class="flex items-center gap-2 text-text-secondary">
          <span class="material-symbols-outlined text-[16px]">link</span>
          <a href="https://docs.coingecko.com/reference/introduction" target="_blank" class="text-primary hover:underline">Documentación oficial</a>
        </div>
      </div>
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
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Agregar API Key</h2>
              <button @click="showCreateModal = false" class="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg">
                <span class="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>
            <div class="p-6 space-y-5">
              <!-- Nombre -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Nombre *</label>
                <input 
                  v-model="newKeyForm.name"
                  type="text"
                  placeholder="ej: CoinGecko Production"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none"
                />
              </div>
              <!-- API Key -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">API Key *</label>
                <input 
                  v-model="newKeyForm.apiKey"
                  type="password"
                  placeholder="Ingresa tu API Key"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none font-mono"
                />
                <p class="text-xs text-text-secondary mt-1">Tu API Key será almacenada de forma segura</p>
              </div>
              <!-- Proveedor -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Proveedor</label>
                <select 
                  v-model="newKeyForm.provider"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none"
                >
                  <option v-for="provider in providerOptions" :key="provider" :value="provider">{{ provider }}</option>
                </select>
              </div>
              <!-- Rate Limit -->
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Rate Limit</label>
                <select 
                  v-model="newKeyForm.rateLimit"
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none"
                >
                  <option v-for="limit in rateLimitOptions" :key="limit" :value="limit">{{ limit }}</option>
                </select>
              </div>
            </div>
            <div class="flex gap-3 p-6 border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark">
              <button @click="showCreateModal = false" class="flex-1 py-3 px-4 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors">Cancelar</button>
              <button 
                @click="createApiKey" 
                :disabled="!newKeyForm.name || !newKeyForm.apiKey || isCreating"
                class="flex-1 py-3 px-4 bg-primary hover:bg-blue-600 disabled:bg-primary/50 text-white font-bold rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span v-if="isCreating" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                {{ isCreating ? 'Guardando...' : 'Guardar Key' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Success Toast -->
    <Transition name="modal">
      <div 
        v-if="showSuccessMessage" 
        class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-success text-white rounded-lg shadow-lg"
      >
        <span class="material-symbols-outlined">check_circle</span>
        <span class="font-medium">¡API Key guardada exitosamente!</span>
      </div>
    </Transition>
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
