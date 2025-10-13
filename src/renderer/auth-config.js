/**
 * Configuration sécurisée pour l'authentification Eminium Launcher
 * Ce fichier contient tous les paramètres de configuration pour l'authentification
 */

// Configuration des environnements
const ENVIRONMENTS = {
  development: {
    name: 'Développement',
    serverUrl: 'http://localhost:8000', // URL de développement
    apiBasePath: '/api/auth',
    enableDebug: true,
    enableLogging: true
  },
  production: {
    name: 'Production',
    serverUrl: 'https://eminium.ovh', // URL de production
    apiBasePath: '/api/auth',
    enableDebug: false,
    enableLogging: true
  }
};

// Configuration réseau
const NETWORK_CONFIG = {
  // Timeouts en millisecondes
  timeouts: {
    connection: 10000,    // 10 secondes pour les connexions
    request: 15000,       // 15 secondes pour les requêtes
    retryDelay: 1000,     // 1 seconde entre les tentatives
    maxRetryDelay: 30000, // 30 secondes maximum entre les tentatives
  },

  // Nombre maximum de tentatives de reconnexion
  maxRetries: {
    connection: 3,
    authentication: 2,
    tokenRefresh: 3
  },

  // Configuration du backoff exponentiel
  backoffMultiplier: 2,
  backoffJitter: true // Ajouter du jitter pour éviter les thundering herd
};

// Configuration de sécurité
const SECURITY_CONFIG = {
  // Clé de chiffrement pour les données sensibles (doit être changée en production)
  encryptionKey: 'eminium-launcher-auth-key-2024',

  // Durée de vie des tokens en millisecondes
  tokenLifetime: 24 * 60 * 60 * 1000, // 24 heures

  // Intervalle de vérification de session en millisecondes
  sessionCheckInterval: 5 * 60 * 1000, // 5 minutes

  // Durée avant expiration pour déclencher le rafraîchissement
  tokenRefreshThreshold: 60 * 60 * 1000, // 1 heure avant expiration

  // Configuration CSRF
  csrf: {
    enabled: true,
    tokenLength: 32,
    headerName: 'X-CSRF-Token',
    cookieName: 'csrf_token'
  },

  // Headers de sécurité pour les requêtes
  secureHeaders: {
    'User-Agent': 'EminiumLauncher/2.0',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Client-Version': '2.0.0'
  }
};

// Configuration de validation
const VALIDATION_CONFIG = {
  email: {
    regex: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    minLength: 5,
    maxLength: 254
  },

  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false
  },

  twoFactorCode: {
    length: 6,
    regex: /^[0-9]{6}$/
  }
};

// Configuration des messages d'erreur
const ERROR_MESSAGES = {
  network: {
    timeout: 'Délai d\'attente dépassé. Vérifiez votre connexion internet.',
    connection: 'Impossible de se connecter au serveur. Réessayez plus tard.',
    server: 'Erreur du serveur. Réessayez dans quelques instants.',
    offline: 'Vous êtes hors ligne. Vérifiez votre connexion internet.'
  },

  authentication: {
    invalidCredentials: 'Email ou mot de passe incorrect.',
    accountLocked: 'Compte temporairement verrouillé. Réessayez plus tard.',
    emailNotVerified: 'Veuillez vérifier votre adresse email avant de vous connecter.',
    twoFactorRequired: 'Code de vérification à deux facteurs requis.',
    invalidTwoFactor: 'Code de vérification incorrect.',
    sessionExpired: 'Votre session a expiré. Reconnectez-vous.',
    accountBanned: 'Ce compte est suspendu.',
    tooManyAttempts: 'Trop de tentatives de connexion. Réessayez plus tard.'
  },

  validation: {
    invalidEmail: 'Adresse email invalide.',
    passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères.',
    passwordTooWeak: 'Le mot de passe n\'est pas assez sécurisé.',
    invalidTwoFactor: 'Le code de vérification doit contenir 6 chiffres.'
  }
};

// Configuration des logs
const LOGGING_CONFIG = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  },

  maxLogSize: 1000, // Nombre maximum d'entrées de log
  enableConsole: true,
  enableFile: false, // À activer en production si nécessaire
  logFilePath: './logs/auth.log',

  // Données sensibles à masquer dans les logs
  sensitiveFields: ['password', 'access_token', 'csrf_token', 'code']
};

// Classe de configuration principale
class AuthConfig {
  constructor() {
    this.env = this.detectEnvironment();
    this.settings = this.loadEnvironmentSettings();
    this.validateConfig();
  }

  /**
   * Détecte l'environnement d'exécution
   */
  detectEnvironment() {
    if (typeof window !== 'undefined' && window.location) {
      // Environnement navigateur
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      }
    }

    // Vérification des variables d'environnement Node.js
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.NODE_ENV === 'development') {
        return 'development';
      }
    }

    return 'production';
  }

  /**
   * Charge les paramètres de configuration pour l'environnement détecté
   */
  loadEnvironmentSettings() {
    const envSettings = ENVIRONMENTS[this.env];

    return {
      ...envSettings,
      network: NETWORK_CONFIG,
      security: SECURITY_CONFIG,
      validation: VALIDATION_CONFIG,
      errors: ERROR_MESSAGES,
      logging: LOGGING_CONFIG
    };
  }

  /**
   * Valide la configuration
   */
  validateConfig() {
    if (!this.settings.serverUrl) {
      throw new Error('URL du serveur non configurée');
    }

    if (!this.settings.apiBasePath) {
      throw new Error('Chemin de base de l\'API non configuré');
    }

    if (this.env === 'production' && this.settings.enableDebug) {
      console.warn('WARNING: Debug activé en environnement de production');
    }
  }

  /**
   * Récupère un paramètre de configuration
   */
  get(path, defaultValue = null) {
    const keys = path.split('.');
    let current = this.settings;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * Met à jour un paramètre de configuration
   */
  set(path, value) {
    const keys = path.split('.');
    let current = this.settings;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Récupère l'URL complète de l'API
   */
  getApiUrl(endpoint = '') {
    const baseUrl = this.settings.serverUrl;
    const basePath = this.settings.apiBasePath;

    return `${baseUrl}${basePath}${endpoint}`;
  }

  /**
   * Vérifie si le débogage est activé
   */
  isDebugEnabled() {
    return this.settings.enableDebug;
  }

  /**
   * Vérifie si la journalisation est activée
   */
  isLoggingEnabled() {
    return this.settings.enableLogging;
  }
}

// Créer une instance globale de configuration
const authConfig = new AuthConfig();

// Exporter pour les environnements Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthConfig, authConfig };
}

// Exporter pour les navigateurs
if (typeof window !== 'undefined') {
  window.AuthConfig = AuthConfig;
  window.authConfig = authConfig;
}
