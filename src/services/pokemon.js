import axios from 'axios'

const API_URL = 'http://localhost:5000/api/pokemon'

/**
 * Obtener lista de pokémons con paginación
 * @param {number} limit - Cantidad de pokémons por página
 * @param {number} offset - Desde qué posición empezar
 */
export const getPokemons = async (limit = 20, offset = 0) => {
  const response = await axios.get(API_URL, {
    params: { limit, offset }
  })
  return response.data
}

/**
 * Obtener un pokémon por ID o nombre
 * @param {string|number} idOrName - ID o nombre del pokémon
 */
export const getPokemonById = async (idOrName) => {
  const response = await axios.get(`${API_URL}/${idOrName}`)
  return response.data
}

/**
 * Obtener todos los tipos de pokémon
 */
export const getPokemonTypes = async () => {
  const response = await axios.get(`${API_URL}/types`)
  return response.data
}
