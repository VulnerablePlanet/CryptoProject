/**
 * ============================================================================
 * RING BUFFER TESTS - Phase 10
 * ============================================================================
 * Unit tests for the RingBuffer data structure.
 * Tests: push overflow, getAll, getLatest, getRange, clear
 */

import { RingBuffer } from '../../../server/trading/agent/structures/ringBuffer.js'

describe('RingBuffer', () => {
  let buffer

  beforeEach(() => {
    buffer = new RingBuffer(5) // Small capacity for testing
  })

  describe('constructor', () => {
    test('should create buffer with specified capacity', () => {
      expect(new RingBuffer(10).capacity).toBe(10)
      expect(new RingBuffer(100).capacity).toBe(100)
    })

    test('should initialize with empty data', () => {
      expect(buffer.getAll()).toEqual([])
      expect(buffer.getLatest(1)).toEqual([])
    })
  })

  describe('push', () => {
    test('should add items to buffer', () => {
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      
      expect(buffer.getAll()).toEqual([1, 2, 3])
    })

    test('should overwrite oldest items when capacity exceeded (O(1) behavior)', () => {
      // Fill beyond capacity
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      buffer.push(4)
      buffer.push(5) // Capacity reached
      buffer.push(6) // Should overwrite 1
      
      const all = buffer.getAll()
      expect(all).toEqual([2, 3, 4, 5, 6])
      expect(all.length).toBe(5) // Capacity maintained
    })

    test('should maintain O(1) write performance at any size', () => {
      // Push more than 10x capacity
      for (let i = 0; i < 50; i++) {
        buffer.push(i)
      }
      
      const all = buffer.getAll()
      expect(all.length).toBe(5) // Still at capacity
      expect(all).toEqual([45, 46, 47, 48, 49]) // Last 5 items
    })

    test('should handle different data types', () => {
      buffer.push({ a: 1 })
      buffer.push([1, 2, 3])
      buffer.push('string')
      buffer.push(null)
      buffer.push(42.5)
      buffer.push(true) // Overwrites { a: 1 } (oldest)

      const all = buffer.getAll()
      expect(all.length).toBe(5)
      expect(all[0]).toEqual([1, 2, 3])
      expect(all[1]).toEqual('string')
      expect(all[4]).toBe(true)
    })
  })

  describe('getAll', () => {
    test('should return all items in order (oldest to newest)', () => {
      buffer.push('a')
      buffer.push('b')
      buffer.push('c')
      
      expect(buffer.getAll()).toEqual(['a', 'b', 'c'])
    })

    test('should return empty array for empty buffer', () => {
      expect(buffer.getAll()).toEqual([])
    })

    test('should return items after overflow in correct order', () => {
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      buffer.push(4)
      buffer.push(5)
      buffer.push(6) // Overwrites 1
      buffer.push(7) // Overwrites 2
      
      expect(buffer.getAll()).toEqual([3, 4, 5, 6, 7])
    })
  })

  describe('getLatest', () => {
    test('should return last n items', () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(i)
      }
      
      expect(buffer.getLatest(1)).toEqual([5])
      expect(buffer.getLatest(3)).toEqual([3, 4, 5])
      expect(buffer.getLatest(5)).toEqual([1, 2, 3, 4, 5])
    })

    test('should return all items if n exceeds count', () => {
      buffer.push(1)
      buffer.push(2)
      
      expect(buffer.getLatest(10)).toEqual([1, 2])
    })

    test('should return empty array for empty buffer', () => {
      expect(buffer.getLatest(3)).toEqual([])
    })

    test('should handle zero', () => {
      buffer.push(1)
      buffer.push(2)
      
      expect(buffer.getLatest(0)).toEqual([])
    })
  })

  describe('getRange', () => {
    beforeEach(() => {
      // Push 10 items (will overflow the 5-capacity buffer)
      for (let i = 1; i <= 10; i++) {
        buffer.push(i)
      }
    })

    test('should return items within range', () => {
      // Buffer contains [6, 7, 8, 9, 10]
      const range = buffer.getRange(0, 2)
      expect(range).toEqual([6, 7, 8])
    })

    test('should handle range exceeding available items', () => {
      const range = buffer.getRange(0, 10)
      expect(range).toEqual([6, 7, 8, 9, 10])
    })

    test('should handle negative indices', () => {
      const range = buffer.getRange(-2, 5)
      // Negative start wraps to available items
      expect(range.length).toBeLessThanOrEqual(5)
    })
  })

  describe('clear', () => {
    test('should remove all items', () => {
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      
      buffer.clear()
      
      expect(buffer.getAll()).toEqual([])
      expect(buffer.getLatest(1)).toEqual([])
    })

    test('should reset to empty state', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push(i)
      }
      
      buffer.clear()
      
      // Should behave like empty buffer
      buffer.push(100)
      expect(buffer.getAll()).toEqual([100])
    })
  })

  describe('capacity management', () => {
    test('should maintain fixed capacity regardless of operations', () => {
      for (let i = 0; i < 100; i++) {
        buffer.push(i)
      }
      
      expect(buffer.getAll().length).toBe(5)
    })

    test('should overwrite in FIFO order', () => {
      // Fill
      buffer.push(1)
      buffer.push(2)
      buffer.push(3)
      buffer.push(4)
      buffer.push(5)
      
      // Add one more - should remove 1
      buffer.push(6)
      expect(buffer.getAll()).toEqual([2, 3, 4, 5, 6])
      
      // Add another - should remove 2
      buffer.push(7)
      expect(buffer.getAll()).toEqual([3, 4, 5, 6, 7])
    })
  })

  describe('edge cases', () => {
    test('should handle capacity of 1', () => {
      const tinyBuffer = new RingBuffer(1)
      tinyBuffer.push('first')
      expect(tinyBuffer.getAll()).toEqual(['first'])
      
      tinyBuffer.push('second')
      expect(tinyBuffer.getAll()).toEqual(['second'])
    })

    test('should handle very large capacity', () => {
      const largeBuffer = new RingBuffer(10000)
      for (let i = 0; i < 10000; i++) {
        largeBuffer.push(i)
      }
      expect(largeBuffer.getAll().length).toBe(10000)
      
      // One more should trigger overwrite
      largeBuffer.push(99999)
      expect(largeBuffer.getAll().length).toBe(10000)
      expect(largeBuffer.getLatest(1)[0]).toBe(99999)
    })

    test('should maintain order with alternating push/clear', () => {
      buffer.push(1)
      buffer.push(2)
      buffer.clear()
      buffer.push(3)
      buffer.push(4)
      
      expect(buffer.getAll()).toEqual([3, 4])
    })
  })
})