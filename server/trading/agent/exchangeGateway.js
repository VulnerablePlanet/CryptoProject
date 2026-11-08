/**
 * Exchange gateway for the trading agent.
 *
 * The ONLY place that builds authenticated CCXT clients for trading. Every
 * caller (order placement, kill switch order cancellation, key verification)
 * goes through here so the sandbox/production decision is made once,
 * consistently, from BINANCE_MODE (see config/env.js). Previously three call
 * sites built their own clients and two of them ignored sandbox mode.
 */

const ccxt = require('ccxt')
const { getTradingMode } = require('../../config/env')
const { createLogger } = require('../../utils/logger')

const logger = createLogger('agent:exchange')

/** Exchange-specific defaults */
const EXCHANGE_OPTIONS = {
  binance: { defaultType: 'spot', adjustForTimeDifference: true },
  bitget: { defaultType: 'spot', defaultSubType: 'spot' },
  bybit: { defaultType: 'spot' }
}

/**
 * Read API credentials for an exchange from the environment
 * (`<EXCHANGE>_API_KEY` / `<EXCHANGE>_API_SECRET`).
 */
const getCredentials = (exchangeId, env = process.env) => {
  const prefix = exchangeId.toUpperCase()
  const apiKey = env[`${prefix}_API_KEY`]
  const secret = env[`${prefix}_API_SECRET`]
  return apiKey && secret ? { apiKey, secret } : null
}

/**
 * Create a CCXT client for trading.
 * @param {string} exchangeId - e.g. 'binance'
 * @param {object} [options]
 * @param {boolean} [options.requireCredentials=false] - throw if keys are missing
 * @param {object} [options.ccxtLib] - injectable CCXT module (tests)
 * @param {object} [options.env] - injectable environment (tests)
 */
const createTradingExchange = (exchangeId = 'binance', options = {}) => {
  const { requireCredentials = false, ccxtLib = ccxt, env = process.env } = options
  const id = exchangeId.toLowerCase()
  const ExchangeClass = ccxtLib[id]
  if (!ExchangeClass) {
    throw new Error(`Exchange ${id} not supported by CCXT`)
  }

  const credentials = getCredentials(id, env)
  if (!credentials && requireCredentials) {
    throw new Error(`API credentials for ${id} are not configured`)
  }

  const mode = getTradingMode(env)
  const exchange = new ExchangeClass({
    enableRateLimit: true,
    timeout: 30000,
    ...(credentials || {}),
    options: EXCHANGE_OPTIONS[id] || {}
  })

  // Sandbox is applied explicitly after construction (works for every CCXT
  // exchange that supports a testnet; throws for those that do not, which is
  // the safe outcome).
  if (mode === 'sandbox') {
    exchange.setSandboxMode(true)
  }

  logger.debug('Trading exchange client created', {
    exchange: id,
    mode,
    authenticated: Boolean(credentials)
  })

  return exchange
}

/**
 * Cancel every open order for the given symbols.
 * @returns {Promise<{ cancelled: string[], failed: Array<{symbol, error}> }>}
 */
const cancelAllOpenOrders = async (symbols, options = {}) => {
  const { exchangeId = 'binance', exchange: injected } = options
  const result = { cancelled: [], failed: [] }
  if (!symbols || symbols.length === 0) return result

  let exchange
  try {
    exchange = injected || createTradingExchange(exchangeId, { ...options, requireCredentials: true })
  } catch (error) {
    // Without credentials there cannot be open orders placed by this agent.
    logger.warn('Cannot cancel open orders', { reason: error.message })
    result.failed.push({ symbol: '*', error: error.message })
    return result
  }

  for (const symbol of symbols) {
    try {
      const openOrders = await exchange.fetchOpenOrders(symbol)
      for (const order of openOrders) {
        await exchange.cancelOrder(order.id, symbol)
        result.cancelled.push(order.id)
      }
    } catch (error) {
      logger.error('Failed to cancel open orders', { symbol, error: error.message })
      result.failed.push({ symbol, error: error.message })
    }
  }

  logger.info('Open orders cancelled', {
    cancelled: result.cancelled.length,
    failed: result.failed.length
  })
  return result
}

module.exports = {
  createTradingExchange,
  cancelAllOpenOrders,
  getCredentials
}
