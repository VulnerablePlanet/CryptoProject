/**
 * Portfolio ledger rules (pure, no I/O).
 *
 * Single source for how transactions change holdings. Previously the
 * weighted-average cost was implemented three times (portfolioController,
 * transactionController and an unused Portfolio model method), and reverting
 * a sell used the sale price instead of the cost basis it had removed, so
 * deleting a sell corrupted avgBuyPrice and totalInvested.
 *
 * Works on any object shaped like a Portfolio document:
 *   { holdings: [{ coinId, symbol, name, amount, avgBuyPrice, notes }], totalInvested }
 */

const INFLOW_TYPES = new Set(['buy', 'transfer_in', 'deposit'])
const OUTFLOW_TYPES = new Set(['sell', 'transfer_out', 'withdraw'])

/** Amounts below this are treated as zero (floating point residue) */
const EPSILON = 1e-10

class LedgerError extends Error {
  constructor (code, message, details = {}) {
    super(message)
    this.name = 'LedgerError'
    this.code = code
    this.details = details
  }
}

const isInflow = (type) => INFLOW_TYPES.has(type)
const isOutflow = (type) => OUTFLOW_TYPES.has(type)

const findHoldingIndex = (portfolio, coinId) =>
  portfolio.holdings.findIndex((h) => h.coinId === coinId)

const removeHoldingAt = (portfolio, index) => {
  // Works for both plain arrays and Mongoose document arrays
  portfolio.holdings.splice(index, 1)
}

const clampInvested = (value) => (Math.abs(value) < EPSILON ? 0 : Math.max(0, value))

/**
 * Add `amount` units at `price` (weighted-average cost).
 */
const addLot = (portfolio, { coinId, symbol, name, amount, price, notes }) => {
  if (!(amount > 0)) throw new LedgerError('INVALID_AMOUNT', 'Amount must be greater than 0')
  if (!(price >= 0)) throw new LedgerError('INVALID_PRICE', 'Price must be 0 or greater')

  const index = findHoldingIndex(portfolio, coinId)
  if (index >= 0) {
    const holding = portfolio.holdings[index]
    const totalCost = holding.amount * holding.avgBuyPrice + amount * price
    const newAmount = holding.amount + amount
    holding.avgBuyPrice = newAmount > 0 ? totalCost / newAmount : 0
    holding.amount = newAmount
    if (notes) holding.notes = notes
  } else {
    portfolio.holdings.push({
      coinId,
      symbol: symbol.toUpperCase(),
      name,
      amount,
      avgBuyPrice: price,
      notes: notes || ''
    })
  }
  portfolio.totalInvested = clampInvested((portfolio.totalInvested || 0) + amount * price)
}

/**
 * Remove `amount` units at the holding's current average cost.
 * @returns {number} cost basis per unit that was removed
 * @throws {LedgerError} INSUFFICIENT_HOLDING when selling more than is held
 */
const removeLot = (portfolio, { coinId, amount }) => {
  if (!(amount > 0)) throw new LedgerError('INVALID_AMOUNT', 'Amount must be greater than 0')

  const index = findHoldingIndex(portfolio, coinId)
  const held = index >= 0 ? portfolio.holdings[index].amount : 0
  if (amount - held > EPSILON) {
    throw new LedgerError(
      'INSUFFICIENT_HOLDING',
      `Cannot remove ${amount} ${coinId}: only ${held} held`,
      { coinId, requested: amount, available: held }
    )
  }

  const holding = portfolio.holdings[index]
  const costBasisPerUnit = holding.avgBuyPrice
  const remaining = holding.amount - amount
  if (remaining <= EPSILON) {
    removeHoldingAt(portfolio, index)
  } else {
    holding.amount = remaining
  }
  portfolio.totalInvested = clampInvested((portfolio.totalInvested || 0) - amount * costBasisPerUnit)
  return costBasisPerUnit
}

/**
 * Apply a transaction to the portfolio.
 * @returns {{ costBasisPerUnit: number|null }} cost basis removed by outflows
 */
const applyTransaction = (portfolio, tx) => {
  if (isInflow(tx.type)) {
    addLot(portfolio, {
      coinId: tx.coinId,
      symbol: tx.symbol,
      name: tx.coinName,
      amount: tx.amount,
      price: tx.priceAtTransaction
    })
    return { costBasisPerUnit: null }
  }
  if (isOutflow(tx.type)) {
    return { costBasisPerUnit: removeLot(portfolio, { coinId: tx.coinId, amount: tx.amount }) }
  }
  throw new LedgerError('INVALID_TYPE', `Unknown transaction type: ${tx.type}`)
}

/**
 * Undo a previously applied transaction (exact inverse of applyTransaction).
 *
 * - Inflow: removes the lot at its purchase price. Refused if those units are
 *   no longer held (they were sold later), since the history would otherwise
 *   become negative — delete the later outflow first.
 * - Outflow: adds the units back at the cost basis they left with
 *   (`costBasisPerUnit`, stored when the outflow was recorded). Legacy records
 *   without it fall back to the transaction price.
 */
const revertTransaction = (portfolio, tx) => {
  if (isInflow(tx.type)) {
    const index = findHoldingIndex(portfolio, tx.coinId)
    const held = index >= 0 ? portfolio.holdings[index].amount : 0
    if (tx.amount - held > EPSILON) {
      throw new LedgerError(
        'REVERT_CONFLICT',
        `Cannot delete this ${tx.type}: ${tx.amount} ${tx.symbol} are no longer held. Delete the later sell/transfer first.`,
        { coinId: tx.coinId, requested: tx.amount, available: held }
      )
    }
    const holding = portfolio.holdings[index]
    const remainingAmount = holding.amount - tx.amount
    if (remainingAmount <= EPSILON) {
      removeHoldingAt(portfolio, index)
    } else {
      const remainingCost = holding.amount * holding.avgBuyPrice - tx.amount * tx.priceAtTransaction
      holding.avgBuyPrice = Math.max(0, remainingCost / remainingAmount)
      holding.amount = remainingAmount
    }
    portfolio.totalInvested = clampInvested((portfolio.totalInvested || 0) - tx.amount * tx.priceAtTransaction)
    return
  }
  if (isOutflow(tx.type)) {
    const costBasis = tx.costBasisPerUnit ?? tx.priceAtTransaction
    addLot(portfolio, {
      coinId: tx.coinId,
      symbol: tx.symbol,
      name: tx.coinName,
      amount: tx.amount,
      price: costBasis
    })
    return
  }
  throw new LedgerError('INVALID_TYPE', `Unknown transaction type: ${tx.type}`)
}

/**
 * Replace a holding's amount/average cost (manual edit), keeping
 * totalInvested consistent.
 */
const updateHoldingValues = (portfolio, holding, { amount, avgBuyPrice, notes }) => {
  if (amount !== undefined && !(amount >= 0)) throw new LedgerError('INVALID_AMOUNT', 'Amount must be 0 or greater')
  if (avgBuyPrice !== undefined && !(avgBuyPrice >= 0)) throw new LedgerError('INVALID_PRICE', 'Price must be 0 or greater')
  const oldInvestment = holding.amount * holding.avgBuyPrice
  if (amount !== undefined) holding.amount = amount
  if (avgBuyPrice !== undefined) holding.avgBuyPrice = avgBuyPrice
  if (notes !== undefined) holding.notes = notes
  const newInvestment = holding.amount * holding.avgBuyPrice
  portfolio.totalInvested = clampInvested((portfolio.totalInvested || 0) - oldInvestment + newInvestment)
}

/**
 * Remove a whole holding (manual edit).
 */
const removeHolding = (portfolio, holdingId) => {
  const index = portfolio.holdings.findIndex((h) => String(h._id) === String(holdingId))
  if (index < 0) return false
  const holding = portfolio.holdings[index]
  portfolio.totalInvested = clampInvested((portfolio.totalInvested || 0) - holding.amount * holding.avgBuyPrice)
  removeHoldingAt(portfolio, index)
  return true
}

module.exports = {
  LedgerError,
  INFLOW_TYPES,
  OUTFLOW_TYPES,
  isInflow,
  isOutflow,
  addLot,
  removeLot,
  applyTransaction,
  revertTransaction,
  updateHoldingValues,
  removeHolding
}
