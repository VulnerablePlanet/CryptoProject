/**
 * OHLC API client (/api/ohlc) — authenticated, with token refresh.
 *
 * Replaces raw fetch() calls in TechnicalAnalysisContent and FibonacciContent
 * that sent no Authorization header (the route requires auth, so every call
 * failed with 401) and hard-coded http://localhost:5000 in development.
 */
import { createApiClient } from '@/services/api'

const api = createApiClient('/api/ohlc')

export const getCandles = async (coinId, { timeframe, limit = 100 } = {}) => {
  const { data } = await api.get(`/${coinId}/candles`, { params: { timeframe, limit } })
  return data
}

export const syncCoin = async (coinId, { timeframe, vs_currency = 'usd' } = {}) => {
  const { data } = await api.post(`/${coinId}/sync`, { timeframe, vs_currency })
  return data
}

export const getStatus = async () => {
  const { data } = await api.get('/status')
  return data
}

export default { getCandles, syncCoin, getStatus }
