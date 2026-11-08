import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import path from 'node:path'

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const env = requireFromServer('./config/env.js')

const SECRET = 'x'.repeat(40)

describe('config/env', () => {
  describe('validateConfig', () => {
    it('accepts a complete development configuration', () => {
      const { errors } = env.validateConfig({ JWT_SECRET: SECRET, MONGODB_URI_LOCAL: 'mongodb://x' })
      expect(errors).toEqual([])
    })

    it('requires JWT_SECRET', () => {
      const { errors } = env.validateConfig({ MONGODB_URI_LOCAL: 'mongodb://x' })
      expect(errors).toContain('JWT_SECRET is required')
    })

    it('rejects a short JWT_SECRET in production but only warns in development', () => {
      const prod = env.validateConfig({
        NODE_ENV: 'production', JWT_SECRET: 'short', MONGODB_URI_PROD: 'mongodb://x', CORS_ORIGIN: 'https://app'
      })
      expect(prod.errors.some((e) => e.includes('at least 32'))).toBe(true)

      const dev = env.validateConfig({ JWT_SECRET: 'short', MONGODB_URI_LOCAL: 'mongodb://x' })
      expect(dev.errors).toEqual([])
      expect(dev.warnings.some((w) => w.includes('at least 32'))).toBe(true)
    })

    it('requires the production Mongo URI and CORS origin in production', () => {
      const { errors } = env.validateConfig({ NODE_ENV: 'production', JWT_SECRET: SECRET })
      expect(errors).toContain('MONGODB_URI_PROD is required in production')
      expect(errors).toContain('CORS_ORIGIN must be set explicitly in production')
    })

    it('warns about an unknown BINANCE_MODE', () => {
      const { warnings } = env.validateConfig({ JWT_SECRET: SECRET, MONGODB_URI_LOCAL: 'm', BINANCE_MODE: 'prod' })
      expect(warnings.some((w) => w.includes('BINANCE_MODE'))).toBe(true)
    })
  })

  describe('trading mode', () => {
    it('defaults to sandbox for missing or invalid values', () => {
      expect(env.getTradingMode({})).toBe('sandbox')
      expect(env.getTradingMode({ BINANCE_MODE: 'Production' })).toBe('sandbox')
      expect(env.getTradingMode({ BINANCE_MODE: 'production' })).toBe('production')
    })

    it('requires an explicit opt-in for live trading', () => {
      expect(env.isLiveTradingAllowed({ BINANCE_MODE: 'production' })).toBe(false)
      expect(env.isLiveTradingAllowed({ BINANCE_MODE: 'production', AGENT_ALLOW_LIVE_TRADING: 'true' })).toBe(true)
      expect(env.isLiveTradingAllowed({ BINANCE_MODE: 'sandbox', AGENT_ALLOW_LIVE_TRADING: 'true' })).toBe(false)
    })
  })

  describe('getUploadsRoot', () => {
    it('honours UPLOADS_DIR and falls back to public/uploads', () => {
      expect(env.getUploadsRoot({ UPLOADS_DIR: '/data/uploads' })).toBe(path.resolve('/data/uploads'))
      expect(env.getUploadsRoot({}).endsWith(path.join('public', 'uploads'))).toBe(true)
    })
  })
})
