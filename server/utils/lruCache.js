/**
 * ============================================================================
 * LRU Cache
 * ============================================================================
 * A minimal, dependency-free Least-Recently-Used cache. Unlike a plain Map it
 * enforces a maximum entry count, evicting the least recently used item when
 * full — preventing unbounded memory growth in long-running services.
 *
 * Relies on the fact that Map preserves insertion order: re-setting an existing
 * key moves it to the end, so the first key is always the least recently used.
 */

class LRUCache {
  /**
   * @param {number} maxSize - Maximum number of entries (default 500)
   */
  constructor(maxSize = 500) {
    this.maxSize = maxSize
    this._map = new Map()
  }

  get(key) {
    if (!this._map.has(key)) return undefined
    const value = this._map.get(key)
    // Move to most-recently-used position.
    this._map.delete(key)
    this._map.set(key, value)
    return value
  }

  has(key) {
    return this._map.has(key)
  }

  set(key, value) {
    if (this._map.has(key)) {
      this._map.delete(key)
    } else if (this._map.size >= this.maxSize) {
      // Evict least-recently-used (first inserted key).
      const oldest = this._map.keys().next().value
      this._map.delete(oldest)
    }
    this._map.set(key, value)
  }

  delete(key) {
    return this._map.delete(key)
  }

  clear() {
    this._map.clear()
  }

  keys() {
    return this._map.keys()
  }

  get size() {
    return this._map.size
  }
}

module.exports = LRUCache