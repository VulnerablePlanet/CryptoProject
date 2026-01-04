const express = require('express')
const router = express.Router()
const ApiKey = require('../models/ApiKey')
const { auth } = require('../middleware/auth')

// All routes require authentication
router.use(auth)

/**
 * GET /api/apikeys
 * Get all API keys for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const apiKeys = await ApiKey.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('-key') // Don't send the hashed key

    res.json(apiKeys)
  } catch (error) {
    console.error('Error fetching API keys:', error)
    res.status(500).json({ message: 'Error al obtener las API keys' })
  }
})

/**
 * POST /api/apikeys
 * Add a new API key (user provides their own key)
 */
router.post('/', async (req, res) => {
  try {
    const { name, apiKey: userApiKey, provider, rateLimit } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre es requerido' })
    }

    if (!userApiKey || !userApiKey.trim()) {
      return res.status(400).json({ message: 'La API Key es requerida' })
    }

    // Create preview from user's key
    const keyPreview = ApiKey.createPreview(userApiKey.trim())

    const apiKeyDoc = new ApiKey({
      userId: req.user._id,
      name: name.trim(),
      key: userApiKey.trim(),
      keyPreview,
      provider: provider?.trim() || 'Custom',
      rateLimit: rateLimit?.trim() || 'N/A',
      active: true
    })

    await apiKeyDoc.save()

    // Return success (don't return the full key for security)
    res.status(201).json({
      _id: apiKeyDoc._id,
      name: apiKeyDoc.name,
      keyPreview: apiKeyDoc.keyPreview,
      provider: apiKeyDoc.provider,
      rateLimit: apiKeyDoc.rateLimit,
      active: apiKeyDoc.active,
      createdAt: apiKeyDoc.createdAt
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message })
    }
    res.status(500).json({ message: 'Error al guardar la API key' })
  }
})

/**
 * DELETE /api/apikeys/:id
 * Delete an API key
 */
router.delete('/:id', async (req, res) => {
  try {
    const apiKey = await ApiKey.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    })

    if (!apiKey) {
      return res.status(404).json({ message: 'API key no encontrada' })
    }

    res.json({ message: 'API key eliminada exitosamente' })
  } catch (error) {
    console.error('Error deleting API key:', error)
    res.status(500).json({ message: 'Error al eliminar la API key' })
  }
})

/**
 * PATCH /api/apikeys/:id/toggle
 * Toggle API key active status
 */
router.patch('/:id/toggle', async (req, res) => {
  try {
    const apiKey = await ApiKey.findOne({
      _id: req.params.id,
      userId: req.user._id
    })

    if (!apiKey) {
      return res.status(404).json({ message: 'API key no encontrada' })
    }

    apiKey.active = !apiKey.active
    await apiKey.save()

    res.json({
      _id: apiKey._id,
      active: apiKey.active
    })
  } catch (error) {
    console.error('Error toggling API key:', error)
    res.status(500).json({ message: 'Error al actualizar la API key' })
  }
})

module.exports = router
