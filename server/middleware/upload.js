const multer = require('multer')
const path = require('path')
const fs = require('fs')

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
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

module.exports = { upload }
