<script setup>
import { ref, onMounted, computed } from 'vue'
import { getPokemons, getPokemonById } from '@/services/pokemon'

// State
const pokemons = ref([])
const loading = ref(false)
const loadingMore = ref(false)
const offset = ref(0)
const limit = 20
const totalCount = ref(0)
const selectedPokemon = ref(null)
const showModal = ref(false)
const loadingDetails = ref(false)

// Type colors for visual styling
const typeColors = {
  normal: 'bg-gray-400',
  fire: 'bg-orange-500',
  water: 'bg-blue-500',
  electric: 'bg-yellow-400',
  grass: 'bg-green-500',
  ice: 'bg-cyan-400',
  fighting: 'bg-red-700',
  poison: 'bg-purple-500',
  ground: 'bg-amber-600',
  flying: 'bg-indigo-400',
  psychic: 'bg-pink-500',
  bug: 'bg-lime-500',
  rock: 'bg-stone-500',
  ghost: 'bg-purple-700',
  dragon: 'bg-violet-600',
  dark: 'bg-gray-700',
  steel: 'bg-slate-400',
  fairy: 'bg-pink-300'
}

// Computed
const hasMore = computed(() => pokemons.value.length < totalCount.value)

// Methods
const fetchPokemons = async (isLoadMore = false) => {
  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
  }
  
  try {
    const response = await getPokemons(limit, offset.value)
    totalCount.value = response.count
    
    // Fetch details for each pokemon to get sprites and types
    const pokemonDetails = await Promise.all(
      response.data.map(async (pokemon) => {
        const id = extractIdFromUrl(pokemon.url)
        try {
          const details = await getPokemonById(id)
          return details.data
        } catch (error) {
          console.error(`Error fetching ${pokemon.name}:`, error)
          return null
        }
      })
    )
    
    const validPokemons = pokemonDetails.filter(p => p !== null)
    
    if (isLoadMore) {
      pokemons.value = [...pokemons.value, ...validPokemons]
    } else {
      pokemons.value = validPokemons
    }
  } catch (error) {
    console.error('Error fetching pokemons:', error)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  offset.value += limit
  fetchPokemons(true)
}

const extractIdFromUrl = (url) => {
  const matches = url.match(/\/pokemon\/(\d+)\//)
  return matches ? matches[1] : null
}

const getTypeColor = (type) => {
  return typeColors[type] || 'bg-gray-500'
}

const getPokemonImage = (pokemon) => {
  return pokemon.sprites?.other?.['official-artwork']?.front_default || 
         pokemon.sprites?.front_default || 
         null
}

const openPokemonModal = async (pokemon) => {
  selectedPokemon.value = pokemon
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  selectedPokemon.value = null
}

const getStatColor = (statName) => {
  const colors = {
    hp: 'bg-red-500',
    attack: 'bg-orange-500',
    defense: 'bg-yellow-500',
    'special-attack': 'bg-blue-500',
    'special-defense': 'bg-green-500',
    speed: 'bg-pink-500'
  }
  return colors[statName] || 'bg-gray-500'
}

const formatStatName = (name) => {
  const names = {
    hp: 'HP',
    attack: 'Attack',
    defense: 'Defense',
    'special-attack': 'Sp. Atk',
    'special-defense': 'Sp. Def',
    speed: 'Speed'
  }
  return names[name] || name
}

// Initialize
onMounted(() => {
  fetchPokemons()
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">Pokédex</h1>
        <p class="text-slate-500 dark:text-text-secondary text-sm">
          Explore {{ totalCount }} Pokémon from the PokéAPI
        </p>
      </div>
      
      <div class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-lg">
        <span class="material-symbols-outlined text-primary">catching_pokemon</span>
        <span class="font-medium text-slate-900 dark:text-white">{{ pokemons.length }} loaded</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
      <p class="text-text-secondary">Loading Pokémon...</p>
    </div>

    <!-- Pokemon Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <div
        v-for="pokemon in pokemons"
        :key="pokemon.id"
        @click="openPokemonModal(pokemon)"
        class="group relative bg-white dark:bg-card-dark border border-gray-200 dark:border-border-dark rounded-2xl p-4 cursor-pointer hover:shadow-xl hover:shadow-primary/10 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
      >
        <!-- Pokemon Number -->
        <span class="absolute top-3 right-3 z-10 text-xs font-bold text-slate-400 dark:text-gray-500 bg-white/80 dark:bg-gray-800/80 px-2 py-0.5 rounded-md">
          #{{ String(pokemon.id).padStart(3, '0') }}
        </span>
        
        <!-- Pokemon Image -->
        <div class="relative w-full aspect-square mb-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl overflow-hidden">
          <img
            v-if="getPokemonImage(pokemon)"
            :src="getPokemonImage(pokemon)"
            :alt="pokemon.name"
            class="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-300"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600">catching_pokemon</span>
          </div>
        </div>
        
        <!-- Pokemon Name -->
        <h3 class="text-center font-bold text-slate-900 dark:text-white capitalize mb-2">
          {{ pokemon.name }}
        </h3>
        
        <!-- Pokemon Types -->
        <div class="flex justify-center gap-2">
          <span
            v-for="type in pokemon.types"
            :key="type"
            :class="getTypeColor(type)"
            class="px-3 py-1 text-xs font-medium text-white rounded-full capitalize"
          >
            {{ type }}
          </span>
        </div>
      </div>
    </div>

    <!-- Load More Button -->
    <div v-if="hasMore && !loading" class="flex justify-center py-4">
      <button
        @click="loadMore"
        :disabled="loadingMore"
        class="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-blue-600 disabled:bg-primary/50 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
      >
        <span v-if="loadingMore" class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
        <span class="material-symbols-outlined" v-else>expand_more</span>
        {{ loadingMore ? 'Loading...' : 'Load More Pokémon' }}
      </button>
    </div>

    <!-- Pokemon Detail Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showModal && selectedPokemon" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="closeModal"
        >
          <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          
          <div class="relative bg-white dark:bg-card-dark rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <!-- Header with gradient based on first type -->
            <div 
              class="relative p-6 pb-20"
              :class="getTypeColor(selectedPokemon.types[0])"
            >
              <button 
                @click="closeModal" 
                class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-colors"
              >
                <span class="material-symbols-outlined text-white">close</span>
              </button>
              
              <div class="flex items-center gap-3">
                <h2 class="text-2xl font-bold text-white capitalize">{{ selectedPokemon.name }}</h2>
                <span class="px-3 py-1 bg-white/20 rounded-full text-sm font-bold text-white">
                  #{{ String(selectedPokemon.id).padStart(3, '0') }}
                </span>
              </div>
              
              <div class="flex gap-2 mt-3">
                <span
                  v-for="type in selectedPokemon.types"
                  :key="type"
                  class="px-4 py-1 bg-white/25 text-white text-sm font-medium rounded-full capitalize"
                >
                  {{ type }}
                </span>
              </div>
            </div>
            
            <!-- Pokemon Image (overlapping) -->
            <div class="relative -mt-16 flex justify-center z-10">
              <div class="w-40 h-40 bg-white dark:bg-card-dark rounded-full shadow-xl p-2">
                <img
                  v-if="getPokemonImage(selectedPokemon)"
                  :src="getPokemonImage(selectedPokemon)"
                  :alt="selectedPokemon.name"
                  class="w-full h-full object-contain"
                />
              </div>
            </div>
            
            <!-- Stats -->
            <div class="p-6 pt-4">
              <h3 class="text-sm font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-4">Base Stats</h3>
              
              <div class="space-y-3">
                <div
                  v-for="stat in selectedPokemon.stats"
                  :key="stat.name"
                  class="flex items-center gap-3"
                >
                  <span class="w-20 text-sm font-medium text-slate-600 dark:text-gray-300">
                    {{ formatStatName(stat.name) }}
                  </span>
                  <span class="w-10 text-sm font-bold text-slate-900 dark:text-white text-right">
                    {{ stat.value }}
                  </span>
                  <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      :class="getStatColor(stat.name)"
                      class="h-full rounded-full transition-all duration-500"
                      :style="{ width: `${Math.min(stat.value / 150 * 100, 100)}%` }"
                    ></div>
                  </div>
                </div>
              </div>
              
              <!-- Physical Info -->
              <div class="flex justify-center gap-8 mt-6 pt-6 border-t border-gray-200 dark:border-border-dark">
                <div class="text-center">
                  <p class="text-2xl font-bold text-slate-900 dark:text-white">{{ (selectedPokemon.height / 10).toFixed(1) }}m</p>
                  <p class="text-sm text-text-secondary">Height</p>
                </div>
                <div class="text-center">
                  <p class="text-2xl font-bold text-slate-900 dark:text-white">{{ (selectedPokemon.weight / 10).toFixed(1) }}kg</p>
                  <p class="text-sm text-text-secondary">Weight</p>
                </div>
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

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.9);
}
</style>
