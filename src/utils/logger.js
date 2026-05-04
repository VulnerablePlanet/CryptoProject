/**
 * Conditional logger for frontend.
 *
 * In development: logs everything to console.
 * In production: only logs errors and warnings.
 *
 * Usage:
 *   import { logger } from '@/utils/logger'
 *   logger.debug('Cache hit:', key)     // Silenced in production
 *   logger.info('Prices updated')        // Silenced in production
 *   logger.warn('Stale data')            // Always visible
 *   logger.error('Fetch failed:', err)   // Always visible
 */

const isDev = import.meta.env.DEV

const noop = () => {}

export const logger = {
  debug: isDev ? (...args) => console.log(...args) : noop,
  info: isDev ? (...args) => console.log(...args) : noop,
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
}

export default logger
