/**
 * Logger for TA-Lib Module
 * Provides structured logging with different levels
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(module = 'TALIB', level = 'INFO') {
    this.module = module;
    this.level = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  }

  /**
   * Format log message
   * @private
   */
  _format(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}] [${this.module}]`;
    
    if (data) {
      return `${prefix} ${message}\n${JSON.stringify(data, null, 2)}`;
    }
    return `${prefix} ${message}`;
  }

  /**
   * Log error message
   */
  error(message, error = null) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this._format('ERROR', message, error));
    }
  }

  /**
   * Log warning message
   */
  warn(message, data = null) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this._format('WARN', message, data));
    }
  }

  /**
   * Log info message
   */
  info(message, data = null) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.log(this._format('INFO', message, data));
    }
  }

  /**
   * Log debug message
   */
  debug(message, data = null) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log(this._format('DEBUG', message, data));
    }
  }

  /**
   * Log performance metric
   */
  performance(operation, duration) {
    this.debug(`Performance: ${operation} took ${duration}ms`);
  }

  /**
   * Create child logger with sub-module name
   */
  child(subModule) {
    return new Logger(`${this.module}:${subModule}`, 
      Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === this.level)
    );
  }
}

// Create default logger instance
const defaultLogger = new Logger('TALIB', process.env.TALIB_LOG_LEVEL || 'INFO');

module.exports = { Logger, defaultLogger };
