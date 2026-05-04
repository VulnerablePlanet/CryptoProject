/**
 * ============================================================================
 * MESSAGE QUEUE - Phase 1 Structure
 * ============================================================================
 * This is a placeholder stub. The full implementation is in Phase 1.
 * EventEmitter-based queue for phase-to-phase data passing.
 * Overrides emit to catch handler errors and continue to other handlers.
 */

const { EventEmitter } = require('events')

class MessageQueue extends EventEmitter {
  constructor() {
    super()
    this.queue = []
  }

  emit(event, ...args) {
    if (event === 'error') {
      return super.emit(event, ...args)
    }

    // Use rawListeners to get the actual bound functions (including once wrappers).
    // This ensures once wrappers properly self-remove after execution.
    const handlers = this.rawListeners(event)
    for (const handler of handlers) {
      try {
        handler(...args)
      } catch (err) {
        // Only emit error if there are error listeners, otherwise swallow
        // (prevents unhandled error throw from EventEmitter when no error listener)
        if (this.listenerCount('error') > 0) {
          super.emit('error', err)
        }
      }
    }

    return handlers.length > 0
  }

  on(event, handler) {
    super.on(event, handler)
    return this
  }

  off(event, handler) {
    if (handler) {
      super.off(event, handler)
    } else {
      super.removeAllListeners(event)
    }
    return this
  }

  once(event, handler) {
    super.once(event, handler)
    return this
  }
}

module.exports = { MessageQueue }
