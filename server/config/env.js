/**
 * Runtime configuration helpers.
 *
 * Centralizes environment-derived settings that more than one module needs
 * (upload paths, trading mode) and validates required configuration at boot,
 * so a misconfigured deployment fails immediately with a clear message
 * instead of failing later on the first login or request.
 */

const path = require('path')

const TRADING_MODES = ['sandbox', 'production']

const isProduction = (env = process.env) => env.NODE_ENV === 'production'

/**
 * Root directory for user uploads (avatars live in `<root>/avatars`).
 * Served at `/uploads`. Override with UPLOADS_DIR (e.g. a mounted volume in
 * containers); defaults to `<repo>/public/uploads` for local development.
 */
const getUploadsRoot = (env = process.env) =>
  env.UPLOADS_DIR
    ? path.resolve(env.UPLOADS_DIR)
    : path.join(__dirname, '..', '..', 'public', 'uploads')

/**
 * Exchange trading mode. Anything other than an explicit 'production' is
 * treated as sandbox, so a typo can never enable real-money trading.
 */
const getTradingMode = (env = process.env) =>
  env.BINANCE_MODE === 'production' ? 'production' : 'sandbox'

const isSandboxMode = (env = process.env) => getTradingMode(env) === 'sandbox'

/**
 * Real-money trading requires a second, explicit opt-in on top of
 * BINANCE_MODE=production (see README › Trading Bot).
 */
const isLiveTradingAllowed = (env = process.env) =>
  getTradingMode(env) === 'production' && env.AGENT_ALLOW_LIVE_TRADING === 'true'

const getMongoUri = (env = process.env) =>
  isProduction(env) ? env.MONGODB_URI_PROD : env.MONGODB_URI_LOCAL

/**
 * Validate configuration.
 * @returns {{ errors: string[], warnings: string[] }}
 */
const validateConfig = (env = process.env) => {
  const errors = []
  const warnings = []
  const prod = isProduction(env)

  if (!env.JWT_SECRET) {
    errors.push('JWT_SECRET is required')
  } else if (env.JWT_SECRET.length < 32) {
    const msg = 'JWT_SECRET must be at least 32 characters'
    prod ? errors.push(msg) : warnings.push(`${msg} (allowed outside production)`)
  }

  if (!getMongoUri(env)) {
    errors.push(prod ? 'MONGODB_URI_PROD is required in production' : 'MONGODB_URI_LOCAL is required')
  }

  if (prod && !env.CORS_ORIGIN) {
    errors.push('CORS_ORIGIN must be set explicitly in production')
  }

  if (env.BINANCE_MODE && !TRADING_MODES.includes(env.BINANCE_MODE)) {
    warnings.push(`BINANCE_MODE="${env.BINANCE_MODE}" is not valid; falling back to sandbox`)
  }

  return { errors, warnings }
}

module.exports = {
  isProduction,
  getUploadsRoot,
  getTradingMode,
  isSandboxMode,
  isLiveTradingAllowed,
  getMongoUri,
  validateConfig,
  TRADING_MODES
}
