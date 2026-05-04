const express = require('express')
const {
  getPokemons,
  getPokemonById,
  getPokemonTypes
} = require('../controllers/pokeController')
const { auth } = require('../middleware/auth')

const router = express.Router()

// All Pokemon routes require authentication
router.use(auth)

// GET /api/pokemon - Obtener lista de pokémons
router.get('/', getPokemons)

// GET /api/pokemon/types - Obtener todos los tipos
router.get('/types', getPokemonTypes)

// GET /api/pokemon/:id - Obtener un pokémon por ID o nombre
router.get('/:id', getPokemonById)

module.exports = router
