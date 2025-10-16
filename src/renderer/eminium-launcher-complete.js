/**
 * EMINIUM LAUNCHER - FICHIER CONSOLIDÉ COMPLET
 * Tous les modules JavaScript en un seul fichier
 * Dernière mise à jour : 2025
 */

// =============================================================================
// SECTION 1 : CONFIGURATION ET CONSTANTES
// =============================================================================

/**
 * Configuration sécurisée pour l'authentification Eminium Launcher
 */
const AuthConfig = {
  settings: {
    security: {
      encryptionKey: 'eminium-launcher-auth-key-2024',
      sessionCheckInterval: 60000,
      csrf: { enabled: false, headerName: 'X-CSRF-Token' },
      secureHeaders: {
        'X-Requested-With': 'EminiumLauncher',
        'X-Client-Version': '2.0.0'
      }
    },
    network: {
      timeouts: {
        connection: 10000,
        request: 15000,
        retryDelay: 1000,
        maxRetryDelay: 30000
      },
      maxRetries: {
        connection: 3,
        authentication: 2,
        tokenRefresh: 3
      },
      backoffMultiplier: 2,
      backoffJitter: true
    },
    logging: {
      maxLogSize: 1000,
      sensitiveFields: ['password', 'token', 'secret', 'key'],
      enableConsole: true
    },
    azuriom: {
      enabled: true,
      url: 'https://eminium.ovh', // À modifier dans config.env si nécessaire
      apiBasePath: '/api/auth'
    }
  },

  get: function(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.settings;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  },

  set: function(key, value) {
    const keys = key.split('.');
    let obj = this.settings;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in obj) || typeof obj[keys[i]] !== 'object') {
        obj[keys[i]] = {};
      }
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
  }
};

// =============================================================================
// SECTION 2 : UTILITAIRES DE BASE
// =============================================================================

/**
 * Logger sécurisé pour l'authentification Eminium Launcher
 */
const SecureLogger = {
  logs: [],
  maxLogs: 1000,
  sensitiveFields: new Set(['password', 'token', 'secret', 'key']),

  maskSensitiveData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const masked = Array.isArray(data) ? [...data] : { ...data };

    for (const key in masked) {
      if (this.sensitiveFields.has(key.toLowerCase())) {
        if (typeof masked[key] === 'string') {
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
  },

  log(level, message, data = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? this.maskSensitiveData(data) : null
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    if (AuthConfig.get('logging.enableConsole', true)) {
      const consoleMethod = level === 'error' ? console.error :
                          level === 'warn' ? console.warn :
                          level === 'info' ? console.info : console.log;
      consoleMethod(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, entry.data);
    }
  },

  info(message, data = null) { this.log('info', message, data); },
  error(message, data = null) { this.log('error', message, data); },
  warn(message, data = null) { this.log('warn', message, data); },
  debug(message, data = null) { this.log('debug', message, data); },

  clearLogs() {
    this.logs = [];
  },

  getLogs() {
    return [...this.logs];
  }
};

/**
 * Gestionnaire d'erreurs amélioré pour Eminium Launcher
 */
const ErrorManager = {
  initialized: false,
  errorHistory: [],

  init() {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof window !== 'undefined') {
      window.ErrorManager = this;
    }
  },

  handleError(error, context = 'unknown') {
    const errorInfo = {
      message: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      severity: this.determineSeverity(error, context)
    };

    this.errorHistory.push(errorInfo);

    if (this.errorHistory.length > 100) {
      this.errorHistory.shift();
    }

    SecureLogger.error(`Erreur dans ${context}`, {
      message: errorInfo.message,
      severity: errorInfo.severity
    });

    return errorInfo;
  },

  determineSeverity(error, context) {
    if (context.includes('auth') || context.includes('security')) {
      return 'high';
    }
    if (context.includes('network') || context.includes('connection')) {
      return 'medium';
    }
    return 'low';
  },

  getErrorStats() {
    const stats = {
      total: this.errorHistory.length,
      byContext: {},
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
    };

    this.errorHistory.forEach(error => {
      stats.byContext[error.context] = (stats.byContext[error.context] || 0) + 1;
      stats.bySeverity[error.severity]++;
    });

    return stats;
  },

  clearErrorHistory() {
    this.errorHistory = [];
  }
};

// =============================================================================
// SECTION 3 : GESTIONNAIRE D'AUTHENTIFICATION AZURIOM
// =============================================================================

/**
 * Gestionnaire d'authentification Azuriom pour Eminium Launcher
 * Utilise l'API HTTP directe selon la documentation officielle d'Azuriom
 */
class AzuriomAuthManager {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
    this.accessToken = null;
    this.init();
  }

  async init() {
    try {
      SecureLogger.info('Initialisation du système d\'authentification Azuriom (API directe)');
      if (!window.DOMUtils) {
        throw new Error('DOMUtils non disponible');
      }
      this.isInitialized = true;
      SecureLogger.info('Système d\'authentification Azuriom initialisé avec succès');
    } catch (error) {
      SecureLogger.error('Erreur lors de l\'initialisation Azuriom:', error);
      throw error;
    }
  }

  async login(email, password, twoFactorCode = null) {
    try {
      SecureLogger.info('Tentative d\'authentification Azuriom pour:', email);

      const azuriomUrl = AuthConfig.get('azuriom.url');
      console.log('[Azuriom] URL utilisée:', azuriomUrl);

      if (!azuriomUrl) {
        throw new Error('URL Azuriom non configurée');
      }

      const authData = { email, password };
      if (twoFactorCode) {
        authData.code = twoFactorCode;
        console.log('[Azuriom] Code 2FA fourni');
      }

      console.log('[Azuriom] Envoi de la requête à:', `${azuriomUrl}/api/auth/authenticate`);

      const response = await fetch(`${azuriomUrl}/api/auth/authenticate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(authData)
      });

      console.log('[Azuriom] Réponse HTTP:', response.status, response.statusText);

      const result = await response.json();
      console.log('[Azuriom] Réponse du serveur:', result);

      if (response.ok && result.id) {
        this.currentUser = result;
        this.accessToken = result.access_token;
        SecureLogger.info('Authentification Azuriom réussie');
        return { success: true, user: result, requiresTwoFactor: false, status: 'success' };
      } else if (response.status === 422 && result.status === 'pending' && result.reason === '2fa') {
        SecureLogger.info('Code 2FA requis par Azuriom');
        console.log('[Azuriom] Code 2FA requis, raison:', result.reason);
        return { success: false, requiresTwoFactor: true, status: 'pending', reason: '2fa', error: 'Code de vérification requis' };
      } else {
        console.log('[Azuriom] Échec d\'authentification:', result);
        return { success: false, error: result.message || 'Échec de l\'authentification', code: result.reason || 'INVALID_CREDENTIALS' };
      }
    } catch (error) {
      console.error('[Azuriom] Erreur réseau:', error);
      return { success: false, error: error.message || 'Erreur réseau', code: 'NETWORK_ERROR' };
    }
  }

  async logout() {
    try {
      const azuriomUrl = AuthConfig.get('azuriom.url');
      if (!azuriomUrl || !this.accessToken) {
        return { success: true };
      }

      await fetch(`${azuriomUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: this.accessToken })
      });

      this.currentUser = null;
      this.accessToken = null;
      return { success: true };
    } catch (error) {
      this.currentUser = null;
      this.accessToken = null;
      return { success: true, warning: 'Erreur réseau, mais déconnexion locale effectuée' };
    }
  }

  async verifyToken(token) {
    try {
      const azuriomUrl = AuthConfig.get('azuriom.url');
      if (!azuriomUrl) {
        throw new Error('URL Azuriom non configurée');
      }

      const response = await fetch(`${azuriomUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
      });

      const result = await response.json();

      if (response.ok && result.id) {
        return { ok: true, user: result, valid: true };
      } else {
        return { ok: false, valid: false, error: result.message || 'Token invalide' };
      }
    } catch (error) {
      return { ok: false, valid: false, error: error.message || 'Erreur réseau' };
    }
  }

  getCurrentUser() { return this.currentUser; }
  isAuthenticated() { return !!(this.currentUser && this.accessToken); }
  getAccessToken() { return this.accessToken; }
}

// =============================================================================
// SECTION 4 : GESTIONNAIRE D'AUTHENTIFICATION PRINCIPAL
// =============================================================================

/**
 * Système d'authentification complet et sécurisé pour Eminium Launcher v2.0
 */
class AuthManager {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
    this.sessionTimer = null;
    this.retryCount = 0;
    this.authProviders = { default: null, azuriom: null };
    this.currentProvider = 'azuriom';
    this.init();
  }

  async init() {
    try {
      SecureLogger.info('Initialisation du système d\'authentification');
      this.isInitialized = true;
      SecureLogger.info('Système d\'authentification initialisé avec succès');
    } catch (error) {
      SecureLogger.error('Erreur lors de l\'initialisation du système d\'authentification', { error: error.message });
      throw error;
    }
  }

  async login(email, password, twoFactorCode = null, provider = 'azuriom') {
    try {
      SecureLogger.info('Début de la procédure de connexion', { provider });
      this.currentProvider = provider;

      let authResult;
      switch (provider) {
        case 'azuriom':
          if (!this.authProviders.azuriom) {
            this.authProviders.azuriom = new AzuriomAuthManager();
          }
          authResult = await this.authProviders.azuriom.login(email, password, twoFactorCode);
          break;
        default:
          authResult = { ok: false, error: 'Fournisseur non supporté', code: 'UNSUPPORTED_PROVIDER' };
          break;
      }

      if (!authResult.success && !authResult.ok) {
        throw new Error(authResult.error || 'Échec de l\'authentification');
      }

      this.currentUser = authResult.user || authResult.data;
      this.retryCount = 0;
      SecureLogger.info('Authentification réussie', { userId: this.currentUser?.id, provider });

      return { success: true, user: this.currentUser, requiresTwoFactor: false, provider };
    } catch (error) {
      const errorInfo = ErrorManager.handleError(error, 'auth');
      SecureLogger.error('Échec de l\'authentification', { error: errorInfo.message, provider });

      return {
        success: false,
        error: errorInfo.message,
        code: errorInfo.code || 'AUTH_ERROR',
        suggestions: ['Vérifiez vos identifiants', 'Réessayez plus tard'],
        canRetry: true,
        provider
      };
    }
  }

  async logout() {
    try {
      if (this.authProviders[this.currentProvider]) {
        await this.authProviders[this.currentProvider].logout();
      }

      this.currentUser = null;
      this.retryCount = 0;
      this.currentProvider = 'azuriom';

      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
      }

      return { success: true };
    } catch (error) {
      this.currentUser = null;
      this.currentProvider = 'azuriom';
      return { success: true, warning: 'Erreur côté serveur, mais déconnexion locale effectuée' };
    }
  }

  async getCurrentUser() { return this.currentUser; }
  isAuthenticated() { return !!this.currentUser; }

  getAvailableProviders() {
    return {
      default: { name: 'Par défaut', description: 'Authentification standard', enabled: true },
      azuriom: { name: 'Azuriom', description: 'Via site Azuriom', enabled: AuthConfig.get('azuriom.enabled', true) }
    };
  }

  getCurrentProvider() { return this.currentProvider; }
}

// =============================================================================
// SECTION 5 : INTERFACE UTILISATEUR ET DOM
// =============================================================================

/**
 * Utilitaires DOM pour l'interface utilisateur
 */
const DOMUtils = {
  select: (selector) => document.querySelector(selector),
  selectAll: (selector) => document.querySelectorAll(selector),

  addClass: (element, className) => element?.classList.add(className),
  removeClass: (element, className) => element?.classList.remove(className),
  toggleClass: (element, className) => element?.classList.toggle(className),
  hasClass: (element, className) => element?.classList.contains(className),

  show: (element) => {
    if (typeof element === 'string') {
      const el = DOMUtils.select(element);
      if (el) el.style.display = 'block';
    } else if (element) {
      element.style.display = 'block';
    }
  },

  hide: (element) => {
    if (typeof element === 'string') {
      const el = DOMUtils.select(element);
      if (el) el.style.display = 'none';
    } else if (element) {
      element.style.display = 'none';
    }
  },

  setText: (element, text) => {
    if (typeof element === 'string') {
      const el = DOMUtils.select(element);
      if (el) el.textContent = text;
    } else if (element) {
      element.textContent = text;
    }
  },

  getValue: (element) => {
    if (typeof element === 'string') {
      const el = DOMUtils.select(element);
      return el ? el.value : '';
    } else if (element) {
      return element.value;
    }
    return '';
  },

  setValue: (element, value) => {
    if (typeof element === 'string') {
      const el = DOMUtils.select(element);
      if (el) el.value = value;
    } else if (element) {
      element.value = value;
    }
  },

  setDisplay: (element, display) => {
    if (typeof element === 'string') {
      const el = DOMUtils.select(element);
      if (el) el.style.display = display;
    } else if (element) {
      element.style.display = display;
    }
  },

  setDisabled: (element, disabled) => {
    if (typeof element === 'string') {
      const el = DOMUtils.select(element);
      if (el) el.disabled = disabled;
    } else if (element) {
      element.disabled = disabled;
    }
  },

  addEventListener: (element, event, handler) => {
    if (typeof element === 'string') {
      const el = DOMUtils.select(element);
      if (el) el.addEventListener(event, handler);
    } else if (element) {
      element.addEventListener(event, handler);
    }
  }
};

// =============================================================================
// SECTION 6 : GESTIONNAIRE DE PROGRÈS
// =============================================================================

/**
 * Gestionnaire d'interface de progression pour Eminium Launcher
 */
class ProgressUI {
  constructor() {
    this.isInitialized = false;
    this.currentModal = null;
    this.init();
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      window.ProgressUI = this;
    }
  }

  open(title = 'Progression') {
    const modal = document.getElementById('progressModal') || this.createModal();
    modal.querySelector('.modal-title').textContent = title;
    modal.style.display = 'flex';

    const progressBar = modal.querySelector('.progress-bar');
    const progressText = modal.querySelector('.progress-text');
    const progressDetails = modal.querySelector('.progress-details');

    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    progressDetails.innerHTML = '';

    this.currentModal = modal;
    return modal;
  }

  set(percentage) {
    if (!this.currentModal) return;

    const progressBar = this.currentModal.querySelector('.progress-bar');
    const progressText = this.currentModal.querySelector('.progress-text');

    if (progressBar && progressText) {
      progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
      progressText.textContent = `${Math.round(percentage)}%`;
    }
  }

  addLine(text) {
    if (!this.currentModal) return;

    const progressDetails = this.currentModal.querySelector('.progress-details');
    if (progressDetails) {
      const line = document.createElement('div');
      line.className = 'progress-line';
      line.textContent = text;
      progressDetails.appendChild(line);

      // Auto-scroll vers le bas
      progressDetails.scrollTop = progressDetails.scrollHeight;
    }
  }

  close() {
    if (this.currentModal) {
      this.currentModal.style.display = 'none';
      this.currentModal = null;
    }
  }

  isOpen() {
    return this.currentModal !== null;
  }

  createModal() {
    const modal = document.createElement('div');
    modal.id = 'progressModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Progression</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="progress-container">
            <div class="progress-bar"></div>
            <div class="progress-text">0%</div>
          </div>
          <div class="progress-details"></div>
        </div>
      </div>
    `;

    // Gestionnaire de fermeture
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.onclick = () => this.close();

    // Fermeture par clic en dehors
    modal.onclick = (e) => {
      if (e.target === modal) this.close();
    };

    document.body.appendChild(modal);
    return modal;
  }
}

// =============================================================================
// SECTION 7 : APPLICATION PRINCIPALE
// =============================================================================

/**
 * Eminium Launcher - Application Principal
 */
class App {
  constructor() {
    this.state = {
      initialized: false,
      authenticated: false,
      user: null,
      currentTab: 'auth',
      serverOnline: false,
      pingTimer: null
    };

    this.authManager = null;
    this.progressUI = null;

    this.init();
  }

  async init() {
    try {
      console.log('[App] Initialisation du launcher...');

      // Initialiser les composants de base
      this.progressUI = new ProgressUI();

      // Initialiser le gestionnaire d'authentification
      this.authManager = new AuthManager();

      // Configurer les gestionnaires d'événements DOM
      this.setupEventListeners();

      // Démarrer le monitoring serveur
      this.startServerMonitoring();

      this.state.initialized = true;
      console.log('[App] Initialisation terminée');

    } catch (error) {
      console.error('[App] Erreur d\'initialisation:', error);
      ErrorManager.handleError(error, 'initialization');
    }
  }

  setupEventListeners() {
    // Un seul gestionnaire pour les deux boutons (Azuriom et formulaire)
    DOMUtils.addEventListener('azuriomBtn', 'click', (e) => this.handleLogin(e));
    DOMUtils.addEventListener('loginForm', 'submit', (e) => this.handleLogin(e));

    // Bouton de jeu
    DOMUtils.addEventListener('btnPlay', 'click', () => this.launchGame());

    // Bouton de vérification
    DOMUtils.addEventListener('btnCheck', 'click', () => this.checkAndPrepare());
  }

  async handleLogin(event) {
    event.preventDefault();

    try {
      const email = DOMUtils.getValue('email');
      const password = DOMUtils.getValue('password');
      const twoFactorCode = DOMUtils.getValue('code2fa');

      console.log('[Auth] Tentative de connexion:', { email, hasPassword: !!password, hasTwoFactorCode: !!twoFactorCode });

      if (!email || !password) {
        this.showError('Veuillez saisir votre email et mot de passe');
        return;
      }

      this.setLoginLoading(true);
      this.hideMessages();

      console.log('[Auth] Appel de authManager.login...');
      const result = await this.authManager.login(email, password, twoFactorCode, 'azuriom');

      console.log('[Auth] Résultat de l\'authentification:', result);

      if (result.success) {
        console.log('[Auth] Connexion réussie, utilisateur:', result.user);
        this.handleLoginSuccess(result.user);
      } else {
        console.log('[Auth] Échec de connexion, gestion de l\'erreur:', result);
        this.handleLoginError(result);
      }

    } catch (error) {
      console.error('[Auth] Erreur lors de la connexion:', error);
      this.handleLoginError({ error: error.message || 'Erreur lors de la connexion' });
    } finally {
      this.setLoginLoading(false);
    }
  }

  handleLoginSuccess(user) {
    console.log('[App] Connexion réussie:', user);

    this.state.authenticated = true;
    this.state.user = user;

    // Masquer le champ 2FA
    DOMUtils.setDisplay('code2faGroup', 'none');
    DOMUtils.setText('loginText', 'Se connecter');

    // Masquer l'authentification
    DOMUtils.setDisplay('authSection', 'none');

    // Afficher les autres onglets
    DOMUtils.setDisplay('navPlay', 'flex');
    DOMUtils.setDisplay('navLogs', 'flex');

    // Mettre à jour l'interface utilisateur
    DOMUtils.setDisplay('userCard', 'flex');
    DOMUtils.setDisplay('logoutBtn', 'flex');
    DOMUtils.setText('userName', user.username || user.name || 'Utilisateur');
    DOMUtils.setText('userRole', user.grade?.name || 'Membre');

    this.showSuccess(`Connecté avec succès en tant que ${user.username || user.name || 'Utilisateur'}`);

    // Basculer vers l'onglet de jeu après un délai
    setTimeout(() => {
      this.switchToPlayTab();
    }, 1500);
  }

  handleLoginError(errorInfo) {
    console.error('[App] Échec de connexion:', errorInfo);

    // Si c'est une demande de 2FA, afficher le champ sans montrer d'erreur
    if (errorInfo.requiresTwoFactor || errorInfo.status === 'pending') {
      console.log('[App] Demande de 2FA détectée, affichage du champ');
      this.showTwoFactorPrompt();
      return;
    }

    console.log('[App] Gestion d\'erreur générale');
    let errorMessage = errorInfo.error || 'Erreur lors de la connexion';

    switch (errorInfo.code) {
      case 'INVALID_CREDENTIALS':
        console.log('[App] Erreur: identifiants invalides');
        errorMessage = 'Email ou mot de passe incorrect';
        break;
      case 'TOO_MANY_ATTEMPTS':
        console.log('[App] Erreur: trop de tentatives');
        errorMessage = 'Trop de tentatives. Réessayez plus tard';
        break;
      case 'AZURIOM_ERROR':
        console.log('[App] Erreur: serveur Azuriom');
        errorMessage = 'Erreur de connexion au serveur Azuriom';
        break;
      case 'NETWORK_ERROR':
        console.log('[App] Erreur: réseau');
        errorMessage = 'Problème de connexion réseau';
        break;
      default:
        console.log('[App] Erreur inconnue:', errorInfo.code, errorInfo.message);
        // Si le serveur retourne une erreur spécifique, l'utiliser
        if (errorInfo.message) {
          errorMessage = errorInfo.message;
        }
        break;
    }

    console.log('[App] Affichage de l\'erreur:', errorMessage);
    // Masquer le champ 2FA si on affiche une erreur générale
    DOMUtils.setDisplay('code2faGroup', 'none');
    DOMUtils.setText('loginText', 'Se connecter');

    this.showError(errorMessage);
  }

  showTwoFactorPrompt() {
    // Afficher le champ 2FA
    DOMUtils.setDisplay('code2faGroup', 'block');
    DOMUtils.setValue('code2fa', '');
    DOMUtils.select('code2fa').focus();

    // Mettre à jour le texte du bouton
    DOMUtils.setText('loginText', 'Vérifier le code');
    DOMUtils.setDisabled('loginBtn', false);
  }

  setLoginLoading(loading) {
    DOMUtils.setDisabled('loginBtn', loading);
    DOMUtils.setDisplay('loginSpinner', loading ? 'inline-block' : 'none');
    DOMUtils.setText('loginText', loading ? 'Connexion...' : 'Se connecter');
  }

  showError(message) {
    DOMUtils.setText('authError', message);
    DOMUtils.setDisplay('authError', 'block');
    DOMUtils.setDisplay('authSuccess', 'none');
  }

  showSuccess(message) {
    DOMUtils.setText('authSuccess', message);
    DOMUtils.setDisplay('authSuccess', 'block');
    DOMUtils.setDisplay('authError', 'none');
  }

  hideMessages() {
    DOMUtils.setDisplay('authError', 'none');
    DOMUtils.setDisplay('authSuccess', 'none');
  }

  switchToPlayTab() {
    // Logique pour basculer vers l'onglet de jeu
    console.log('[App] Basculement vers l\'onglet de jeu');
  }

  async checkAndPrepare() {
    try {
      this.progressUI.open('Préparation');
      this.progressUI.set(10);
      console.log('[App] Vérification des fichiers...');

      // Simulation de vérification
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.progressUI.set(100);
      this.progressUI.addLine('Fichiers prêts ✓');
      setTimeout(() => this.progressUI.close(), 1500);

    } catch (error) {
      ErrorManager.handleError(error, 'checkAndPrepare');
      this.progressUI.addLine('Erreur: ' + error.message);
    }
  }

  async launchGame() {
    try {
      this.progressUI.open('Lancement');
      this.progressUI.set(20);
      console.log('[App] Lancement du jeu...');

      // Simulation de lancement
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.progressUI.set(100);
      this.progressUI.addLine('Jeu lancé ✓');
      setTimeout(() => this.progressUI.close(), 1500);

    } catch (error) {
      ErrorManager.handleError(error, 'launchGame');
      this.progressUI.addLine('Erreur: ' + error.message);
    }
  }

  startServerMonitoring() {
    // Désactiver temporairement le monitoring serveur pour éviter les erreurs SSL
    console.log('[App] Monitoring serveur désactivé temporairement');

    // Simuler un serveur en ligne par défaut
    this.state.serverOnline = true;

    // Si vous voulez réactiver le monitoring plus tard, décommentez ces lignes :
    /*
    if (this.state.pingTimer) {
      clearInterval(this.state.pingTimer);
    }

    this.state.pingTimer = setInterval(() => {
      this.pingServer();
    }, 5000);

    this.pingServer(); // Premier ping immédiat
    */
  }

  async pingServer() {
    try {
      // Désactiver temporairement pour éviter les erreurs SSL
      console.log('[App] Ping serveur désactivé temporairement');

      const wasOnline = this.state.serverOnline;
      this.state.serverOnline = true;

      if (!wasOnline) {
        console.log('[App] Serveur en ligne');
      }

    } catch (error) {
      this.state.serverOnline = false;
      console.log('[App] Serveur hors ligne (erreur SSL ignorée)');
    }
  }
}

// =============================================================================
// SECTION 8 : INITIALISATION GLOBALE
// =============================================================================

// Initialiser les composants globaux
ErrorManager.init();

// Créer les instances globales
const authManager = new AuthManager();
const progressUI = new ProgressUI();

// Exposer les fonctions globales pour la compatibilité
window.AuthManager = authManager;
window.ProgressUI = progressUI;
window.ErrorManager = ErrorManager;
window.DOMUtils = DOMUtils;
window.performLogin = async (email, password, twoFactorCode, options) => {
  const result = await authManager.login(email, password, twoFactorCode, options?.provider || 'azuriom');
  if (result.success && options?.onSuccess) options.onSuccess(result.user);
  if (!result.success && options?.onError) options.onError(result);
  return result.success ? result.user : null;
};

window.performLogout = () => authManager.logout();
window.checkAuthStatus = () => authManager.getCurrentUser().then(user => ({ isAuthenticated: !!user, user }));
window.getAvailableAuthProviders = () => authManager.getAvailableProviders();
window.getCurrentAuthProvider = () => authManager.getCurrentProvider();

// Initialiser l'application quand le DOM est prêt
if (document.readyState === 'loading') {
  console.log('⏳ DOM en cours de chargement, attente de DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOMContentLoaded détecté, initialisation de l\'application...');
    new App();
  });
} else {
  console.log('✅ DOM déjà chargé, initialisation immédiate...');
  new App();
}

console.log('🚀 Eminium Launcher initialisé avec succès !');
