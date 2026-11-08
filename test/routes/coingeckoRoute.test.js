import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { createRequire } from 'node:module'

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const express = requireFromServer('express')
const jwt = requireFromServer('jsonwebtoken')
const mongoose = requireFromServer('mongoose')
const User = requireFromServer('./models/User.js')
const limiter = requireFromServer('./services/coingeckoRateLimiter.js')
const router = requireFromServer('./routes/coingecko.js')

describe('GET /api/coingecko/*', () => {
  let server
  let base
  let token

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-'.repeat(4)
    const userId = new mongoose.Types.ObjectId()
    token = jwt.sign({ userId }, process.env.JWT_SECRET, { algorithm: 'HS256' })
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: userId })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const app = express()
    app.use('/api/coingecko', router)
    await new Promise((resolve) => { server = app.listen(0, resolve) })
    base = `http://127.0.0.1:${server.address().port}/api/coingecko`
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await new Promise((resolve) => server.close(resolve))
  })

  beforeEach(() => {
    vi.spyOn(limiter, 'get').mockReset()
  })

  const get = (path) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } })

  it('requires authentication', async () => {
    const res = await fetch(`${base}/global`)
    expect(res.status).toBe(401)
  })

  it('proxies allowed endpoints through the rate limiter with the query params', async () => {
    limiter.get.mockResolvedValueOnce([{ id: 'bitcoin' }])
    const res = await get('/coins/markets?vs_currency=usd&per_page=5')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'bitcoin' }])
    expect(limiter.get).toHaveBeenCalledWith('/coins/markets', { per_page: '5', vs_currency: 'usd' })
  })

  it('caches identical requests (parameter order does not matter)', async () => {
    limiter.get.mockResolvedValueOnce({ data: 1 })
    await get('/simple/price?ids=bitcoin&vs_currencies=usd')
    const res = await get('/simple/price?vs_currencies=usd&ids=bitcoin')
    expect(await res.json()).toEqual({ data: 1 })
    expect(limiter.get).toHaveBeenCalledTimes(1)
  })

  it('rejects endpoints outside the allow-list', async () => {
    const res = await get('/exchanges')
    expect(res.status).toBe(404)
    expect(limiter.get).not.toHaveBeenCalled()
  })

  it('maps upstream failures to 502 without leaking details', async () => {
    limiter.get.mockRejectedValueOnce(Object.assign(new Error('socket hang up at 10.0.0.3'), { response: { status: 500 } }))
    const res = await get('/global')
    expect(res.status).toBe(502)
    expect(JSON.stringify(await res.json())).not.toContain('10.0.0.3')
  })
})
