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

// Global state for authentication - use globalThis to avoid redeclaration
let authState = globalThis.authState || {
  isAuthenticated: false,
  userProfile: null,
  accessToken: null
};

// Store in globalThis to persist across reloads
if (!globalThis.authState) {
  globalThis.authState = authState;
}

// Create auth client instance - use globalThis to avoid redeclaration
const azAuthClient = globalThis.azAuthClient || new AzAuthClient(SITE_URL);

// Store in globalThis to persist across reloads
if (!globalThis.azAuthClient) {
  globalThis.azAuthClient = azAuthClient;
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

// Validation formulaire login
function validateLogin(email, pass, code2fa) {
  if (!email || !pass) {
    return { valid: false, error: 'Email et mot de passe requis' };
  }
  if (!email.includes('@')) {
    return { valid: false, error: 'Email invalide' };
  }
  if (pass.length < 6) {
    return { valid: false, error: 'Mot de passe trop court' };
  }
  return { valid: true };
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
    } else {
      return { ok: false, message: `Serveur répond avec le code ${response.status}` };
    }
  } catch (error) {
    if (error.name === 'TimeoutError') {
      return { ok: false, message: 'Timeout de connexion (serveur injoignable)' };
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return { ok: false, message: 'Impossible de contacter le serveur' };
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
    // Validation des champs
    if (!email || !email.includes('@')) {
      throw new Error('Veuillez entrer une adresse email valide');
    }
    if (!pass) {
      throw new Error('Veuillez entrer votre mot de passe');
    }
    if (code2fa && code2fa.length !== 6) {
      throw new Error('Le code 2FA doit contenir 6 chiffres');
    }

    // Test de connexion au serveur
    window.Logger.info('Test de connexion au serveur...');
    showConnectionStatus('Test de connexion...', 'info');

    const connectionTest = await testConnection();
    if (!connectionTest.ok) {
      throw new Error('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
    }

    // Tentative de connexion
    window.Logger.info('Tentative de connexion...');
    showConnectionStatus('Connexion en cours...', 'info');

    const result = await azAuthClient.login(email, pass, code2fa);

    // Gestion de la réponse
    if (result && result.status === 'pending' && result.requires2fa) {
      // Afficher le champ 2FA
      if (code2faGroup) code2faGroup.style.display = 'block';
      if (loginText) loginText.textContent = 'Valider le code 2FA';

      // Mettre le focus sur le champ 2FA
      const code2faInput = window.DOMUtils.getElement('code2fa', false);
      if (code2faInput) code2faInput.focus();

      throw new Error('Code de vérification 2FA requis');
    }

    if (result && result.ok && result.profile) {
      // Connexion réussie
      window.Logger.success('Connexion réussie!');
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
      window.Logger.error('Erreur de connexion:', errorMessage);
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

    // Get stored access token
    const accessToken = authState.accessToken;

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
    if (authState.isAuthenticated && authState.accessToken) {
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

// Function to show connection status
function showConnectionStatus(message, type = 'info') {
  const indicator = document.getElementById('connectionStatus');
  if (indicator) {
    indicator.textContent = message;
    indicator.style.background = type === 'error' ? 'rgba(220,38,38,0.9)' :
                                 type === 'success' ? 'rgba(34,197,94,0.9)' :
                                 'rgba(0,0,0,0.8)';
    indicator.style.display = 'block';
    setTimeout(() => {
      indicator.style.display = 'none';
    }, 5000);
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

// Get AuthManager instance (legacy API compatibility)
function getAuthManager() {
  return AuthManager;
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

// Export authentication manager
const AuthManager = {
  initialized: false,
  performLogin,
  performLogout,
  perform2FALogin,
  checkAuthStatus,
  getAuthState,
  getAuthManager,
  initAuthManager,
  validateLogin,
  updateUIAfterLogin,
  resetUIAfterLogout,
  mapLoginError,
  setAuthError,
  testConnection,
  showConnectionStatus,
  testNavigationSwitch
};

// Store in globalThis to persist across reloads
if (!globalThis.AuthManager) {
  globalThis.AuthManager = AuthManager;
}

// Also expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}
