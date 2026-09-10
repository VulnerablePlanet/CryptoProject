import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

/**
 * Holt-Winters forecaster unit tests (TD-039).
 *
 * The previous "Transformer" seeded weights with Math.random, producing
 * different forecasts on every run. These tests lock in the two properties
 * that make the replacement valid:
 *   1. Determinism — same input always yields the same output.
 *   2. Trend-following + sane confidence bounds.
 */

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const { HoltWintersForecaster } = requireFromServer('./services/predictionService.js')

describe('HoltWintersForecaster', () => {
  it('is deterministic — identical input yields identical predictions', () => {
    const seq = [100, 101, 103, 102, 105, 107, 106, 108, 110, 112]

    const a = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1, predictionHorizon: 5 })
    const b = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1, predictionHorizon: 5 })

    expect(a.predict(seq)).toEqual(b.predict(seq))
  })

  it('follows an upward trend', () => {
    const seq = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118]
    const forecaster = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1, predictionHorizon: 3 })
    const predictions = forecaster.predict(seq)

    expect(predictions).toHaveLength(3)
    // Clearly rising: every prediction is above the last observed value.
    for (const p of predictions) {
      expect(p).toBeGreaterThan(seq[seq.length - 1])
    }
  })

  it('follows a downward trend', () => {
    const seq = [200, 198, 196, 194, 192, 190, 188, 186, 184, 182]
    const forecaster = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1, predictionHorizon: 3 })
    const predictions = forecaster.predict(seq)

    for (const p of predictions) {
      expect(p).toBeLessThan(seq[seq.length - 1])
    }
  })

  it('returns the expected number of predictions', () => {
    const seq = [100, 101, 102, 103, 104]
    const horizon = 5
    const forecaster = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1, predictionHorizon: horizon })

    expect(forecaster.predict(seq)).toHaveLength(horizon)
  })

  it('calculates a deterministic, bounded confidence in [0.1, 0.95]', () => {
    const seq = [100, 101, 103, 102, 105, 107, 106, 108, 110, 112]

    const a = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1 })
    const b = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1 })

    const ca = a.calculateConfidence(seq)
    const cb = b.calculateConfidence(seq)

    expect(ca).toBe(cb) // deterministic
    expect(ca).toBeGreaterThanOrEqual(0.1)
    expect(ca).toBeLessThanOrEqual(0.95)
  })

  it('returns 0.5 confidence for sequences too short to fit a trend', () => {
    const forecaster = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1 })
    expect(forecaster.calculateConfidence([100, 101])).toBe(0.5)
    expect(forecaster.calculateConfidence([100])).toBe(0.5)
    expect(forecaster.calculateConfidence([])).toBe(0.5)
  })

  it('assigns higher confidence to a smooth series than a volatile one', () => {
    const smooth = [100, 101, 101.5, 102, 102.5, 103, 103.5, 104, 104.5, 105]
    const volatile = [100, 130, 90, 140, 80, 150, 70, 160, 60, 170]

    const forecaster = new HoltWintersForecaster({ alpha: 0.25, beta: 0.1 })
    const smoothConf = forecaster.calculateConfidence(smooth)
    const volatileConf = forecaster.calculateConfidence(volatile)

    expect(smoothConf).toBeGreaterThan(volatileConf)
  })
})