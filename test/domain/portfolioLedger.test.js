import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const ledger = requireFromServer('./domain/portfolioLedger.js')

const emptyPortfolio = () => ({ holdings: [], totalInvested: 0 })
const tx = (type, amount, price, extra = {}) => ({
  type, amount, priceAtTransaction: price, coinId: 'bitcoin', symbol: 'btc', coinName: 'Bitcoin', ...extra
})
const btc = (p) => p.holdings.find((h) => h.coinId === 'bitcoin')

describe('portfolioLedger', () => {
  it('computes the weighted-average buy price', () => {
    const p = emptyPortfolio()
    ledger.applyTransaction(p, tx('buy', 1, 100))
    ledger.applyTransaction(p, tx('buy', 3, 200))
    expect(btc(p).amount).toBe(4)
    expect(btc(p).avgBuyPrice).toBe(175)
    expect(p.totalInvested).toBe(700)
    expect(btc(p).symbol).toBe('BTC')
  })

  it('sells at average cost and reports the cost basis removed', () => {
    const p = emptyPortfolio()
    ledger.applyTransaction(p, tx('buy', 2, 100))
    const { costBasisPerUnit } = ledger.applyTransaction(p, tx('sell', 1, 150))
    expect(costBasisPerUnit).toBe(100)
    expect(btc(p).amount).toBe(1)
    expect(btc(p).avgBuyPrice).toBe(100)
    expect(p.totalInvested).toBe(100)
  })

  it('rejects selling more than is held (previously clamped silently)', () => {
    const p = emptyPortfolio()
    ledger.applyTransaction(p, tx('buy', 1, 100))
    expect(() => ledger.applyTransaction(p, tx('sell', 2, 100))).toThrow(ledger.LedgerError)
    expect(() => ledger.applyTransaction(p, tx('sell', 1, 100, { coinId: 'eth' }))).toThrow(/only 0 held/)
    expect(btc(p).amount).toBe(1) // unchanged
  })

  it('removes a holding that reaches zero', () => {
    const p = emptyPortfolio()
    ledger.applyTransaction(p, tx('buy', 0.3, 100))
    ledger.applyTransaction(p, tx('sell', 0.1, 100))
    ledger.applyTransaction(p, tx('sell', 0.2, 100)) // float residue
    expect(p.holdings).toHaveLength(0)
    expect(p.totalInvested).toBe(0)
  })

  it('reverting a sell restores the original cost basis (bug: used the sale price)', () => {
    const p = emptyPortfolio()
    ledger.applyTransaction(p, tx('buy', 1, 100))
    const sell = tx('sell', 1, 150)
    sell.costBasisPerUnit = ledger.applyTransaction(p, sell).costBasisPerUnit

    ledger.revertTransaction(p, sell)
    expect(btc(p).amount).toBe(1)
    expect(btc(p).avgBuyPrice).toBe(100) // was 150 before the fix
    expect(p.totalInvested).toBe(100) // was 150 before the fix
  })

  it('reverting a buy recomputes the average of the remaining lots', () => {
    const p = emptyPortfolio()
    const first = tx('buy', 1, 100)
    ledger.applyTransaction(p, first)
    ledger.applyTransaction(p, tx('buy', 1, 300))
    ledger.revertTransaction(p, first)
    expect(btc(p).amount).toBe(1)
    expect(btc(p).avgBuyPrice).toBe(300)
    expect(p.totalInvested).toBe(300)
  })

  it('refuses to revert a buy whose units were sold later', () => {
    const p = emptyPortfolio()
    const buy = tx('buy', 1, 100)
    ledger.applyTransaction(p, buy)
    ledger.applyTransaction(p, tx('sell', 1, 120))
    expect(() => ledger.revertTransaction(p, buy)).toThrow(expect.objectContaining({ code: 'REVERT_CONFLICT' }))
  })

  it('keeps totalInvested consistent on manual edits and removal', () => {
    const p = emptyPortfolio()
    ledger.addLot(p, { coinId: 'bitcoin', symbol: 'btc', name: 'Bitcoin', amount: 2, price: 100 })
    const holding = btc(p)
    holding._id = 'h1'
    ledger.updateHoldingValues(p, holding, { amount: 3, avgBuyPrice: 50 })
    expect(p.totalInvested).toBe(150)
    expect(ledger.removeHolding(p, 'h1')).toBe(true)
    expect(p.totalInvested).toBe(0)
    expect(ledger.removeHolding(p, 'missing')).toBe(false)
  })

  it('property: applying any valid history and reverting it in reverse order returns to empty', () => {
    let seed = 42
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31 }

    for (let run = 0; run < 500; run++) {
      const p = emptyPortfolio()
      const history = []
      for (let i = 0; i < 25; i++) {
        const coinId = rand() < 0.5 ? 'bitcoin' : 'ethereum'
        const held = p.holdings.find((h) => h.coinId === coinId)?.amount || 0
        const sell = held > 0 && rand() < 0.4
        const amount = sell ? held * (0.1 + rand() * 0.9) : 0.01 + rand() * 5
        const t = tx(sell ? 'sell' : (rand() < 0.5 ? 'buy' : 'deposit'), amount, 1 + rand() * 1000, { coinId })
        const { costBasisPerUnit } = ledger.applyTransaction(p, t)
        if (costBasisPerUnit !== null) t.costBasisPerUnit = costBasisPerUnit
        history.push(t)
      }
      for (const t of history.reverse()) ledger.revertTransaction(p, t)
      expect(p.holdings).toHaveLength(0)
      expect(p.totalInvested).toBeCloseTo(0, 6)
    }
  })
})
