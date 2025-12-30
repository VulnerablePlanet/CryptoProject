<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// Form state
const isEditing = ref(false)
const isSaving = ref(false)
const showSuccess = ref(false)
const errorMessage = ref('')

// Profile photo
const profilePhoto = ref(null)
const photoPreview = ref(null)

// Profile form data
const profileForm = ref({
  displayName: '',
  legalName: '',
  email: '',
  phone: '',
  birthDate: '',
  location: '',
  bio: '',
  github: '',
  twitter: '',
  linkedin: '',
  website: ''
})

// Original data for cancel/reset
const originalData = ref({})

// Load user data from store
const loadUserData = () => {
  const user = authStore.user
  if (user) {
    const userData = {
      displayName: user.name || '',
      legalName: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      birthDate: user.birthDate ? user.birthDate.split('T')[0] : '',
      location: user.location || '',
      bio: user.bio || '',
      github: user.socialLinks?.github || '',
      twitter: user.socialLinks?.twitter || '',
      linkedin: user.socialLinks?.linkedin || '',
      website: user.socialLinks?.website || ''
    }
    
    profileForm.value = { ...userData }
    originalData.value = { ...userData }
    
    // Load existing avatar
    if (user.avatar && !photoPreview.value) {
      photoPreview.value = user.avatar
    }
  }
}

// Initialize form with user data
onMounted(async () => {
  // First load from cached store data
  loadUserData()
  
  // Then fetch fresh data from server
  if (authStore.accessToken) {
    await authStore.fetchUser()
    loadUserData()
  }
})

// Watch for user changes in store
watch(() => authStore.user, () => {
  if (!isEditing.value) {
    loadUserData()
  }
}, { deep: true })

// Computed
const hasChanges = computed(() => {
  return JSON.stringify(profileForm.value) !== JSON.stringify(originalData.value) || profilePhoto.value
})

const currentAvatar = computed(() => {
  if (photoPreview.value) {
    // If it's a blob URL (new upload preview) or existing avatar path
    return photoPreview.value
  }
  return null
})

// Methods
const handlePhotoUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    profilePhoto.value = file
    photoPreview.value = URL.createObjectURL(file)
  }
}

const removePhoto = () => {
  profilePhoto.value = null
  photoPreview.value = null
}

const startEditing = () => {
  isEditing.value = true
  errorMessage.value = ''
}

const cancelEditing = () => {
  profileForm.value = { ...originalData.value }
  profilePhoto.value = null
  // Restore original avatar preview
  photoPreview.value = authStore.user?.avatar || null
  isEditing.value = false
  errorMessage.value = ''
}

const saveProfile = async () => {
  isSaving.value = true
  errorMessage.value = ''
  
  try {
    // Create FormData for file upload
    const formData = new FormData()
    
    // Add profile fields
    formData.append('name', profileForm.value.displayName)
    formData.append('phone', profileForm.value.phone)
    formData.append('birthDate', profileForm.value.birthDate || '')
    formData.append('location', profileForm.value.location)
    formData.append('bio', profileForm.value.bio)
    
    // Add social links as JSON
    formData.append('socialLinks', JSON.stringify({
      github: profileForm.value.github,
      twitter: profileForm.value.twitter,
      linkedin: profileForm.value.linkedin,
      website: profileForm.value.website
    }))
    
    // Add avatar file if selected
    if (profilePhoto.value) {
      formData.append('avatar', profilePhoto.value)
    }
    
    // Send to API using fetch for FormData
    const token = authStore.accessToken
    const response = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    const data = await response.json()
    
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Error al actualizar el perfil')
    }
    
    // Update auth store with new user data (need to use proper assignment for reactivity)
    // The store's user is a useLocalStorage ref, so we assign the value properly
    if (authStore.user) {
      Object.assign(authStore.user, data.user)
    } else {
      // Fallback: refetch user from server
      await authStore.fetchUser()
    }
    
    // Update original data
    originalData.value = { ...profileForm.value }
    
    // Reset photo state
    profilePhoto.value = null
    if (data.user.avatar) {
      photoPreview.value = data.user.avatar
    }
    
    isEditing.value = false
    showSuccess.value = true
    
    setTimeout(() => {
      showSuccess.value = false
    }, 3000)
  } catch (error) {
    console.error('Error saving profile:', error)
    errorMessage.value = error.message || 'Error al guardar los cambios'
  } finally {
    isSaving.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Configuración de Perfil</h1>
        <p class="text-slate-500 dark:text-text-secondary text-sm">
          Administra tu información personal, verificación de identidad y datos de contacto.
        </p>
      </div>
      
      <!-- Edit/Save Buttons -->
      <div class="flex gap-3">
        <template v-if="isEditing">
          <button 
            @click="cancelEditing"
            class="px-4 py-2 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
            :disabled="isSaving"
          >
            Cancelar
          </button>
          <button 
            @click="saveProfile"
            class="px-6 py-2 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
            :disabled="isSaving || !hasChanges"
          >
            <span v-if="isSaving" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            <span>{{ isSaving ? 'Guardando...' : 'Guardar Cambios' }}</span>
          </button>
        </template>
        <button 
          v-else
          @click="startEditing"
          class="px-4 py-2 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <span class="material-symbols-outlined text-[18px]">edit</span>
          Editar Perfil
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <Transition name="fade">
      <div 
        v-if="errorMessage"
        class="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center gap-3"
      >
        <span class="material-symbols-outlined text-danger">error</span>
        <p class="text-danger font-medium">{{ errorMessage }}</p>
        <button @click="errorMessage = ''" class="ml-auto text-danger hover:text-red-700">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </Transition>

    <!-- Success Alert -->
    <Transition name="fade">
      <div 
        v-if="showSuccess"
        class="bg-success/10 border border-success/30 rounded-xl p-4 flex items-center gap-3"
      >
        <span class="material-symbols-outlined text-success">check_circle</span>
        <p class="text-success font-medium">¡Perfil actualizado exitosamente!</p>
      </div>
    </Transition>

    <!-- Profile Header Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
      <div class="flex flex-col md:flex-row items-start md:items-center gap-6">
        <!-- Profile Photo -->
        <div class="relative">
          <div class="size-24 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center overflow-hidden ring-4 ring-white dark:ring-card-dark shadow-lg">
            <img 
              v-if="currentAvatar" 
              :src="currentAvatar" 
              alt="Profile" 
              class="w-full h-full object-cover"
            />
            <span v-else class="text-white text-3xl font-bold">
              {{ profileForm.displayName.charAt(0).toUpperCase() }}
            </span>
          </div>
        </div>

        <!-- Profile Info -->
        <div class="flex-1">
          <div class="flex flex-wrap items-center gap-3 mb-1">
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ profileForm.displayName }}</h2>
          </div>
          <p class="text-text-secondary text-sm">{{ profileForm.email }}</p>
        </div>

        <!-- Photo Actions -->
        <div v-if="isEditing" class="flex gap-2">
          <button 
            @click="removePhoto"
            v-if="currentAvatar"
            class="px-4 py-2 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors"
          >
            Eliminar
          </button>
          <label class="px-4 py-2 bg-primary hover:bg-blue-600 text-white font-medium rounded-lg transition-colors cursor-pointer">
            Subir Foto
            <input 
              type="file" 
              accept="image/*" 
              class="hidden" 
              @change="handlePhotoUpload"
            />
          </label>
        </div>
      </div>
    </div>

    <!-- Personal Information -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">Información Personal</h3>
        <button 
          v-if="!isEditing"
          @click="startEditing"
          class="text-primary hover:text-blue-600 text-sm font-medium transition-colors"
        >
          Editar
        </button>
      </div>

      <!-- Identity & Professional -->
      <div class="mb-8">
        <div class="flex items-center gap-2 mb-4">
          <span class="material-symbols-outlined text-primary text-[20px]">badge</span>
          <h4 class="font-semibold text-slate-700 dark:text-gray-300 uppercase text-sm tracking-wide">Identidad y Profesional</h4>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Display Name -->
          <div>
            <label class="block text-sm text-text-secondary mb-2">Nombre de Usuario</label>
            <div v-if="!isEditing" class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white">
              {{ profileForm.displayName || '—' }}
            </div>
            <input 
              v-else 
              v-model="profileForm.displayName"
              type="text"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <!-- Legal Name -->
          <div>
            <label class="block text-sm text-text-secondary mb-2">Nombre Completo</label>
            <div v-if="!isEditing" class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white">
              {{ profileForm.legalName || '—' }}
            </div>
            <input 
              v-else 
              v-model="profileForm.legalName"
              type="text"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <!-- Birth Date -->
          <div>
            <label class="block text-sm text-text-secondary mb-2">Fecha de Nacimiento</label>
            <div v-if="!isEditing" class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-text-secondary text-[18px]">cake</span>
              {{ formatDate(profileForm.birthDate) || '—' }}
            </div>
            <input 
              v-else 
              v-model="profileForm.birthDate"
              type="date"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <!-- Location -->
          <div>
            <label class="block text-sm text-text-secondary mb-2">Ubicación</label>
            <div v-if="!isEditing" class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-text-secondary text-[18px]">location_on</span>
              {{ profileForm.location || '—' }}
            </div>
            <input 
              v-else 
              v-model="profileForm.location"
              type="text"
              placeholder="Ciudad, País"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      <!-- Contact & Social -->
      <div class="mb-8">
        <div class="flex items-center gap-2 mb-4">
          <span class="material-symbols-outlined text-primary text-[20px]">contact_page</span>
          <h4 class="font-semibold text-slate-700 dark:text-gray-300 uppercase text-sm tracking-wide">Contacto y Redes Sociales</h4>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Email -->
          <div>
            <label class="block text-sm text-text-secondary mb-2">Correo Electrónico</label>
            <div class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-text-secondary text-[18px]">mail</span>
              {{ profileForm.email || '—' }}
            </div>
          </div>

          <!-- Phone -->
          <div>
            <label class="block text-sm text-text-secondary mb-2">Teléfono</label>
            <div v-if="!isEditing" class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-text-secondary text-[18px]">phone</span>
              {{ profileForm.phone || '—' }}
            </div>
            <input 
              v-else 
              v-model="profileForm.phone"
              type="tel"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <!-- GitHub -->
          <div>
            <label class="block text-sm text-text-secondary mb-2">GitHub / Portfolio</label>
            <div v-if="!isEditing" class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-text-secondary text-[18px]">code</span>
              {{ profileForm.github || '—' }}
            </div>
            <input 
              v-else 
              v-model="profileForm.github"
              type="url"
              placeholder="github.com/username"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>

          <!-- Website -->
          <div>
            <label class="block text-sm text-text-secondary mb-2">Sitio Web</label>
            <div v-if="!isEditing" class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-text-secondary text-[18px]">language</span>
              {{ profileForm.website || '—' }}
            </div>
            <input 
              v-else 
              v-model="profileForm.website"
              type="url"
              placeholder="www.tudominio.com"
              class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>
        </div>
      </div>

      <!-- About Me -->
      <div>
        <div class="flex items-center gap-2 mb-4">
          <span class="material-symbols-outlined text-primary text-[20px]">person</span>
          <h4 class="font-semibold text-slate-700 dark:text-gray-300 uppercase text-sm tracking-wide">Sobre Mí</h4>
        </div>
        
        <div>
          <label class="block text-sm text-text-secondary mb-2">Biografía</label>
          <div v-if="!isEditing" class="px-4 py-3 bg-gray-50 dark:bg-background-dark rounded-lg text-slate-900 dark:text-white min-h-[80px]">
            {{ profileForm.bio || '—' }}
          </div>
          <textarea 
            v-else 
            v-model="profileForm.bio"
            rows="3"
            placeholder="Cuéntanos sobre ti..."
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors resize-none"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- Account Preferences -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
      <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-6">Preferencias de Cuenta</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Language -->
        <div>
          <label class="block text-sm text-text-secondary mb-2">Idioma</label>
          <div class="relative">
            <select class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none appearance-none pr-10">
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">expand_more</span>
          </div>
        </div>

        <!-- Timezone -->
        <div>
          <label class="block text-sm text-text-secondary mb-2">Zona Horaria</label>
          <div class="relative">
            <select class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none appearance-none pr-10">
              <option value="America/Mexico_City">Ciudad de México (UTC-6)</option>
              <option value="America/New_York">Nueva York (UTC-5)</option>
              <option value="America/Los_Angeles">Los Ángeles (UTC-8)</option>
              <option value="Europe/Madrid">Madrid (UTC+1)</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">expand_more</span>
          </div>
        </div>

        <!-- Currency -->
        <div>
          <label class="block text-sm text-text-secondary mb-2">Moneda Preferida</label>
          <div class="relative">
            <select class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none appearance-none pr-10">
              <option value="USD">USD - Dólar Estadounidense</option>
              <option value="MXN">MXN - Peso Mexicano</option>
              <option value="EUR">EUR - Euro</option>
              <option value="BTC">BTC - Bitcoin</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">expand_more</span>
          </div>
        </div>

        <!-- Date Format -->
        <div>
          <label class="block text-sm text-text-secondary mb-2">Formato de Fecha</label>
          <div class="relative">
            <select class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none appearance-none pr-10">
              <option value="DD/MM/YYYY">DD/MM/AAAA</option>
              <option value="MM/DD/YYYY">MM/DD/AAAA</option>
              <option value="YYYY-MM-DD">AAAA-MM-DD</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">expand_more</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="bg-white dark:bg-card-dark border border-danger/30 rounded-xl p-6">
      <h3 class="text-lg font-bold text-danger mb-2">Zona de Peligro</h3>
      <p class="text-text-secondary text-sm mb-4">
        Estas acciones son irreversibles. Por favor, procede con precaución.
      </p>
      
      <div class="flex flex-wrap gap-3">
        <button class="px-4 py-2 border border-danger text-danger font-medium rounded-lg hover:bg-danger/10 transition-colors">
          Desactivar Cuenta
        </button>
        <button class="px-4 py-2 bg-danger/10 text-danger font-medium rounded-lg hover:bg-danger/20 transition-colors">
          Eliminar Cuenta Permanentemente
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
