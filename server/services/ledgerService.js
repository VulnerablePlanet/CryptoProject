/**
 * Ledger service: persists transactions and keeps the portfolio consistent
 * with them.
 *
 * Consistency strategy
 *  - Replica set / sharded cluster: the transaction document and the
 *    portfolio change are written in ONE MongoDB transaction.
 *  - Standalone server (no transactions): the transaction is written first
 *    and removed again (compensation) if the portfolio update fails, so a
 *    failure never leaves a transaction without its portfolio effect.
 *  - Concurrency: Portfolio uses optimistic concurrency; conflicting writes
 *    (VersionError, transient transaction errors, duplicate portfolio
 *    creation) are retried on fresh data instead of silently losing updates.
 *
 * Holding math is delegated to domain/portfolioLedger.js.
 */

const mongoose = require('mongoose')
const Transaction = require('../models/Transaction')
const Portfolio = require('../models/Portfolio')
const { supportsTransactions } = require('../config/db')
const ledger = require('../domain/portfolioLedger')
const { createLogger } = require('../utils/logger')

const logger = createLogger('services:ledger')

// Each conflict round lets one writer win, so the bound must cover a burst
// of concurrent writes to the same portfolio; jittered backoff spreads them.
const MAX_ATTEMPTS = 10
const backoff = (attempt) =>
  new Promise((resolve) => setTimeout(resolve, Math.random() * 10 * attempt))

const isRetryable = (error) =>
  error?.name === 'VersionError' ||
  error?.code === 11000 || // concurrent creation of the same user's portfolio
  error?.code === 112 || // WriteConflict
  (typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError'))

const withRetry = async (operation, label) => {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) throw error
      logger.debug('Retrying ledger operation after write conflict', { label, attempt, reason: error.name })
      await backoff(attempt)
    }
  }
  throw lastError
}

let transactionsSupport = null
const useTransactions = async () => {
  if (transactionsSupport === null && mongoose.connection.readyState === 1) {
    transactionsSupport = await supportsTransactions()
    logger.info('Ledger write mode', { transactional: transactionsSupport })
    if (!transactionsSupport) {
      logger.warn('MongoDB does not support transactions (standalone). Using compensating writes; run a replica set for atomic ledger updates.')
    }
  }
  return Boolean(transactionsSupport)
}

const runInTransaction = async (work) => {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await work(session)
    })
    return result
  } finally {
    await session.endSession()
  }
}

const loadPortfolio = async (userId, session, { create = false } = {}) => {
  const query = Portfolio.findOne({ user: userId })
  const portfolio = await (session ? query.session(session) : query)
  if (portfolio || !create) return portfolio
  return new Portfolio({ user: userId, holdings: [], totalInvested: 0 })
}

const applyToPortfolio = async (userId, transaction, session) => {
  const portfolio = await loadPortfolio(userId, session, { create: true })
  const { costBasisPerUnit } = ledger.applyTransaction(portfolio, transaction)
  await portfolio.save({ session })
  return { portfolio, costBasisPerUnit }
}

/**
 * Record a transaction and apply it to the user's portfolio.
 * @returns {Promise<{ transaction, portfolio }>}
 * @throws {LedgerError} e.g. INSUFFICIENT_HOLDING for an oversell
 */
const recordTransaction = async (userId, data) => {
  const doc = { ...data, user: userId }

  if (await useTransactions()) {
    return withRetry(() => runInTransaction(async (session) => {
      const [transaction] = await Transaction.create([doc], { session })
      const { portfolio, costBasisPerUnit } = await applyToPortfolio(userId, transaction, session)
      if (costBasisPerUnit !== null) {
        transaction.costBasisPerUnit = costBasisPerUnit
        await transaction.save({ session })
      }
      return { transaction, portfolio }
    }), 'recordTransaction')
  }

  // Standalone MongoDB: write, then compensate on failure
  const transaction = await Transaction.create(doc)
  try {
    const { portfolio, costBasisPerUnit } = await withRetry(
      () => applyToPortfolio(userId, transaction, null),
      'recordTransaction'
    )
    if (costBasisPerUnit !== null) {
      await Transaction.updateOne({ _id: transaction._id }, { $set: { costBasisPerUnit } })
      transaction.costBasisPerUnit = costBasisPerUnit
    }
    return { transaction, portfolio }
  } catch (error) {
    await Transaction.deleteOne({ _id: transaction._id }).catch((cleanupError) => {
      logger.error('Compensation failed: transaction left without portfolio effect', {
        transactionId: transaction._id.toString(),
        error: cleanupError
      })
    })
    throw error
  }
}

/**
 * Delete a transaction and revert its effect on the portfolio.
 * @returns {Promise<{ portfolio } | null>} null when the transaction does not exist
 * @throws {LedgerError} REVERT_CONFLICT when the units are no longer held
 */
const deleteTransaction = async (userId, transactionId) => {
  const existing = await Transaction.findOne({ _id: transactionId, user: userId })
  if (!existing) return null

  if (await useTransactions()) {
    return withRetry(() => runInTransaction(async (session) => {
      const transaction = await Transaction.findOne({ _id: transactionId, user: userId }).session(session)
      if (!transaction) return { portfolio: null }
      const portfolio = await loadPortfolio(userId, session)
      if (portfolio) {
        ledger.revertTransaction(portfolio, transaction)
        await portfolio.save({ session })
      }
      await Transaction.deleteOne({ _id: transaction._id }, { session })
      return { portfolio }
    }), 'deleteTransaction')
  }

  // Standalone MongoDB: revert portfolio, delete, re-apply if delete fails
  const portfolio = await withRetry(async () => {
    const p = await loadPortfolio(userId, null)
    if (p) {
      ledger.revertTransaction(p, existing)
      await p.save()
    }
    return p
  }, 'deleteTransaction')

  try {
    await Transaction.deleteOne({ _id: existing._id })
  } catch (error) {
    if (portfolio) {
      await withRetry(() => applyToPortfolio(userId, existing, null), 'deleteTransaction:compensate')
        .catch((compensationError) => logger.error('Compensation failed after delete error', {
          transactionId: existing._id.toString(),
          error: compensationError
        }))
    }
    throw error
  }
  return { portfolio }
}

/**
 * Apply a manual change to the user's portfolio (holdings CRUD) with
 * conflict retry.
 * @param {Function} mutate - (portfolio) => result; may throw LedgerError
 * @returns {Promise<{ portfolio, result } | null>} null if no portfolio and !create
 */
const updatePortfolio = async (userId, mutate, { create = false } = {}) =>
  withRetry(async () => {
    const portfolio = await loadPortfolio(userId, null, { create })
    if (!portfolio) return null
    const result = await mutate(portfolio)
    await portfolio.save()
    return { portfolio, result }
  }, 'updatePortfolio')

/** Test helper */
const _resetForTests = () => { transactionsSupport = null }

module.exports = {
  recordTransaction,
  deleteTransaction,
  updatePortfolio,
  _resetForTests
}
