/**
 * ============================================================================
 * EVENT BUS - Socket.io Wrapper
 * ============================================================================
 * Unified event emission for dashboard updates and inter-module communication
 *
 * Usage:
 *   const eventBus = require('./eventBus')
 *   eventBus.emit('position:opened', { symbol: 'BTC/USDT', ... })
 *   eventBus.on('kill_switch:triggered', (data) => { ... })
 */

const EventEmitter = require('events')

class AgentEventBus extends EventEmitter {
  constructor(socket = null) {
    super()
    this.socket = socket
    this.eventHistory = []
    this.maxHistoryLength = 100
  }

  /**
   * Emit event to Socket.io and local listeners
   * @param {string} event - Event name
   * @param {object} data - Event payload
   */
  emit(event, data) {
    // Store in history for debugging/auditing
    this.eventHistory.push({
      event,
      data,
      timestamp: Date.now()
    })

    // Trim history if too long
    if (this.eventHistory.length > this.maxHistoryLength) {
      this.eventHistory.shift()
    }

    // Emit to local EventEmitter listeners
    super.emit(event, data)

    // Forward to Socket.io if connected
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data)
    }
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {function} handler - Callback function
   */
  on(event, handler) {
    super.on(event, handler)
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {function} handler - Callback to remove (optional)
   */
  off(event, handler) {
    if (handler) {
      super.off(event, handler)
    } else {
      super.removeAllListeners(event)
    }
  }

  /**
   * Get recent event history
   * @param {number} limit - Max events to return
   * @returns {array} Recent events
   */
  getHistory(limit = 20) {
    return this.eventHistory.slice(-limit)
  }

  /**
   * Get events by type
   * @param {string} eventName - Event name to filter
   * @param {number} limit - Max events to return
   * @returns {array} Matching events
   */
  getEventsByType(eventName, limit = 20) {
    const filtered = this.eventHistory.filter(e => e.event === eventName)
    return filtered.slice(-limit)
  }

  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = []
  }

  /**
   * Attach Socket.io socket
   * @param {object} socket - Socket.io socket instance
   */
  setSocket(socket) {
    this.socket = socket
  }

  /**
   * Check if connected to Socket.io
   * @returns {boolean}
   */
  isConnected() {
    return this.socket && this.socket.connected
  }
}

// Singleton instance for use across modules
let eventBusInstance = null

/**
 * Get or create the singleton event bus
 * @param {object} socket - Optional Socket.io socket
 * @returns {AgentEventBus}
 */
function getEventBus(socket = null) {
  if (!eventBusInstance) {
    eventBusInstance = new AgentEventBus(socket)
  } else if (socket && !eventBusInstance.socket) {
    eventBusInstance.setSocket(socket)
  }
  return eventBusInstance
}

/**
 * Reset the event bus (for testing)
 */
function resetEventBus() {
  if (eventBusInstance) {
    eventBusInstance.removeAllListeners()
    eventBusInstance.clearHistory()
  }
  eventBusInstance = null
}

module.exports = {
  AgentEventBus,
  getEventBus,
  resetEventBus
}