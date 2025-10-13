/**
 * Logger for Eminium Launcher
 * Provides centralized logging functionality with different severity levels
 */

// Check if Logger is already initialized
if (typeof window !== 'undefined' && window.Logger && window.Logger.initialized) {
  // Already loaded, no need to continue
  throw new Error('Logger already initialized');
}

const LOG_LEVELS = Object.freeze({
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SUCCESS: 4
});

// Default configuration
const LOGGER_CONFIG = Object.freeze({
  maxHistory: 1000,
  defaultLevel: LOG_LEVELS.INFO,
  showTimestamp: true,
  showLevel: true,
  colors: {
    [LOG_LEVELS.DEBUG]: '#888888',
    [LOG_LEVELS.INFO]: '#3498db',
    [LOG_LEVELS.WARN]: '#f39c12',
    [LOG_LEVELS.ERROR]: '#e74c3c',
    [LOG_LEVELS.SUCCESS]: '#2ecc71'
  }
});

// Private state
let logHistory = [];
let currentLevel = LOGGER_CONFIG.defaultLevel;
let isInitialized = false;

// Format timestamp
function formatTimestamp(date = new Date()) {
  return date.toISOString();
}

// Create log entry
function createLogEntry(message, level = LOG_LEVELS.INFO) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message: String(message),
    stack: level >= LOG_LEVELS.ERROR ? new Error().stack : undefined
  };
}

// Add log entry to storage
function addLogEntry(entry) {
  logHistory.push(entry);
  if (logHistory.length > LOGGER_CONFIG.maxHistory) {
    logHistory.shift();
  }
  return entry;
}

// Log to console
function logToConsole(entry) {
  if (entry.level < currentLevel) return;
  
  const timestamp = formatTimestamp(new Date(entry.timestamp));
  const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === entry.level) || 'UNKNOWN';
  const style = `color: ${LOGGER_CONFIG.colors[entry.level] || '#000000'}; font-weight: bold`;
  
  const logMethod = {
    [LOG_LEVELS.DEBUG]: console.debug,
    [LOG_LEVELS.INFO]: console.info,
    [LOG_LEVELS.WARN]: console.warn,
    [LOG_LEVELS.ERROR]: console.error,
    [LOG_LEVELS.SUCCESS]: console.log
  }[entry.level] || console.log;
  
  logMethod(`%c[${timestamp}] [${levelName}]`, style, entry.message);
  
  if (entry.level === LOG_LEVELS.ERROR && entry.stack) {
    console.error(entry.stack);
  }
}

// Core logging function
function log(message, level = LOG_LEVELS.INFO) {
  const entry = createLogEntry(message, level);
  addLogEntry(entry);
  logToConsole(entry);
  return entry;
}

// Initialize logger
function init() {
  if (isInitialized) {
    return false;
  }
  
  isInitialized = true;
  log('Logger initialized', LOG_LEVELS.INFO);
  return true;
}

// Public API
const api = {
  init,
  debug: (message) => log(message, LOG_LEVELS.DEBUG),
  info: (message) => log(message, LOG_LEVELS.INFO),
  warn: (message) => log(message, LOG_LEVELS.WARN),
  error: (message) => log(message, LOG_LEVELS.ERROR),
  success: (message) => log(message, LOG_LEVELS.SUCCESS),
  setLevel: (level) => {
    if (typeof level === 'string') {
      level = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
    }
    currentLevel = level;
    return level;
  },
  getLevel: () => currentLevel,
  clearHistory: () => {
    const count = logHistory.length;
    logHistory = [];
    return count;
  },
  getHistory: () => [...logHistory],
  exportLogs: () => ({
    logs: [...logHistory],
    config: LOGGER_CONFIG,
    exportedAt: new Date().toISOString()
  }),
  formatMessage: (message, level = LOG_LEVELS.INFO) => {
    const timestamp = formatTimestamp();
    const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'INFO';
    return `[${timestamp}] [${levelName}] ${message}`;
  }
};

// Initialize immediately if in browser
if (typeof window !== 'undefined') {
  init();
}

// Export for different environments
if (typeof globalThis !== 'undefined') {
  globalThis.Logger = {
    initialized: false,
    ...api
  };
}

if (typeof window !== 'undefined') {
  window.Logger = globalThis.Logger;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalThis.Logger;
}

// For backward compatibility
Logger.initLogger = init;
