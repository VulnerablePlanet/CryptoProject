import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'

const requireFromServer = createRequire(new URL('../../server/index.js', import.meta.url))
const LRUCache = requireFromServer('./utils/lruCache.js')

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache(3)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(2)
    expect(cache.get('missing')).toBeUndefined()
  })

  it('evicts the least-recently-used entry when exceeding maxSize', () => {
    const cache = new LRUCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3) // evicts 'a'

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    expect(cache.size).toBe(2)
  })

  it('refreshes recency on get()', () => {
    const cache = new LRUCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // 'a' becomes most-recently-used
    cache.set('c', 3) // evicts 'b' (LRU), not 'a'

    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.get('c')).toBe(3)
  })

  it('updates an existing key without growing size', () => {
    const cache = new LRUCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 10) // update, not insert

    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBe(10)
  })

  it('supports delete and clear', () => {
    const cache = new LRUCache(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    expect(cache.delete('b')).toBe(true)
    expect(cache.get('b')).toBeUndefined()
    expect(cache.size).toBe(2)

    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get('a')).toBeUndefined()
  })

  it('honors the maxSize bound under sustained writes', () => {
    const cache = new LRUCache(10)
    for (let i = 0; i < 1000; i++) {
      cache.set(`key-${i}`, i)
    }
    expect(cache.size).toBe(10)
  })
})