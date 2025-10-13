/**
 * Environment Configuration for Eminium Launcher
 * Handles environment variables and configuration
 */

// Default configuration
const defaultConfig = {
  API_BASE_URL: 'https://eminium.ovh',
  API_TIMEOUT: 10000,
  UPDATE_SERVER_URL: 'https://api.github.com/repos/Eminium-Games/EminiumLauncher/releases/latest',
  LOG_LEVEL: 'info',
  LOG_MAX_ENTRIES: 100,
  NODE_ENV: 'development',
  DEBUG: true
};

// Load configuration from environment variables or use defaults
const config = { ...defaultConfig };

// Override with environment variables if available
if (typeof process !== 'undefined' && process.env) {
  Object.keys(defaultConfig).forEach(key => {
    if (process.env[key]) {
      // Convert string values to appropriate types
      if (key.includes('TIMEOUT') || key.includes('ENTRIES')) {
        config[key] = parseInt(process.env[key]);
      } else if (key === 'DEBUG') {
        config[key] = process.env[key] === 'true';
      } else {
        config[key] = process.env[key];
      }
    }
  });
}

// Export configuration
const ENV = config;

// Store in globalThis for access throughout the application
if (!globalThis.ENV) {
  globalThis.ENV = ENV;
}

// Expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.ENV = ENV;
}
