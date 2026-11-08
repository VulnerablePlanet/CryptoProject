const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { getUploadsRoot } = require('../config/env')

/**
 * Avatar directory. Resolved from UPLOADS_DIR (see config/env.js) and created
 * lazily on first upload: creating it at module load crashed the server at
 * startup when the process could not write to the default location
 * (e.g. a non-root user inside a container).
 */
const getAvatarDir = () => path.join(getUploadsRoot(), 'avatars')

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getAvatarDir()
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir))
  },
  filename: (req, file, cb) => {
    // Create unique filename: userId-timestamp.extension
    const ext = path.extname(file.originalname).toLowerCase()
    const filename = `${req.user._id}-${Date.now()}${ext}`
    cb(null, filename)
  }
})

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false)
  }
}

// Multer upload configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  }
})

module.exports = { upload, getAvatarDir }
