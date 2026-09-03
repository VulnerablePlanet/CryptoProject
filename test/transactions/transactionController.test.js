import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'
import transactionController from '../../server/controllers/transactionController.js'

// The controller is CJS and requires models through its own registry. To
// access the same mongoose instance the controller uses, we resolve it from
// the server's module context (same pattern as test/auth/authController.test.js).
const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const mongoose = requireFromServer('mongoose')
const Transaction = mongoose.model('Transaction')

const { getTransactions, getTransaction, createTransaction, deleteTransaction, getTransactionStats } = transactionController

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

describe('transactionController error handling', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getTransactions', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Transaction, 'find').mockReturnValueOnce({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.reject(new Error('cursor exhausted on shard rs-2.internal:27017'))
            })
          })
        })
      })
      vi.spyOn(Transaction, 'countDocuments').mockResolvedValueOnce(0)

      const req = createReqMock({ query: {} })
      const res = createResMock()

      await getTransactions(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error fetching transactions')
      expect(body.message).not.toContain('rs-2.internal')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Transaction, 'find').mockReturnValueOnce({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => Promise.reject(new Error('query exceeded memory limit 100MB'))
            })
          })
        })
      })
      vi.spyOn(Transaction, 'countDocuments').mockResolvedValueOnce(0)

      const req = createReqMock({ query: {} })
      const res = createResMock()

      await getTransactions(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to fetch transactions')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'memory limit')).toBe(true)
    })
  })

  describe('getTransaction', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Transaction, 'findOne').mockRejectedValueOnce(
        new Error('ObjectId invalid: bytes at /usr/share/mongodb/keys')
      )

      const req = createReqMock({ params: { id: 'abc123' } })
      const res = createResMock()

      await getTransaction(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error fetching transaction')
      expect(body.message).not.toContain('/usr/share')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Transaction, 'findOne').mockRejectedValueOnce(
        new Error('session killed by admin')
      )

      const req = createReqMock({ params: { id: 'abc123' } })
      const res = createResMock()

      await getTransaction(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to fetch transaction')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'session killed')).toBe(true)
    })
  })

  describe('createTransaction', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Transaction, 'create').mockRejectedValueOnce(
        new Error('duplicate key error collection=app.transactions index=user_1 with credentials admin:hunter2')
      )

      const req = createReqMock({
        body: {
          type: 'buy',
          coinId: 'bitcoin',
          symbol: 'BTC',
          coinName: 'Bitcoin',
          amount: 0.5,
          priceAtTransaction: 50000
        }
      })
      const res = createResMock()

      await createTransaction(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error creating transaction')
      expect(body.message).not.toContain('hunter2')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Transaction, 'create').mockRejectedValueOnce(
        new Error('transaction too large 16MB')
      )

      const req = createReqMock({
        body: {
          type: 'buy',
          coinId: 'bitcoin',
          symbol: 'BTC',
          coinName: 'Bitcoin',
          amount: 0.5,
          priceAtTransaction: 50000
        }
      })
      const res = createResMock()

      await createTransaction(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to create transaction')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, '16MB')).toBe(true)
    })
  })

  describe('deleteTransaction', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Transaction, 'findOne').mockRejectedValueOnce(
        new Error('not authorized on admin cluster, host mongo.internal:27017')
      )

      const req = createReqMock({ params: { id: 'abc123' } })
      const res = createResMock()

      await deleteTransaction(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error deleting transaction')
      expect(body.message).not.toContain('mongo.internal')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Transaction, 'findOne').mockRejectedValueOnce(
        new Error('cannot drop index mid-operation')
      )

      const req = createReqMock({ params: { id: 'abc123' } })
      const res = createResMock()

      await deleteTransaction(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to delete transaction')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'cannot drop index')).toBe(true)
    })
  })

  describe('getTransactionStats', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      vi.spyOn(Transaction, 'aggregate').mockRejectedValueOnce(
        new Error('aggregation aborted: $group exceeded limits on node atlas-shard-7')
      )

      const req = createReqMock()
      const res = createResMock()

      await getTransactionStats(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe('Error fetching transaction stats')
      expect(body.message).not.toContain('atlas-shard-7')
    })

    it('logs the real error server-side via logger', async () => {
      vi.spyOn(Transaction, 'aggregate').mockRejectedValueOnce(
        new Error('pipeline stage timeout after 90s')
      )

      const req = createReqMock()
      const res = createResMock()

      await getTransactionStats(req, res)

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to fetch transaction stats')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'pipeline stage timeout')).toBe(true)
    })
  })
})
