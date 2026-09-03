import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import ohlcController from '../../server/controllers/ohlcController.js'

// The controller is CJS and requires ohlcService through its own registry.
// To spy on the service the controller actually uses, we resolve it from the
// server's module context (same pattern as test/auth/authController.test.js).
const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const ohlcService = requireFromServer('./services/ohlcService.js')

const { getCandles, syncCoin, getSupportedCoins, getStatus, syncAllTimeframes } = ohlcController

const createResMock = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

/**
 * The structured logger writes error-level entries through console.error,
 * passing the normalized meta as an object (readable format in dev, JSON
 * lines in production). This helper checks string args and serialized
 * object args so it works in both formats.
 */
const wasLoggedWith = (spy, text) =>
  spy.mock.calls.some((args) =>
    args.some((arg) => {
      if (typeof arg === 'string') return arg.includes(text)
      if (arg && typeof arg === 'object') {
        try {
          return JSON.stringify(arg).includes(text)
        } catch {
          return false
        }
      }
      return false
    })
  )

describe('ohlcController error sanitization', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCandles', () => {
    it('returns generic 500 message without leaking internal error details', async () => {
      const internalError = new Error('ECONNREFUSED to coingecko.internal.aws:443')
      vi.spyOn(ohlcService, 'getCandles').mockRejectedValueOnce(internalError)

      const req = { params: { coinId: 'bitcoin' }, query: { timeframe: '1h' } }
      const res = createResMock()

      await getCandles(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.success).toBe(false)
      expect(body.message).toBe('Failed to get candles')
      expect(body.message).not.toContain('ECONNREFUSED')
      expect(body.message).not.toContain('coingecko')
    })

    it('logs the real error server-side via logger', async () => {
      const internalError = new Error('MongoNetworkTimeout mongodb://admin:secret@prod:27017')
      vi.spyOn(ohlcService, 'getCandles').mockRejectedValueOnce(internalError)

      const req = { params: { coinId: 'bitcoin' }, query: { timeframe: '1h' } }
      const res = createResMock()

      await getCandles(req, res)

      // logger.error writes through console.error in all environments
      expect(wasLoggedWith(consoleErrorSpy, 'Failed to get candles')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'MongoNetworkTimeout')).toBe(true)
    })

    it('rejects invalid timeframe with 400 before touching the service', async () => {
      const getCandlesSpy = vi.spyOn(ohlcService, 'getCandles')

      const req = { params: { coinId: 'bitcoin' }, query: { timeframe: 'bogus' } }
      const res = createResMock()

      await getCandles(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(getCandlesSpy).not.toHaveBeenCalled()
    })
  })

  describe('syncCoin', () => {
    it('returns generic 500 message without leaking internal error details', async () => {
      const internalError = new Error('connect ETIMEDOUT 10.0.4.12:27017 (mongo credentials: admin/hunter2)')
      vi.spyOn(ohlcService, 'syncCandles').mockRejectedValueOnce(internalError)

      const req = { params: { coinId: 'ethereum' }, body: { timeframe: '1h' } }
      const res = createResMock()

      await syncCoin(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to sync candles')
      expect(body.message).not.toContain('ETIMEDOUT')
      expect(body.message).not.toContain('hunter2')
    })

    it('logs the real error server-side via logger', async () => {
      const internalError = new Error('Redis connection lost')
      vi.spyOn(ohlcService, 'syncCandles').mockRejectedValueOnce(internalError)

      const req = { params: { coinId: 'ethereum' }, body: {} }
      const res = createResMock()

      await syncCoin(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to sync candles for coin')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'Redis connection lost')).toBe(true)
    })
  })

  describe('getSupportedCoins', () => {
    it('returns generic 500 message without leaking internal error details', async () => {
      const internalError = new Error('API key expired: sk-live-9f8e7d6c')
      vi.spyOn(ohlcService, 'getSupportedCoins').mockRejectedValueOnce(internalError)

      const req = {}
      const res = createResMock()

      await getSupportedCoins(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to get coins list')
      expect(body.message).not.toContain('sk-live')
    })

    it('logs the real error server-side via logger', async () => {
      const internalError = new Error('CoinGecko rate limit exceeded')
      vi.spyOn(ohlcService, 'getSupportedCoins').mockRejectedValueOnce(internalError)

      const req = {}
      const res = createResMock()

      await getSupportedCoins(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to get supported coins')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'rate limit')).toBe(true)
    })
  })

  describe('getStatus', () => {
    it('returns generic 500 message without leaking internal error details', async () => {
      const internalError = new Error('stack trace leak: /home/deploy/.env')
      vi.spyOn(ohlcService, 'getServiceStatus').mockImplementationOnce(() => {
        throw internalError
      })

      const req = {}
      const res = createResMock()

      await getStatus(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to get service status')
      expect(body.message).not.toContain('.env')
    })
  })

  describe('syncAllTimeframes', () => {
    it('returns generic 500 message without leaking internal error details', async () => {
      // The outer catch only fires when something outside the per-timeframe
      // loop throws (e.g. reading the timeframe list itself).
      const internalError = new Error('disk full at /var/lib/mongodb')
      vi.spyOn(ohlcService, 'TIMEFRAME_MS', 'get').mockImplementationOnce(() => {
        throw internalError
      })

      const req = { params: { coinId: 'bitcoin' }, body: {} }
      const res = createResMock()

      await syncAllTimeframes(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to sync all timeframes')
      expect(body.message).not.toContain('/var/lib')
    })

    it('does not leak per-timeframe error details in results array', async () => {
      const internalError = new Error('upstream 502 from api.coingecko.com with token=abc123')
      vi.spyOn(ohlcService, 'syncCandles').mockRejectedValue(internalError)

      const req = { params: { coinId: 'bitcoin' }, body: {} }
      const res = createResMock()

      await syncAllTimeframes(req, res)

      // sync-all aggregates per-timeframe results; each failure entry must be generic
      const body = res.json.mock.calls[0][0]
      expect(body.success).toBe(true)
      for (const result of body.results) {
        expect(result.success).toBe(false)
        expect(result.error).toBe('Sync failed')
        expect(String(result.error)).not.toContain('coingecko')
        expect(String(result.error)).not.toContain('abc123')
      }
    })

    it('logs per-timeframe failures server-side via logger', async () => {
      const internalError = new Error('upstream timeout')
      vi.spyOn(ohlcService, 'syncCandles').mockRejectedValue(internalError)

      const req = { params: { coinId: 'bitcoin' }, body: {} }
      const res = createResMock()

      await syncAllTimeframes(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to sync timeframe during sync-all')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'upstream timeout')).toBe(true)
    })
  })
})
