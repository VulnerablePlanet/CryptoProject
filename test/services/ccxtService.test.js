import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'node:module'

/**
 * CCXT Service unit tests (TD-005).
 *
 * The service is a CJS module singleton that maintains its own exchange-instance
 * and data caches. We inject a fake `ccxt` object via the service's `_setCcxt`
 * hook (same DI pattern as research.js `_setAxios`) so the tests never hit the
 * network and remain deterministic.
 */

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))

/**
 * Build a fake exchange class whose network callbacks are mockable vi.fn()s
 * exposed on the constructor as `Cls.__mocks`. Instances delegate to these
 * shared mocks, so tests can program behavior without touching the network.
 */
function makeFakeExchange(id) {
  const mocks = {
    loadMarkets: vi.fn(async () => {}),
    fetchOHLCV: vi.fn(async () => []),
    fetchOrderBook: vi.fn(async () => ({ timestamp: Date.now(), bids: [], asks: [] })),
    fetchTicker: vi.fn(async () => ({}))
  }
  const cls = class {
    constructor(config) {
      this.id = id
      this.config = config
      this.timeframes = { '1m': '1m', '5m': '5m', '1h': '1h', '4h': '4h', '1d': '1d' }
      this.markets = {}
    }
    async loadMarkets() { return mocks.loadMarkets.call(this) }
    async fetchOHLCV(...args) { return mocks.fetchOHLCV(...args) }
    async fetchOrderBook(...args) { return mocks.fetchOrderBook(...args) }
    async fetchTicker(...args) { return mocks.fetchTicker(...args) }
  }
  cls.__mocks = mocks
  return cls
}

function buildFakeCcxt() {
  return {
    binance: makeFakeExchange('binance'),
    kraken: makeFakeExchange('kraken'),
    coinbase: makeFakeExchange('coinbase'),
    bitget: makeFakeExchange('bitget'),
    bybit: makeFakeExchange('bybit'),
    okx: makeFakeExchange('okx'),
    kucoin: makeFakeExchange('kucoin')
  }
}

let ccxtService

beforeEach(async () => {
  ccxtService = requireFromServer('./services/ccxtService.js')
  // Inject a fresh fake ccxt module for every test.
  ccxtService._setCcxt(buildFakeCcxt())
  // Reset module-level data cache between tests to avoid cross-test pollution.
  ccxtService.clearCache()
})

describe('ccxtService — exchange instance management', () => {
  it('exposes exactly the 7 supported exchanges', () => {
    const supported = ccxtService.getSupportedExchanges()
    expect(supported).toHaveLength(7)
    const ids = supported.map((s) => s.id).sort()
    expect(ids).toEqual(['binance', 'bitget', 'bybit', 'coinbase', 'kraken', 'kucoin', 'okx'])
  })

  it('normalizes exchange IDs to lowercase', () => {
    const supported = ccxtService.getSupportedExchanges()
    expect(supported.every((s) => s.id === s.id.toLowerCase())).toBe(true)
  })
})

describe('ccxtService — fetchOHLCV', () => {
  it('maps raw ccxt candles to the TradingView-friendly shape', async () => {
    const fake = buildFakeCcxt()
    ccxtService._setCcxt(fake)
    fake.binance.__mocks.fetchOHLCV.mockResolvedValueOnce([
      [1710000000000, 100, 110, 90, 105, 5000],
      [1710003600000, 105, 115, 100, 112, 6000]
    ])

    const result = await ccxtService.fetchOHLCV('binance', 'BTC/USDT', '1h', 2)

    expect(result.fromCache).toBe(false)
    expect(result.candles).toHaveLength(2)
    expect(result.candles[0]).toEqual({
      timestamp: 1710000000000,
      time: 1710000000,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 5000
    })
  })

  it('returns the cached result on a second call (fromCache true)', async () => {
    const fake = buildFakeCcxt()
    ccxtService._setCcxt(fake)
    fake.binance.__mocks.fetchOHLCV.mockResolvedValueOnce([
      [1710000000000, 100, 110, 90, 105, 5000]
    ])

    const first = await ccxtService.fetchOHLCV('binance', 'BTC/USDT', '1h', 1)
    const second = await ccxtService.fetchOHLCV('binance', 'BTC/USDT', '1h', 1)

    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    // Only one real ccxt call despite two service invocations.
    expect(fake.binance.__mocks.fetchOHLCV).toHaveBeenCalledTimes(1)
  })

  it('falls back 4h → 1h for Coinbase', async () => {
    const fake = buildFakeCcxt()
    ccxtService._setCcxt(fake)
    fake.coinbase.__mocks.fetchOHLCV.mockResolvedValueOnce([
      [1710000000000, 100, 110, 90, 105, 5000]
    ])

    await ccxtService.fetchOHLCV('coinbase', 'BTC/USD', '4h', 1)

    // Coinbase's 4h maps to 1h (timeframe fallback), so ccxt receives '1h'.
    expect(fake.coinbase.__mocks.fetchOHLCV).toHaveBeenCalledWith('BTC/USD', '1h', undefined, 1)
  })
})

describe('ccxtService — fetchOrderBook', () => {
  it('calculates cumulative amounts and midPrice', async () => {
    const fake = buildFakeCcxt()
    ccxtService._setCcxt(fake)
    fake.binance.__mocks.fetchOrderBook.mockResolvedValueOnce({
      timestamp: 1710000000000,
      bids: [[100, 2], [99, 3]],
      asks: [[101, 5], [102, 7]]
    })

    const result = await ccxtService.fetchOrderBook('binance', 'BTC/USDT', 50)

    expect(result.fromCache).toBe(false)
    expect(result.orderBook.bids).toEqual([
      { price: 100, amount: 2, cumulative: 2 },
      { price: 99, amount: 3, cumulative: 5 }
    ])
    expect(result.orderBook.asks).toEqual([
      { price: 101, amount: 5, cumulative: 5 },
      { price: 102, amount: 7, cumulative: 12 }
    ])
    // midPrice = (best bid + best ask) / 2 = (100 + 101) / 2
    expect(result.orderBook.midPrice).toBe(100.5)
  })

  it('returns null midPrice when order book is empty', async () => {
    const fake = buildFakeCcxt()
    ccxtService._setCcxt(fake)
    fake.binance.__mocks.fetchOrderBook.mockResolvedValueOnce({
      timestamp: Date.now(),
      bids: [],
      asks: []
    })

    const result = await ccxtService.fetchOrderBook('binance', 'BTC/USDT', 50)

    expect(result.orderBook.midPrice).toBe(null)
    expect(result.orderBook.bids).toEqual([])
    expect(result.orderBook.asks).toEqual([])
  })
})

describe('ccxtService — fetchTicker', () => {
  it('maps raw ticker fields into a normalized shape', async () => {
    const fake = buildFakeCcxt()
    ccxtService._setCcxt(fake)
    fake.binance.__mocks.fetchTicker.mockResolvedValueOnce({
      symbol: 'BTC/USDT',
      timestamp: 1710000000000,
      high: 120,
      low: 90,
      bid: 104,
      ask: 106,
      last: 105,
      open: 100,
      close: 105,
      change: 5,
      percentage: 5,
      baseVolume: 10000,
      quoteVolume: 1000000
    })

    const result = await ccxtService.fetchTicker('binance', 'BTC/USDT')

    expect(result.fromCache).toBe(false)
    expect(result.ticker).toEqual({
      symbol: 'BTC/USDT',
      timestamp: 1710000000000,
      high: 120,
      low: 90,
      bid: 104,
      ask: 106,
      last: 105,
      open: 100,
      close: 105,
      change: 5,
      percentage: 5,
      volume: 10000,
      quoteVolume: 1000000
    })
  })
})

describe('ccxtService — fetchMarkets', () => {
  it('filters to spot markets only and sorts by symbol', async () => {
    const fake = buildFakeCcxt()
    ccxtService._setCcxt(fake)
    const mocks = fake.binance.__mocks
    mocks.loadMarkets.mockImplementation(async function () {
      this.markets = {
        'ETH/USDT': { symbol: 'ETH/USDT', base: 'ETH', quote: 'USDT', active: true, spot: true, baseId: 'ETH', quoteId: 'USDT', precision: { price: 2, amount: 5 } },
        'BTC/USDT': { symbol: 'BTC/USDT', base: 'BTC', quote: 'USDT', active: true, spot: true, baseId: 'BTC', quoteId: 'USDT', precision: { price: 2, amount: 5 } },
        'BTC/USDT:USDT': { symbol: 'BTC/USDT:USDT', base: 'BTC', quote: 'USDT', active: true, spot: false, baseId: 'BTC', quoteId: 'USDT', precision: { price: 2, amount: 5 } },
        'XYZ/BTC': { symbol: 'XYZ/BTC', base: 'XYZ', quote: 'BTC', active: false, spot: true, baseId: 'XYZ', quoteId: 'BTC', precision: {} }
      }
    })

    const markets = await ccxtService.fetchMarkets('binance')

    const symbols = markets.map((m) => m.symbol)
    expect(symbols).toEqual(['BTC/USDT', 'ETH/USDT']) // futures + inactive excluded, sorted
  })

  it('rejects unsupported exchanges with a descriptive error', async () => {
    await expect(ccxtService.fetchMarkets('bogus')).rejects.toThrow(/not supported/)
  })
})

describe('ccxtService — clearCache', () => {
  it('clears cached OHLCV data', async () => {
    const fake = buildFakeCcxt()
    ccxtService._setCcxt(fake)
    fake.binance.__mocks.fetchOHLCV.mockResolvedValue([
      [1710000000000, 100, 110, 90, 105, 5000]
    ])

    await ccxtService.fetchOHLCV('binance', 'BTC/USDT', '1h', 1)
    expect(ccxtService.getCacheStats().size).toBeGreaterThan(0)

    ccxtService.clearCache()
    expect(ccxtService.getCacheStats().size).toBe(0)
  })
})