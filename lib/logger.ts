/**
 * Advanced logging system with different log levels and formatting
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export type LogContext = {
  module?: string;
  function?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
};

class Logger {
  private level: LogLevel;
  private module: string;

  constructor(module: string, level: LogLevel = LogLevel.INFO) {
    this.module = module;
    this.level = this.getLogLevelFromEnv();
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG': return LogLevel.DEBUG;
      case 'INFO': return LogLevel.INFO;
      case 'WARN': return LogLevel.WARN;
      case 'ERROR': return LogLevel.ERROR;
      case 'FATAL': return LogLevel.FATAL;
      default: return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const moduleName = context?.module || this.module;
    const func = context?.function ? `.${context.function}()` : '';
    
    let logMessage = `[${timestamp}] [${level}] [${moduleName}${func}] ${message}`;
    
    // Add context information if present
    if (context) {
      const { module, function: fn, ...rest } = context;
      if (Object.keys(rest).length > 0) {
        logMessage += ` | Context: ${JSON.stringify(rest)}`;
      }
    }
    
    return logMessage;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  debug(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMessage = error instanceof Error 
        ? `${message} | Error: ${error.message} | Stack: ${error.stack}`
        : `${message} | Error: ${JSON.stringify(error)}`;
      console.error(this.formatMessage('ERROR', errorMessage, context));
    }
  }

  fatal(message: string, error?: Error | unknown, context?: LogContext) {
    if (this.shouldLog(LogLevel.FATAL)) {
      const errorMessage = error instanceof Error 
        ? `${message} | Fatal Error: ${error.message} | Stack: ${error.stack}`
        : `${message} | Fatal Error: ${JSON.stringify(error)}`;
      console.error(this.formatMessage('FATAL', errorMessage, context));
    }
  }

  // Performance logging
  time(label: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(this.formatMessage('PERF', label, context));
    }
  }

  timeEnd(label: string, context?: LogContext) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(this.formatMessage('PERF', label, context));
    }
  }

  // Metrics logging
  metric(name: string, value: number, unit: string = '', context?: LogContext) {
    if (this.shouldLog(LogLevel.INFO)) {
      const metricMessage = `Metric: ${name}=${value}${unit}`;
      console.log(this.formatMessage('METRIC', metricMessage, context));
    }
  }
}

// Create loggers for different modules
export const apiLogger = new Logger('API');
export const ragLogger = new Logger('RAG');
export const pineconeLogger = new Logger('Pinecone');
export const openaiLogger = new Logger('OpenAI');
export const indexLogger = new Logger('Indexer');

// Export factory function for creating custom loggers
export function createLogger(module: string): Logger {
  return new Logger(module);
}

export default Logger;