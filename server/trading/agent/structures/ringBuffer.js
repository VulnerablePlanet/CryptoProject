/**
 * ============================================================================
 * RING BUFFER - Phase 1 Structure
 * ============================================================================
 * This is a placeholder stub. The full implementation is in Phase 1.
 * Fixed-capacity circular buffer with O(1) writes.
 */

class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity
    this.buffer = []
    this.index = 0
  }
  
  push(item) {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(item)
    } else {
      this.buffer[this.index] = item
    }
    this.index = (this.index + 1) % this.capacity
  }
  
  getAll() {
    if (this.buffer.length < this.capacity) {
      return [...this.buffer]
    }
    return [
      ...this.buffer.slice(this.index),
      ...this.buffer.slice(0, this.index)
    ]
  }
  
  getLatest(n) {
    if (n === 0) return []
    const all = this.getAll()
    return all.slice(-Math.min(n, all.length))
  }

  getRange(start, end) {
    const all = this.getAll()
    return all.slice(start, end + 1)
  }
  
  clear() {
    this.buffer = []
    this.index = 0
  }
}

module.exports = { RingBuffer }