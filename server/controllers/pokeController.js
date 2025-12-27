const pokeService = require('../services/pokeService')

// Obtener lista de pokémons con paginación
const getPokemons = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20
    const offset = parseInt(req.query.offset) || 0
    const data = await pokeService.getPokemons(limit, offset)
    
    res.json({
      success: true,
      data: data.results,
      count: data.count,
      next: data.next,
      previous: data.previous
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pokemons'
    })
  }
}

// Obtener un pokémon por ID o nombre
const getPokemonById = async (req, res) => {
  try {
    const { id } = req.params
    const pokemon = await pokeService.getPokemonById(id)
    
    res.json({
      success: true,
      data: {
        id: pokemon.id,
        name: pokemon.name,
        height: pokemon.height,
        weight: pokemon.weight,
        types: pokemon.types.map(t => t.type.name),
        sprites: pokemon.sprites,
        stats: pokemon.stats.map(s => ({
          name: s.stat.name,
          value: s.base_stat
        }))
      }
    })
  } catch (error) {
    res.status(404).json({
      success: false,
      message: 'Pokemon not found'
    })
  }
}

// Obtener todos los tipos de pokémon
const getPokemonTypes = async (req, res) => {
  try {
    const data = await pokeService.getPokemonTypes()
    
    res.json({
      success: true,
      data: data.results
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pokemon types'
    })
  }
}

module.exports = {
  getPokemons,
  getPokemonById,
  getPokemonTypes
}