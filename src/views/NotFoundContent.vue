<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="min-h-[80vh] flex items-center justify-center px-4">
    <div class="text-center max-w-md">
      <div class="text-8xl font-black text-primary/20 mb-4">404</div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        Page Not Found
      </h1>
      <p class="text-text-secondary mb-8">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <RouterLink 
        to="/dashboard"
        class="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-colors"
      >
        <span class="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to Dashboard
      </RouterLink>
    </div>
  </div>
</template>
