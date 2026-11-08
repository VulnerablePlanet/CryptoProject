import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import {
  calculateRSI,
  calculateRSIHistory,
  calculateSMA,
  calculateEMA
} from '../../src/utils/technicalIndicators.js'

// The server's reference implementation (also used by the trading agent)
const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const { RSI, SMA, EMA } = requireFromServer('technicalindicators')
const confluence = requireFromServer('./services/confluenceService.js')

const series = (seed, length = 200) => {
  let s = seed
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const out = []
  let p = 100 + rand() * 1000
  for (let i = 0; i < length; i++) {
    p = Math.max(1, p * (1 + (rand() - 0.5) * 0.04))
    out.push(+p.toFixed(4))
  }
  return out
}

const SEEDS = [1, 7, 42, 1234, 99991]

describe('frontend ↔ server indicator parity', () => {
  it('RSI (Wilder) matches the server library on the last value', () => {
    for (const seed of SEEDS) {
      const prices = series(seed)
      const server = RSI.calculate({ values: prices, period: 14 }).pop()
      expect(calculateRSI(prices, 14)).toBeCloseTo(server, 1)
    }
  })

  it('RSI matches the server for the reference series used in the audit', () => {
    const prices = []
    let p = 100
    for (let i = 0; i < 120; i++) { p += Math.sin(i / 3) * 2 + (i % 7 - 3) * 0.4; prices.push(+p.toFixed(4)) }
    expect(calculateRSI(prices, 14)).toBe(60.88) // previously 46.03
  })

  it('RSI history matches the server series point by point', () => {
    const prices = series(42)
    const server = RSI.calculate({ values: prices, period: 14 })
    const client = calculateRSIHistory(prices, 14).filter((v) => v !== null)
    expect(client).toHaveLength(server.length)
    client.forEach((value, i) => expect(value).toBeCloseTo(server[i], 1))
  })

  it('RSI agrees with the confluence service implementation', () => {
    const prices = series(7)
    const confluenceSeries = confluence.calculateRSI(prices, 14)
    expect(calculateRSI(prices, 14)).toBeCloseTo(confluenceSeries[confluenceSeries.length - 1], 1)
  })

  it('SMA and EMA match the server library', () => {
    for (const seed of SEEDS) {
      const prices = series(seed)
      expect(calculateSMA(prices, 20)).toBeCloseTo(SMA.calculate({ values: prices, period: 20 }).pop(), 6)
      expect(calculateEMA(prices, 20)).toBeCloseTo(EMA.calculate({ values: prices, period: 20 }).pop(), 6)
    }
  })

  it('returns null / empty without enough data', () => {
    expect(calculateRSI([1, 2, 3], 14)).toBeNull()
    expect(calculateRSIHistory([1, 2, 3], 14)).toEqual([])
  })
})
