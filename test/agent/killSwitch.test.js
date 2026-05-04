/**
 * ============================================================================
 * KILL SWITCH TESTS - Phase 10
 * ============================================================================
 * Unit tests for the Kill Switch risk management module.
 * Tests: daily loss, drawdown, consecutive losses thresholds
 */

import { check, checkThresholds, THRESHOLDS } from '../../server/trading/agent/killSwitch.js'

describe('KillSwitch', () => {
  describe('THRESHOLDS', () => {
    test('should have correct default thresholds', () => {
      expect(THRESHOLDS.DAILY_LOSS_PCT).toBe(0.03)
      expect(THRESHOLDS.MAX_DRAWDOWN_PCT).toBe(0.10)
      expect(THRESHOLDS.MAX_CONSECUTIVE_LOSSES).toBe(5)
    })
  })

  describe('check - daily loss', () => {
    test('daily loss < 3% should NOT trigger kill switch', () => {
      const result = check({ dailyLoss: 0.02, drawdown: 0, consecutiveLosses: 0 })
      expect(result.triggered).toBe(false)
      expect(result.reason).toBeNull()
    })

    test('daily loss = 2.99% should NOT trigger kill switch', () => {
      const result = check({ dailyLoss: 0.0299, drawdown: 0, consecutiveLosses: 0 })
      expect(result.triggered).toBe(false)
    })

    test('daily loss >= 3% should trigger kill switch', () => {
      const result = check({ dailyLoss: 0.03, drawdown: 0, consecutiveLosses: 0 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DAILY_LOSS')
    })

    test('daily loss = 5% should trigger kill switch', () => {
      const result = check({ dailyLoss: 0.05, drawdown: 0, consecutiveLosses: 0 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DAILY_LOSS')
      expect(result.details.triggerValue).toBe(0.05)
    })

    test('daily loss = 10% should trigger kill switch', () => {
      const result = check({ dailyLoss: 0.10, drawdown: 0, consecutiveLosses: 0 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DAILY_LOSS')
    })
  })

  describe('check - drawdown', () => {
    test('drawdown < 10% should NOT trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0.09, consecutiveLosses: 0 })
      expect(result.triggered).toBe(false)
      expect(result.reason).toBeNull()
    })

    test('drawdown = 9.99% should NOT trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0.0999, consecutiveLosses: 0 })
      expect(result.triggered).toBe(false)
    })

    test('drawdown >= 10% should trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0.10, consecutiveLosses: 0 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DRAWDOWN')
    })

    test('drawdown = 15% should trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0.15, consecutiveLosses: 0 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DRAWDOWN')
      expect(result.details.triggerValue).toBe(0.15)
    })

    test('drawdown = 25% should trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0.25, consecutiveLosses: 0 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DRAWDOWN')
    })
  })

  describe('check - consecutive losses', () => {
    test('consecutive losses < 5 should NOT trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0, consecutiveLosses: 4 })
      expect(result.triggered).toBe(false)
      expect(result.reason).toBeNull()
    })

    test('consecutive losses = 4 should NOT trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0, consecutiveLosses: 4 })
      expect(result.triggered).toBe(false)
    })

    test('consecutive losses >= 5 should trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0, consecutiveLosses: 5 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('CONSECUTIVE_LOSSES')
    })

    test('consecutive losses = 7 should trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0, consecutiveLosses: 7 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('CONSECUTIVE_LOSSES')
      expect(result.details.triggerValue).toBe(7)
    })

    test('consecutive losses = 10 should trigger kill switch', () => {
      const result = check({ dailyLoss: 0, drawdown: 0, consecutiveLosses: 10 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('CONSECUTIVE_LOSSES')
    })
  })

  describe('check - multiple triggers', () => {
    test('should report first triggered reason (daily loss prioritized)', () => {
      // When multiple thresholds are breached, daily loss is checked first
      const result = check({ dailyLoss: 0.05, drawdown: 0.15, consecutiveLosses: 10 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DAILY_LOSS')
    })

    test('drawdown should be checked before consecutive losses', () => {
      const result = check({ dailyLoss: 0, drawdown: 0.12, consecutiveLosses: 10 })
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DRAWDOWN')
    })
  })

  describe('check - no breaches', () => {
    test('all thresholds within limits should NOT trigger', () => {
      const result = check({
        dailyLoss: 0.01,
        drawdown: 0.03,
        consecutiveLosses: 2
      })
      expect(result.triggered).toBe(false)
      expect(result.reason).toBeNull()
    })

    test('zero values should NOT trigger', () => {
      const result = check({
        dailyLoss: 0,
        drawdown: 0,
        consecutiveLosses: 0
      })
      expect(result.triggered).toBe(false)
      expect(result.reason).toBeNull()
    })

    test('missing values default to 0 should NOT trigger', () => {
      const result = check({})
      expect(result.triggered).toBe(false)
      expect(result.reason).toBeNull()
    })
  })

  describe('check - custom thresholds', () => {
    test('should use custom thresholds when provided', () => {
      const result = check(
        { dailyLoss: 0.02, drawdown: 0, consecutiveLosses: 0 },
        { DAILY_LOSS_PCT: 0.01 } // Set lower threshold
      )
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DAILY_LOSS')
    })

    test('should not trigger when below custom thresholds', () => {
      const result = check(
        { dailyLoss: 0.02, drawdown: 0, consecutiveLosses: 0 },
        { DAILY_LOSS_PCT: 0.05 } // Set higher threshold
      )
      expect(result.triggered).toBe(false)
    })
  })

  describe('checkThresholds - alternative API', () => {
    test('should accept separate parameters', () => {
      const result = checkThresholds(0.04, 0, 0)
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DAILY_LOSS')
    })

    test('should work with all thresholds', () => {
      const result = checkThresholds(0, 0.12, 0)
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('DRAWDOWN')
    })

    test('should work with consecutive losses', () => {
      const result = checkThresholds(0, 0, 6)
      expect(result.triggered).toBe(true)
      expect(result.reason).toBe('CONSECUTIVE_LOSSES')
    })

    test('should return no trigger with safe values', () => {
      const result = checkThresholds(0.01, 0.05, 2)
      expect(result.triggered).toBe(false)
    })
  })

  describe('details object', () => {
    test('should include all performance metrics in details', () => {
      const result = check({
        dailyLoss: 0.02,
        drawdown: 0.05,
        consecutiveLosses: 3
      })

      expect(result.details.dailyLoss).toBe(0.02)
      expect(result.details.drawdown).toBe(0.05)
      expect(result.details.consecutiveLosses).toBe(3)
    })

    test('should include thresholds in details when triggered', () => {
      const result = check({ dailyLoss: 0.05, drawdown: 0, consecutiveLosses: 0 })

      expect(result.details.thresholds).toBeDefined()
      expect(result.details.thresholds.DAILY_LOSS_PCT).toBe(0.03)
      expect(result.details.thresholdValue).toBe(0.03)
      expect(result.details.triggerValue).toBe(0.05)
    })
  })
})