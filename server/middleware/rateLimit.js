const windows = new Map()

const getClientKey = (req) => {
  const userKey = req.user?._id ? `u:${req.user._id}` : null
  const ipKey = req.ip || req.connection?.remoteAddress || 'unknown'
  return userKey || `ip:${ipKey}`
}

const createRateLimiter = ({ windowMs, max, message }) => {
  return (req, res, next) => {
    const now = Date.now()
    const key = `${req.path}:${getClientKey(req)}`

    const entry = windows.get(key)

    if (!entry || now > entry.resetAt) {
      windows.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    entry.count += 1

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests. Please try again later.'
      })
    }

    next()
  }
}

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Try again in a few minutes.'
})

const heavyOpsRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many expensive requests. Slow down and retry.'
})

module.exports = {
  createRateLimiter,
  authRateLimiter,
  heavyOpsRateLimiter
}
