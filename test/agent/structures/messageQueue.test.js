/**
 * ============================================================================
 * MESSAGE QUEUE TESTS - Phase 10
 * ============================================================================
 * Unit tests for the MessageQueue (EventEmitter-based).
 * Tests: emit/on pattern, multiple handlers, data passing
 */

import { MessageQueue } from '../../../server/trading/agent/structures/messageQueue.js'
import { vi } from 'vitest'

describe('MessageQueue', () => {
  let queue

  beforeEach(() => {
    queue = new MessageQueue()
  })

  describe('constructor', () => {
    test('should create an EventEmitter-based queue', () => {
      expect(queue).toBeInstanceOf(MessageQueue)
      expect(typeof queue.emit).toBe('function')
      expect(typeof queue.on).toBe('function')
      expect(typeof queue.off).toBe('function')
    })
  })

  describe('emit and on', () => {
    test('should emit event and receive data', () => {
      const testData = { value: 42 }
      let received = null

      queue.on('test', (data) => { received = data })
      queue.emit('test', testData)

      expect(received).toEqual(testData)
    })

    test('should emit to multiple listeners', () => {
      const received = []
      
      queue.on('event1', (data) => received.push({ handler: 1, data }))
      queue.on('event1', (data) => received.push({ handler: 2, data }))
      queue.on('event1', (data) => received.push({ handler: 3, data }))
      
      queue.emit('event1', { value: 'test' })
      
      expect(received.length).toBe(3)
      expect(received[0].handler).toBe(1)
      expect(received[1].handler).toBe(2)
      expect(received[2].handler).toBe(3)
    })

    test('should only emit to listeners of that event', () => {
      const received = []
      
      queue.on('eventA', () => received.push('A'))
      queue.on('eventB', () => received.push('B'))
      
      queue.emit('eventA', null)
      
      expect(received).toEqual(['A'])
      expect(received).not.toContain('B')
    })

    test('should emit with multiple arguments', () => {
      let receivedArgs = null
      queue.on('multi', (...args) => { receivedArgs = args })
      queue.emit('multi', 'first', 42, { key: 'value' })

      expect(receivedArgs[0]).toBe('first')
      expect(receivedArgs[1]).toBe(42)
      expect(receivedArgs[2]).toEqual({ key: 'value' })
    })
  })

  describe('off (unsubscribe)', () => {
    test('should remove specific handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      queue.on('event', handler1)
      queue.on('event', handler2)
      
      queue.off('event', handler1)
      
      queue.emit('event', null)
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    test('should remove all handlers for event when no handler specified', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      
      queue.on('event', handler1)
      queue.on('event', handler2)
      
      queue.off('event')
      
      queue.emit('event', null)
      
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('data passing between phases', () => {
    test('should pass analysis results to scoring', () => {
      const analysisResults = {
        regime: 'BULL',
        rsi: 65,
        indicators: { macd: 0.5 }
      }

      let received = null
      queue.on('analysis:complete', (data) => { received = data })
      queue.emit('analysis:complete', analysisResults)

      expect(received.regime).toBe('BULL')
      expect(received.indicators.macd).toBe(0.5)
    })

    test('should pass research + analysis to scoring', () => {
      const researchData = { fearGreed: 45, sentiment: 0.6 }
      const analysisData = { regime: 'BEAR', mtfAlignment: 'MIXED' }

      let receivedResearch = null
      let receivedAnalysis = null
      queue.on('scoring:start', (research, analysis) => {
        receivedResearch = research
        receivedAnalysis = analysis
      })
      queue.emit('scoring:start', researchData, analysisData)

      expect(receivedResearch.fearGreed).toBe(45)
      expect(receivedAnalysis.regime).toBe('BEAR')
    })

    test('should chain phases correctly', () => {
      const executionOrder = []
      
      queue.on('phase:research', () => executionOrder.push('research'))
      queue.on('phase:analysis', () => executionOrder.push('analysis'))
      queue.on('phase:scoring', () => executionOrder.push('scoring'))
      queue.on('phase:execution', () => executionOrder.push('execution'))
      queue.on('phase:monitoring', () => executionOrder.push('monitoring'))
      
      // Simulate phase sequence
      queue.emit('phase:research')
      queue.emit('phase:analysis')
      queue.emit('phase:scoring')
      queue.emit('phase:execution')
      queue.emit('phase:monitoring')
      
      expect(executionOrder).toEqual([
        'research',
        'analysis',
        'scoring',
        'execution',
        'monitoring'
      ])
    })
  })

  describe('error handling', () => {
    test('should handle errors in handlers gracefully', () => {
      const errorHandler = vi.fn()
      queue.on('error', errorHandler)
      
const throwingHandler = vi.fn(() => {
      throw new Error('Test error')
    })
    queue.on('event', throwingHandler)

    // Should not throw
    expect(() => queue.emit('event', null)).not.toThrow()
    expect(errorHandler).toHaveBeenCalled()
  })

  test('should continue emitting to other handlers if one throws', () => {
    const handler1 = vi.fn()
    const throwingHandler = vi.fn(() => {
      throw new Error('Test error')
    })
      const handler2 = vi.fn()
      
      queue.on('event', handler1)
      queue.on('event', throwingHandler)
      queue.on('event', handler2)
      
      queue.emit('event', null)
      
      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })

  describe('once (single execution)', () => {
    test('should only execute handler once', () => {
      const handler = vi.fn()
      
      queue.once('single', handler)
      queue.emit('single')
      queue.emit('single')
      queue.emit('single')
      
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('phase-to-phase communication', () => {
    test('should support agent state updates', () => {
      const stateUpdate = {
        state: 'RESEARCH',
        cycleCount: 5,
        killSwitch: false
      }

      let received = null
      queue.on('agent:state', (data) => { received = data })
      queue.emit('agent:state', stateUpdate)

      expect(received.state).toBe('RESEARCH')
      expect(received.cycleCount).toBe(5)
    })

    test('should support position updates', () => {
      const positionUpdate = {
        positionId: 'pos_123',
        symbol: 'BTC/USDT',
        side: 'LONG',
        size: 0.5
      }

      let received = null
      queue.on('position:opened', (data) => { received = data })
      queue.emit('position:opened', positionUpdate)

      expect(received.symbol).toBe('BTC/USDT')
      expect(received.side).toBe('LONG')
    })

    test('should support kill switch events', () => {
      const killData = {
        reason: 'DRAWDOWN_10PCT',
        thresholds: { drawdown: 0.12 }
      }

      let received = null
      queue.on('agent:kill-switch', (data) => { received = data })
      queue.emit('agent:kill-switch', killData)

      expect(received.reason).toBe('DRAWDOWN_10PCT')
    })
  })

  describe('buffer behavior', () => {
    test('should handle rapid emissions', () => {
      const received = []
      queue.on('rapid', (data) => received.push(data))
      
      for (let i = 0; i < 100; i++) {
        queue.emit('rapid', i)
      }
      
      expect(received.length).toBe(100)
      expect(received[99]).toBe(99)
    })

    test('should handle mixed event types', () => {
      const counts = { a: 0, b: 0, c: 0 }
      
      queue.on('a', () => counts.a++)
      queue.on('b', () => counts.b++)
      queue.on('c', () => counts.c++)
      
      queue.emit('a')
      queue.emit('b')
      queue.emit('a')
      queue.emit('c')
      queue.emit('b')
      
      expect(counts).toEqual({ a: 2, b: 2, c: 1 })
    })
  })
})