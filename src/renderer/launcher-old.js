/**
 * EMINIUM LAUNCHER - VERSION COMPLÈTE ET FONCTIONNELLE
 * Launcher Minecraft avec authentification Azuriom
 * Version simplifiée et robuste
 */

// Configuration
const CONFIG = {
  AZURIOM_URL: 'https://eminium.ovh',
  DEBUG: true
};

// =============================================================================
// OUTILS DE BASE
// =============================================================================

const DOM = {
  select: (selector) => document.querySelector(selector),
  setText: (id, text) => {
    const el = DOM.select(`#${id}`);
    if (el) el.textContent = text;
  },
  setDisplay: (id, display) => {
    const el = DOM.select(`#${id}`);
    if (el) el.style.display = display;
  },
  getValue: (id) => {
    const el = DOM.select(`#${id}`);
    return el ? el.value : '';
  },
  setValue: (id, value) => {
    const el = DOM.select(`#${id}`);
    if (el) el.value = value;
  },
  addClick: (id, handler) => {
    const el = DOM.select(`#${id}`);
    if (el) el.addEventListener('click', handler);
  },
  addSubmit: (id, handler) => {
    const el = DOM.select(`#${id}`);
    if (el) el.addEventListener('submit', handler);
  }
};

// =============================================================================
// LOGGER
// =============================================================================

const Logger = {
  log: (message, data) => {
    if (CONFIG.DEBUG) {
      console.log(`[${new Date().toLocaleTimeString()}] ${message}`, data || '');
    }
  },
  error: (message, error) => {
    console.error(`[${new Date().toLocaleTimeString()}] ERROR: ${message}`, error || '');
  }
};

// =============================================================================
// AUTHENTIFICATION AZURIOM
// =============================================================================

class AzuriomAuth {
  async login(email, password, twoFactorCode = null) {
    Logger.log('Tentative d\'authentification Azuriom', { email, hasTwoFactorCode: !!twoFactorCode });

    try {
      const data = { email, password };
      if (twoFactorCode && twoFactorCode.trim()) {
        data.code = twoFactorCode.trim();
        Logger.log('Code 2FA fourni dans la requête');
      }

      Logger.log('Envoi de la requête à Azuriom', { url: `${CONFIG.AZURIOM_URL}/api/auth/authenticate` });

      // Créer une Promise avec timeout pour éviter les blocages
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 secondes timeout

      let response, result;

      try {
        response = await fetch(`${CONFIG.AZURIOM_URL}/api/auth/authenticate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'EminiumLauncher/1.0'
          },
          body: JSON.stringify(data),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        Logger.log('Réponse HTTP reçue', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        result = await response.json();
        Logger.log('Corps de la réponse', result);

      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          Logger.error('Timeout de la requête d\'authentification');
          return { success: false, error: 'Timeout - Le serveur met trop de temps à répondre', code: 'TIMEOUT' };
        }

        Logger.error('Erreur réseau lors de l\'authentification', fetchError);
        return { success: false, error: 'Erreur de connexion réseau', code: 'NETWORK_ERROR' };
      }

      // Vérifier différents formats de réponse 2FA selon la documentation Azuriom
      if (response.ok && result.id && result.access_token) {
        Logger.log('Authentification réussie', { userId: result.id, username: result.username });
        return { success: true, user: result };
      }

      // Format 1: Réponse 422 avec status "pending" et reason "2fa"
      if (response.status === 422 && result.status === 'pending' && result.reason === '2fa') {
        Logger.log('Format 2FA détecté (status pending, reason 2fa)');
        return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis', status: 'pending', reason: '2fa' };
      }

      // Format 2: Réponse avec message contenant "2fa" ou "code"
      if (result.message && (result.message.toLowerCase().includes('2fa') || result.message.toLowerCase().includes('code'))) {
        Logger.log('Format 2FA détecté dans le message');
        return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis', message: result.message };
      }

      // Format 3: Réponse 401 avec demande de 2FA
      if (response.status === 401 && result.require_2fa) {
        Logger.log('Format 2FA détecté (require_2fa)');
        return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis' };
      }

      Logger.log('Échec d\'authentification standard', result);
      return {
        success: false,
        error: result.message || `Erreur HTTP ${response.status}: ${response.statusText}`,
        code: result.reason || `HTTP_${response.status}`
      };

    } catch (error) {
      Logger.error('Erreur générale lors de l\'authentification', error);
      return { success: false, error: 'Erreur de connexion réseau', code: 'NETWORK_ERROR' };
    }
  }

  async logout(token) {
    if (!token) return { success: true };

    try {
      await fetch(`${CONFIG.AZURIOM_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token })
      });
      return { success: true };
    } catch (error) {
      Logger.error('Erreur déconnexion', error);
      return { success: true };
    }
  }
}

// =============================================================================
// INTERFACE UTILISATEUR
// =============================================================================

class UI {
  constructor() {
    this.auth = new AzuriomAuth();
    this.isLoading = false;
    this.currentUser = null;
    this.init();
  }

  init() {
    Logger.log('Initialisation de l\'interface');
    this.setupEvents();
    this.checkExistingSession();
  }

  setupEvents() {
    Logger.log('Configuration des événements');

    DOM.addClick('azuriomBtn', (e) => this.handleLogin(e));
    DOM.addSubmit('loginForm', (e) => this.handleLogin(e));

    DOM.addClick('logoutBtn', () => this.logout());

    Logger.log('Événements configurés');
  }

  async handleLogin(event) {
    Logger.log('Gestionnaire de connexion appelé');
    event.preventDefault();

    if (this.isLoading) {
      Logger.log('Connexion déjà en cours, ignorée');
      return;
    }

    const email = DOM.getValue('email');
    const password = DOM.getValue('password');
    const twoFactorCode = DOM.getValue('code2fa');

    Logger.log('Données saisies', {
      email,
      hasPassword: !!password,
      hasTwoFactor: !!twoFactorCode,
      isTwoFactorVisible: DOM.select('#code2faGroup')?.style.display === 'block'
    });

    if (!email || !password) {
      this.showError('Veuillez saisir votre email et mot de passe');
      return;
    }

    this.setLoading(true);
    this.hideMessages();

    try {
      const result = await this.auth.login(email, password, twoFactorCode);
      Logger.log('Résultat authentification', result);

      if (result.success) {
        this.handleLoginSuccess(result.user);
      } else if (result.requiresTwoFactor) {
        Logger.log('Code 2FA requis, affichage du champ');
        this.showTwoFactorPrompt();
      } else {
        Logger.log('Échec d\'authentification', result.error);
        this.showError(result.error || 'Erreur de connexion');
        this.resetTwoFactorState();
      }
    } catch (error) {
      Logger.error('Erreur lors de la connexion', error);
      this.showError('Erreur de connexion réseau');
      this.resetTwoFactorState();
    } finally {
      this.setLoading(false);
    }
  }

  handleLoginSuccess(user) {
    Logger.log('Connexion réussie', user);
    this.currentUser = user;

    // Masquer complètement le champ 2FA lors du succès
    this.resetTwoFactorState();

    // Masquer l'authentification
    DOM.setDisplay('authSection', 'none');

    // Afficher les autres onglets
    DOM.setDisplay('navPlay', 'flex');
    DOM.setDisplay('navLogs', 'flex');

    // Mettre à jour l'interface utilisateur
    DOM.setDisplay('userCard', 'flex');
    DOM.setDisplay('logoutBtn', 'flex');
    DOM.setText('userName', user.username || user.name || 'Utilisateur');
    DOM.setText('userRole', user.grade?.name || 'Membre');

    this.showSuccess(`Connecté en tant que ${user.username || user.name || 'Utilisateur'}`);
  }

  showTwoFactorPrompt() {
    Logger.log('Affichage du champ 2FA');
    DOM.setDisplay('code2faGroup', 'block');
    DOM.setValue('code2fa', '');
    DOM.setText('loginText', 'Vérifier le code');

    // Focus sur le champ 2FA après un court délai
    setTimeout(() => {
      const codeInput = DOM.select('code2fa');
      if (codeInput) {
        codeInput.focus();
        Logger.log('Focus mis sur le champ 2FA');
      }
    }, 100);
  }

  resetTwoFactorState() {
    Logger.log('Réinitialisation de l\'état 2FA');
    DOM.setDisplay('code2faGroup', 'none');
    DOM.setValue('code2fa', '');
    DOM.setText('loginText', 'Se connecter');
  }

  async logout() {
    Logger.log('Déconnexion demandée');

    if (this.currentUser?.access_token) {
      await this.auth.logout(this.currentUser.access_token);
    }

    this.currentUser = null;

    // Masquer les éléments connectés
    DOM.setDisplay('userCard', 'none');
    DOM.setDisplay('logoutBtn', 'none');
    DOM.setDisplay('navPlay', 'none');
    DOM.setDisplay('navLogs', 'none');

    // Afficher l'authentification
    DOM.setDisplay('authSection', 'block');

    // Réinitialiser le formulaire
    this.resetForm();
    this.hideMessages();
  }

  async checkExistingSession() {
    // Vérifier s'il y a une session existante
    Logger.log('Vérification de session existante');
  }

  setLoading(loading) {
    this.isLoading = loading;
    DOM.setText('loginText', loading ? 'Connexion...' : 'Se connecter');

    const spinner = DOM.select('#loginSpinner');
    if (spinner) {
      spinner.style.display = loading ? 'inline-block' : 'none';
    }

    const loginBtn = DOM.select('#loginBtn');
    if (loginBtn) {
      loginBtn.disabled = loading;
    }
  }

  showError(message) {
    Logger.log('Affichage erreur', message);
    DOM.setText('authError', message);
    DOM.setDisplay('authError', 'block');
    DOM.setDisplay('authSuccess', 'none');
  }

  showSuccess(message) {
    Logger.log('Affichage succès', message);
    DOM.setText('authSuccess', message);
    DOM.setDisplay('authSuccess', 'block');
    DOM.setDisplay('authError', 'none');
  }

  hideMessages() {
    DOM.setDisplay('authError', 'none');
    DOM.setDisplay('authSuccess', 'none');
  }
}

// =============================================================================
// INITIALISATION
// =============================================================================

Logger.log('🚀 Démarrage du launcher Eminium');

document.addEventListener('DOMContentLoaded', () => {
  Logger.log('✅ DOM prêt, initialisation de l\'application');

  // Vérifier que les éléments DOM existent
  const requiredElements = ['email', 'password', 'azuriomBtn', 'loginForm'];
  const missingElements = requiredElements.filter(id => !DOM.select(`#${id}`));

  if (missingElements.length > 0) {
    Logger.error('Éléments DOM manquants', missingElements);
    alert('Erreur: Éléments DOM manquants: ' + missingElements.join(', '));
    return;
  }

  Logger.log('✅ Tous les éléments DOM trouvés');

  // Initialiser l'interface
  const ui = new UI();

  Logger.log('🎯 Launcher initialisé avec succès !');
});

// Gestionnaire d'erreurs global
window.addEventListener('error', (e) => {
  Logger.error('Erreur JavaScript globale', { message: e.message, filename: e.filename, line: e.lineno });
});

window.addEventListener('unhandledrejection', (e) => {
  Logger.error('Promise rejetée non gérée', e.reason);
});

console.log('🎮 Eminium Launcher chargé et prêt !');
