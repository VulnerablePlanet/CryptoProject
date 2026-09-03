import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import portfolioController from '../../server/controllers/portfolioController.js'

// The controller is CJS and requires models through its own registry. To
// access the same mongoose instance the controller uses, we resolve it from
// the server's module context (same pattern as test/auth/authController.test.js).
const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const mongoose = requireFromServer('mongoose')
const Portfolio = mongoose.model('Portfolio')

const { getPortfolio, addHolding, updateHolding, deleteHolding, clearPortfolio } = portfolioController

const createResMock = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
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

const createReqMock = (overrides = {}) => ({
  user: { _id: new mongoose.Types.ObjectId() },
  ...overrides
})

describe('portfolioController error handling', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPortfolio', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('MongoServerSelectionError mongodb://admin:secret@prod-internal:27017')
      )

      const req = createReqMock()
      const res = createResMock()

      await getPortfolio(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error fetching portfolio')
      expect(body.message).not.toContain('secret')
      expect(body.message).not.toContain('prod-internal')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('replica set stepdown mid-query')
      )

      const req = createReqMock()
      const res = createResMock()

      await getPortfolio(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to fetch portfolio')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'replica set stepdown')).toBe(true)
    })
  })

  describe('addHolding', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('validation failed: schema path /data/db/portfolio.bson corrupted')
      )

      const req = createReqMock({ body: { coinId: 'bitcoin' } })
      const res = createResMock()

      await addHolding(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error adding holding')
      expect(body.message).not.toContain('/data/db')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('write concern timeout w=2')
      )

      const req = createReqMock({ body: { coinId: 'bitcoin' } })
      const res = createResMock()

      await addHolding(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to add holding')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'write concern timeout')).toBe(true)
    })
  })

  describe('updateHolding', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('CastError: failed to cast ObjectId at /var/lib/mongodb/storage')
      )

      const req = createReqMock({ params: { holdingId: 'abc123' }, body: {} })
      const res = createResMock()

      await updateHolding(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error updating holding')
      expect(body.message).not.toContain('/var/lib')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('document version conflict')
      )

      const req = createReqMock({ params: { holdingId: 'abc123' }, body: {} })
      const res = createResMock()

      await updateHolding(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to update holding')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'document version conflict')).toBe(true)
    })
  })

  describe('deleteHolding', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('network timeout to shard-shard3.internal:27017')
      )

      const req = createReqMock({ params: { holdingId: 'abc123' } })
      const res = createResMock()

      await deleteHolding(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error deleting holding')
      expect(body.message).not.toContain('shard3')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('cannot delete from secondary')
      )

      const req = createReqMock({ params: { holdingId: 'abc123' } })
      const res = createResMock()

      await deleteHolding(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to delete holding')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'cannot delete from secondary')).toBe(true)
    })
  })

  describe('clearPortfolio', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('journal corruption at /mnt/db/journal/j._0')
      )

      const req = createReqMock()
      const res = createResMock()

      await clearPortfolio(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error clearing portfolio')
      expect(body.message).not.toContain('/mnt/db')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Portfolio, 'findOne').mockRejectedValueOnce(
        new Error('storage engine shutdown in progress')
      )

      const req = createReqMock()
      const res = createResMock()

      await clearPortfolio(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to clear portfolio')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'storage engine shutdown')).toBe(true)
    })
  })
})
