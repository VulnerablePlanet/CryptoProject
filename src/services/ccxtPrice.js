/**
 * CCXT Price Service - Frontend API client
 * Fetches real-time prices from exchanges via the backend CCXT service
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api/exchange',
  headers: { 'Content-Type': 'application/json' }
})

/**
 * Get supported exchanges
 * @returns {Promise<Array>} List of supported exchanges
 */
export const getSupportedExchanges = async () => {
  const response = await api.get('/supported')
  return response.data.exchanges
}

/**
 * Get price for a trading pair from an exchange
 * @param {string} exchange - Exchange ID (e.g., 'binance')
 * @param {string} base - Base symbol (e.g., 'BTC')
 * @param {string} quote - Quote symbol (e.g., 'USDT')
 * @returns {Promise<Object>} Price data
 */
export const getPrice = async (exchange, base, quote) => {
  const response = await api.get(`/${exchange}/price/${base}/${quote}`)
  return response.data
}

/**
 * Get price using a trading pair string
 * @param {string} exchange - Exchange ID
 * @param {string} symbol - Trading pair (e.g., 'BTC/USDT')
 * @returns {Promise<Object>} Price data
 */
export const getPriceBySymbol = async (exchange, symbol) => {
  const [base, quote] = symbol.split('/')
  return getPrice(exchange, base, quote || 'USDT')
}

/**
 * Get multiple prices from different exchanges
 * @param {Array<{exchange: string, symbol: string}>} coins - Array of coins with exchange and symbol
 * @returns {Promise<Object>} Object with prices keyed by exchange:symbol
 */
export const getMultiplePrices = async (coins) => {
  const response = await api.post('/prices', { coins })
  return response.data
}

/**
 * Get available markets from an exchange
 * @param {string} exchange - Exchange ID
 * @param {string} quote - Quote currency filter (optional)
 * @returns {Promise<Array>} Available markets
 */
export const getMarkets = async (exchange, quote = null) => {
  const url = quote 
    ? `/${exchange}/markets?quote=${quote}`
    : `/${exchange}/markets`
  const response = await api.get(url)
  return response.data.markets
}

/**
 * Get ticker for a trading pair
 * @param {string} exchange - Exchange ID
 * @param {string} base - Base symbol
 * @param {string} quote - Quote symbol
 * @returns {Promise<Object>} Ticker data
 */
export const getTicker = async (exchange, base, quote) => {
  const response = await api.get(`/${exchange}/ticker/${base}/${quote}`)
  return response.data
}

/**
 * Get CoinGecko to CCXT symbol mapping
 * @returns {Promise<Object>} Symbol mapping
 */
export const getCoinSymbolMapping = async () => {
  const response = await api.get('/coin-symbols')
  return response.data.symbols
}

// Common quote currencies
export const QUOTE_CURRENCIES = ['USDT', 'USD', 'BUSD', 'USDC', 'BTC', 'ETH']

// Exchange display names
export const EXCHANGE_NAMES = {
  binance: 'Binance',
  bitget: 'Bitget',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
  kucoin: 'KuCoin',
  bybit: 'Bybit',
  okx: 'OKX'
}

export default {
  getSupportedExchanges,
  getPrice,
  getPriceBySymbol,
  getMultiplePrices,
  getMarkets,
  getTicker,
  getCoinSymbolMapping,
  QUOTE_CURRENCIES,
  EXCHANGE_NAMES
}
