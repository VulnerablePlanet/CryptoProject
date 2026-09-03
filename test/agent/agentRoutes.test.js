import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'

// The router is CJS and requires mongoose through its own registry. To access
// the same mongoose instance the router uses, we resolve it from the server's
// module context (same pattern as test/auth/authController.test.js).
const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const mongoose = requireFromServer('mongoose')
const agentRouter = requireFromServer('./routes/agent.js')

/**
 * Minimal Express-like harness: walks the router's stack and invokes the
 * first matching route handler with mocked req/res. Router-level middleware
 * (auth, requireAdmin) is bypassed — we invoke the route's own handler
 * stack directly, so tests focus purely on handler behavior.
 */
const dispatch = (method, path, { params = {}, query = {}, body = {} } = {}) => {
  return new Promise((resolve) => {
    const req = { method, path, params, query, body, headers: {} }
    // Handlers end by calling res.json() — resolve the dispatch promise there.
    const res = {
      status: vi.fn(() => res),
      json: vi.fn(() => resolve({ res }))
    }
    const layer = agentRouter.stack.find((l) => {
      if (!l.route) return false
      const methodsMatch = l.route.methods[method.toLowerCase()]
      const pathMatch = l.route.path === path
      return methodsMatch && pathMatch
    })
    if (!layer) {
      throw new Error(`No route found: ${method} ${path}`)
    }
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

// Position/AgentState schemas used by /positions and /state handlers.
// Registered on the shared mongoose singleton the router itself uses.
const registerTestModels = () => {
  if (!mongoose.models.Position) {
    const positionSchema = new mongoose.Schema({
      symbol: String,
      status: String,
      entryPrice: Number,
      amount: Number
    })
    mongoose.model('Position', positionSchema)
  }
  if (!mongoose.models.AgentState) {
    const agentStateSchema = new mongoose.Schema({
      agentId: String,
      state: String,
      capital: Number
    })
    mongoose.model('AgentState', agentStateSchema)
  }
}

/**
 * The /positions and /state handlers check mongoose.connection.readyState
 * before touching the DB. There is no live connection in tests, so we mock
 * the readyState getter to simulate a connected state.
 */
const mockConnectedState = () => {
  const connection = mongoose.connection
  const descriptor = Object.getOwnPropertyDescriptor(connection, 'readyState')
  Object.defineProperty(connection, 'readyState', {
    configurable: true,
    get: () => 1
  })
  return () => {
    if (descriptor) Object.defineProperty(connection, 'readyState', descriptor)
    else delete connection.readyState
  }
}

/**
 * The /positions and /state handlers chain mongoose queries:
 * `Position.find({...}).lean()`. A plain mockRejectedValueOnce breaks the
 * chain (the rejected promise has no .lean), so we mock a chainable query
 * object whose .lean() rejects with the intended error.
 */
const rejectingQuery = (error) => ({
  lean: () => Promise.reject(error)
})

describe('agent routes error sanitization', () => {
  let consoleErrorSpy
  let restoreReadyState

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    registerTestModels()
    restoreReadyState = mockConnectedState()
  })

  afterEach(() => {
    restoreReadyState()
    vi.restoreAllMocks()
  })

  describe('GET /positions', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      const Position = mongoose.model('Position')
      vi.spyOn(Position, 'find').mockReturnValueOnce(
        rejectingQuery(new Error('MongoServerSelectionError mongodb://admin:secret@prod-internal:27017'))
      )

      const { res } = await dispatch('GET', '/positions')

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.error).toBe('Failed to fetch positions')
      expect(body.error).not.toContain('secret')
      expect(body.error).not.toContain('prod-internal')
    })

    it('logs the real error server-side via logger', async () => {
      const Position = mongoose.model('Position')
      vi.spyOn(Position, 'find').mockReturnValueOnce(
        rejectingQuery(new Error('MongoServerSelectionError production-host:27017'))
      )

      await dispatch('GET', '/positions')

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to fetch open positions')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'production-host')).toBe(true)
    })
  })

  describe('GET /state', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      const AgentState = mongoose.model('AgentState')
      vi.spyOn(AgentState, 'findOne').mockReturnValueOnce(
        rejectingQuery(new Error('query planner crash: ns=agent.states idx=secret_key_1'))
      )

      const { res } = await dispatch('GET', '/state')

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.error).toBe('Failed to fetch agent state')
      expect(body.error).not.toContain('secret_key')
    })

    it('logs the real error server-side via logger', async () => {
      const AgentState = mongoose.model('AgentState')
      vi.spyOn(AgentState, 'findOne').mockReturnValueOnce(
        rejectingQuery(new Error('replica set primary lost'))
      )

      await dispatch('GET', '/state')

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to fetch agent state')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, 'replica set primary lost')).toBe(true)
    })
  })

  describe('GET /signal', () => {
    it('returns generic 500 without leaking internal error details', async () => {
      const research = requireFromServer('./trading/agent/phases/research.js')
      vi.spyOn(research, 'runResearchCycle').mockRejectedValueOnce(
        new Error('coingecko API key CG-SECRET-123 rejected in fetch headers')
      )

      const { res } = await dispatch('GET', '/signal', { query: { symbol: 'BTC/USDT' } })

      expect(res.status).toHaveBeenCalledWith(500)
      const body = res.json.mock.calls[0][0]
      expect(body.error).toBe('Failed to generate signal')
      expect(body.error).not.toContain('CG-SECRET-123')
    })

    it('logs the real error server-side via logger', async () => {
      const research = requireFromServer('./trading/agent/phases/research.js')
      vi.spyOn(research, 'runResearchCycle').mockRejectedValueOnce(
        new Error('upstream coingecko 429 rate limited')
      )

      await dispatch('GET', '/signal', { query: { symbol: 'BTC/USDT' } })

      expect(wasLoggedWith(consoleErrorSpy, 'Failed to generate agent signal')).toBe(true)
      expect(wasLoggedWith(consoleErrorSpy, '429 rate limited')).toBe(true)
    })
  })
})
