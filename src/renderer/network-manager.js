/**
 * Système réseau robuste avec retry et backoff exponentiel
 * Pour l'authentification Eminium Launcher
 */

class NetworkManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.activeRequests = new Map();
  }

  /**
   * Effectue une requête HTTP avec retry automatique et backoff exponentiel
   */
  async request(url, options = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    // Configuration par défaut
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...this.config.security.secureHeaders
      },
      timeout: this.config.network.timeouts.request,
      retries: this.config.network.maxRetries.connection,
      retryDelay: this.config.network.timeouts.retryDelay,
      retryOn: [408, 429, 500, 502, 503, 504], // Codes d'erreur à retry
      ...options
    };

    // Ajouter le token CSRF si activé
    if (this.config.security.csrf.enabled && defaultOptions.method !== 'GET') {
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        defaultOptions.headers[this.config.security.csrf.headerName] = csrfToken;
      }
    }

    this.logger.debug('Nouvelle requête réseau', {
      requestId,
      url,
      method: defaultOptions.method,
      timeout: defaultOptions.timeout
    });

    return this.executeWithRetry(requestId, url, defaultOptions, startTime);
  }

  /**
   * Exécute une requête avec mécanisme de retry
   */
  async executeWithRetry(requestId, url, options, startTime) {
    let lastError;

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        this.logger.debug(`Tentative ${attempt + 1}/${options.retries + 1}`, {
          requestId,
          url,
          attempt: attempt + 1
        });

        const result = await this.executeRequest(url, options, requestId);

        this.logger.info('Requête réussie', {
          requestId,
          url,
          duration: Date.now() - startTime,
          attempts: attempt + 1
        });

        return result;

      } catch (error) {
        lastError = error;

        this.logger.warn(`Tentative ${attempt + 1} échouée`, {
          requestId,
          url,
          error: error.message,
          status: error.status,
          attempt: attempt + 1
        });

        // Vérifier si on doit retry
        if (attempt < options.retries && this.shouldRetry(error, options.retryOn)) {
          const delay = this.calculateDelay(attempt, options.retryDelay);

          this.logger.debug(`Retry dans ${delay}ms`, {
            requestId,
            delay,
            nextAttempt: attempt + 2
          });

          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    // Toutes les tentatives ont échoué
    this.logger.error('Toutes les tentatives de requête ont échoué', {
      requestId,
      url,
      totalAttempts: options.retries + 1,
      totalDuration: Date.now() - startTime,
      lastError: lastError.message
    });

    throw lastError;
  }

  /**
   * Exécute une requête HTTP individuelle
   */
  async executeRequest(url, options, requestId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, options.timeout);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Vérifier si la réponse est ok
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }

      // Parser la réponse JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }

    } catch (error) {
      clearTimeout(timeoutId);

      // Améliorer les messages d'erreur
      if (error.name === 'AbortError') {
        error.message = this.config.errors.network.timeout;
        error.code = 'TIMEOUT';
      } else if (!navigator.onLine) {
        error.message = this.config.errors.network.offline;
        error.code = 'OFFLINE';
      } else if (error.message.includes('fetch')) {
        error.message = this.config.errors.network.connection;
        error.code = 'NETWORK_ERROR';
      }

      throw error;
    }
  }

  /**
   * Détermine si une erreur justifie un retry
   */
  shouldRetry(error, retryOn) {
    if (error.code === 'OFFLINE' || error.code === 'TIMEOUT') {
      return true;
    }

    if (error.status && retryOn.includes(error.status)) {
      return true;
    }

    return false;
  }

  /**
   * Calcule le délai avant le prochain retry avec backoff exponentiel
   */
  calculateDelay(attempt, baseDelay) {
    const exponentialDelay = baseDelay * Math.pow(this.config.network.backoffMultiplier, attempt);

    // Ajouter du jitter si activé
    let jitter = 0;
    if (this.config.network.backoffJitter) {
      jitter = Math.random() * 0.1 * exponentialDelay; // ±10% de jitter
    }

    const totalDelay = exponentialDelay + jitter;

    // Respecter le délai maximum
    return Math.min(totalDelay, this.config.network.timeouts.maxRetryDelay);
  }

  /**
   * Génère un ID unique pour la requête
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utilitaire de pause
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Récupère le token CSRF depuis le stockage sécurisé
   */
  getCSRFToken() {
    // Cette méthode sera implémentée quand on intégrera le stockage sécurisé
    if (typeof window !== 'undefined' && window.secureStorage) {
      return window.secureStorage.getCSRFToken();
    }
    return null;
  }

  /**
   * Test de connectivité réseau
   */
  async testConnectivity() {
    const testUrl = this.config.getApiUrl('/ping') || `${this.config.settings.serverUrl}/api/auth/ping`;

    try {
      const response = await this.request(testUrl, {
        method: 'GET',
        timeout: this.config.network.timeouts.connection,
        retries: 1
      });

      this.logger.info('Test de connectivité réussi', {
        serverUrl: this.config.settings.serverUrl,
        responseTime: response.responseTime
      });

      return { ok: true, response };

    } catch (error) {
      this.logger.error('Test de connectivité échoué', {
        serverUrl: this.config.settings.serverUrl,
        error: error.message
      });

      return { ok: false, error: error.message };
    }
  }

  /**
   * Annule une requête en cours
   */
  cancelRequest(requestId) {
    // Implémentation pour annuler les requêtes si nécessaire
    this.logger.debug('Annulation de requête demandée', { requestId });
  }

  /**
   * Nettoie les ressources
   */
  cleanup() {
    this.activeRequests.clear();
  }
}

/**
 * Gestionnaire de requêtes spécialisées pour l'authentification
 */
class AuthNetworkManager extends NetworkManager {
  constructor(config, logger) {
    super(config, logger);
  }

  /**
   * Authentification utilisateur
   */
  async authenticate(email, password, twoFactorCode = null) {
    const requestBody = {
      email,
      password,
      ...(twoFactorCode && { code: twoFactorCode })
    };

    try {
      const response = await this.request(this.config.getApiUrl('/authenticate'), {
        method: 'POST',
        body: requestBody,
        retries: this.config.network.maxRetries.authentication
      });

      this.logger.authSuccess(response);
      return { ok: true, data: response };

    } catch (error) {
      this.logger.authFailure(error.message, { email });

      // Mapper les erreurs d'authentification
      if (error.status === 422) {
        return {
          ok: false,
          error: this.config.errors.authentication.invalidCredentials,
          code: 'INVALID_CREDENTIALS'
        };
      }

      if (error.status === 429) {
        return {
          ok: false,
          error: this.config.errors.authentication.tooManyAttempts,
          code: 'TOO_MANY_ATTEMPTS'
        };
      }

      return {
        ok: false,
        error: error.message || this.config.errors.network.server,
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Vérification du token d'accès
   */
  async verifyToken(accessToken) {
    try {
      const response = await this.request(this.config.getApiUrl('/verify'), {
        method: 'POST',
        body: { access_token: accessToken },
        retries: this.config.network.maxRetries.authentication
      });

      this.logger.debug('Vérification de token réussie');
      return { ok: true, data: response };

    } catch (error) {
      this.logger.warn('Échec de vérification de token', {
        error: error.message,
        status: error.status
      });

      if (error.status === 401) {
        return {
          ok: false,
          error: this.config.errors.authentication.sessionExpired,
          code: 'SESSION_EXPIRED'
        };
      }

      return {
        ok: false,
        error: error.message,
        code: 'VERIFICATION_FAILED'
      };
    }
  }

  /**
   * Déconnexion utilisateur
   */
  async logout(accessToken) {
    try {
      await this.request(this.config.getApiUrl('/logout'), {
        method: 'POST',
        body: { access_token: accessToken },
        retries: 1 // Pas besoin de retry pour la déconnexion
      });

      this.logger.info('Déconnexion réussie');
      return { ok: true };

    } catch (error) {
      this.logger.warn('Erreur lors de la déconnexion', { error: error.message });
      // La déconnexion côté serveur peut échouer, mais côté client on peut continuer
      return { ok: true, warning: 'Erreur côté serveur, mais déconnexion locale effectuée' };
    }
  }

  /**
   * Rafraîchissement du token (si supporté par l'API)
   */
  async refreshToken(refreshToken) {
    try {
      const response = await this.request(this.config.getApiUrl('/refresh'), {
        method: 'POST',
        body: { refresh_token: refreshToken },
        retries: this.config.network.maxRetries.tokenRefresh
      });

      this.logger.tokenRefresh(true);
      return { ok: true, data: response };

    } catch (error) {
      this.logger.tokenRefresh(false, error);
      return {
        ok: false,
        error: error.message,
        code: 'REFRESH_FAILED'
      };
    }
  }
}

// Exporter les classes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    NetworkManager,
    AuthNetworkManager
  };
}

// Exporter pour les navigateurs
if (typeof window !== 'undefined') {
  window.NetworkManager = NetworkManager;
  window.AuthNetworkManager = AuthNetworkManager;
}
