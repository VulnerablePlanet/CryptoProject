/**
 * Shared crypto constants — single source of truth for coin lists and exchange configs.
 * Replace hardcoded arrays in stores and views with imports from here.
 */

// Major cryptocurrencies used across the app
export const DEFAULT_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
]

// Common trading pairs
export const DEFAULT_SYMBOLS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT',
  'ADA/USDT', 'XRP/USDT', 'DOT/USDT', 'AVAX/USDT',
  'DOGE/USDT', 'LINK/USDT'
]

// Supported exchanges for CCXT integration
export const SUPPORTED_EXCHANGES = [
  'binance', 'bitget', 'coinbase', 'kraken',
  'kucoin', 'bybit', 'okx', 'gate'
]

// Exchange display names
export const EXCHANGE_NAMES = {
  binance: 'Binance',
  bitget: 'Bitget',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
  kucoin: 'KuCoin',
  bybit: 'Bybit',
  okx: 'OKX',
  gate: 'Gate.io',
}

// Short coin symbols for quick reference
export const COIN_SYMBOLS = DEFAULT_COINS.map(c => c.symbol)

// CoinGecko IDs mapped to symbols
export const COIN_ID_MAP = Object.fromEntries(
  DEFAULT_COINS.map(c => [c.symbol, c.id])
)

// Common timeframes
export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M']
