<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// State
const users = ref([])
const isLoading = ref(false)
const error = ref('')
const searchQuery = ref('')

// Computed
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(user => 
    user.name.toLowerCase().includes(query) || 
    user.email.toLowerCase().includes(query)
  )
})

// Load users
const loadUsers = async () => {
  if (!authStore.isAuthenticated) return
  
  isLoading.value = true
  error.value = ''
  
  try {
    const response = await fetch('/api/auth/users', {
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      users.value = data.users || []
    } else {
      error.value = 'Error al cargar los usuarios'
    }
  } catch (err) {
    console.error('Error loading users:', err)
    error.value = 'Error de conexión'
  } finally {
    isLoading.value = false
  }
}

const formatDate = (date) => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Usuarios</h1>
        <p class="text-slate-500 dark:text-text-secondary text-sm">
          {{ users.length }} usuario{{ users.length !== 1 ? 's' : '' }} registrado{{ users.length !== 1 ? 's' : '' }}
        </p>
      </div>
      
      <!-- Search -->
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[20px] text-text-secondary">search</span>
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="Buscar usuarios..."
          class="pl-10 pr-4 py-2 w-full sm:w-64 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white placeholder-text-secondary focus:border-primary outline-none"
        />
      </div>
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
        <h4 class="font-medium text-slate-900 dark:text-white">Inicia sesión para ver los usuarios</h4>
        <p class="text-sm text-text-secondary mt-1">Necesitas estar autenticado para ver la lista de usuarios.</p>
      </div>
    </div>

    <!-- Users List -->
    <div v-else class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <!-- Loading State -->
      <div v-if="isLoading" class="p-12 text-center">
        <span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
        <p class="text-text-secondary mt-4">Cargando usuarios...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredUsers.length === 0" class="p-12 text-center">
        <span class="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">group</span>
        <h3 class="text-lg font-medium text-slate-900 dark:text-white mb-2">
          {{ searchQuery ? 'No se encontraron usuarios' : 'No hay usuarios registrados' }}
        </h3>
        <p class="text-text-secondary">
          {{ searchQuery ? 'Intenta con otro término de búsqueda' : 'Los usuarios aparecerán aquí cuando se registren' }}
        </p>
      </div>

      <!-- Users Table -->
      <table v-else class="w-full">
        <thead class="bg-gray-50 dark:bg-background-dark border-b border-gray-200 dark:border-border-dark">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase">Usuario</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase hidden md:table-cell">Email</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-text-secondary uppercase hidden lg:table-cell">Registrado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-border-dark/50">
          <tr 
            v-for="user in filteredUsers"
            :key="user._id"
            class="hover:bg-gray-50 dark:hover:bg-white/5"
          >
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <!-- Avatar -->
                <div v-if="user.avatar" class="size-10 rounded-full overflow-hidden bg-gray-100 dark:bg-border-dark">
                  <img :src="user.avatar" :alt="user.name" class="size-full object-cover" />
                </div>
                <div v-else class="size-10 rounded-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                  {{ getInitials(user.name) }}
                </div>
                <div>
                  <p class="font-medium text-slate-900 dark:text-white">{{ user.name }}</p>
                  <p class="text-xs text-text-secondary md:hidden">{{ user.email }}</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 hidden md:table-cell">
              <p class="text-sm text-text-secondary">{{ user.email }}</p>
            </td>
            <td class="px-6 py-4 hidden lg:table-cell">
              <p class="text-sm text-text-secondary">{{ formatDate(user.createdAt) }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
