/**
 * Common Utilities for Eminium Launcher
 * Provides shared utility functions
 */

(function() {
  // Check if already loaded
  if (window.CommonUtils) {
    return;
  }

  // Private state
  const _cache = new Map();
  const _performanceMetrics = new Map();
  let _isInitialized = false;

  /**
   * Debounce function to limit the rate at which a function can fire
   * @param {Function} func - The function to debounce
   * @param {number} wait - The time to wait in milliseconds
   * @param {boolean} [immediate=false] - Whether to execute immediately on first call
   * @returns {Function} - The debounced function
   */
  function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const context = this;
      const later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }

  /**
   * Throttle function to limit the rate at which a function can fire
   * @param {Function} func - The function to throttle
   * @param {number} limit - The time to wait between calls in milliseconds
   * @returns {Function} - The throttled function
   */
  function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - The number of bytes
   * @param {number} [decimals=2] - Number of decimal places
   * @returns {string} Formatted string
   */
  function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Format a value as a percentage of a total
   * @param {number} value - The value to format
   * @param {number} total - The total value
   * @param {number} [decimals=1] - Number of decimal places
   * @returns {string} Formatted percentage string
   */
  function formatPercentage(value, total, decimals = 1) {
    if (total === 0) return '0%';
    return ((value / total) * 100).toFixed(decimals) + '%';
  }

  /**
   * Format milliseconds to human readable duration
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration string
   */
  function formatDuration(ms) {
    if (ms < 0) ms = -ms;
    const time = {
      day: Math.floor(ms / 86400000),
      hour: Math.floor(ms / 3600000) % 24,
      minute: Math.floor(ms / 60000) % 60,
      second: Math.floor(ms / 1000) % 60,
      millisecond: Math.floor(ms) % 1000
    };
    
    return Object.entries(time)
      .filter(val => val[1] !== 0)
      .map(([key, val]) => `${val} ${key}${val !== 1 ? 's' : ''}`)
      .join(', ');
  }

  /**
   * Safely parse JSON with fallback
   * @param {string} str - JSON string to parse
   * @param {*} [fallback=null] - Fallback value if parsing fails
   * @returns {*} Parsed object or fallback
   */
  function safeJSONParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Safely stringify JSON with fallback
   * @param {*} obj - Object to stringify
   * @param {string} [fallback='{}'] - Fallback string if stringify fails
   * @returns {string} JSON string or fallback
   */
  function safeJSONStringify(obj, fallback = '{}') {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Generate a unique ID
   * @returns {string} Unique ID string
   */
  function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Check if a value is empty
   * @param {*} value - Value to check
   * @returns {boolean} True if value is empty
   */
  function isEmpty(value) {
    return value === null || 
           value === undefined || 
           (typeof value === 'string' && value.trim() === '') ||
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
  }

  /**
   * Deep clone an object
   * @param {*} obj - Object to clone
   * @returns {*} Deep cloned object
   */
  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => deepClone(item));
    }
    
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = deepClone(obj[key]);
      }
    }
    
    return result;
  }

  /**
   * Deep merge objects
   * @param {Object} target - Target object
   * @param {...Object} sources - Source objects
   * @returns {Object} Merged object
   */
  function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
      for (const key in source) {
        if (isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
    
    return deepMerge(target, ...sources);
  }

  /**
   * Check if a value is a plain object
   * @param {*} item - Value to check
   * @returns {boolean} True if value is a plain object
   */
  function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }

  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to retry
   * @param {number} [maxAttempts=3] - Maximum number of attempts
   * @param {number} [delay=1000] - Initial delay in milliseconds
   * @returns {Promise<*>} Result of the function
   */
  async function retry(fn, maxAttempts = 3, delay = 1000) {
    try {
      return await fn();
    } catch (err) {
      if (maxAttempts <= 1) throw err;
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(fn, maxAttempts - 1, delay * 2);
    }
  }

  // Create a simple event emitter
  class EventEmitter {
    constructor() {
      this.events = {};
    }
    
    on(event, listener) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(listener);
      return () => this.off(event, listener);
    }
    
    off(event, listener) {
      if (!this.events[event]) return;
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    
    emit(event, ...args) {
      if (!this.events[event]) return;
      this.events[event].forEach(listener => {
        try {
          listener(...args);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      });
    }
  }

  // State manager for handling application state
  class StateManager {
    constructor() {
      this.state = {};
      this.listeners = {};
    }
    
    get(key) {
      return key ? this.state[key] : { ...this.state };
    }
    
    set(key, value) {
      this.state[key] = value;
      this.notify(key, value);
    }
    
    update(key, updater) {
      const newValue = typeof updater === 'function' 
        ? updater(this.state[key])
        : updater;
      this.set(key, newValue);
    }
    
    on(key, callback) {
      if (!this.listeners[key]) {
        this.listeners[key] = new Set();
      }
      this.listeners[key].add(callback);
      return () => this.off(key, callback);
    }
    
    off(key, callback) {
      if (!this.listeners[key]) return;
      this.listeners[key].delete(callback);
    }
    
    notify(key, value) {
      if (!this.listeners[key]) return;
      for (const callback of this.listeners[key]) {
        try {
          callback(value, key, this.state);
        } catch (err) {
          console.error(`Error in state listener for ${key}:`, err);
        }
      }
    }
    
    reset() {
      this.state = {};
      this.listeners = {};
    }
  }

  // Performance monitoring utility
  class PerformanceMonitor {
    constructor() {
      this.metrics = new Map();
      this.enabled = true;
    }
    
    startTimer(name) {
      if (!this.enabled) return;
      this.metrics.set(name, {
        start: performance.now(),
        end: null,
        duration: null
      });
    }
    
    endTimer(name) {
      if (!this.enabled || !this.metrics.has(name)) return null;
      
      const metric = this.metrics.get(name);
      metric.end = performance.now();
      metric.duration = metric.end - metric.start;
      
      return metric.duration;
    }
    
    getMetrics() {
      return Array.from(this.metrics.entries())
        .reduce((obj, [key, value]) => ({
          ...obj,
          [key]: value.duration !== null ? `${value.duration.toFixed(2)}ms` : 'running'
        }), {});
    }
    
    clearMetrics() {
      this.metrics.clear();
    }
  }

  // Create and expose CommonUtils
  const CommonUtils = {
    debounce,
    throttle,
    formatFileSize,
    formatPercentage,
    formatDuration,
    safeJSONParse,
    safeJSONStringify,
    generateUniqueId,
    isEmpty,
    deepClone,
    deepMerge,
    isObject,
    retry,
    EventEmitter,
    StateManager,
    PerformanceMonitor,
    
    // Initialize the utilities
    init() {
      if (_isInitialized) return;
      _isInitialized = true;
      console.log('CommonUtils initialized');
    },
    
    // Cache utilities
    cache: {
      set(key, value, ttl = 0) {
        const expiresAt = ttl > 0 ? Date.now() + ttl : null;
        _cache.set(key, { value, expiresAt });
      },
      
      get(key) {
        const item = _cache.get(key);
        if (!item) return null;
        
        if (item.expiresAt && Date.now() > item.expiresAt) {
          _cache.delete(key);
          return null;
        }
        
        return item.value;
      },
      
      delete(key) {
        return _cache.delete(key);
      },
      
      clear() {
        _cache.clear();
      },
      
      size() {
        return _cache.size;
      }
    },
    
    // Performance utilities
    perf: {
      start(name) {
        _performanceMetrics.set(name, performance.now());
      },
      
      end(name) {
        const start = _performanceMetrics.get(name);
        if (start === undefined) return null;
        
        const duration = performance.now() - start;
        _performanceMetrics.delete(name);
        return duration;
      },
      
      measure(name, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        
        if (result && typeof result.then === 'function') {
          return result.then(res => ({
            result: res,
            duration: performance.now() - start
          }));
        }
        
        return { result, duration };
      }
    }
  };

  // Auto-initialize in browser
  if (typeof window !== 'undefined') {
    window.CommonUtils = CommonUtils;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => CommonUtils.init());
    } else {
      CommonUtils.init();
    }
  }

  // Export for CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommonUtils;
  }
})();
