const config = require('../config');

/**
 * Simple logger utility
 * Provides structured logging with different levels
 */
class Logger {
  constructor() {
    this.logLevel = config.app.logLevel;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * Check if log level should be printed
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  /**
   * Format log message with timestamp
   */
  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
      return `${formattedMessage} ${JSON.stringify(data)}`;
    }
    
    return formattedMessage;
  }

  /**
   * Log error messages
   */
  error(message, error = null) {
    if (this.shouldLog('error')) {
      const data = error ? { error: error.message, stack: error.stack } : null;
      console.error(this.formatMessage('error', message, data));
    }
  }

  /**
   * Log warning messages
   */
  warn(message, data = null) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, data));
    }
  }

  /**
   * Log info messages
   */
  info(message, data = null) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, data));
    }
  }

  /**
   * Log debug messages
   */
  debug(message, data = null) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  /**
   * Log Slack events with structured data
   */
  logSlackEvent(eventType, event, metadata = {}) {
    this.info(`Slack ${eventType}`, {
      event_type: eventType,
      channel: event.channel,
      user: event.user,
      timestamp: event.ts,
      ...metadata
    });
  }

  /**
   * Log message processing pipeline
   */
  logMessageProcessing(stage, messageId, data = {}) {
    this.debug(`Message processing: ${stage}`, {
      message_id: messageId,
      stage,
      ...data
    });
  }

  /**
   * Log AI/LLM operations
   */
  logAIOperation(operation, data = {}) {
    this.info(`AI Operation: ${operation}`, {
      operation,
      ...data
    });
  }
}

module.exports = new Logger();