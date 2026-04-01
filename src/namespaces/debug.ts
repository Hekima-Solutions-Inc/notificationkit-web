import { LogLevel } from '../core/types';

const LOG_LEVELS: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export class DebugNamespace {
  private _level: LogLevel = 'warn';

  setLogLevel(level: LogLevel): void {
    this._level = level;
  }

  getLogLevel(): LogLevel {
    return this._level;
  }

  // Internal logging methods used throughout the SDK
  _error(...args: unknown[]): void {
    if (LOG_LEVELS[this._level] >= LOG_LEVELS.error) console.error('[NotificationKit]', ...args);
  }

  _warn(...args: unknown[]): void {
    if (LOG_LEVELS[this._level] >= LOG_LEVELS.warn) console.warn('[NotificationKit]', ...args);
  }

  _info(...args: unknown[]): void {
    if (LOG_LEVELS[this._level] >= LOG_LEVELS.info) console.info('[NotificationKit]', ...args);
  }

  _debug(...args: unknown[]): void {
    if (LOG_LEVELS[this._level] >= LOG_LEVELS.debug) console.debug('[NotificationKit]', ...args);
  }
}
