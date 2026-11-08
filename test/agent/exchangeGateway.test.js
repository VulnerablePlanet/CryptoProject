import { describe, it, expect, vi } from 'vitest'
import { createRequire } from 'node:module'

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const { createTradingExchange, cancelAllOpenOrders } = requireFromServer('./trading/agent/exchangeGateway.js')

/** Fake CCXT module: records constructor config and sandbox calls */
const makeCcxt = () => {
  const instances = []
  class binance {
    constructor (config) {
      this.config = config
      this.sandbox = false
      instances.push(this)
    }
    setSandboxMode (enabled) { this.sandbox = enabled }
  }
  return { lib: { binance }, instances }
}

const KEYS = { BINANCE_API_KEY: 'key-1234567890', BINANCE_API_SECRET: 'secret' }

describe('exchangeGateway.createTradingExchange', () => {
  it('uses the testnet unless BINANCE_MODE is exactly "production"', () => {
    for (const mode of [undefined, 'sandbox', 'Production', 'live']) {
      const { lib, instances } = makeCcxt()
      createTradingExchange('binance', { ccxtLib: lib, env: { ...KEYS, BINANCE_MODE: mode } })
      expect(instances[0].sandbox).toBe(true)
    }
  })

  it('uses the real exchange only in production mode', () => {
    const { lib, instances } = makeCcxt()
    createTradingExchange('binance', { ccxtLib: lib, env: { ...KEYS, BINANCE_MODE: 'production' } })
    expect(instances[0].sandbox).toBe(false)
  })

  it('passes credentials from the environment', () => {
    const { lib, instances } = makeCcxt()
    createTradingExchange('binance', { ccxtLib: lib, env: KEYS })
    expect(instances[0].config.apiKey).toBe(KEYS.BINANCE_API_KEY)
    expect(instances[0].config.secret).toBe(KEYS.BINANCE_API_SECRET)
  })

  it('throws when credentials are required but missing', () => {
    const { lib } = makeCcxt()
    expect(() => createTradingExchange('binance', { ccxtLib: lib, env: {}, requireCredentials: true }))
      .toThrow(/credentials/)
  })

  it('rejects unsupported exchanges', () => {
    const { lib } = makeCcxt()
    expect(() => createTradingExchange('nope', { ccxtLib: lib, env: KEYS })).toThrow(/not supported/)
  })
})

describe('exchangeGateway.cancelAllOpenOrders', () => {
  it('cancels every open order of every symbol and reports failures per symbol', async () => {
    const exchange = {
      fetchOpenOrders: vi.fn(async (symbol) => {
        if (symbol === 'ETH/USDT') throw new Error('boom')
        return [{ id: `${symbol}-1` }, { id: `${symbol}-2` }]
      }),
      cancelOrder: vi.fn(async () => ({}))
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await cancelAllOpenOrders(['BTC/USDT', 'ETH/USDT'], { exchange })

    expect(exchange.cancelOrder).toHaveBeenCalledTimes(2)
    expect(result.cancelled).toEqual(['BTC/USDT-1', 'BTC/USDT-2'])
    expect(result.failed).toEqual([{ symbol: 'ETH/USDT', error: 'boom' }])
    vi.restoreAllMocks()
  })

  it('is a no-op without symbols', async () => {
    const result = await cancelAllOpenOrders([], {})
    expect(result).toEqual({ cancelled: [], failed: [] })
  })
})
