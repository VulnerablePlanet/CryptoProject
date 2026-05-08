<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'

const authStore = useAuthStore()

// Security settings state
const twoFactorEnabled = ref(false)
const emailNotifications = ref(true)
const loginAlerts = ref(true)
const withdrawalConfirmation = ref(true)

// Sessions data
const activeSessions = ref([
  {
    id: 1,
    device: 'Chrome on Windows',
    location: 'New York, US',
    ip: '192.168.1.xxx',
    lastActive: 'Now',
    current: true
  },
  {
    id: 2,
    device: 'Safari on macOS',
    location: 'Los Angeles, US',
    ip: '10.0.0.xxx',
    lastActive: '2 hours ago',
    current: false
  }
])

// Activity log
const recentActivity = ref([
  { id: 1, action: 'Login', device: 'Chrome/Windows', time: '2 minutes ago', status: 'success' },
  { id: 2, action: 'Password changed', device: 'Chrome/Windows', time: '1 day ago', status: 'success' },
  { id: 3, action: 'New API key created', device: 'Chrome/Windows', time: '3 days ago', status: 'success' },
  { id: 4, action: 'Failed login attempt', device: 'Unknown', time: '5 days ago', status: 'failed' },
])

// Change password modal
const showPasswordModal = ref(false)
const passwordForm = ref({
  current: '',
  new: '',
  confirm: ''
})

const changePassword = async () => {
  // TODO: Implement password change API call
  logger.debug('Changing password...')
  showPasswordModal.value = false
}

const revokeSession = (sessionId) => {
  activeSessions.value = activeSessions.value.filter(s => s.id !== sessionId)
}

const getStatusColor = (status) => {
  return status === 'success' ? 'text-success' : 'text-danger'
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Security</h1>
      <p class="text-slate-500 dark:text-text-secondary text-sm">Manage your account security and privacy settings</p>
    </div>

    <!-- Security Score Card -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="size-16 rounded-full bg-success/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-success text-[32px]">verified_user</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Security Score: Good</h2>
            <p class="text-sm text-text-secondary">Your account is well protected</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <div class="w-48 bg-gray-200 dark:bg-border-dark rounded-full h-2">
            <div class="bg-success h-2 rounded-full" style="width: 75%"></div>
          </div>
          <span class="font-bold text-success">75%</span>
        </div>
      </div>
    </div>

    <!-- Two-Factor Authentication -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-4">
          <div class="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-primary text-[24px]">phonelink_lock</span>
          </div>
          <div>
            <h3 class="font-bold text-slate-900 dark:text-white">Two-Factor Authentication</h3>
            <p class="text-sm text-text-secondary mt-1">Add an extra layer of security to your account</p>
            <p class="text-xs text-warning mt-2" v-if="!twoFactorEnabled">
              <span class="material-symbols-outlined text-[14px] align-middle mr-1">warning</span>
              Recommended for better security
            </p>
          </div>
        </div>
        <button 
          @click="twoFactorEnabled = !twoFactorEnabled"
          class="px-4 py-2 rounded-lg font-medium transition-colors"
          :class="twoFactorEnabled 
            ? 'bg-gray-100 dark:bg-border-dark text-slate-700 dark:text-gray-300' 
            : 'bg-primary text-white'"
        >
          {{ twoFactorEnabled ? 'Disable' : 'Enable' }}
        </button>
      </div>
    </div>

    <!-- Password & Settings Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Password -->
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
        <h3 class="font-bold text-slate-900 dark:text-white mb-4">Password</h3>
        <p class="text-sm text-text-secondary mb-4">Last changed: 30 days ago</p>
        <button 
          @click="showPasswordModal = true"
          class="px-4 py-2 bg-slate-100 dark:bg-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-border-dark/80 transition-colors"
        >
          Change Password
        </button>
      </div>

      <!-- Security Preferences -->
      <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
        <h3 class="font-bold text-slate-900 dark:text-white mb-4">Security Preferences</h3>
        <div class="space-y-4">
          <label class="flex items-center justify-between cursor-pointer">
            <span class="text-sm text-slate-700 dark:text-gray-300">Email notifications</span>
            <input type="checkbox" v-model="emailNotifications" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary relative"></div>
          </label>
          <label class="flex items-center justify-between cursor-pointer">
            <span class="text-sm text-slate-700 dark:text-gray-300">Login alerts</span>
            <input type="checkbox" v-model="loginAlerts" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary relative"></div>
          </label>
          <label class="flex items-center justify-between cursor-pointer">
            <span class="text-sm text-slate-700 dark:text-gray-300">Withdrawal email confirmation</span>
            <input type="checkbox" v-model="withdrawalConfirmation" class="sr-only peer">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-border-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary relative"></div>
          </label>
        </div>
      </div>
    </div>

    <!-- Active Sessions -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <div class="p-6 border-b border-gray-200 dark:border-border-dark">
        <h3 class="font-bold text-slate-900 dark:text-white">Active Sessions</h3>
        <p class="text-sm text-text-secondary">Manage your logged-in devices</p>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-border-dark/50">
        <div 
          v-for="session in activeSessions"
          :key="session.id"
          class="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <div class="flex items-center gap-4">
            <div class="size-10 rounded-lg bg-gray-100 dark:bg-border-dark flex items-center justify-center">
              <span class="material-symbols-outlined text-slate-600 dark:text-gray-400">devices</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <p class="font-medium text-slate-900 dark:text-white">{{ session.device }}</p>
                <span v-if="session.current" class="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">Current</span>
              </div>
              <p class="text-xs text-text-secondary">{{ session.location }} • {{ session.ip }}</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-xs text-text-secondary">{{ session.lastActive }}</span>
            <button 
              v-if="!session.current"
              @click="revokeSession(session.id)"
              class="text-xs text-danger hover:underline"
            >
              Revoke
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl overflow-hidden">
      <div class="p-6 border-b border-gray-200 dark:border-border-dark">
        <h3 class="font-bold text-slate-900 dark:text-white">Recent Activity</h3>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-border-dark/50">
        <div 
          v-for="activity in recentActivity"
          :key="activity.id"
          class="flex items-center justify-between p-4"
        >
          <div class="flex items-center gap-4">
            <span 
              class="material-symbols-outlined text-[20px]"
              :class="getStatusColor(activity.status)"
            >
              {{ activity.status === 'success' ? 'check_circle' : 'cancel' }}
            </span>
            <div>
              <p class="font-medium text-slate-900 dark:text-white">{{ activity.action }}</p>
              <p class="text-xs text-text-secondary">{{ activity.device }}</p>
            </div>
          </div>
          <span class="text-xs text-text-secondary">{{ activity.time }}</span>
        </div>
      </div>
    </div>

    <!-- Change Password Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showPasswordModal" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="showPasswordModal = false"
        >
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-border-dark">
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Change Password</h2>
              <button @click="showPasswordModal = false" class="p-2 hover:bg-gray-100 dark:hover:bg-border-dark rounded-lg">
                <span class="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>
            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Current Password</label>
                <input v-model="passwordForm.current" type="password" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">New Password</label>
                <input v-model="passwordForm.new" type="password" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none" />
              </div>
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Confirm New Password</label>
                <input v-model="passwordForm.confirm" type="password" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-border-dark bg-white dark:bg-background-dark text-slate-900 dark:text-white focus:border-primary outline-none" />
              </div>
            </div>
            <div class="flex gap-3 p-6 border-t border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-background-dark">
              <button @click="showPasswordModal = false" class="flex-1 py-3 px-4 border border-gray-300 dark:border-border-dark text-slate-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-border-dark transition-colors">Cancel</button>
              <button @click="changePassword" class="flex-1 py-3 px-4 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-colors">Update Password</button>
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
