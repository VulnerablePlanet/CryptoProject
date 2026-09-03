import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'

// The router is CJS and requires services through its own registry. To spy on
// the services the router actually uses, we resolve them from the server's
// module context (same pattern as test/auth/authController.test.js).
const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const ccxtService = requireFromServer('./services/ccxtService.js')
const ccxtPriceService = requireFromServer('./services/ccxtPriceService.js')
const exchangeRouter = requireFromServer('./routes/exchange.js')

/**
 * Minimal Express-like harness: walks the router's stack and invokes the
 * first matching route handler with mocked req/res. This avoids spinning up
 * an HTTP server while still exercising the real route definitions.
 */
const dispatch = (method, path, { params = {}, query = {}, body = {} } = {}) => {
  return new Promise((resolve) => {
    const req = { method, path, params, query, body, headers: {} }
    // Handlers end by calling res.json() — resolve the dispatch promise there.
    const res = {
      status: vi.fn(() => res),
      json: vi.fn(() => resolve({ res }))
    }
    // Find the first layer matching method + path
    const layer = exchangeRouter.stack.find((l) => {
      if (!l.route) return false
      const methodsMatch = l.route.methods[method.toLowerCase()]
      const pathMatch = l.route.path === path
      return methodsMatch && pathMatch
    })
    if (!layer) {
      throw new Error(`No route found: ${method} ${path}`)
    }
    // Run the handler chain (auth middleware runs at router level; we invoke
    // the route's own stack directly, bypassing router-level middleware)
    const handlers = layer.route.stack.map((l) => l.handle)
    let index = -1
    const next = (err) => {
      index += 1
      if (err || index >= handlers.length) {
        resolve({ res, err })
        return
      }
      handlers[index](req, res, next)
    }
    next()
  })
}

/**
 * The structured logger writes error-level entries through console.error.
 * This helper checks string args and serialized object args so it works in
 * both dev (readable) and production (JSON lines) formats.
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

describe('exchange routes error sanitization', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /supported', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(ccxtService, 'getSupportedExchanges').mockImplementationOnce(() => {
        throw new Error('internal config path /home/deploy/.env leaked')
      })

      const { res } = await dispatch('GET', '/supported')

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch supported exchanges')
      expect(body.message).not.toContain('.env')
    })
  })

  describe('GET /status', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(ccxtService, 'getCacheStats').mockImplementationOnce(() => {
        throw new Error('Redis AUTH failed with password hunter2')
      })

      const { res } = await dispatch('GET', '/status')

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch status')
      expect(body.message).not.toContain('hunter2')
    })
  })

  describe('GET /:exchange/markets', () => {
    it('returns generic 502 without leaking upstream error details', async () => {
      vi.spyOn(ccxtService, 'fetchMarkets').mockRejectedValueOnce(
        new Error('binance API key invalid: sk-prod-12345')
      )

      const { res } = await dispatch('GET', '/:exchange/markets', {
        params: { exchange: 'binance' }
      })

      expect(res.status).toHaveBeenCalledWith(502)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch markets')
      expect(body.message).not.toContain('sk-prod')
    })

    it('returns the controlled "not supported" validation message with 400', async () => {
      vi.spyOn(ccxtService, 'fetchMarkets').mockRejectedValueOnce(
        new Error('Exchange "bogus" is not supported. Supported: binance, kraken')
      )

      const { res } = await dispatch('GET', '/:exchange/markets', {
        params: { exchange: 'bogus' }
      })

      expect(res.status).toHaveBeenCalledWith(400)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toContain('not supported')
      // The supported list is public info (exposed via GET /supported)
      expect(body.message).toContain('binance')
    })

    it('logs the real error server-side via logger', async () => {
      const internalError = new Error('upstream 522 from binance')
      vi.spyOn(ccxtService, 'fetchMarkets').mockRejectedValueOnce(internalError)

      await dispatch('GET', '/:exchange/markets', { params: { exchange: 'binance' } })

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to fetch exchange markets')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'upstream 522')).toBe(true)
    })
  })

  describe('GET /:exchange/ohlcv', () => {
    it('returns generic 502 without leaking upstream error details', async () => {
      vi.spyOn(ccxtService, 'fetchOHLCV').mockRejectedValueOnce(
        new Error('ETIMEDOUT 10.0.0.1:443 after 30000ms')
      )

      const { res } = await dispatch('GET', '/:exchange/ohlcv/:base/:quote', {
        params: { exchange: 'binance', base: 'BTC', quote: 'USDT' },
        query: { timeframe: '1h' }
      })

      expect(res.status).toHaveBeenCalledWith(502)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch OHLCV data')
      expect(body.message).not.toContain('10.0.0.1')
    })
  })

  describe('GET /:exchange/orderbook', () => {
    it('returns generic 502 without leaking upstream error details', async () => {
      vi.spyOn(ccxtService, 'fetchOrderBook').mockRejectedValueOnce(
        new Error('proxy credentials admin:s3cret@proxy.internal')
      )

      const { res } = await dispatch('GET', '/:exchange/orderbook/:base/:quote', {
        params: { exchange: 'binance', base: 'BTC', quote: 'USDT' }
      })

      expect(res.status).toHaveBeenCalledWith(502)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch order book')
      expect(body.message).not.toContain('s3cret')
    })
  })

  describe('GET /:exchange/ticker', () => {
    it('returns generic 502 without leaking upstream error details', async () => {
      vi.spyOn(ccxtService, 'fetchTicker').mockRejectedValueOnce(
        new Error('binance secret key 8Kj2mS leaked in stack trace')
      )

      const { res } = await dispatch('GET', '/:exchange/ticker/:base/:quote', {
        params: { exchange: 'binance', base: 'BTC', quote: 'USDT' }
      })

      expect(res.status).toHaveBeenCalledWith(502)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch ticker')
      expect(body.message).not.toContain('8Kj2mS')
    })

    it('returns the controlled "not supported" validation message with 400', async () => {
      vi.spyOn(ccxtService, 'fetchTicker').mockRejectedValueOnce(
        new Error('Exchange "bogus" is not supported. Supported: binance, kraken')
      )

      const { res } = await dispatch('GET', '/:exchange/ticker/:base/:quote', {
        params: { exchange: 'bogus', base: 'BTC', quote: 'USDT' }
      })

      expect(res.status).toHaveBeenCalledWith(400)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toContain('not supported')
    })
  })

  describe('GET /:exchange/timeframes', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(ccxtService, 'getTimeframes').mockImplementationOnce(() => {
        throw new Error('cannot read config /etc/binance/keys.pem')
      })

      const { res } = await dispatch('GET', '/:exchange/timeframes', {
        params: { exchange: 'binance' }
      })

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch timeframes')
      expect(body.message).not.toContain('keys.pem')
    })

    it('returns the controlled "not supported" validation message with 400', async () => {
      vi.spyOn(ccxtService, 'getTimeframes').mockImplementationOnce(() => {
        throw new Error('Exchange "bogus" is not supported. Supported: binance, kraken')
      })

      const { res } = await dispatch('GET', '/:exchange/timeframes', {
        params: { exchange: 'bogus' }
      })

      expect(res.status).toHaveBeenCalledWith(400)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toContain('not supported')
    })
  })

  describe('DELETE /cache', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(ccxtService, 'clearCache').mockImplementationOnce(() => {
        throw new Error('EACCES permission denied /var/cache/ccxt')
      })

      const { res } = await dispatch('DELETE', '/cache')

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to clear cache')
      expect(body.message).not.toContain('/var/cache')
    })
  })

  describe('GET /:exchange/price', () => {
    it('returns generic 502 without leaking upstream error details', async () => {
      // ccxtPriceService.getPrice delegates to ccxtService.fetchTicker
      vi.spyOn(ccxtService, 'fetchTicker').mockRejectedValueOnce(
        new Error('coingecko api key CG-PROD-XYZ expired')
      )

      const { res } = await dispatch('GET', '/:exchange/price/:base/:quote', {
        params: { exchange: 'binance', base: 'BTC', quote: 'USDT' }
      })

      expect(res.status).toHaveBeenCalledWith(502)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch price')
      expect(body.message).not.toContain('CG-PROD-XYZ')
    })

    it('returns the controlled "not supported" validation message with 400', async () => {
      vi.spyOn(ccxtService, 'fetchTicker').mockRejectedValueOnce(
        new Error('Exchange "bogus" is not supported. Supported: binance, kraken')
      )

      const { res } = await dispatch('GET', '/:exchange/price/:base/:quote', {
        params: { exchange: 'bogus', base: 'BTC', quote: 'USDT' }
      })

      expect(res.status).toHaveBeenCalledWith(400)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toContain('not supported')
    })
  })

  describe('POST /prices', () => {
    it('returns generic 502 without leaking upstream error details', async () => {
      vi.spyOn(ccxtPriceService, 'getMultiplePrices').mockRejectedValueOnce(
        new Error('batch failed: internal host 10.20.30.40 unreachable')
      )

      const { res } = await dispatch('POST', '/prices', {
        body: { coins: ['bitcoin'] }
      })

      expect(res.status).toHaveBeenCalledWith(502)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Failed to fetch prices')
      expect(body.message).not.toContain('10.20.30.40')
    })
  })
})
