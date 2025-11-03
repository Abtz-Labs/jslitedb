/**
 * Logger - Structured logging utility for JSLiteDB
 * Provides consistent logging across the application with different log levels
 */
class Logger {
  /**
   * Create a new Logger instance
   * @param {Object} options - Logger configuration options
   * @param {string} [options.level='info'] - Minimum log level to outpu
   * @param {boolean} [options.enableConsole=true] - Enable console outpu
   * @param {string} [options.logFile] - Optional log file path (not implemented)
   */
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.enableConsole = options.enableConsole !== false;
    this.logFile = options.logFile;

    // Log level hierarchy
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} [meta={}] - Additional metadata
   */
  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} [meta={}] - Additional metadata
   */
  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Object} [meta={}] - Additional metadata
   */
  error(message, meta = {}) {
    this._log('error', message, meta);
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} [meta={}] - Additional metadata
   */
  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  /**
   * Set the minimum log level
   * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
   */
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
    }
  }

  /**
   * Get the current log level
   * @returns {string} Current log level
   */
  getLevel() {
    return this.level;
  }

  /**
   * Check if a log level should be outpu
   * @param {string} level - Log level to check
   * @returns {boolean} True if level should be logged
   */
  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  /**
   * Internal logging method
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  _log(level, message, meta) {
    // Only log if level meets threshold
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...meta
    };

    if (this.enableConsole) {
      const colorCode = this._getColorCode(level);
      const resetCode = '\x1b[0m';

      console.log(
        `${colorCode}[${logEntry.timestamp}] ${logEntry.level}:${resetCode} ${message}`,
        Object.keys(meta).length > 0 ? meta : ''
      );
    }

    // TODO: Implement file logging if needed
    // if (this.logFile) {
    //   this._writeToFile(logEntry);
    // }
  }

  /**
   * Get ANSI color code for log level
   * @private
   * @param {string} level - Log level
   * @returns {string} ANSI color code
   */
  _getColorCode(level) {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    };
    return colors[level] || '\x1b[0m'; // Defaul
  }

  /**
   * Create a child logger with additional contex
   * @param {Object} context - Additional context to include in all logs
   * @returns {Logger} Child logger instance
   */
  child(context) {
    const childLogger = new Logger({
      level: this.level,
      enableConsole: this.enableConsole,
      logFile: this.logFile
    });

    // Override _log to include contex
    const originalLog = childLogger._log.bind(childLogger);
    childLogger._log = (level, message, meta) => {
      originalLog(level, message, { ...context, ...meta });
    };

    return childLogger;
  }
}

module.exports = Logger;