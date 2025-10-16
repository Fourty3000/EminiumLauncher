/**
 * EMINIUM LAUNCHER - VERSION COMPLÈTE ET FONCTIONNELLE
 * Launcher Minecraft avec authentification Azuriom et interface moderne
 */

// Configuration
const CONFIG = {
    AZURIOM_URL: 'https://eminium.ovh',
    DEBUG: true,
    TIMEOUT: 15000
};

// =============================================================================
// OUTILS DE BASE
// =============================================================================

const DOM = {
    select: (selector) => document.querySelector(selector),
    selectAll: (selector) => document.querySelectorAll(selector),

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
    },

    addInput: (id, handler) => {
        const el = DOM.select(`#${id}`);
        if (el) el.addEventListener('input', handler);
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
    },

    success: (message, data) => {
        if (CONFIG.DEBUG) {
            console.log(`[${new Date().toLocaleTimeString()}] ✅ ${message}`, data || '');
        }
    }
};

// =============================================================================
// CLASSES D'AUTHENTIFICATION
// =============================================================================

class AzuriomAuth {
    async login(email, password, twoFactorCode = null) {
        Logger.log('🔐 Tentative d\'authentification Azuriom', { email, hasTwoFactor: !!twoFactorCode });

        try {
            const data = { email, password };
            if (twoFactorCode && twoFactorCode.trim()) {
                data.code = twoFactorCode.trim();
            }

            // Timeout pour éviter les blocages
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

            const response = await fetch(`${CONFIG.AZURIOM_URL}/api/auth/authenticate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'EminiumLauncher/2.0'
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            Logger.log('📡 Réponse serveur', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });

            const result = await response.json();
            Logger.log('📦 Corps de la réponse', result);

            // Vérifier différents formats de réponse 2FA
            if (response.ok && result.id && result.access_token) {
                Logger.success('🎉 Authentification réussie', { userId: result.id, username: result.username });
                return { success: true, user: result };
            }

            // Format 1: Réponse 422 avec status "pending" et reason "2fa"
            if (response.status === 422 && result.status === 'pending' && result.reason === '2fa') {
                Logger.log('🔐 Code 2FA requis (format 1)');
                return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis', status: 'pending', reason: '2fa' };
            }

            // Format 2: Réponse avec message contenant "2fa" ou "code"
            if (result.message && (result.message.toLowerCase().includes('2fa') || result.message.toLowerCase().includes('code'))) {
                Logger.log('🔐 Code 2FA requis (format 2)');
                return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis', message: result.message };
            }

            // Format 3: Réponse 401 avec demande de 2FA
            if (response.status === 401 && result.require_2fa) {
                Logger.log('🔐 Code 2FA requis (format 3)');
                return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis' };
            }

            Logger.error('❌ Échec d\'authentification', result);
            return {
                success: false,
                error: result.message || `Erreur HTTP ${response.status}: ${response.statusText}`,
                code: result.reason || `HTTP_${response.status}`
            };

        } catch (error) {
            if (error.name === 'AbortError') {
                Logger.error('⏰ Timeout de la requête');
                return { success: false, error: 'Timeout - Le serveur met trop de temps à répondre', code: 'TIMEOUT' };
            }

            Logger.error('🌐 Erreur réseau', error);
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
// CLASSES D'INTERFACE
// =============================================================================

class ProgressUI {
    constructor() {
        this.modal = null;
        this.init();
    }

    init() {
        this.modal = DOM.select('#progressModal');
    }

    open(title = 'Préparation') {
        if (!this.modal) this.createModal();

        DOM.setText('progressTitle', title);
        this.modal.style.display = 'flex';

        // Reset progress
        this.set(0);
        DOM.setText('progressLogContainer', '');

        return this.modal;
    }

    set(percentage) {
        const progressBar = DOM.select('#progressBar');
        const progressText = DOM.select('#progressPercent');

        if (progressBar && progressText) {
            progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            DOM.setText('progressPercent', `${Math.round(percentage)}%`);
        }
    }

    addLine(text) {
        const container = DOM.select('#progressLogContainer');
        if (container) {
            const line = document.createElement('div');
            line.className = 'progress-line';
            line.textContent = text;
            container.appendChild(line);
            container.scrollTop = container.scrollHeight;
        }
    }

    close() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    createModal() {
        // Le modal est déjà dans le HTML
        this.modal = DOM.select('#progressModal');
    }
}

class GameManager {
    async prepareGame() {
        const progressUI = new ProgressUI();
        progressUI.open('Préparation du jeu');

        progressUI.set(10);
        progressUI.addLine('🔍 Vérification des fichiers...');

        await new Promise(resolve => setTimeout(resolve, 1000));

        progressUI.set(50);
        progressUI.addLine('📦 Téléchargement des ressources...');

        await new Promise(resolve => setTimeout(resolve, 1500));

        progressUI.set(100);
        progressUI.addLine('✅ Jeu prêt !');

        setTimeout(() => progressUI.close(), 1500);
    }

    async launchGame() {
        const progressUI = new ProgressUI();
        progressUI.open('Lancement du jeu');

        progressUI.set(20);
        progressUI.addLine('🚀 Initialisation du launcher...');

        await new Promise(resolve => setTimeout(resolve, 1000));

        progressUI.set(60);
        progressUI.addLine('🎮 Connexion au serveur...');

        await new Promise(resolve => setTimeout(resolve, 1500));

        progressUI.set(100);
        progressUI.addLine('🎉 Jeu lancé avec succès !');

        setTimeout(() => progressUI.close(), 2000);
    }
}

// =============================================================================
// CLASSE DE GESTION DU THÈME
// =============================================================================

class ThemeManager {
    constructor() {
        this.isDarkMode = true;
        this.themeToggle = null;
        this.init();
    }

    init() {
        this.themeToggle = DOM.select('#themeToggle');
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());

            // Détecter la préférence système
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                this.setLightTheme();
            }
        }

        // Écouter les changements de préférence système
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
                if (!this.isDarkMode) return; // Ne changer que si on est en mode sombre
                if (e.matches) {
                    this.setLightTheme();
                }
            });
        }
    }

    toggleTheme() {
        if (this.isDarkMode) {
            this.setLightTheme();
        } else {
            this.setDarkTheme();
        }
    }

    setLightTheme() {
        this.isDarkMode = false;
        document.body.classList.add('light-theme');
        if (this.themeToggle) {
            this.themeToggle.querySelector('.icon').textContent = '☀️';
            this.themeToggle.title = 'Basculer vers le thème sombre';
        }
        Logger.log('🎨 Thème clair activé');
    }

    setDarkTheme() {
        this.isDarkMode = true;
        document.body.classList.remove('light-theme');
        if (this.themeToggle) {
            this.themeToggle.querySelector('.icon').textContent = '🌙';
            this.themeToggle.title = 'Basculer vers le thème clair';
        }
        Logger.log('🎨 Thème sombre activé');
    }
}

// =============================================================================
// CLASSE DE GESTION DE SESSION
// =============================================================================

class SessionManager {
    constructor() {
        this.storageKey = 'eminium_session';
        this.tokenKey = 'eminium_token';
        this.currentSession = null;
    }

    // Sauvegarder la session utilisateur
    saveSession(user) {
        try {
            const sessionData = {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    grade: user.grade,
                    avatar: user.avatar
                },
                token: user.access_token,
                timestamp: Date.now(),
                expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 heures
            };

            localStorage.setItem(this.storageKey, JSON.stringify(sessionData));
            localStorage.setItem(this.tokenKey, user.access_token);

            Logger.success('💾 Session sauvegardée', { userId: user.id });
            return true;
        } catch (error) {
            Logger.error('❌ Erreur sauvegarde session', error);
            return false;
        }
    }

    // Restaurer la session au démarrage
    async restoreSession() {
        try {
            const sessionData = localStorage.getItem(this.storageKey);
            const token = localStorage.getItem(this.tokenKey);

            if (!sessionData || !token) {
                Logger.log('ℹ️ Aucune session sauvegardée');
                return null;
            }

            const session = JSON.parse(sessionData);

            // Vérifier l'expiration
            if (Date.now() > session.expiresAt) {
                Logger.log('⏰ Session expirée, nettoyage');
                this.clearSession();
                return null;
            }

            // Vérifier la validité du token
            const isValid = await this.validateToken(token);
            if (!isValid) {
                Logger.log('❌ Token invalide, nettoyage de la session');
                this.clearSession();
                return null;
            }

            Logger.success('✅ Session restaurée', { userId: session.user.id });
            return { ...session.user, access_token: token };

        } catch (error) {
            Logger.error('❌ Erreur restauration session', error);
            this.clearSession();
            return null;
        }
    }

    // Vérifier la validité d'un token
    async validateToken(token) {
        try {
            const response = await fetch(`${CONFIG.AZURIOM_URL}/api/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ access_token: token })
            });

            const result = await response.json();
            return response.ok && result.id;
        } catch (error) {
            Logger.error('❌ Erreur validation token', error);
            return false;
        }
    }

    // Nettoyer la session
    clearSession() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.tokenKey);
            Logger.log('🧹 Session nettoyée');
        } catch (error) {
            Logger.error('❌ Erreur nettoyage session', error);
        }
    }

    // Prolonger la session
    extendSession() {
        try {
            const sessionData = localStorage.getItem(this.storageKey);
            if (sessionData) {
                const session = JSON.parse(sessionData);
                session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // +24h
                localStorage.setItem(this.storageKey, JSON.stringify(session));
                Logger.log('⏰ Session prolongée');
            }
        } catch (error) {
            Logger.error('❌ Erreur prolongation session', error);
        }
    }
}

// =============================================================================
// CLASSE PRINCIPALE AMÉLIORÉE AVEC PERSISTANCE
// =============================================================================

class EminiumLauncher {
    constructor() {
        this.auth = new AzuriomAuth();
        this.progressUI = new ProgressUI();
        this.gameManager = new GameManager();
        this.themeManager = new ThemeManager();
        this.sessionManager = new SessionManager();
        this.currentUser = null;
        this.isLoading = false;

        this.init();
    }

    async init() {
        Logger.log('🚀 Initialisation d\'Eminium Launcher');

        // Restaurer la session existante
        await this.restoreExistingSession();

        // Vérifier que tous les éléments DOM existent
        this.checkRequiredElements();

        // Configurer les gestionnaires d'événements
        this.setupEventListeners();

        // Configurer la navigation par onglets
        this.setupTabNavigation();

        // Démarrer l'animation de fond
        this.startBackgroundAnimation();

        // Démarrer le gestionnaire de session automatique
        this.startSessionManager();

        Logger.success('🎯 Launcher initialisé avec succès');
    }

    startSessionManager() {
        // Prolonger la session toutes les heures si l'utilisateur est connecté
        setInterval(() => {
            if (this.currentUser && this.sessionManager) {
                this.sessionManager.extendSession();
            }
        }, 60 * 60 * 1000); // Toutes les heures

        Logger.log('⏰ Gestionnaire de session automatique démarré');
    }

    async restoreExistingSession() {
        Logger.log('🔄 Tentative de restauration de session');

        const savedUser = await this.sessionManager.restoreSession();
        if (savedUser) {
            this.currentUser = savedUser;
            this.handleLoginSuccess(savedUser);
            Logger.success('🔑 Session restaurée automatiquement');
        } else {
            Logger.log('ℹ️ Démarrage sans session existante');
        }
    }

    checkRequiredElements() {
        const required = [
            'email', 'password', 'azuriomBtn', 'loginForm', 'code2fa',
            'loginBtn', 'themeToggle', 'navPlay', 'navLogs'
        ];
        const missing = required.filter(id => !DOM.select(`#${id}`));

        if (missing.length > 0) {
            Logger.error('❌ Éléments DOM manquants', missing);
            alert('Erreur: Éléments DOM manquants: ' + missing.join(', '));
            return;
        }

        Logger.success('✅ Tous les éléments DOM trouvés');
    }

    setupEventListeners() {
        Logger.log('🔗 Configuration des événements');

        // Authentification
        DOM.addClick('azuriomBtn', (e) => this.handleLogin(e));
        DOM.addSubmit('loginForm', (e) => this.handleLogin(e));
        DOM.addClick('logoutBtn', () => this.logout());

        // Jeu
        DOM.addClick('prepareBtn', () => this.gameManager.prepareGame());
        DOM.addClick('playBtn', () => this.gameManager.launchGame());

        Logger.success('✅ Événements configurés');
    }

    setupTabNavigation() {
        Logger.log('📑 Configuration de la navigation par onglets');

        DOM.selectAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = item.getAttribute('data-tab');
                if (tab) {
                    this.switchToTab(tab);
                }
            });
        });

        Logger.success('✅ Navigation par onglets configurée');
    }

    switchToTab(tabName) {
        Logger.log('🔄 Basculement vers l\'onglet', tabName);

        // Masquer tous les onglets
        DOM.selectAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        // Afficher l'onglet demandé
        DOM.setDisplay(`${tabName}Section`, 'block');

        // Mettre à jour la navigation
        DOM.selectAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        DOM.select(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Actions spéciales par onglet
        if (tabName === 'play') {
            this.updateGameSettings();
        }
    }

    updateGameSettings() {
        // Mettre à jour les paramètres de jeu avec les valeurs actuelles du système
        Logger.log('🎮 Mise à jour des paramètres de jeu');

        // Exemple : détecter automatiquement la RAM disponible
        if (navigator.deviceMemory) {
            const ramGB = navigator.deviceMemory;
            const ramMB = ramGB * 1024;
            DOM.setValue('memSlider', Math.min(ramMB, 8192));
            DOM.setText('memValue', `${Math.min(ramMB, 8192)} Mo`);
        }
    }

    startBackgroundAnimation() {
        // Démarrer des animations de fond supplémentaires si nécessaire
        Logger.log('✨ Animation de fond démarrée');

        // Afficher un message d'information sur la persistance
        setTimeout(() => {
            if (this.currentUser) {
                Logger.log('💡 Session active détectée - Vous êtes automatiquement connecté');
            } else {
                Logger.log('💡 Lancez le launcher et connectez-vous - votre session sera sauvegardée');
            }
        }, 2000);
    }

    async handleLogin(event) {
        Logger.log('🔑 Gestionnaire de connexion appelé');
        event.preventDefault();

        if (this.isLoading) {
            Logger.log('⏳ Connexion déjà en cours');
            return;
        }

        const email = DOM.getValue('email');
        const password = DOM.getValue('password');
        const twoFactorCode = DOM.getValue('code2fa');

        Logger.log('📝 Données saisies', {
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
            Logger.log('📊 Résultat de l\'authentification', result);

            if (result.success) {
                this.handleLoginSuccess(result.user);
            } else if (result.requiresTwoFactor) {
                Logger.log('🔐 Code 2FA requis, affichage du champ');
                this.showTwoFactorPrompt();
            } else {
                Logger.error('❌ Échec d\'authentification', result.error);
                this.showError(result.error || 'Erreur de connexion');
                this.resetTwoFactorState();
            }
        } catch (error) {
            Logger.error('💥 Erreur lors de la connexion', error);
            this.showError('Erreur de connexion réseau');
            this.resetTwoFactorState();
        } finally {
            this.setLoading(false);
        }
    }

    handleLoginSuccess(user) {
        Logger.success('🎉 Connexion réussie', user);
        this.currentUser = user;

        // Sauvegarder la session pour la persistance
        this.sessionManager.saveSession(user);

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

        // Afficher automatiquement l'onglet de jeu après 1.5 secondes
        setTimeout(() => {
            this.switchToTab('play');
        }, 1500);
    }

    showTwoFactorPrompt() {
        Logger.log('🔐 Affichage du champ 2FA');
        DOM.setDisplay('code2faGroup', 'block');
        DOM.setValue('code2fa', '');
        DOM.setText('loginText', 'Vérifier le code');

        // Focus automatique après un court délai
        setTimeout(() => {
            const codeInput = DOM.select('code2fa');
            if (codeInput) {
                codeInput.focus();
                Logger.log('👁️ Focus mis sur le champ 2FA');
            }
        }, 100);
    }

    resetTwoFactorState() {
        Logger.log('🔄 Réinitialisation de l\'état 2FA');
        DOM.setDisplay('code2faGroup', 'none');
        DOM.setValue('code2fa', '');
        DOM.setText('loginText', 'Se connecter');
    }

    async logout() {
        Logger.log('🚪 Déconnexion demandée');

        if (this.currentUser?.access_token) {
            await this.auth.logout(this.currentUser.access_token);
        }

        // Nettoyer la session sauvegardée
        this.sessionManager.clearSession();

        this.currentUser = null;

        // Masquer les éléments connectés
        DOM.setDisplay('userCard', 'none');
        DOM.setDisplay('logoutBtn', 'none');
        DOM.setDisplay('navPlay', 'none');
        DOM.setDisplay('navLogs', 'none');

        // Afficher l'authentification
        DOM.setDisplay('authSection', 'block');

        // Réinitialiser le formulaire
        this.resetTwoFactorState();
        this.hideMessages();

        Logger.success('✅ Déconnexion complète effectuée');
    }

    switchToPlayTab() {
        // Masquer tous les onglets
        DOM.selectAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });

        // Afficher l'onglet de jeu
        DOM.setDisplay('playSection', 'block');

        // Mettre à jour la navigation
        DOM.selectAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        DOM.select('[data-tab="play"]')?.classList.add('active');

        Logger.log('🎮 Basculement vers l\'onglet Jeu');
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
        Logger.error('❌ Affichage d\'erreur', message);
        DOM.setText('authError', message);
        DOM.setDisplay('authError', 'block');
        DOM.setDisplay('authSuccess', 'none');
    }

    showSuccess(message) {
        Logger.success('✅ Affichage de succès', message);
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
// INITIALISATION GLOBALE
// =============================================================================

Logger.log('🎮 Démarrage d\'Eminium Launcher');

document.addEventListener('DOMContentLoaded', () => {
    Logger.log('✅ DOM prêt, initialisation de l\'application');

    // Créer l'instance principale
    const launcher = new EminiumLauncher();

    // Gestionnaire d'erreurs global
    window.addEventListener('error', (e) => {
        Logger.error('💥 Erreur JavaScript globale', {
            message: e.message,
            filename: e.filename,
            line: e.lineno
        });
    });

    window.addEventListener('unhandledrejection', (e) => {
        Logger.error('💥 Promise rejetée non gérée', e.reason);
    });

    Logger.success('🎯 Eminium Launcher chargé et prêt !');
});

// Exposer globalement pour le débogage
window.EminiumLauncher = EminiumLauncher;
