/**
 * Backend structured logger.
 *
 * Centralizes all server-side logging so application modules do not write
 * directly to console. In production it emits JSON lines; in development it
 * keeps a readable format while preserving structured metadata.
 */

const LEVEL_PRIORITY = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
}

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
const CURRENT_PRIORITY = LEVEL_PRIORITY[LOG_LEVEL] ?? LEVEL_PRIORITY.info
const isProduction = process.env.NODE_ENV === 'production'

const normalizeError = (error) => {
  if (!error) return undefined

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack
    }
  }

  return error
}

const normalizeMeta = (meta) => {
  if (!meta) return undefined
  if (meta instanceof Error) return normalizeError(meta)
  if (Array.isArray(meta)) return meta.map(normalizeMeta)

  if (typeof meta === 'object') {
    return Object.fromEntries(
      Object.entries(meta).map(([key, value]) => [key, normalizeMeta(value)])
    )
  }

  return meta
}

const write = (level, context, message, meta) => {
  if (LEVEL_PRIORITY[level] > CURRENT_PRIORITY) return

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...(meta ? { meta: normalizeMeta(meta) } : {})
  }

  if (isProduction) {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](JSON.stringify(payload))
    return
  }

  const prefix = `[${payload.timestamp}] [${level.toUpperCase()}] [${context}]`
  const output = meta ? [prefix, message, meta] : [prefix, message]

  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](...output)
}

const createLogger = (context = 'app') => ({
  error: (message, meta) => write('error', context, message, normalizeMeta(meta)),
  warn: (message, meta) => write('warn', context, message, normalizeError(meta)),
  info: (message, meta) => write('info', context, message, normalizeError(meta)),
  debug: (message, meta) => write('debug', context, message, normalizeError(meta)),
  child: (childContext) => createLogger(`${context}:${childContext}`)
})

module.exports = {
  createLogger,
  logger: createLogger('app')
}
