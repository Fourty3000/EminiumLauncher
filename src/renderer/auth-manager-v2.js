/**
 * Système d'authentification complet et sécurisé pour Eminium Launcher v2.0
 * Intègre tous les composants de sécurité et de robustesse
 */

// Vérification de l'environnement et initialisation
if (typeof window === 'undefined') {
  throw new Error('Ce module nécessite un environnement navigateur');
}

// Imports des dépendances
const { AuthConfig } = window;
const { SecureAuthStorage } = window;
const { SecureValidator } = window;
const { createSecureLogger } = window;
const { AuthNetworkManager } = window;
const { ErrorManager } = window;

// Initialisation de la configuration
const config = new AuthConfig();

// Initialisation du logger sécurisé
const logger = createSecureLogger(config.settings);

// Initialisation du stockage sécurisé
const secureStorage = new SecureAuthStorage(config.settings);

// Initialisation du validateur
const validator = new SecureValidator(config.settings);

// Initialisation du gestionnaire réseau
const networkManager = new AuthNetworkManager(config.settings, logger);

// Initialisation du gestionnaire d'erreur
const errorManager = new ErrorManager(config.settings, logger);

/**
 * Classe principale du système d'authentification
 */
class AuthManager {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
    this.sessionTimer = null;
    this.retryCount = 0;

    this.init();
  }

  /**
   * Initialise le système d'authentification
   */
  async init() {
    try {
      logger.info('Initialisation du système d\'authentification');

      // Vérifier s'il y a une session existante
      await this.checkExistingSession();

      // Démarrer le timer de vérification de session
      this.startSessionTimer();

      this.isInitialized = true;
      logger.info('Système d\'authentification initialisé avec succès');

    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du système d\'authentification', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Vérifie s'il y a une session existante
   */
  async checkExistingSession() {
    try {
      const hasValidData = await secureStorage.hasValidAuthData();

      if (hasValidData) {
        const userProfile = await secureStorage.getUserProfile();
        const accessToken = await secureStorage.getAccessToken();

        // Vérifier la validité du token
        const verification = await networkManager.verifyToken(accessToken);

        if (verification.ok) {
          this.currentUser = userProfile;
          this.emitAuthEvent('session_restored', userProfile);
          logger.info('Session existante restaurée', { userId: userProfile.id });
        } else {
          // Token invalide, nettoyer les données
          await this.logout();
        }
      }
    } catch (error) {
      logger.warn('Erreur lors de la vérification de session existante', {
        error: error.message
      });
      await this.logout();
    }
  }

  /**
   * Démarre le timer de vérification de session
   */
  startSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    this.sessionTimer = setInterval(async () => {
      await this.checkSessionValidity();
    }, config.settings.security.sessionCheckInterval);
  }

  /**
   * Vérifie la validité de la session actuelle
   */
  async checkSessionValidity() {
    if (!this.currentUser) return;

    try {
      const accessToken = await secureStorage.getAccessToken();

      if (accessToken) {
        const verification = await networkManager.verifyToken(accessToken);

        if (!verification.ok) {
          logger.info('Session expirée détectée');
          await this.logout();
          this.emitAuthEvent('session_expired');
        }
      }
    } catch (error) {
      logger.debug('Erreur lors de la vérification de session', {
        error: error.message
      });
    }
  }

  /**
   * Authentification utilisateur avec validation complète
   */
  async login(email, password, twoFactorCode = null) {
    try {
      logger.info('Début de la procédure de connexion');

      // Validation des entrées
      const validation = validator.sanitizeAndValidateInputs(email, password, twoFactorCode);

      if (!validation.valid) {
        throw errorManager.createAuthError(
          validation.error,
          'VALIDATION_ERROR',
          { email },
          ['Vérifiez le format de vos informations']
        );
      }

      const { email: cleanEmail, password: cleanPassword, twoFactorCode: cleanTwoFactorCode } = validation.values;

      // Test de connectivité réseau
      const connectivityTest = await networkManager.testConnectivity();

      if (!connectivityTest.ok) {
        throw errorManager.createAuthError(
          'Problème de connexion réseau',
          'NETWORK_ERROR',
          { email: cleanEmail },
          ['Vérifiez votre connexion internet', 'Réessayez plus tard']
        );
      }

      // Tentative d'authentification
      const authResult = await networkManager.authenticate(
        cleanEmail,
        cleanPassword,
        cleanTwoFactorCode
      );

      if (!authResult.ok) {
        const errorInfo = errorManager.handleAuthError(
          new Error(authResult.error),
          { email: cleanEmail, hasTwoFactor: !!cleanTwoFactorCode }
        );

        throw errorManager.createAuthError(
          errorInfo.error,
          errorInfo.code,
          { email: cleanEmail, hasTwoFactor: !!cleanTwoFactorCode },
          errorInfo.suggestions
        );
      }

      // Sauvegarder les données d'authentification
      const success = await secureStorage.saveAuthData({
        accessToken: authResult.data.access_token,
        userProfile: authResult.data
      });

      if (!success) {
        throw errorManager.createAuthError(
          'Erreur lors de la sauvegarde des données',
          'STORAGE_ERROR',
          { email: cleanEmail },
          ['Réessayez la connexion', 'Contactez le support si le problème persiste']
        );
      }

      // Mettre à jour l'état
      this.currentUser = authResult.data;
      this.retryCount = 0;

      logger.authSuccess(authResult.data);
      this.emitAuthEvent('login_success', authResult.data);

      return {
        success: true,
        user: authResult.data,
        requiresTwoFactor: false
      };

    } catch (error) {
      const errorInfo = errorManager.analyzeError(error, { email });

      logger.authFailure(errorInfo.code, { email });

      this.emitAuthEvent('login_failure', {
        code: errorInfo.code,
        message: errorInfo.message,
        suggestions: errorInfo.suggestions
      });

      return {
        success: false,
        error: errorInfo.message,
        code: errorInfo.code,
        suggestions: errorInfo.suggestions,
        canRetry: errorInfo.canRetry
      };
    }
  }

  /**
   * Déconnexion sécurisée
   */
  async logout() {
    try {
      logger.info('Début de la procédure de déconnexion');

      // Récupérer le token avant de nettoyer
      const accessToken = await secureStorage.getAccessToken();

      // Déconnexion côté serveur si token disponible
      if (accessToken) {
        await networkManager.logout(accessToken);
      }

      // Nettoyer les données locales
      await secureStorage.clearAuthData();

      // Nettoyer le timer de session
      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
      }

      // Réinitialiser l'état
      const previousUser = this.currentUser;
      this.currentUser = null;
      this.retryCount = 0;

      logger.info('Déconnexion réussie');
      this.emitAuthEvent('logout_success', { previousUser });

      return { success: true };

    } catch (error) {
      logger.error('Erreur lors de la déconnexion', { error: error.message });

      // Même en cas d'erreur, nettoyer les données locales
      await secureStorage.clearAuthData();
      this.currentUser = null;

      this.emitAuthEvent('logout_success', { forced: true });

      return {
        success: true,
        warning: 'Erreur côté serveur, mais déconnexion locale effectuée'
      };
    }
  }

  /**
   * Récupère l'utilisateur actuellement connecté
   */
  async getCurrentUser() {
    if (!this.isInitialized) {
      await this.init();
    }

    return this.currentUser;
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  async isAuthenticated() {
    if (!this.isInitialized) {
      await this.init();
    }

    return this.currentUser !== null;
  }

  /**
   * Système d'événements pour l'interface utilisateur
   */
  emitAuthEvent(event, data = null) {
    const eventData = {
      type: event,
      timestamp: new Date().toISOString(),
      data
    };

    // Émettre un événement DOM personnalisé
    if (typeof window !== 'undefined' && window.CustomEvent) {
      const customEvent = new CustomEvent('authEvent', { detail: eventData });
      window.dispatchEvent(customEvent);
    }

    // Logger l'événement
    logger.debug(`Événement d'authentification: ${event}`, eventData);
  }

  /**
   * Gestionnaire d'événements pour l'interface
   */
  addAuthEventListener(event, callback) {
    if (typeof window !== 'undefined') {
      const handler = (e) => {
        if (e.detail && e.detail.type === event) {
          callback(e.detail.data, e.detail);
        }
      };

      window.addEventListener('authEvent', handler);

      // Retourner une fonction de nettoyage
      return () => {
        window.removeEventListener('authEvent', handler);
      };
    }

    return () => {};
  }

  /**
   * Nettoie les ressources
   */
  cleanup() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }

    networkManager.cleanup();
    logger.clearLogs();
  }
}

// Créer une instance globale
let authManagerInstance = null;

/**
 * Fonction pour obtenir l'instance du gestionnaire d'authentification
 */
function getAuthManager() {
  if (!authManagerInstance) {
    authManagerInstance = new AuthManager();
  }
  return authManagerInstance;
}

/**
 * Fonctions d'API publiques pour la compatibilité
 */

// Fonction de connexion principale (compatibilité avec l'API existante)
async function performLogin(email, password, twoFactorCode = null, options = {}) {
  const authManager = getAuthManager();

  const result = await authManager.login(email, password, twoFactorCode);

  if (result.success && options.onSuccess) {
    options.onSuccess(result.user);
  } else if (!result.success && options.onError) {
    options.onError(result);
  }

  return result.success ? result.user : null;
}

// Fonction de déconnexion (compatibilité avec l'API existante)
async function performLogout() {
  const authManager = getAuthManager();
  return await authManager.logout();
}

// Fonction pour vérifier l'état d'authentification (compatibilité)
async function checkAuthStatus() {
  const authManager = getAuthManager();
  const isAuthenticated = await authManager.isAuthenticated();
  const currentUser = await authManager.getCurrentUser();

  return {
    isAuthenticated,
    user: currentUser
  };
}

// Fonction pour écouter les événements d'authentification
function onAuthEvent(event, callback) {
  const authManager = getAuthManager();
  return authManager.addAuthEventListener(event, callback);
}

// Exporter les fonctions pour la compatibilité
window.performLogin = performLogin;
window.performLogout = performLogout;
window.checkAuthStatus = checkAuthStatus;
window.onAuthEvent = onAuthEvent;
window.getAuthManager = getAuthManager;

// Initialiser automatiquement si le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    getAuthManager();
  });
} else {
  getAuthManager();
}

logger.info('Module d\'authentification v2.0 chargé avec succès');
