const axios = require('axios')

// Configurar la URL base de PokeAPI v2
const POKE_API = 'https://pokeapi.co/api/v2'

// Función para obtener lista de pokémons (con paginación)
const getPokemons = async (limit = 20, offset = 0) => {
  try {
    const response = await axios.get(`${POKE_API}/pokemon`, {
      params: { limit, offset },
      timeout: 10000
    })
    return response.data
  } catch (error) {
    console.error('❌ Error fetching pokemons:', error.message)
    throw error
  }
}

// Función para obtener un pokémon por ID o nombre
const getPokemonById = async (idOrName) => {
  try {
    const response = await axios.get(`${POKE_API}/pokemon/${idOrName}`)
    return response.data
  } catch (error) {
    console.error('❌ Error fetching pokemon:', error.message)
    throw error
  }
}

// Función para obtener tipos de pokémon
const getPokemonTypes = async () => {
  try {
    const response = await axios.get(`${POKE_API}/type`)
    return response.data
  } catch (error) {
    console.error('❌ Error fetching pokemon types:', error.message)
    throw error
  }
}

module.exports = {
  getPokemons,
  getPokemonById,
  getPokemonTypes
}