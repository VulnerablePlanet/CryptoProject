/**
 * ============================================================================
 * AUTH CONTROLLER TESTS — Error sanitization & input validation
 * ============================================================================
 * Security regression tests. These tests guarantee that:
 *
 * 1. A 500 response NEVER leaks internal error details (error.message,
 *    stack traces, driver messages) to the client.
 * 2. Malformed socialLinks input (invalid JSON) is rejected with 400
 *    instead of crashing with an unhandled exception.
 * 3. Errors are logged via the structured logger in EVERY environment
 *    (the old code silenced errors in production — invisible failures).
 *
 * Testing strategy: direct controller invocation with req/res mocks.
 * Model statics are intercepted with vi.spyOn on the REAL mongoose models
 * (they are singletons shared with the controller under test), because
 * vi.mock factories do NOT reliably intercept CJS require() calls in this
 * setup — see test/agent/phases/research.test.js, which documents the same
 * limitation and uses dependency injection instead.
 * Logger output is verified by spying on console.error, which is where
 * the structured logger writes error-level entries (dev AND prod formats).
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'node:module'

// Import ONLY the controller. It requires the models via CJS require(),
// compiling them in ITS module registry. Importing the models here too
// would compile a SECOND copy (OverwriteModelError) because vitest keeps
// separate registries for ESM imports and CJS requires — the same
// limitation documented in test/agent/phases/research.test.js.
// Instead, we reach the compiled singletons through the shared mongoose
// instance. mongoose is a dependency of server/package.json (not the root),
// so we require it from the server's own resolution context.
import authController from '../../server/controllers/authController.js'

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const mongoose = requireFromServer('mongoose')

const User = mongoose.model('User')
const RefreshToken = mongoose.model('RefreshToken')

/**
 * Minimal req/res mock factory for Express-style controllers.
 * res.json captures the payload; res.status chains like Express.
 */
const createResMock = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    }
  }
  return res
}

/**
 * The structured logger writes error-level entries through console.error
 * (readable format in dev, JSON lines in production). This helper checks
 * that the logger actually emitted a given message.
 */
const wasLoggedWith = (spy, text) =>
  spy.mock.calls.some((args) =>
    args.some((arg) => typeof arg === 'string' && arg.includes(text))
  )

let consoleErrorSpy

beforeEach(() => {
  // Observe (and silence) everything the logger writes to console.error
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  // Restore model statics and console.error
  vi.restoreAllMocks()
})

describe('authController — 500 responses never leak internal details', () => {
  test('login 500: response contains only the generic message, not error.message', async () => {
    // Simulate an unexpected internal failure (e.g. DB connection dropped)
    const internalError = new Error('Connection refused: mongodb://admin:secret@prod-cluster:27017/users')
    vi.spyOn(User, 'findOne').mockRejectedValueOnce(internalError)

    const req = { body: { email: 'user@example.com', password: 'Password123' } }
    const res = createResMock()

    await authController.login(req, res)

    // 1. Client gets a generic message — zero internal details
    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      success: false,
      message: 'Error logging in'
    })

    // 2. The raw error message must NOT appear anywhere in the response
    const responseBody = JSON.stringify(res.body)
    expect(responseBody).not.toContain('mongodb://')
    expect(responseBody).not.toContain('Connection refused')
    expect(responseBody).not.toContain('secret')

    // 3. The error WAS logged internally (not silently swallowed)
    expect(wasLoggedWith(consoleErrorSpy, 'Login failed')).toBe(true)
  })

  test('register 500: response contains only the generic message', async () => {
    const internalError = new Error('E11000 duplicate key error collection: users index email_1')
    vi.spyOn(User, 'findOne').mockResolvedValueOnce(null) // passes the "exists" check
    vi.spyOn(User, 'create').mockRejectedValueOnce(internalError)

    const req = {
      body: { name: 'Test', email: 'new@example.com', password: 'Password123' }
    }
    const res = createResMock()

    await authController.register(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      success: false,
      message: 'Error registering user'
    })
    expect(JSON.stringify(res.body)).not.toContain('E11000')
    expect(JSON.stringify(res.body)).not.toContain('duplicate key')
    expect(wasLoggedWith(consoleErrorSpy, 'Register failed')).toBe(true)
  })

  test('refreshAccessToken 500: response contains only the generic message', async () => {
    const internalError = new Error('MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017')
    vi.spyOn(RefreshToken, 'findValidToken').mockRejectedValueOnce(internalError)

    const req = { body: { refreshToken: 'some-token' } }
    const res = createResMock()

    await authController.refreshAccessToken(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      success: false,
      message: 'Error refreshing token'
    })
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED')
    expect(wasLoggedWith(consoleErrorSpy, 'Refresh token failed')).toBe(true)
  })

  test('updateProfile 500: response contains only the generic message (regression: old code returned error.message)', async () => {
    // Regression test: the OLD implementation returned `error.message` in the
    // 500 response, leaking internal details to the client.
    const internalError = new Error('ENOENT: no such file or directory, unlink \'/srv/uploads/avatars/old.png\'')
    vi.spyOn(User, 'findByIdAndUpdate').mockRejectedValueOnce(internalError)

    const req = {
      user: { _id: '507f1f77bcf86cd799439011', socialLinks: {} },
      body: { name: 'Updated Name' }
    }
    const res = createResMock()

    await authController.updateProfile(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      success: false,
      message: 'Error updating profile'
    })
    // The old bug: response contained the raw ENOENT path
    expect(JSON.stringify(res.body)).not.toContain('ENOENT')
    expect(JSON.stringify(res.body)).not.toContain('/srv/uploads')
    expect(wasLoggedWith(consoleErrorSpy, 'Update profile failed')).toBe(true)
  })

  test('getUserCount 500: response contains only the generic message', async () => {
    vi.spyOn(User, 'countDocuments').mockRejectedValueOnce(new Error('pool destroyed'))

    const req = {}
    const res = createResMock()

    await authController.getUserCount(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      success: false,
      message: 'Error fetching user count'
    })
    expect(JSON.stringify(res.body)).not.toContain('pool destroyed')
    expect(wasLoggedWith(consoleErrorSpy, 'Get user count failed')).toBe(true)
  })

  test('getAllUsers 500: response contains only the generic message', async () => {
    vi.spyOn(User, 'find').mockRejectedValueOnce(new Error('querySelector failed after 30s'))

    const req = {}
    const res = createResMock()

    await authController.getAllUsers(req, res)

    expect(res.statusCode).toBe(500)
    expect(res.body).toEqual({
      success: false,
      message: 'Error fetching users'
    })
    expect(JSON.stringify(res.body)).not.toContain('querySelector')
    expect(wasLoggedWith(consoleErrorSpy, 'Get all users failed')).toBe(true)
  })
})

describe('authController — updateProfile socialLinks validation', () => {
  const baseReq = () => {
    // Spy on the DB write these tests assert against (must never be
    // reached with invalid input). Re-spying an already-spied static
    // returns the same spy, so valid-path tests can queue behavior on it.
    vi.spyOn(User, 'findByIdAndUpdate')
    return {
      user: { _id: '507f1f77bcf86cd799439011', socialLinks: {} },
      body: {}
    }
  }

  test('malformed JSON string in socialLinks returns 400, not 500 (regression: old code threw unhandled)', async () => {
    // Regression test: the OLD implementation called JSON.parse without
    // try/catch — malformed input crashed into the generic catch and
    // returned a 500 with the parse error message leaked.
    const req = baseReq()
    req.body.socialLinks = '{not valid json!!'

    const res = createResMock()

    await authController.updateProfile(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({
      success: false,
      message: 'socialLinks must be a valid JSON object'
    })
    // The DB must never be touched for invalid input
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  test('socialLinks as JSON array is rejected with 400', async () => {
    const req = baseReq()
    req.body.socialLinks = '["twitter","https://x.com/me"]'

    const res = createResMock()

    await authController.updateProfile(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.message).toBe('socialLinks must be a valid JSON object')
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  test('socialLinks as JSON primitive (number) is rejected with 400', async () => {
    const req = baseReq()
    req.body.socialLinks = '42'

    const res = createResMock()

    await authController.updateProfile(req, res)

    expect(res.statusCode).toBe(400)
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  test('valid socialLinks object passes through and merges with existing links', async () => {
    const req = baseReq()
    req.user.socialLinks = { twitter: 'https://x.com/existing' }
    req.body.socialLinks = JSON.stringify({ github: 'https://github.com/new' })

    User.findByIdAndUpdate.mockResolvedValueOnce({
      _id: '507f1f77bcf86cd799439011',
      toJSON: () => ({ _id: '507f1f77bcf86cd799439011' })
    })

    const res = createResMock()

    await authController.updateProfile(req, res)

    expect(res.statusCode).toBe(200)
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({
        socialLinks: {
          twitter: 'https://x.com/existing',
          github: 'https://github.com/new'
        }
      }),
      expect.any(Object)
    )
  })

  test('socialLinks sent as object (not string) still works', async () => {
    const req = baseReq()
    req.body.socialLinks = { website: 'https://example.com' }

    User.findByIdAndUpdate.mockResolvedValueOnce({
      _id: '507f1f77bcf86cd799439011',
      toJSON: () => ({ _id: '507f1f77bcf86cd799439011' })
    })

    const res = createResMock()

    await authController.updateProfile(req, res)

    expect(res.statusCode).toBe(200)
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        socialLinks: { website: 'https://example.com' }
      }),
      expect.any(Object)
    )
  })
})

describe('authController — errors are logged in every environment', () => {
  test('login failure is logged via the structured logger (regression: old code silenced errors when NODE_ENV=production)', async () => {
    // The OLD implementation gated logging behind NODE_ENV !== 'production',
    // making production failures invisible. The controller no longer reads
    // NODE_ENV at all: logging is unconditional. We still run the call
    // under NODE_ENV=production to guard against any future regression.
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    try {
      vi.spyOn(User, 'findOne').mockRejectedValueOnce(new Error('prod failure'))
      const req = { body: { email: 'user@example.com', password: 'Password123' } }
      const res = createResMock()

      await authController.login(req, res)

      expect(res.statusCode).toBe(500)
      expect(res.body).toEqual({
        success: false,
        message: 'Error logging in'
      })
      expect(wasLoggedWith(consoleErrorSpy, 'Login failed')).toBe(true)
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  })
})
