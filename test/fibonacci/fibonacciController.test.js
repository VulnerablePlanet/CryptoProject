import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'node:module'

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const fibonacciService = requireFromServer('./services/fibonacciService.js')
const { getAnalysis } = requireFromServer('./controllers/fibonacciController.js')

const res = () => {
  const r = {}
  r.status = vi.fn(() => r)
  r.json = vi.fn(() => r)
  return r
}
const req = { params: { coinId: 'bitcoin' }, query: {} }

describe('fibonacciController error mapping', () => {
  afterEach(() => vi.restoreAllMocks())

  it('answers 422 with the reason when market data is insufficient', async () => {
    vi.spyOn(fibonacciService, 'analyzeFibonacci').mockRejectedValueOnce(
      Object.assign(new Error('Insufficient candle data. Need at least 11 candles, got 0'), { code: 'INSUFFICIENT_DATA' })
    )
    const r = res()
    await getAnalysis(req, r)
    expect(r.status).toHaveBeenCalledWith(422)
    expect(r.json.mock.calls[0][0].message).toContain('Insufficient candle data')
  })

  it('answers a generic 500 without leaking internal errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(fibonacciService, 'analyzeFibonacci').mockRejectedValueOnce(new Error('connection to 10.0.0.5:27017 lost'))
    const r = res()
    await getAnalysis(req, r)
    expect(r.status).toHaveBeenCalledWith(500)
    expect(JSON.stringify(r.json.mock.calls[0][0])).not.toContain('10.0.0.5')
  })
})
