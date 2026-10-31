const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const CURRENT_LEVEL = process.env.LOG_LEVEL || 'info';

class Logger {
  formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    return {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context,
    };
  }

  shouldLog(level) {
    const currentWeight = LOG_LEVELS[CURRENT_LEVEL.toLowerCase()] ?? 1;
    const targetWeight = LOG_LEVELS[level.toLowerCase()] ?? 1;
    return targetWeight >= currentWeight;
  }

  info(message, context) {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${new Date().toISOString()} - ${message}`, context ? JSON.stringify(context) : '');
    }
  }

  warn(message, context) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, context ? JSON.stringify(context) : '');
    }
  }

  error(message, error, context = {}) {
    if (this.shouldLog('error')) {
      const errDetails = error instanceof Error
        ? { errorMessage: error.message, stack: error.stack }
        : { rawError: error };
      console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, { ...context, ...errDetails });
    }
  }

  debug(message, context) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, context ? JSON.stringify(context) : '');
    }
  }
}

export const logger = new Logger();
export default logger;
