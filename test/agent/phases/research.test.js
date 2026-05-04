/**
 * ============================================================================
 * RESEARCH PHASE TESTS - Phase 10
 * ============================================================================
 * Unit tests for Research Phase.
 * Mocks Fear & Greed API, CryptoPanic, ApeWisdom
 *
 * Uses _setAxios() dependency injection to mock axios in CJS source module.
 * vi.mock('axios') does NOT intercept CJS require() calls in vitest.
 */

import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  runResearchCycle,
  fetchFearAndGreed,
  fetchCryptoPanic,
  fetchSocialMetrics,
  aggregateSocialMetrics,
  _clearCache,
  _setAxios
} from '../../../server/trading/agent/phases/research.js'

// Create mock axios instance
const mockAxios = {
  get: vi.fn(),
  post: vi.fn()
}

describe('Research Phase', () => {
  beforeEach(() => {
    mockAxios.get.mockReset()
    mockAxios.post.mockReset()
    _clearCache()
    // Inject mock axios into the CJS source module
    _setAxios(mockAxios)
  })

  afterEach(() => {
    // Restore real axios
    _setAxios(null)
    delete process.env.CRYPTOPANIC_API_KEY
  })

  describe('fetchFearAndGreed', () => {
    const mockFearGreedResponse = {
      data: {
        data: [{
          value: '45',
          value_classification: 'Fear',
          timestamp: '1704067200'
        }]
      }
    }

    test('should fetch Fear & Greed data successfully', async () => {
      mockAxios.get.mockResolvedValueOnce(mockFearGreedResponse)

      const result = await fetchFearAndGreed()

      expect(result.value).toBe(45)
      expect(result.classification).toBe('Fear')
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://api.alternative.me/fng/?limit=1&format=json',
        expect.objectContaining({ timeout: 10000 })
      )
    })

    test('should cache Fear & Greed results for 5 minutes', async () => {
      mockAxios.get.mockResolvedValueOnce(mockFearGreedResponse)

      // First call
      await fetchFearAndGreed()
      // Second call should use cache
      await fetchFearAndGreed()

      // Should only make one HTTP request
      expect(mockAxios.get).toHaveBeenCalledTimes(1)
    })

    test('should handle API failure and return cached data if available', async () => {
      // First call succeeds to populate cache
      mockAxios.get.mockResolvedValueOnce({
        data: {
          data: [{
            value: '60',
            value_classification: 'Greed',
            timestamp: '1704067200'
          }]
        }
      })
      await fetchFearAndGreed()

      // Second call fails — should return cached data
      mockAxios.get.mockRejectedValueOnce(new Error('Network error'))
      const result = await fetchFearAndGreed()
      expect(result.value).toBe(60)
      expect(result.classification).toBe('Greed')
    })

    test('should handle extreme values', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: {
          data: [{
            value: '10',
            value_classification: 'Extreme Fear',
            timestamp: '1704067200'
          }]
        }
      })

      const result = await fetchFearAndGreed()
      expect(result.value).toBe(10)
      expect(result.classification).toBe('Extreme Fear')
    })
  })

  describe('fetchCryptoPanic', () => {
    const mockNewsResponse = {
      data: {
        results: [
          {
            title: 'Bitcoin looks bullish today',
            url: 'https://example.com/news/1',
            source: { domain: 'coindesk.com' },
            published_at: '2024-01-01T00:00:00Z',
            votes: { positive: 100, negative: 10 },
            currencies: [{ code: 'BTC' }]
          },
          {
            title: 'Market analysis: potential drop ahead',
            url: 'https://example.com/news/2',
            source: { domain: 'cointelegraph.com' },
            published_at: '2024-01-01T01:00:00Z',
            votes: { positive: 5, negative: 3 },
            currencies: [{ code: 'BTC' }]
          }
        ]
      }
    }

    test('should fetch and filter CryptoPanic news with PanicScore >= 0.6', async () => {
      process.env.CRYPTOPANIC_API_KEY = 'test-key'
      mockAxios.get.mockResolvedValueOnce(mockNewsResponse)

      const result = await fetchCryptoPanic('BTC')

      // First item has panicScore = 100/(100+10) = 0.909 >= 0.6
      // Second item has panicScore = 5/(5+3) = 0.625 >= 0.6
      expect(result.news.length).toBe(2)
      expect(result.news[0].title).toContain('Bitcoin looks bullish')
    })

    test('should filter out low-quality news', async () => {
      const lowQualityResponse = {
        data: {
          results: [
            {
              title: 'Low engagement post',
              url: 'https://example.com/news/1',
              source: { domain: 'example.com' },
              published_at: '2024-01-01T00:00:00Z',
              votes: { positive: 2, negative: 10 },
              currencies: [{ code: 'BTC' }]
            }
          ]
        }
      }

      process.env.CRYPTOPANIC_API_KEY = 'test-key'
      mockAxios.get.mockResolvedValueOnce(lowQualityResponse)

      const result = await fetchCryptoPanic('BTC')

      // Should be filtered out due to low panicScore (2/(2+10) = 0.167 < 0.6 AND total < 5)
      expect(result.news.length).toBe(0)
    })

    test('should use cache for 30 seconds', async () => {
      process.env.CRYPTOPANIC_API_KEY = 'test-key'
      mockAxios.get.mockResolvedValueOnce(mockNewsResponse)

      await fetchCryptoPanic('BTC')
      await fetchCryptoPanic('BTC')

      expect(mockAxios.get).toHaveBeenCalledTimes(1)
    })

    test('should handle API errors gracefully', async () => {
      process.env.CRYPTOPANIC_API_KEY = 'test-key'
      mockAxios.get.mockRejectedValueOnce(new Error('API Error'))

      const result = await fetchCryptoPanic('BTC')

      // Should return neutral fallback on error
      expect(result.news).toEqual([])
      expect(result.sentimentScore).toBe(0.5)
    })
  })

  describe('fetchSocialMetrics', () => {
    const mockApeWisdomResponse = {
      data: [
        { coin: 'BITCOIN', shills: 5000, rank: 1 },
        { coin: 'ETHEREUM', shills: 3000, rank: 2 },
        { coin: 'DOGECOIN', shills: 1500, rank: 3 }
      ]
    }

    test('should fetch social metrics from ApeWisdom', async () => {
      mockAxios.get.mockResolvedValueOnce(mockApeWisdomResponse)

      const result = await fetchSocialMetrics()

      expect(result.topMentions).toHaveLength(3)
      expect(result.topMentions[0].coin).toBe('BITCOIN')
      expect(result.topMentions[0].shills).toBe(5000)
    })

    test('should handle API errors', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchSocialMetrics()

      // Should return empty topMentions array on error
      expect(result.topMentions).toEqual([])
    })
  })

  describe('aggregateSocialMetrics', () => {
    test('should normalize Fear & Greed correctly', () => {
      const fearGreed = { value: 25, classification: 'Extreme Fear' }
      const cryptoPanic = []
      const apeWisdom = { coins: [] }

      const result = aggregateSocialMetrics(fearGreed, cryptoPanic, apeWisdom)

      // Value 25 -> normalized 0.25
      // Since < 50, it's fear: 1 - 0.25 = 0.75
      expect(result.fearGreed.fear).toBe(0.75)
      expect(result.fearGreed.greed).toBe(0)
    })

    test('should normalize greed correctly', () => {
      const fearGreed = { value: 75, classification: 'Greed' }
      const cryptoPanic = []
      const apeWisdom = { coins: [] }

      const result = aggregateSocialMetrics(fearGreed, cryptoPanic, apeWisdom)

      // Value 75 -> normalized 0.75
      // Since > 50, it's greed: 0.75
      expect(result.fearGreed.greed).toBe(0.75)
      expect(result.fearGreed.fear).toBe(0)
    })

    test('should calculate bullish ratio from news', () => {
      const fearGreed = { value: 50, classification: 'Neutral' }
      const cryptoPanic = [
        { title: 'Bitcoin bullish analysis' },
        { title: 'Bull run coming' },
        { title: 'Market crash warning' }
      ]
      const apeWisdom = { coins: [] }

      const result = aggregateSocialMetrics(fearGreed, cryptoPanic, apeWisdom)

      // 2 out of 3 contain bullish keywords ("bullish", "bull")
      // "Market crash warning" contains "crash" → bearish
      expect(result.sentiment.bullishRatio).toBe(2 / 3)
    })

    test('should aggregate social mentions', () => {
      const fearGreed = { value: 50, classification: 'Neutral' }
      const cryptoPanic = []
      const apeWisdom = {
        coins: [
          { coin: 'BTC', shills: 1000, rank: 1 },
          { coin: 'ETH', shills: 500, rank: 2 }
        ]
      }

      const result = aggregateSocialMetrics(fearGreed, cryptoPanic, apeWisdom)

      expect(result.socialMetrics.totalSocialMentions).toBe(1500)
      expect(result.socialMetrics.topMentions).toHaveLength(2)
    })
  })

  describe('execute', () => {
    test('should run full research phase successfully', async () => {
      // Mock Fear & Greed
      mockAxios.get
        .mockResolvedValueOnce({
          data: {
            data: [{
              value: '55',
              value_classification: 'Greed',
              timestamp: '1704067200'
            }]
          }
        })
      // No CRYPTOPANIC_API_KEY set → CryptoPanic returns neutral without calling axios
      // Mock ApeWisdom
        .mockResolvedValueOnce({
          data: [
            { coin: 'BTC', shills: 1000, rank: 1 }
          ]
        })

      const result = await runResearchCycle('BTC/USDT')

      expect(result).toHaveProperty('fearGreed')
      expect(result).toHaveProperty('sentiment')
      expect(result).toHaveProperty('socialMetrics')
      expect(result.fearGreed.value).toBe(55)
    })

    test('should handle partial API failures', async () => {
      // Fear & Greed succeeds
      mockAxios.get
        .mockResolvedValueOnce({
          data: {
            data: [{
              value: '50',
              value_classification: 'Neutral',
              timestamp: '1704067200'
            }]
          }
        })
      // No CRYPTOPANIC_API_KEY → CryptoPanic returns neutral (no axios call)
      // ApeWisdom fails
        .mockRejectedValueOnce(new Error('API Error'))

      // Should not throw, should return partial data
      const result = await runResearchCycle('BTC/USDT')

      expect(result.fearGreed.value).toBe(50)
      // CryptoPanic returns neutral (no API key) → newsCount = 0
      expect(result.sentiment.newsCount).toBe(0)
    })
  })
})
