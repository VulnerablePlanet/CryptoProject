<script setup>
import { ref } from 'vue'

const categories = [
  {
    id: 'basics',
    name: 'Crypto Basics',
    icon: 'school',
    description: 'Learn the fundamentals of cryptocurrency',
    articles: [
      { id: 1, title: 'What is Bitcoin?', duration: '5 min', level: 'Beginner' },
      { id: 2, title: 'Understanding Blockchain', duration: '8 min', level: 'Beginner' },
      { id: 3, title: 'How Wallets Work', duration: '6 min', level: 'Beginner' },
      { id: 4, title: 'Public vs Private Keys', duration: '4 min', level: 'Beginner' },
    ]
  },
  {
    id: 'trading',
    name: 'Trading Strategies',
    icon: 'candlestick_chart',
    description: 'Master trading techniques and analysis',
    articles: [
      { id: 5, title: 'Technical Analysis Basics', duration: '10 min', level: 'Intermediate' },
      { id: 6, title: 'Reading Candlestick Charts', duration: '12 min', level: 'Intermediate' },
      { id: 7, title: 'Risk Management', duration: '8 min', level: 'Intermediate' },
      { id: 8, title: 'Dollar Cost Averaging', duration: '5 min', level: 'Beginner' },
    ]
  },
  {
    id: 'defi',
    name: 'DeFi & Web3',
    icon: 'hub',
    description: 'Explore decentralized finance',
    articles: [
      { id: 9, title: 'What is DeFi?', duration: '7 min', level: 'Intermediate' },
      { id: 10, title: 'Yield Farming Explained', duration: '10 min', level: 'Advanced' },
      { id: 11, title: 'Understanding NFTs', duration: '6 min', level: 'Beginner' },
      { id: 12, title: 'Smart Contracts', duration: '9 min', level: 'Intermediate' },
    ]
  },
  {
    id: 'security',
    name: 'Security Best Practices',
    icon: 'security',
    description: 'Keep your assets safe',
    articles: [
      { id: 13, title: 'Protecting Your Wallet', duration: '8 min', level: 'Beginner' },
      { id: 14, title: 'Avoiding Scams', duration: '6 min', level: 'Beginner' },
      { id: 15, title: 'Hardware Wallets', duration: '10 min', level: 'Intermediate' },
      { id: 16, title: 'Seed Phrase Security', duration: '5 min', level: 'Beginner' },
    ]
  }
]

const selectedCategory = ref(null)

const getLevelColor = (level) => {
  const colors = {
    Beginner: 'text-success bg-success/10',
    Intermediate: 'text-warning bg-warning/10',
    Advanced: 'text-danger bg-danger/10'
  }
  return colors[level] || 'text-gray-500 bg-gray-100'
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Learn</h1>
      <p class="text-slate-500 dark:text-text-secondary text-sm">Educational resources to improve your crypto knowledge</p>
    </div>

    <!-- Featured Banner -->
    <div v-once class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-purple-600 p-6 md:p-8">
      <div class="relative z-10">
        <span class="inline-block px-3 py-1 bg-white/20 text-white text-xs font-medium rounded-full mb-3">Featured Course</span>
        <h2 class="text-xl md:text-2xl font-bold text-white mb-2">Getting Started with Cryptocurrency</h2>
        <p class="text-white/80 text-sm mb-4 max-w-md">A comprehensive guide for beginners covering everything from buying your first Bitcoin to understanding market dynamics.</p>
        <button class="px-5 py-2 bg-white text-primary font-bold rounded-lg hover:bg-white/90 transition-colors">
          Start Learning
        </button>
      </div>
      <div class="absolute right-0 bottom-0 opacity-10">
        <span class="material-symbols-outlined text-[200px]">school</span>
      </div>
    </div>

    <!-- Categories Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div 
        v-for="category in categories"
        :key="category.id"
        class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-5 hover:border-primary/30 transition-all cursor-pointer group"
        @click="selectedCategory = selectedCategory === category.id ? null : category.id"
      >
        <!-- Category Header -->
        <div class="flex items-start gap-4">
          <div class="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <span class="material-symbols-outlined text-primary text-[24px]">{{ category.icon }}</span>
          </div>
          <div class="flex-1">
            <h3 class="font-bold text-slate-900 dark:text-white mb-1">{{ category.name }}</h3>
            <p class="text-sm text-text-secondary">{{ category.description }}</p>
            <p class="text-xs text-primary mt-2">{{ category.articles.length }} articles</p>
          </div>
          <span 
            class="material-symbols-outlined text-slate-400 transition-transform"
            :class="{ 'rotate-180': selectedCategory === category.id }"
          >
            expand_more
          </span>
        </div>

        <!-- Articles List (Expandable) -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 max-h-0"
          enter-to-class="opacity-100 max-h-96"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 max-h-96"
          leave-to-class="opacity-0 max-h-0"
        >
          <div v-if="selectedCategory === category.id" class="mt-4 pt-4 border-t border-gray-100 dark:border-border-dark overflow-hidden">
            <div 
              v-for="article in category.articles"
              :key="article.id"
              v-memo="[article.id]"
              class="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-gray-50 dark:hover:bg-border-dark/50 transition-colors"
            >
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-text-secondary text-[20px]">article</span>
                <span class="text-sm font-medium text-slate-800 dark:text-gray-200">{{ article.title }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span 
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="getLevelColor(article.level)"
                >
                  {{ article.level }}
                </span>
                <span class="text-xs text-text-secondary">{{ article.duration }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Quick Tips Section -->
    <div v-once class="bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-xl p-6">
      <h3 class="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-warning">lightbulb</span>
        Quick Tips
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg">
          <h4 class="font-medium text-slate-900 dark:text-white mb-2">Never share your seed phrase</h4>
          <p class="text-xs text-text-secondary">Your seed phrase is the master key to your wallet. Keep it offline and secure.</p>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg">
          <h4 class="font-medium text-slate-900 dark:text-white mb-2">Do your own research</h4>
          <p class="text-xs text-text-secondary">Always research before investing. Don't rely solely on social media or tips.</p>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-background-dark rounded-lg">
          <h4 class="font-medium text-slate-900 dark:text-white mb-2">Start small</h4>
          <p class="text-xs text-text-secondary">Only invest what you can afford to lose. Crypto markets are highly volatile.</p>
        </div>
      </div>
    </div>
  </div>
</template>
