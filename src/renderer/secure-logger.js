/**
 * Système de journalisation sécurisé pour l'authentification Eminium Launcher
 * Fournit une journalisation avec masquage automatique des données sensibles
 */

class SecureLogger {
  constructor(config) {
    this.config = config;
    this.logs = [];
    this.maxLogs = this.config.logging.maxLogSize;
    this.sensitiveFields = new Set(this.config.logging.sensitiveFields);

    // Initialiser la journalisation console si activée
    if (this.config.logging.enableConsole) {
      this.consoleMethods = {
        error: console.error.bind(console),
        warn: console.warn.bind(console),
        info: console.info.bind(console),
        debug: console.debug.bind(console)
      };
    }
  }

  /**
   * Masque les données sensibles dans un objet
   */
  maskSensitiveData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const masked = Array.isArray(data) ? [...data] : { ...data };

    for (const key in masked) {
      if (this.sensitiveFields.has(key.toLowerCase())) {
        if (typeof masked[key] === 'string') {
          // Masquer les valeurs sensibles avec des étoiles
          const length = masked[key].length;
          masked[key] = '*'.repeat(Math.min(length, 8)) +
                       (length > 8 ? `...${'*'.repeat(4)}` : '');
        } else {
          masked[key] = '[MASKED]';
        }
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }

    return masked;
  }

  /**
   * Ajoute une entrée au journal
   */
  log(level, message, data = null) {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      data: data ? this.maskSensitiveData(data) : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js'
    };

    // Ajouter au tableau des logs
    this.logs.push(logEntry);

    // Maintenir la taille maximale
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Afficher dans la console si activé
    if (this.config.logging.enableConsole) {
      this.outputToConsole(level, message, logEntry.data);
    }

    // Ici on pourrait ajouter l'écriture dans un fichier si activée
    if (this.config.logging.enableFile) {
      this.writeToFile(logEntry);
    }
  }

  /**
   * Vérifie si un niveau de log est activé
   */
  isLevelEnabled(level) {
    const requestedLevel = this.config.logging.levels[level];
    const currentLevel = this.config.logging.levels[
      this.config.enableDebug ? 'debug' : 'info'
    ];
    return requestedLevel <= currentLevel;
  }

  /**
   * Affiche dans la console
   */
  outputToConsole(level, message, data) {
    const consoleMessage = `[${level.toUpperCase()}] ${message}`;
    const method = this.consoleMethods[level];

    if (method) {
      if (data) {
        method(consoleMessage, data);
      } else {
        method(consoleMessage);
      }
    }
  }

  /**
   * Écrit dans un fichier (implémentation basique)
   */
  writeToFile(logEntry) {
    // Implémentation basique - en production, utiliser un système de fichiers sécurisé
    if (typeof window !== 'undefined') {
      // Dans le navigateur, on pourrait utiliser IndexedDB ou envoyer les logs au serveur
      console.debug('File logging not implemented in browser environment');
    } else {
      // Dans Node.js, on pourrait écrire dans un fichier
      console.debug('File logging not implemented in Node.js environment');
    }
  }

  /**
   * Méthodes de logging publiques
   */
  error(message, data = null) {
    this.log('error', message, data);
  }

  warn(message, data = null) {
    this.log('warn', message, data);
  }

  info(message, data = null) {
    this.log('info', message, data);
  }

  debug(message, data = null) {
    this.log('debug', message, data);
  }

  /**
   * Méthodes spécialisées pour l'authentification
   */
  authAttempt(email, success = false, error = null) {
    const level = success ? 'info' : 'warn';
    this.log(level, `Tentative de connexion: ${email}`, {
      success,
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }

  authSuccess(profile) {
    this.log('info', 'Connexion réussie', {
      userId: profile.id,
      username: profile.username,
      timestamp: new Date().toISOString()
    });
  }

  authFailure(reason, details = null) {
    this.log('warn', `Échec de connexion: ${reason}`, {
      reason,
      details,
      timestamp: new Date().toISOString()
    });
  }

  tokenRefresh(success = true, error = null) {
    const level = success ? 'debug' : 'warn';
    this.log(level, 'Rafraîchissement de token', {
      success,
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }

  sessionExpired() {
    this.log('info', 'Session expirée', {
      timestamp: new Date().toISOString()
    });
  }

  securityEvent(event, details = null) {
    this.log('warn', `Événement de sécurité: ${event}`, {
      event,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Récupère les logs récents (pour le débogage)
   */
  getRecentLogs(count = 50) {
    return this.logs.slice(-count);
  }

  /**
   * Efface les logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Exporte les logs (pour le débogage)
   */
  exportLogs() {
    return {
      timestamp: new Date().toISOString(),
      environment: this.config.env || 'unknown',
      logs: this.logs,
      config: {
        maxLogs: this.maxLogs,
        sensitiveFields: Array.from(this.sensitiveFields)
      }
    };
  }
}

/**
 * Gestionnaire d'événements de sécurité
 */
class SecurityEventHandler {
  constructor(logger) {
    this.logger = logger;
    this.eventListeners = new Map();
  }

  /**
   * Enregistre un écouteur d'événements de sécurité
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Déclenche un événement de sécurité
   */
  emit(event, data = null) {
    this.logger.securityEvent(event, data);

    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          this.logger.error('Erreur dans l\'écouteur d\'événement de sécurité', { error: error.message });
        }
      });
    }
  }

  /**
   * Événements de sécurité prédéfinis
   */
  suspiciousActivity(details) {
    this.emit('suspicious_activity', details);
  }

  multipleFailedAttempts(details) {
    this.emit('multiple_failed_attempts', details);
  }

  tokenCompromised(details) {
    this.emit('token_compromised', details);
  }

  sessionHijackAttempt(details) {
    this.emit('session_hijack_attempt', details);
  }
}

// Créer une instance globale de logger sécurisé
const createSecureLogger = (config) => new SecureLogger(config);

// Exporter les classes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SecureLogger,
    SecurityEventHandler,
    createSecureLogger
  };
}

// Exporter pour les navigateurs
if (typeof window !== 'undefined') {
  window.SecureLogger = SecureLogger;
  window.SecurityEventHandler = SecurityEventHandler;
  window.createSecureLogger = createSecureLogger;
}
