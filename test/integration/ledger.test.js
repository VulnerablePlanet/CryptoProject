import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { mongoose, requireFromServer, startMongo, stopMongo, clearDatabase } from './helpers/mongo.js'

const ledgerService = requireFromServer('./services/ledgerService.js')
const Transaction = requireFromServer('./models/Transaction.js')
const Portfolio = requireFromServer('./models/Portfolio.js')

const userId = () => new mongoose.Types.ObjectId()
const txData = (type, amount, price, coinId = 'bitcoin') => ({
  type, coinId, symbol: coinId === 'bitcoin' ? 'BTC' : 'ETH', coinName: coinId,
  amount, priceAtTransaction: price, totalValue: amount * price, status: 'completed'
})

/** Shared scenarios, run against both deployment kinds */
const ledgerScenarios = () => {
  it('records a transaction and its portfolio effect together', async () => {
    const user = userId()
    const { transaction, portfolio } = await ledgerService.recordTransaction(user, txData('buy', 2, 100))
    expect(transaction._id).toBeDefined()
    expect(portfolio.holdings[0].amount).toBe(2)
    expect(await Transaction.countDocuments({ user })).toBe(1)
  })

  it('an oversell leaves neither a transaction nor a portfolio change', async () => {
    const user = userId()
    await ledgerService.recordTransaction(user, txData('buy', 1, 100))
    await expect(ledgerService.recordTransaction(user, txData('sell', 5, 100)))
      .rejects.toMatchObject({ code: 'INSUFFICIENT_HOLDING' })
    expect(await Transaction.countDocuments({ user })).toBe(1)
    const p = await Portfolio.findOne({ user }).lean()
    expect(p.holdings[0].amount).toBe(1)
  })

  it('stores the cost basis of a sell and restores it exactly on delete', async () => {
    const user = userId()
    await ledgerService.recordTransaction(user, txData('buy', 1, 100))
    const { transaction: sell } = await ledgerService.recordTransaction(user, txData('sell', 1, 150))
    expect((await Transaction.findById(sell._id).lean()).costBasisPerUnit).toBe(100)

    const { portfolio } = await ledgerService.deleteTransaction(user, sell._id)
    expect(portfolio.holdings[0]).toMatchObject({ amount: 1, avgBuyPrice: 100 })
    expect(portfolio.totalInvested).toBe(100)
    expect(await Transaction.exists({ _id: sell._id })).toBeNull()
  })

  it('refuses to delete a buy whose units were sold, keeping the transaction', async () => {
    const user = userId()
    const { transaction: buy } = await ledgerService.recordTransaction(user, txData('buy', 1, 100))
    await ledgerService.recordTransaction(user, txData('sell', 1, 120))
    await expect(ledgerService.deleteTransaction(user, buy._id)).rejects.toMatchObject({ code: 'REVERT_CONFLICT' })
    expect(await Transaction.exists({ _id: buy._id })).not.toBeNull()
  })

  it('does not lose updates under concurrent writes (optimistic concurrency + retry)', async () => {
    const user = userId()
    await ledgerService.recordTransaction(user, txData('buy', 1, 100))
    await Promise.all(Array.from({ length: 10 }, () => ledgerService.recordTransaction(user, txData('buy', 1, 100))))
    const p = await Portfolio.findOne({ user }).lean()
    expect(p.holdings[0].amount).toBe(11)
    expect(p.totalInvested).toBe(1100)
    expect(await Transaction.countDocuments({ user })).toBe(11)
  })

  it('returns null when deleting a transaction of another user', async () => {
    const owner = userId()
    const { transaction } = await ledgerService.recordTransaction(owner, txData('buy', 1, 100))
    expect(await ledgerService.deleteTransaction(userId(), transaction._id)).toBeNull()
  })
}

describe('ledger on a replica set (transactional)', () => {
  let replSet
  beforeAll(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    replSet = await startMongo()
    ledgerService._resetForTests()
  })
  afterAll(async () => { await stopMongo(replSet); vi.restoreAllMocks() })
  beforeEach(clearDatabase)

  ledgerScenarios()

  it('rolls back the transaction document when the portfolio write fails', async () => {
    const user = userId()
    const spy = vi.spyOn(Portfolio.prototype, 'save').mockRejectedValueOnce(new Error('disk full'))
    await expect(ledgerService.recordTransaction(user, txData('buy', 1, 100))).rejects.toThrow('disk full')
    spy.mockRestore()
    expect(await Transaction.countDocuments({ user })).toBe(0)
  })
})

describe('ledger on a standalone server (compensating writes)', () => {
  let server
  beforeAll(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    server = await MongoMemoryServer.create({ binary: { version: process.env.MONGOMS_VERSION || '7.0.14' } })
    await mongoose.connect(server.getUri('standalone'))
    ledgerService._resetForTests()
  })
  afterAll(async () => { await mongoose.disconnect(); await server.stop(); vi.restoreAllMocks() })
  beforeEach(clearDatabase)

  ledgerScenarios()

  it('removes the transaction again when the portfolio write fails', async () => {
    const user = userId()
    const spy = vi.spyOn(Portfolio.prototype, 'save').mockRejectedValue(new Error('disk full'))
    await expect(ledgerService.recordTransaction(user, txData('buy', 1, 100))).rejects.toThrow('disk full')
    spy.mockRestore()
    expect(await Transaction.countDocuments({ user })).toBe(0)
  })
})
