/**
 * Système de chiffrement sécurisé pour l'authentification Eminium Launcher
 * Fournit des fonctions de chiffrement et de déchiffrement AES-256-GCM
 */

// Utilitaire de chiffrement AES-256-GCM
class SecureStorage {
  constructor(encryptionKey) {
    this.key = this.deriveKey(encryptionKey);
    this.algorithm = {
      name: 'AES-GCM',
      length: 256
    };
  }

  /**
   * Dérive une clé de chiffrement à partir d'une clé principale
   */
  async deriveKey(masterKey) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterKey),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('eminium-auth-salt-2024'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Chiffre des données sensibles
   */
  async encrypt(data) {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(data));

      // Générer un IV aléatoire
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // Chiffrer les données
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        dataBuffer
      );

      // Combiner IV + données chiffrées
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);

      // Encoder en base64 pour le stockage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Erreur lors du chiffrement:', error);
      throw new Error('Impossible de chiffrer les données');
    }
  }

  /**
   * Déchiffre des données sensibles
   */
  async decrypt(encryptedData) {
    try {
      // Décoder depuis base64
      const combined = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Extraire l'IV et les données chiffrées
      const iv = combined.slice(0, 12);
      const encryptedBuffer = combined.slice(12);

      // Déchiffrer les données
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.key,
        encryptedBuffer
      );

      // Décoder le JSON
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedBuffer);
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Erreur lors du déchiffrement:', error);
      throw new Error('Impossible de déchiffrer les données');
    }
  }

  /**
   * Génère un token CSRF sécurisé
   */
  async generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hache un mot de passe pour vérification (pas de stockage)
   */
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'eminium-salt-2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Gestionnaire de stockage sécurisé pour les données d'authentification
 */
class SecureAuthStorage {
  constructor(config) {
    this.config = config;
    this.storage = new SecureStorage(config.security.encryptionKey);
    this.storageKey = 'eminium_auth_data';
  }

  /**
   * Stocke les données d'authentification de manière sécurisée
   */
  async saveAuthData(authData) {
    try {
      const dataToStore = {
        accessToken: authData.accessToken,
        userProfile: authData.userProfile,
        timestamp: Date.now(),
        version: '2.0'
      };

      const encrypted = await this.storage.encrypt(dataToStore);
      localStorage.setItem(this.storageKey, encrypted);

      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des données d\'authentification:', error);
      return false;
    }
  }

  /**
   * Récupère les données d'authentification
   */
  async loadAuthData() {
    try {
      const encrypted = localStorage.getItem(this.storageKey);
      if (!encrypted) {
        return null;
      }

      const decrypted = await this.storage.decrypt(encrypted);

      // Vérifier la version et la fraîcheur des données
      if (decrypted.version !== '2.0') {
        console.warn('Version des données d\'authentification obsolète');
        return null;
      }

      // Vérifier si les données ne sont pas trop anciennes
      const maxAge = this.config.security.tokenLifetime;
      if (Date.now() - decrypted.timestamp > maxAge) {
        console.info('Données d\'authentification expirées');
        this.clearAuthData();
        return null;
      }

      return decrypted;
    } catch (error) {
      console.error('Erreur lors du chargement des données d\'authentification:', error);
      this.clearAuthData();
      return null;
    }
  }

  /**
   * Supprime les données d'authentification
   */
  async clearAuthData() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression des données d\'authentification:', error);
      return false;
    }
  }

  /**
   * Vérifie si des données d'authentification valides sont disponibles
   */
  async hasValidAuthData() {
    const data = await this.loadAuthData();
    return data !== null;
  }

  /**
   * Récupère le token d'accès
   */
  async getAccessToken() {
    const data = await this.loadAuthData();
    return data?.accessToken || null;
  }

  /**
   * Récupère le profil utilisateur
   */
  async getUserProfile() {
    const data = await this.loadAuthData();
    return data?.userProfile || null;
  }

  /**
   * Met à jour le token d'accès
   */
  async updateAccessToken(newToken) {
    const currentData = await this.loadAuthData();
    if (currentData) {
      currentData.accessToken = newToken;
      currentData.timestamp = Date.now(); // Mettre à jour le timestamp
      return this.saveAuthData(currentData);
    }
    return false;
  }

  /**
   * Génère et stocke un token CSRF
   */
  async generateAndStoreCSRFToken() {
    try {
      const token = await this.storage.generateCSRFToken();

      // Stocker le token dans sessionStorage pour la session courante
      sessionStorage.setItem('csrf_token', token);

      return token;
    } catch (error) {
      console.error('Erreur lors de la génération du token CSRF:', error);
      return null;
    }
  }

  /**
   * Récupère le token CSRF actuel
   */
  getCSRFToken() {
    return sessionStorage.getItem('csrf_token');
  }

  /**
   * Valide un token CSRF
   */
  async validateCSRFToken(token) {
    const storedToken = this.getCSRFToken();
    return storedToken === token;
  }

  /**
   * Nettoie les anciens tokens CSRF
   */
  cleanupCSRFToken() {
    sessionStorage.removeItem('csrf_token');
  }
}

/**
 * Utilitaires de validation sécurisée
 */
class SecureValidator {
  constructor(config) {
    this.config = config;
  }

  /**
   * Valide une adresse email
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: this.config.errors.validation.invalidEmail };
    }

    const trimmedEmail = email.trim();

    if (trimmedEmail.length < this.config.validation.email.minLength ||
        trimmedEmail.length > this.config.validation.email.maxLength) {
      return { valid: false, error: this.config.errors.validation.invalidEmail };
    }

    if (!this.config.validation.email.regex.test(trimmedEmail)) {
      return { valid: false, error: this.config.errors.validation.invalidEmail };
    }

    return { valid: true, value: trimmedEmail };
  }

  /**
   * Valide un mot de passe
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Mot de passe requis' };
    }

    if (password.length < this.config.validation.password.minLength) {
      return { valid: false, error: this.config.errors.validation.passwordTooShort };
    }

    if (password.length > this.config.validation.password.maxLength) {
      return { valid: false, error: 'Mot de passe trop long' };
    }

    if (this.config.validation.password.requireUppercase && !/[A-Z]/.test(password)) {
      return { valid: false, error: this.config.errors.validation.passwordTooWeak };
    }

    if (this.config.validation.password.requireLowercase && !/[a-z]/.test(password)) {
      return { valid: false, error: this.config.errors.validation.passwordTooWeak };
    }

    if (this.config.validation.password.requireNumbers && !/\d/.test(password)) {
      return { valid: false, error: this.config.errors.validation.passwordTooWeak };
    }

    return { valid: true, value: password };
  }

  /**
   * Valide un code 2FA
   */
  validateTwoFactorCode(code) {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: this.config.errors.validation.invalidTwoFactor };
    }

    if (!this.config.validation.twoFactorCode.regex.test(code)) {
      return { valid: false, error: this.config.errors.validation.invalidTwoFactor };
    }

    return { valid: true, value: code };
  }

  /**
   * Nettoie et valide toutes les entrées utilisateur
   */
  sanitizeAndValidateInputs(email, password, twoFactorCode = null) {
    // Nettoyer les entrées
    const cleanEmail = email?.trim();
    const cleanPassword = password;
    const cleanTwoFactorCode = twoFactorCode;

    // Valider les entrées
    const emailValidation = this.validateEmail(cleanEmail);
    if (!emailValidation.valid) {
      return { valid: false, error: emailValidation.error };
    }

    const passwordValidation = this.validatePassword(cleanPassword);
    if (!passwordValidation.valid) {
      return { valid: false, error: passwordValidation.error };
    }

    if (twoFactorCode !== null) {
      const twoFactorValidation = this.validateTwoFactorCode(cleanTwoFactorCode);
      if (!twoFactorValidation.valid) {
        return { valid: false, error: twoFactorValidation.error };
      }
    }

    return {
      valid: true,
      values: {
        email: emailValidation.value,
        password: passwordValidation.value,
        twoFactorCode: twoFactorCode ? twoFactorValidation.value : null
      }
    };
  }
}

// Exporter les classes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SecureStorage,
    SecureAuthStorage,
    SecureValidator
  };
}

// Exporter pour les navigateurs
if (typeof window !== 'undefined') {
  window.SecureStorage = SecureStorage;
  window.SecureAuthStorage = SecureAuthStorage;
  window.SecureValidator = SecureValidator;
}
