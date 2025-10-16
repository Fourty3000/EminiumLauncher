/**
 * EMINIUM LAUNCHER - VERSION SIMPLIFIÉE POUR TEST
 * Fichier minimal pour diagnostiquer les problèmes
 */

// Configuration de base
const AZURIOM_URL = 'https://eminium.ovh';

// =============================================================================
// CLASSES DE BASE
// =============================================================================

class DOMUtils {
  static select(selector) { return document.querySelector(selector); }
  static setText(element, text) {
    const el = typeof element === 'string' ? this.select(element) : element;
    if (el) el.textContent = text;
  }
  static setDisplay(element, display) {
    const el = typeof element === 'string' ? this.select(element) : element;
    if (el) el.style.display = display;
  }
  static setValue(element, value) {
    const el = typeof element === 'string' ? this.select(element) : element;
    if (el) el.value = value;
  }
  static getValue(element) {
    const el = typeof element === 'string' ? this.select(element) : element;
    return el ? el.value : '';
  }
  static addEventListener(element, event, handler) {
    const el = typeof element === 'string' ? this.select(element) : element;
    if (el) el.addEventListener(event, handler);
  }
}

// =============================================================================
// GESTIONNAIRE D'AUTHENTIFICATION SIMPLIFIÉ
// =============================================================================

class SimpleAuth {
  async login(email, password, twoFactorCode = null) {
    console.log('[SimpleAuth] Tentative de connexion:', { email, hasPassword: !!password, hasTwoFactor: !!twoFactorCode });

    try {
      const response = await fetch(`${AZURIOM_URL}/api/auth/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(twoFactorCode && { code: twoFactorCode })
        })
      });

      const result = await response.json();
      console.log('[SimpleAuth] Réponse serveur:', response.status, result);

      if (response.ok && result.id) {
        return { success: true, user: result };
      } else if (response.status === 422 && result.status === 'pending') {
        return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis' };
      } else {
        return { success: false, error: result.message || 'Échec de connexion' };
      }
    } catch (error) {
      console.error('[SimpleAuth] Erreur réseau:', error);
      return { success: false, error: 'Erreur réseau' };
    }
  }
}

// =============================================================================
// APPLICATION PRINCIPALE SIMPLIFIÉE
// =============================================================================

class SimpleApp {
  constructor() {
    console.log('🔧 Initialisation de SimpleApp...');
    this.auth = new SimpleAuth();
    this.setupEvents();
  }

  setupEvents() {
    console.log('🔗 Configuration des événements...');

    // Bouton Azuriom
    DOMUtils.addEventListener('azuriomBtn', 'click', (e) => this.handleLogin(e));

    // Formulaire
    DOMUtils.addEventListener('loginForm', 'submit', (e) => this.handleLogin(e));

    console.log('✅ Événements configurés');
  }

  async handleLogin(event) {
    console.log('🚀 Gestionnaire de connexion appelé');
    event.preventDefault();

    const email = DOMUtils.getValue('email');
    const password = DOMUtils.getValue('password');
    const twoFactorCode = DOMUtils.getValue('code2fa');

    console.log('📝 Données saisies:', { email, hasPassword: !!password, hasTwoFactor: !!twoFactorCode });

    if (!email || !password) {
      console.log('❌ Email ou mot de passe manquant');
      this.showError('Veuillez saisir votre email et mot de passe');
      return;
    }

    console.log('⏳ Tentative de connexion...');
    DOMUtils.setText('loginText', 'Connexion...');
    DOMUtils.setDisplay('loginSpinner', 'inline-block');

    const result = await this.auth.login(email, password, twoFactorCode);
    console.log('📊 Résultat de l\'authentification:', result);

    if (result.success) {
      console.log('✅ Connexion réussie:', result.user);
      this.showSuccess('Connexion réussie !');
      DOMUtils.setDisplay('authSection', 'none');
      DOMUtils.setDisplay('navPlay', 'flex');
    } else if (result.requiresTwoFactor) {
      console.log('🔐 Code 2FA requis');
      this.showTwoFactorPrompt();
    } else {
      console.log('❌ Échec de connexion:', result.error);
      DOMUtils.setDisplay('code2faGroup', 'none');
      DOMUtils.setText('loginText', 'Se connecter');
      this.showError(result.error || 'Erreur de connexion');
    }

    DOMUtils.setDisplay('loginSpinner', 'none');
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

  showTwoFactorPrompt() {
    DOMUtils.setDisplay('code2faGroup', 'block');
    DOMUtils.setValue('code2fa', '');
    DOMUtils.select('code2fa').focus();
    DOMUtils.setText('loginText', 'Vérifier le code');
  }
}

// =============================================================================
// INITIALISATION
// =============================================================================

console.log('🚀 Démarrage du launcher...');

if (document.readyState === 'loading') {
  console.log('⏳ Attente du DOM...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM prêt, initialisation...');
    new SimpleApp();
  });
} else {
  console.log('✅ DOM déjà prêt, initialisation immédiate...');
  new SimpleApp();
}

console.log('🎯 Launcher initialisé avec succès !');
