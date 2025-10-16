/**
 * Authentication Manager for Eminium Launcher
 * Handles all authentication-related functionality
 */

// Check if already loaded
if (typeof window !== 'undefined' && window.AuthManager && window.AuthManager.initialized) {
  // Already loaded, no need to continue
  throw new Error('AuthManager already initialized');
}

// Site URL constant
const SITE_URL = 'https://eminium.ovh';

// Store in globalThis if not already there
if (typeof globalThis !== 'undefined' && !globalThis.SITE_URL) {
  globalThis.SITE_URL = SITE_URL;
}

// AzAuth API implementation
class AzAuthClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async login(email, password, code2fa = null) {
    const requestBody = {
      email: email,
      password: password
    };

    if (code2fa) {
      requestBody.code = code2fa;
    }

    const response = await fetch(`${this.baseUrl}/authenticate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'EminiumLauncher/1.0'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    const data = await response.json();

    if (response.ok) {
      if (data.status === 'pending' && data.requires2fa) {
        // 2FA required, return pending status
        return {
          status: 'pending',
          requires2fa: true,
          message: data.message || 'Code 2FA requis'
        };
      } else if (data.status === 'success') {
        // Successful login
        return {
          ok: true,
          profile: {
            id: data.id,
            username: data.username,
            pseudo: data.username,
            uuid: data.uuid,
            email_verified: data.email_verified,
            money: data.money,
            grade: data.role?.name || 'Member',
            role: data.role,
            banned: data.banned,
            access_token: data.access_token,
            created_at: data.created_at
          }
        };
      }
    }

    // Error response
    return {
      ok: false,
      error: data.message || `HTTP ${response.status}: ${response.statusText}`,
      status: data.status,
      reason: data.reason
    };
  }

  async verify(accessToken) {
    const response = await fetch(`${this.baseUrl}/verify`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'EminiumLauncher/1.0'
      },
      body: JSON.stringify({
        access_token: accessToken
      }),
      signal: AbortSignal.timeout(5000)
    });

    const data = await response.json();

    if (response.ok) {
      return {
        ok: true,
        profile: {
          id: data.id,
          username: data.username,
          pseudo: data.username,
          uuid: data.uuid,
          email_verified: data.email_verified,
          money: data.money,
          grade: data.role?.name || 'Member',
          role: data.role,
          banned: data.banned,
          access_token: data.access_token,
          created_at: data.created_at
        }
      };
    }

    return {
      ok: false,
      error: data.message || `HTTP ${response.status}: ${response.statusText}`,
      status: data.status,
      reason: data.reason
    };
  }

  async logout(accessToken) {
    const response = await fetch(`${this.baseUrl}/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'EminiumLauncher/1.0'
      },
      body: JSON.stringify({
        access_token: accessToken
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      return { ok: true };
    }

    return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
  }
}

// Store AzAuthClient in globalThis if not already there
if (!globalThis.AzAuthClient) {
  globalThis.AzAuthClient = AzAuthClient;
}

// Système de rate limiting pour éviter les attaques par force brute
class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.maxAttempts = 5;
    this.windowMs = 15 * 60 * 1000; // 15 minutes
    this.blockDuration = 30 * 60 * 1000; // 30 minutes de blocage
  }

  isBlocked(identifier) {
    const attempts = this.attempts.get(identifier);
    if (!attempts) return false;

    const now = Date.now();
    const isInWindow = (now - attempts.firstAttempt) < this.windowMs;
    const isBlocked = attempts.blockedUntil && now < attempts.blockedUntil;

    return (attempts.count >= this.maxAttempts && isInWindow) || isBlocked;
  }

  recordAttempt(identifier, success = false) {
    const now = Date.now();
    let attempts = this.attempts.get(identifier);

    if (!attempts) {
      attempts = {
        count: 0,
        firstAttempt: now,
        blockedUntil: null
      };
      this.attempts.set(identifier, attempts);
    }

    if (success) {
      // Succès - réinitialiser le compteur
      attempts.count = 0;
      attempts.blockedUntil = null;
    } else {
      // Échec - incrémenter le compteur
      attempts.count++;

      if (attempts.count >= this.maxAttempts) {
        attempts.blockedUntil = now + this.blockDuration;
      }
    }

    // Nettoyer les anciennes entrées périodiquement
    if (Math.random() < 0.01) { // 1% de chance à chaque appel
      this.cleanup();
    }

    return attempts;
  }

  cleanup() {
    const now = Date.now();
    for (const [identifier, attempts] of this.attempts.entries()) {
      if (attempts.blockedUntil && now > attempts.blockedUntil) {
        this.attempts.delete(identifier);
      }
    }
  }

  getRemainingTime(identifier) {
    const attempts = this.attempts.get(identifier);
    if (!attempts || !attempts.blockedUntil) return 0;

    const remaining = attempts.blockedUntil - Date.now();
    return Math.max(0, remaining);
  }
}

// Instance globale du rate limiter
const authRateLimiter = new RateLimiter();

// Initial authentication state
let authState = {
  isAuthenticated: false,
  userProfile: null,
  accessToken: null
};

// Store in globalThis to persist across reloads
if (!globalThis.authState) {
  globalThis.authState = authState;
}

// Save auth state
function saveAuthState() {
  try {
    localStorage.setItem('azauth_state', JSON.stringify(authState));
  } catch (error) {
    console.warn('[Auth] Could not save auth state:', error);
  }
}

// Load auth state
function loadAuthState() {
  try {
    const saved = localStorage.getItem('azauth_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      authState = { ...authState, ...parsed };
      return true;
    }
  } catch (error) {
    console.warn('[Auth] Could not load auth state:', error);
  }
  return false;
}

// Clear auth state
function clearAuthState() {
  authState = {
    isAuthenticated: false,
    userProfile: null,
    accessToken: null
  };
  try {
    localStorage.removeItem('azauth_state');
  } catch (error) {
    console.warn('[Auth] Could not clear auth state:', error);
  }
}

// Gestion des erreurs 2FA améliorée
function handle2FAError(error, attemptCount = 0) {
  const maxAttempts = 3;
  const errorMessages = {
    invalid_2fa: attemptCount < maxAttempts ?
      `Code 2FA incorrect. Tentative ${attemptCount + 1}/${maxAttempts}` :
      'Trop de tentatives 2FA échouées. Veuillez réessayer plus tard.',
    expired_2fa: 'Code 2FA expiré. Veuillez en demander un nouveau.',
    blocked_2fa: 'Compte temporairement bloqué en raison de tentatives 2FA échouées.',
    network_error: 'Erreur réseau lors de la vérification 2FA. Vérifiez votre connexion.',
    server_error: 'Erreur serveur lors de la vérification 2FA. Réessayez plus tard.'
  };

  const errorType = error.reason || error.message || 'unknown';
  const userFriendlyMessage = errorMessages[errorType] || 'Erreur lors de la vérification 2FA';

  setAuthError(userFriendlyMessage);

  // Animation d'erreur pour le champ 2FA
  const code2faInput = window.DOMUtils.getElement('code2fa', false);
  if (code2faInput) {
    code2faInput.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
      code2faInput.style.animation = '';
    }, 500);
  }

  return attemptCount >= maxAttempts;
}

// Fonction pour afficher le formulaire 2FA de manière fluide
function show2FAForm() {
  const code2faGroup = window.DOMUtils.getElement('code2faGroup', false);
  if (!code2faGroup) return;

  // Masquer temporairement le groupe pour l'animation
  code2faGroup.style.opacity = '0';
  code2faGroup.style.display = 'block';
  code2faGroup.style.transform = 'translateY(20px)';

  // Animation d'apparition
  requestAnimationFrame(() => {
    code2faGroup.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    code2faGroup.style.opacity = '1';
    code2faGroup.style.transform = 'translateY(0)';
    code2faGroup.classList.add('animated');

    // Mettre le focus sur le champ 2FA après l'animation
    setTimeout(() => {
      const code2faInput = window.DOMUtils.getElement('code2fa', false);
      if (code2faInput) {
        code2faInput.focus();
        // Sélectionner tout le contenu pour faciliter la saisie
        code2faInput.select();
      }
    }, 300);
  });
}

// Set authentication error message
function setAuthError(msg) {
  if (window.DOMUtils) {
    window.DOMUtils.setText('authError', msg || '');
    window.DOMUtils.setDisplay('authError', msg ? 'block' : 'none');
  }
}

// Map login error to user-friendly message
function mapLoginError(result, caught) {
  if (caught) {
    return 'Erreur réseau: ' + (caught.message || 'inconnue');
  }
  if (!result) {
    return 'Réponse invalide du serveur';
  }

  if (result.status === 'pending' && result.requires2fa) {
    return 'Code 2FA requis';
  }

  if (result.error) {
    if (result.reason === 'invalid_credentials') {
      return 'Email ou mot de passe incorrect';
    }
    if (result.reason === '2fa_required' || result.reason === 'invalid_2fa') {
      return 'Code 2FA incorrect';
    }
    return result.error;
  }
  if (!result.ok) {
    return 'Échec de la connexion';
  }
  return null;
}

// Test connection to server before attempting login
async function testConnection() {
  try {
    // Test the AzAuth API endpoint
    const response = await fetch(`${SITE_URL}/verify`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'EminiumLauncher/1.0'
      },
      body: JSON.stringify({
        access_token: 'test' // Test token
      }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      return { ok: true, message: 'Connexion au serveur OK' };
    } else if (response.status === 422) {
      // 422 means invalid parameters but server is reachable
      return { ok: true, message: 'Connexion au serveur OK (API AzAuth détectée)' };
    } else if (response.status === 404) {
      return { ok: false, message: 'Point de terminaison API non trouvé - Vérifiez l\'URL du serveur' };
    } else if (response.status >= 500) {
      return { ok: false, message: `Erreur serveur (${response.status}) - Le serveur rencontre des problèmes` };
    } else {
      return { ok: false, message: `Serveur répond avec le code ${response.status}` };
    }
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return { ok: false, message: 'Timeout de connexion (serveur injoignable)' };
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return { ok: false, message: 'Impossible de contacter le serveur - Vérifiez votre connexion internet' };
    } else if (error.name === 'AbortError') {
      return { ok: false, message: 'Requête annulée - Timeout atteint' };
    } else {
      return { ok: false, message: error.message || 'Erreur de connexion inconnue' };
    }
  }
}

// Update UI after successful login
function updateUIAfterLogin(profile) {
  if (!profile) return;

  // Update global state
  authState.userProfile = profile;
  authState.isAuthenticated = true;
  saveAuthState();

  // Update profile display
  const profileName = document.getElementById('userName');
  const profileRole = document.getElementById('userRole');
  const profileAvatar = document.getElementById('userAvatar');

  if (profileName) profileName.textContent = profile.username || profile.pseudo || 'Utilisateur';
  if (profileRole) {
    const gradeText = profile.grade || 'Membre';
    profileRole.textContent = gradeText;

    // Apply grade styling if available
    if (window.UIHelpers && window.UIHelpers.applyGradeStyle) {
      const gradeColor = window.UIHelpers.paletteColorForGrade(gradeText);
      window.UIHelpers.applyGradeStyle(profileRole, gradeColor, gradeText);
    }
  }

  // Update avatar with Minecraft head
  if (profileAvatar) {
    const username = profile.username || profile.pseudo || 'steve';
    profileAvatar.innerHTML = `<img src="https://minotar.net/helm/${username}/32" alt="Avatar ${username}" onerror="this.src='https://minotar.net/helm/steve/32'">`;

    // Add loading animation
    const img = profileAvatar.querySelector('img');
    if (img) {
      img.style.opacity = '0';
      img.style.transition = 'opacity 0.3s ease';
      img.onload = () => {
        img.style.opacity = '1';
      };
    }
  }

  // Show authenticated UI elements
  const userCard = document.getElementById('userCard');
  const logoutBtn = document.getElementById('logoutBtn');
  const playTab = document.getElementById('navPlay');
  const logsTab = document.getElementById('navLogs');

  if (userCard) userCard.style.display = 'flex';
  if (logoutBtn) logoutBtn.style.display = 'flex';
  if (playTab) playTab.style.display = 'flex';
  if (logsTab) logsTab.style.display = 'flex';

  // Hide auth UI elements
  const authTab = document.getElementById('navAuth');
  if (authTab) authTab.style.display = 'none';

  // Switch to play section using CSS classes
  const authSection = document.getElementById('authSection');
  const playSection = document.getElementById('playSection');
  const logsSection = document.getElementById('logsSection');

  // Remove active class from auth section and add to play section
  if (authSection) {
    authSection.classList.remove('active');
    authSection.style.display = 'none';
  }
  if (playSection) {
    playSection.classList.add('active');
    playSection.style.display = 'block';
  }
  if (logsSection) {
    logsSection.classList.remove('active');
    logsSection.style.display = 'none';
  }

  // Update navigation active state
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  if (playTab) playTab.classList.add('active');

  console.log('[Auth] UI updated for logged in user:', profile.username);
}

// Action de connexion unifiée avec protection contre le blocage
async function performLogin(email, pass, code2fa, options = {}) {
  const { quiet = false, onSuccess, onError } = options;
  const code2faGroup = window.DOMUtils.getElement('code2faGroup', false);
  const loginButton = window.DOMUtils.getElement('loginBtn', false);
  const loginText = window.DOMUtils.getElement('loginText', false);
  const loginSpinner = window.DOMUtils.getElement('loginSpinner', false);

  // Reset UI state
  if (!quiet) {
    setAuthError('');
    window.UIHelpers.setProfileSkeleton(true);
    if (loginButton) loginButton.disabled = true;
    if (loginText) loginText.textContent = 'Connexion en cours...';
    if (loginSpinner) loginSpinner.style.display = 'inline-block';
  }

  try {
    // Validation des champs côté client AVANT d'essayer de se connecter
    const validation = validateLogin(email, pass, code2fa);
    if (!validation.valid) {
      const fieldInput = window.DOMUtils.getElement(validation.field, false);
      if (fieldInput) {
        fieldInput.focus();
        // Animation d'erreur pour le champ invalide
        fieldInput.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
          fieldInput.style.animation = '';
        }, 500);
      }
      throw new Error(validation.error);
    }

    // Vérification du rate limiting
    const userIdentifier = email ? email.toLowerCase().trim() : 'unknown';
    if (authRateLimiter.isBlocked(userIdentifier)) {
      const remainingTime = authRateLimiter.getRemainingTime(userIdentifier);
      const minutes = Math.ceil(remainingTime / (60 * 1000));
      throw new Error(`Trop de tentatives de connexion. Réessayez dans ${minutes} minute(s).`);
    }

    // Test de connexion au serveur
    if (window.Logger) window.Logger.info('Test de connexion au serveur...');
    showConnectionStatus('Test de connexion...', 'info');

    const connectionTest = await testConnection();
    if (!connectionTest.ok) {
      const errorMsg = connectionTest.message;
      if (window.Logger) window.Logger.error('Test de connexion échoué:', errorMsg);

      // Afficher un message plus détaillé selon le type d'erreur
      let userMessage = errorMsg;
      if (errorMsg.includes('Timeout')) {
        userMessage = '⏱️ Le serveur ne répond pas. Vérifiez votre connexion internet ou réessayez plus tard.';
      } else if (errorMsg.includes('connexion internet')) {
        userMessage = '🌐 Impossible de contacter le serveur. Vérifiez votre connexion internet.';
      } else if (errorMsg.includes('code')) {
        userMessage = '🔌 Le serveur répond mais rencontre un problème technique. Réessayez plus tard.';
      }

      throw new Error(userMessage);
    }

    // Tentative de connexion
    if (window.Logger) window.Logger.info('Tentative de connexion...');
    showConnectionStatus('Connexion en cours...', 'info');

    const result = await azAuthClient.login(email, pass, code2fa);

    // Enregistrer la tentative (succès ou échec) - seulement si l'email est valide
    if (email) {
      const userIdentifier = email.toLowerCase().trim();
      authRateLimiter.recordAttempt(userIdentifier, result && result.ok);
    }

    // Gestion de la réponse
    if (result && result.status === 'pending' && result.requires2fa) {
      // Afficher le champ 2FA avec animation fluide
      show2FAForm();
      if (loginText) loginText.textContent = 'Valider le code 2FA';
      throw new Error('Code de vérification 2FA requis');
    }

    if (result && result.ok && result.profile) {
      // Connexion réussie
      if (window.Logger) window.Logger.success('Connexion réussie!');
      showConnectionStatus('Connexion réussie!', 'success');

      // Mettre à jour l'état d'authentification
      authState.accessToken = result.profile.access_token;
      authState.isAuthenticated = true;
      authState.userProfile = result.profile;
      saveAuthState();

      // Mettre à jour l'interface utilisateur
      updateUIAfterLogin(result.profile);

      if (onSuccess) onSuccess(result.profile);
      return result.profile;
    } else {
      // Échec de la connexion
      const errorMsg = result?.error || 'Identifiants incorrects';
      throw new Error(errorMsg);
    }
  } catch (error) {
    // Gestion des erreurs
    const errorMessage = error.message || 'Une erreur est survenue lors de la connexion';

    if (!quiet) {
      setAuthError(errorMessage);
      if (window.Logger) window.Logger.error('Erreur de connexion:', errorMessage);
      showConnectionStatus('Échec de la connexion', 'error');

      // Réactiver le bouton de connexion
      if (loginButton) loginButton.disabled = false;
      if (loginText) loginText.textContent = 'Se connecter';
      if (loginSpinner) loginSpinner.style.display = 'none';
    }

    if (onError) onError(errorMessage);
    return null;
  } finally {
    if (!quiet) {
      window.UIHelpers.setProfileSkeleton(false);
    }
  }
}

// Complete logout and reset
async function performLogout() {
  try {
    // Show confirmation dialog
    const confirmed = confirm('Êtes-vous sûr de vouloir vous déconnecter ?');

    if (!confirmed) {
      return;
    }

    console.log('[Auth] Starting logout process...');

    // Disable logout button during logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.disabled = true;
      logoutBtn.textContent = 'Déconnexion...';
    }

    // Get stored access token - check if authState exists first
    const accessToken = authState ? authState.accessToken : null;

    if (accessToken) {
      // Call logout API
      const result = await azAuthClient.logout(accessToken);

      if (result && result.ok) {
        console.log('[Auth] Logout successful');

        // Clear global state
        clearAuthState();

        // Show success message
        if (window.Logger) {
          window.Logger.success('Déconnexion réussie');
        }

        // Complete UI reset
        resetUIAfterLogout();

        // Update app state if available
        if (window.App && window.App.getState) {
          const state = window.App.getState();
          if (state) {
            state.authenticated = false;
            // Clear any cached profile data
            state.userProfile = null;
          }
        }

        // Show success notification
        if (window.UIHelpers && window.UIHelpers.showNotification) {
          window.UIHelpers.showNotification('Déconnexion réussie ! Vous pouvez vous reconnecter.', 'success');
        }

        // Re-enable logout button after a short delay
        setTimeout(() => {
          if (logoutBtn) {
            logoutBtn.disabled = false;
            logoutBtn.textContent = '🚪 Déconnexion';
          }
        }, 1000);

      } else {
        throw new Error(result?.error || 'Logout failed');
      }
    } else {
      // No access token, just clear local state
      console.log('[Auth] No access token found, clearing local state only');
      clearAuthState();
      resetUIAfterLogout();

      if (window.UIHelpers && window.UIHelpers.showNotification) {
        window.UIHelpers.showNotification('Déconnexion réussie ! Vous pouvez vous reconnecter.', 'success');
      }
    }

  } catch (error) {
    console.error('[Auth] Logout error:', error.message);

    // Show error message
    if (window.Logger) {
      window.Logger.error('Erreur lors de la déconnexion: ' + error.message);
    }

    if (window.UIHelpers && window.UIHelpers.showNotification) {
      window.UIHelpers.showNotification('Erreur lors de la déconnexion: ' + error.message, 'error');
    }

    // Re-enable logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.disabled = false;
      logoutBtn.textContent = '🚪 Déconnexion';
    }
  }
}

// Handle 2FA login
async function perform2FALogin(email, password, twoFactorCode, options = {}) {
  const { quiet = false, onSuccess, onError } = options;

  if (!quiet) {
    setAuthError('');
    window.UIHelpers.setProfileSkeleton(true);
  }

  try {
    const result = await azAuthClient.login(email, password, twoFactorCode);

    if (result && result.ok) {
      if (!quiet) {
        window.Logger.success('Connexion 2FA réussie!');
        updateUIAfterLogin(result.profile);
        window.UIHelpers.setProfileSkeleton(false);
        showConnectionStatus('Connexion réussie!', 'success');
      }

      // Store access token and update global state
      if (result.profile.access_token) {
        authState.accessToken = result.profile.access_token;
        authState.isAuthenticated = true;
        authState.userProfile = result.profile;
        saveAuthState();
      }

      if (onSuccess) onSuccess(result.profile);
      return result.profile;
    } else {
      const errorMsg = result.error || 'Échec de la connexion 2FA';
      if (!quiet) {
        setAuthError(errorMsg);
        window.Logger.error('Échec de connexion 2FA: ' + errorMsg);
        window.UIHelpers.setProfileSkeleton(false);
        showConnectionStatus('Échec de connexion 2FA', 'error');
      }

      if (onError) onError(errorMsg);
      return null;
    }
  } catch (error) {
    const errorMsg = mapLoginError(null, error);
    if (!quiet) {
      setAuthError(errorMsg);
      window.Logger.error('Erreur de connexion 2FA: ' + errorMsg);
      window.UIHelpers.setProfileSkeleton(false);
      showConnectionStatus('Erreur de connexion 2FA', 'error');
    }

    if (onError) onError(errorMsg);
    return null;
  }
}

// Check if user is logged in and update UI accordingly
async function checkAuthStatus() {
  try {
    console.log('[Auth] Checking authentication status...');

    // Load saved state first
    loadAuthState();

    // If we have saved auth state, try to verify it
    if (authState && authState.isAuthenticated && authState.accessToken) {
      const result = await azAuthClient.verify(authState.accessToken);
      if (result && result.ok && result.profile) {
        console.log('[Auth] User is already logged in:', result.profile.username);

        // Update global state with fresh profile data
        authState.userProfile = result.profile;
        saveAuthState();

        // Update UI to show logged in state
        updateUIAfterLogin(result.profile);

        // Update app state if available
        if (window.App && window.App.getState) {
          const state = window.App.getState();
          if (state) {
            state.authenticated = true;
            state.userProfile = result.profile;
          }
        }

        return true;
      } else {
        console.log('[Auth] Invalid or expired session found');

        // Clear invalid state
        clearAuthState();
        resetUIAfterLogout();
        return false;
      }
    } else {
      console.log('[Auth] No active session found');

      // Update UI to show logged out state
      resetUIAfterLogout();

      // Update app state if available
      if (window.App && window.App.getState) {
        const state = window.App.getState();
        if (state) {
          state.authenticated = false;
        }
      }

      return false;
    }
  } catch (error) {
    console.warn('[Auth] Error checking auth status:', error);

    // If there's an error, assume not logged in and show auth UI
    clearAuthState();
    resetUIAfterLogout();

    // Update app state if available
    if (window.App && window.App.getState) {
      const state = window.App.getState();
      if (state) {
        state.authenticated = false;
      }
    }

    return false;
  }
}

// Reset UI after logout
function resetUIAfterLogout() {
  // Clear global state
  clearAuthState();

  // Reset profile display
  const profileName = document.getElementById('userName');
  const profileRole = document.getElementById('userRole');
  const profileAvatar = document.getElementById('userAvatar');

  if (profileName) profileName.textContent = 'Non connecté';
  if (profileRole) {
    profileRole.textContent = 'Visiteur';
    // Reset grade styling
    if (window.UIHelpers && window.UIHelpers.applyGradeStyle) {
      window.UIHelpers.applyGradeStyle(profileRole, '#64748b', 'Visiteur');
    }
  }
  if (profileAvatar) profileAvatar.innerHTML = '👤';

  // Hide authenticated UI elements
  const userCard = document.getElementById('userCard');
  const logoutBtn = document.getElementById('logoutBtn');
  const playTab = document.getElementById('navPlay');
  const logsTab = document.getElementById('navLogs');

  if (userCard) userCard.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (playTab) playTab.style.display = 'none';
  if (logsTab) logsTab.style.display = 'none';

  // Show auth UI elements
  const authTab = document.getElementById('navAuth');
  if (authTab) authTab.style.display = 'flex';

  // Switch to auth section using CSS classes
  const authSection = document.getElementById('authSection');
  const playSection = document.getElementById('playSection');
  const logsSection = document.getElementById('logsSection');

  // Remove active class from play section and add to auth section
  if (authSection) {
    authSection.classList.add('active');
    authSection.style.display = 'block';
  }
  if (playSection) {
    playSection.classList.remove('active');
    playSection.style.display = 'none';
  }
  if (logsSection) {
    logsSection.classList.remove('active');
    logsSection.style.display = 'none';
  }

  // Update navigation active state
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  if (authTab) authTab.classList.add('active');

  // Clear form fields
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const code2faInput = document.getElementById('code2fa');

  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  if (code2faInput) code2faInput.value = '';

  console.log('[Auth] UI reset for logged out state');
}

// Validation formulaire login améliorée avec retour détaillé
function validateLogin(email, pass, code2fa) {
  // Validation email
  if (!email || !email.trim()) {
    return { valid: false, error: 'L\'adresse email est requise', field: 'email' };
  }

  if (!email.includes('@') || !email.includes('.')) {
    return { valid: false, error: 'Format d\'email invalide', field: 'email' };
  }

  // Vérification de la longueur et des caractères spéciaux
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Format d\'email invalide', field: 'email' };
  }

  if (email.length > 254) { // RFC 5321 limit
    return { valid: false, error: 'Adresse email trop longue', field: 'email' };
  }

  // Validation mot de passe
  if (!pass || !pass.trim()) {
    return { valid: false, error: 'Le mot de passe est requis', field: 'password' };
  }

  if (pass.length < 8) {
    return { valid: false, error: 'Le mot de passe doit contenir au moins 8 caractères', field: 'password' };
  }

  if (pass.length > 128) {
    return { valid: false, error: 'Mot de passe trop long (maximum 128 caractères)', field: 'password' };
  }

  // Validation code 2FA (si fourni)
  if (code2fa && code2fa.trim()) {
    if (code2fa.length !== 6) {
      return { valid: false, error: 'Le code 2FA doit contenir exactement 6 chiffres', field: 'code2fa' };
    }

    if (!/^\d{6}$/.test(code2fa)) {
      return { valid: false, error: 'Le code 2FA ne doit contenir que des chiffres', field: 'code2fa' };
    }
  }

  return { valid: true };
}

// Validation en temps réel des champs
function setupRealTimeValidation() {
  const emailInput = window.DOMUtils.getElement('email', false);
  const passwordInput = window.DOMUtils.getElement('password', false);
  const code2faInput = window.DOMUtils.getElement('code2fa', false);

  function addValidationStyling(input, isValid, errorMsg) {
    if (!input) return;

    const formGroup = input.closest('.form-group');
    if (!formGroup) return;

    // Supprimer les anciennes classes de validation
    formGroup.classList.remove('error', 'success');

    if (isValid) {
      formGroup.classList.add('success');
      input.style.borderColor = 'var(--success)';
    } else if (errorMsg) {
      formGroup.classList.add('error');
      input.style.borderColor = 'var(--error)';
    } else {
      input.style.borderColor = '';
    }
  }

  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      const email = emailInput.value.trim();
      if (email) {
        const validation = validateLogin(email, 'dummy');
        addValidationStyling(emailInput, validation.valid, validation.error);
      }
    });

    emailInput.addEventListener('input', () => {
      if (emailInput.style.borderColor === 'var(--error)') {
        addValidationStyling(emailInput, true, null);
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('blur', () => {
      const password = passwordInput.value;
      if (password) {
        const validation = validateLogin('test@test.com', password);
        addValidationStyling(passwordInput, validation.valid, validation.error);
      }
    });

    passwordInput.addEventListener('input', () => {
      if (passwordInput.style.borderColor === 'var(--error)') {
        addValidationStyling(passwordInput, true, null);
      }
    });
  }

  if (code2faInput) {
    code2faInput.addEventListener('input', () => {
      const code = code2faInput.value;
      if (code) {
        const isValid = /^\d{0,6}$/.test(code);
        addValidationStyling(code2faInput, isValid, isValid ? null : 'Format invalide');
      }
    });
  }
}

// Initialize authentication event listeners
function initAuthListeners() {
  if (!window.DOMUtils) {
    console.error('DOMUtils not available');
    return;
  }

  let loginInProgress = false;

  // Gestion de la soumission du formulaire de connexion
  const loginForm = window.DOMUtils.getElement('loginForm', false);
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (loginInProgress) {
        console.log('[Auth] Connexion déjà en cours, nouvelle tentative ignorée');
        return;
      }

      loginInProgress = true;

      try {
        const email = window.DOMUtils.getValue('email', '').trim();
        const password = window.DOMUtils.getValue('password', '');
        const code2fa = window.DOMUtils.getValue('code2fa', '').trim();

        await performLogin(email, password, code2fa);
      } catch (error) {
        console.error('Erreur lors de la connexion:', error);
      } finally {
        loginInProgress = false;
      }
    });
  }

  // Gestion du bouton de déconnexion
  const logoutBtn = window.DOMUtils.getElement('logoutBtn', false);
  if (logoutBtn) {
    logoutBtn.addEventListener('click', performLogout);
  }

  // Gestion du bouton OAuth
  const oauthBtn = window.DOMUtils.getElement('oauthBtn', false);
  if (oauthBtn) {
    oauthBtn.addEventListener('click', () => {
      const detailedForm = window.DOMUtils.getElement('detailedLoginForm', false);
      const quickAuth = window.DOMUtils.getElement('quickAuth', false);

      if (detailedForm && quickAuth) {
        window.DOMUtils.toggle('detailedLoginForm', 'block');
        window.DOMUtils.toggle('quickAuth', 'block');
      }
    });
  }

  // Gestion de la touche Entrée dans le formulaire
  const emailInput = window.DOMUtils.getElement('email', false);
  const passwordInput = window.DOMUtils.getElement('password', false);
  const code2faInput = window.DOMUtils.getElement('code2fa', false);

  [emailInput, passwordInput, code2faInput].forEach(input => {
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const loginButton = window.DOMUtils.getElement('loginBtn', false);
          if (loginButton && !loginButton.disabled) {
            loginButton.click();
          }
        }
      });
    }
  });

  // Add connection status indicator
  const statusIndicator = document.createElement('div');
  statusIndicator.id = 'connectionStatus';
  statusIndicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    display: none;
    background: rgba(0,0,0,0.8);
  `
}

// Initialize authentication manager
function initAuthManager() {
  add2FAErrorAnimation();
  setupRealTimeValidation();
  initAuthListeners();
  checkAuthStatus();
}

// Get current auth state
function getAuthState() {
  return {
    isAuthenticated: authState.isAuthenticated,
    userProfile: authState.userProfile,
    accessToken: authState.accessToken
  };
}

// Debug function to test authentication
async function debugAuth() {
  console.log('🔧 [DEBUG AUTH] Starting authentication debug...');

  try {
    // Test 1: Check if DOM elements exist
    console.log('📋 [DEBUG] Checking DOM elements...');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');

    console.log('Email input:', !!emailInput);
    console.log('Password input:', !!passwordInput);
    console.log('Login button:', !!loginBtn);

    // Test 2: Check auth state
    console.log('🔐 [DEBUG] Current auth state:', {
      isAuthenticated: authState.isAuthenticated,
      hasProfile: !!authState.userProfile,
      hasToken: !!authState.accessToken,
      profile: authState.userProfile ? { username: authState.userProfile.username } : null
    });

    // Test 3: Test server connection
    console.log('🌐 [DEBUG] Testing server connection...');
    const connectionTest = await testConnection();
    console.log('Connection test result:', connectionTest);

    // Test 4: Check if AuthManager is properly initialized
    console.log('⚙️ [DEBUG] AuthManager status:', {
      exists: !!globalThis.AuthManager,
      initialized: globalThis.AuthManager ? globalThis.AuthManager.initialized : false
    });

    console.log('✅ [DEBUG AUTH] Debug completed');

    return {
      domElements: {
        email: !!emailInput,
        password: !!passwordInput,
        loginBtn: !!loginBtn
      },
      authState: authState,
      connection: connectionTest,
      authManager: !!globalThis.AuthManager
    };

  } catch (error) {
    console.error('❌ [DEBUG AUTH] Error during debug:', error);
    return { error: error.message };
  }
}

// Test function to verify navigation works correctly
function testNavigationSwitch() {
  console.log('[Auth Test] Testing navigation switch...');

  // Test switching to play section
  const authSection = document.getElementById('authSection');
  const playSection = document.getElementById('playSection');

  if (authSection && playSection) {
    // Simulate what happens after login
    authSection.classList.remove('active');
    authSection.style.display = 'none';
    playSection.classList.add('active');
    playSection.style.display = 'block';

    console.log('[Auth Test] Navigation test completed');
    console.log('[Auth Test] Auth section hidden:', authSection.style.display === 'none');
    console.log('[Auth Test] Play section visible:', playSection.style.display === 'block');
    console.log('[Auth Test] Play section has active class:', playSection.classList.contains('active'));
  } else {
    console.error('[Auth Test] Could not find sections to test');
  }
}

// Fonction de diagnostic complète du système d'authentification
async function runAuthDiagnostic() {
  console.log('🔧 [DIAGNOSTIC] Démarrage du diagnostic d\'authentification...');

  const results = {
    network: false,
    server: false,
    api: false,
    auth: false
  };

  try {
    // Test 1: Connexion réseau basique
    console.log('📡 Test de connexion réseau...');
    const networkTest = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors'
    }).catch(() => null);

    results.network = !!networkTest;
    console.log(`✅ Réseau: ${results.network ? 'OK' : 'ÉCHEC'}`);

    // Test 2: Connexion au serveur Eminium
    console.log('🏠 Test de connexion au serveur Eminium...');
    const connectionTest = await testConnection();
    results.server = connectionTest.ok;
    console.log(`✅ Serveur: ${results.server ? 'OK' : 'ÉCHEC'} - ${connectionTest.message}`);

    if (results.server) {
      // Test 3: Test de l'API d'authentification
      console.log('🔐 Test de l\'API d\'authentification...');
      const apiTest = await azAuthClient.verify('test');
      results.api = !!(apiTest && (apiTest.ok || apiTest.error)); // API répond (même avec erreur)
      console.log(`✅ API: ${results.api ? 'OK' : 'ÉCHEC'}`);
    }

    // Résumé
    const successCount = Object.values(results).filter(Boolean).length;
    console.log(`📊 Résumé diagnostic: ${successCount}/4 tests réussis`);

    if (successCount === 4) {
      console.log('🎉 Tous les tests sont passés ! Le système d\'authentification est prêt.');
      return { success: true, message: 'Système d\'authentification opérationnel' };
    } else {
      console.log('⚠️ Certains tests ont échoué. Vérifiez les détails ci-dessus.');
      return { success: false, message: 'Des problèmes détectés', details: results };
    }

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
    return { success: false, message: 'Erreur lors du diagnostic', error: error.message };
  }
}

// AuthManager class definition
class AuthManager {
  constructor() {
    this.initialized = false;
    this.rateLimiter = authRateLimiter;
    this.azAuthClient = azAuthClient;
  }

  initAuthManager() {
    if (this.initialized) {
      throw new Error('AuthManager already initialized');
    }
    this.initialized = true;
    add2FAErrorAnimation();
    setupRealTimeValidation();
    initAuthListeners();
    checkAuthStatus();
    return this;
  }

  async checkAuthStatus() {
    return await checkAuthStatus();
  }

  async performLogin(email, password, code2fa) {
    return await performLogin(email, password, code2fa);
  }

  async performLogout() {
    return await performLogout();
  }

  getAuthState() {
    return getAuthState();
  }

  async runAuthDiagnostic() {
    return await runAuthDiagnostic();
  }

  async debugAuth() {
    return await debugAuth();
  }
}

// Create global AuthManager instance
const authManagerInstance = new AuthManager();

// Store in globalThis to persist across reloads
if (!globalThis.AuthManager) {
  globalThis.AuthManager = authManagerInstance;
}
