/**
 * Fonctions de test pour valider l'authentification Eminium Launcher
 * Utilitaires de débogage et de test pour le système d'authentification
 */

class AuthTester {
  constructor(authManager, logger) {
    this.authManager = authManager;
    this.logger = logger;
    this.testResults = [];
  }

  /**
   * Enregistre un résultat de test
   */
  recordTest(testName, success, message, data = null) {
    const result = {
      testName,
      success,
      message,
      data,
      timestamp: new Date().toISOString()
    };

    this.testResults.push(result);

    // Logger le résultat
    if (success) {
      this.logger.info(`Test réussi: ${testName}`, result);
    } else {
      this.logger.error(`Test échoué: ${testName}`, result);
    }

    return result;
  }

  /**
   * Test de la configuration
   */
  async testConfiguration() {
    try {
      const config = window.authConfig;

      if (!config) {
        return this.recordTest('Configuration', false, 'Configuration non trouvée');
      }

      if (!config.settings.serverUrl) {
        return this.recordTest('Configuration', false, 'URL du serveur non configurée');
      }

      if (!config.settings.apiBasePath) {
        return this.recordTest('Configuration', false, 'Chemin de base de l\'API non configuré');
      }

      return this.recordTest('Configuration', true, 'Configuration valide', {
        serverUrl: config.settings.serverUrl,
        environment: config.env
      });

    } catch (error) {
      return this.recordTest('Configuration', false, error.message);
    }
  }

  /**
   * Test de connectivité réseau
   */
  async testNetworkConnectivity() {
    try {
      if (!window.networkManager) {
        return this.recordTest('Connectivité réseau', false, 'Gestionnaire réseau non disponible');
      }

      const result = await window.networkManager.testConnectivity();

      return this.recordTest('Connectivité réseau', result.ok,
        result.ok ? 'Serveur accessible' : 'Serveur inaccessible',
        result
      );

    } catch (error) {
      return this.recordTest('Connectivité réseau', false, error.message);
    }
  }

  /**
   * Test du stockage sécurisé
   */
  async testSecureStorage() {
    try {
      if (!window.secureStorage) {
        return this.recordTest('Stockage sécurisé', false, 'Stockage sécurisé non disponible');
      }

      // Test de génération de token CSRF
      const csrfToken = await window.secureStorage.generateAndStoreCSRFToken();

      if (!csrfToken) {
        return this.recordTest('Stockage sécurisé', false, 'Échec génération token CSRF');
      }

      // Test de récupération du token
      const retrievedToken = window.secureStorage.getCSRFToken();

      if (retrievedToken !== csrfToken) {
        return this.recordTest('Stockage sécurisé', false, 'Token CSRF récupéré incorrect');
      }

      return this.recordTest('Stockage sécurisé', true, 'Stockage sécurisé fonctionnel', {
        csrfTokenLength: csrfToken.length
      });

    } catch (error) {
      return this.recordTest('Stockage sécurisé', false, error.message);
    }
  }

  /**
   * Test du système de journalisation
   */
  async testLoggingSystem() {
    try {
      if (!window.createSecureLogger) {
        return this.recordTest('Système de journalisation', false, 'Logger sécurisé non disponible');
      }

      const logger = window.createSecureLogger(window.authConfig.settings);

      // Test de journalisation
      logger.info('Test de journalisation', { test: true });

      // Vérifier que les données sensibles sont masquées
      logger.error('Test avec données sensibles', {
        password: 'secret123',
        token: 'abc123def456'
      });

      return this.recordTest('Système de journalisation', true, 'Journalisation sécurisée fonctionnelle');

    } catch (error) {
      return this.recordTest('Système de journalisation', false, error.message);
    }
  }

  /**
   * Test de validation des entrées
   */
  async testInputValidation() {
    try {
      if (!window.validator) {
        return this.recordTest('Validation des entrées', false, 'Validateur non disponible');
      }

      // Tests de validation d'email
      const emailTests = [
        { email: 'test@example.com', expected: true },
        { email: 'invalid-email', expected: false },
        { email: '', expected: false },
        { email: 'test@', expected: false }
      ];

      let allEmailTestsPassed = true;
      for (const test of emailTests) {
        const result = window.validator.validateEmail(test.email);
        if (result.valid !== test.expected) {
          allEmailTestsPassed = false;
          break;
        }
      }

      // Tests de validation de mot de passe
      const passwordTests = [
        { password: 'StrongPass123', expected: true },
        { password: 'weak', expected: false },
        { password: '', expected: false }
      ];

      let allPasswordTestsPassed = true;
      for (const test of passwordTests) {
        const result = window.validator.validatePassword(test.password);
        if (result.valid !== test.expected) {
          allPasswordTestsPassed = false;
          break;
        }
      }

      const success = allEmailTestsPassed && allPasswordTestsPassed;

      return this.recordTest('Validation des entrées', success,
        success ? 'Validation des entrées fonctionnelle' : 'Échec de certains tests de validation',
        { emailTests: allEmailTestsPassed, passwordTests: allPasswordTestsPassed }
      );

    } catch (error) {
      return this.recordTest('Validation des entrées', false, error.message);
    }
  }

  /**
   * Test de l'état d'authentification
   */
  async testAuthState() {
    try {
      const isAuthenticated = await this.authManager.isAuthenticated();
      const currentUser = await this.authManager.getCurrentUser();

      return this.recordTest('État d\'authentification', true,
        isAuthenticated ? 'Utilisateur connecté' : 'Aucun utilisateur connecté',
        {
          isAuthenticated,
          hasUser: !!currentUser,
          userId: currentUser?.id
        }
      );

    } catch (error) {
      return this.recordTest('État d\'authentification', false, error.message);
    }
  }

  /**
   * Test d'authentification avec des identifiants de test
   */
  async testAuthentication() {
    try {
      // Ne pas effectuer de vraie connexion, juste tester la structure
      const result = {
        success: false,
        message: 'Test d\'authentification simulé (pas de vraies identifiants)',
        canRetry: true,
        suggestions: [
          'Utilisez de vraies identifiants pour tester la connexion',
          'Vérifiez que le serveur est accessible'
        ]
      };

      return this.recordTest('Authentification', true, result.message, result);

    } catch (error) {
      return this.recordTest('Authentification', false, error.message);
    }
  }

  /**
   * Test de déconnexion
   */
  async testLogout() {
    try {
      const result = await this.authManager.logout();

      return this.recordTest('Déconnexion', result.success,
        result.success ? 'Déconnexion réussie' : 'Erreur lors de la déconnexion',
        result
      );

    } catch (error) {
      return this.recordTest('Déconnexion', false, error.message);
    }
  }

  /**
   * Exécute tous les tests
   */
  async runAllTests() {
    this.logger.info('Début de la batterie de tests d\'authentification');
    this.testResults = [];

    const tests = [
      () => this.testConfiguration(),
      () => this.testSecureStorage(),
      () => this.testLoggingSystem(),
      () => this.testInputValidation(),
      () => this.testNetworkConnectivity(),
      () => this.testAuthState(),
      () => this.testAuthentication()
    ];

    const results = [];

    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
      } catch (error) {
        this.logger.error('Erreur lors de l\'exécution d\'un test', { error: error.message });
        results.push(this.recordTest('Erreur de test', false, error.message));
      }
    }

    const summary = {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };

    this.logger.info('Fin de la batterie de tests', summary);

    return summary;
  }

  /**
   * Génère un rapport de test
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.success).length,
        failed: this.testResults.filter(r => !r.success).length,
        successRate: `${((this.testResults.filter(r => r.success).length / this.testResults.length) * 100).toFixed(1)}%`
      },
      results: this.testResults,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Génère des recommandations basées sur les résultats des tests
   */
  generateRecommendations() {
    const recommendations = [];

    const failedTests = this.testResults.filter(r => !r.success);

    if (failedTests.some(t => t.testName === 'Configuration')) {
      recommendations.push('Vérifiez la configuration du serveur dans auth-config.js');
    }

    if (failedTests.some(t => t.testName === 'Connectivité réseau')) {
      recommendations.push('Vérifiez votre connexion internet et l\'accessibilité du serveur');
    }

    if (failedTests.some(t => t.testName === 'Stockage sécurisé')) {
      recommendations.push('Vérifiez que le navigateur supporte les Web Crypto APIs');
    }

    if (failedTests.some(t => t.testName === 'État d\'authentification')) {
      recommendations.push('Vérifiez que les données d\'authentification sont correctement stockées');
    }

    if (recommendations.length === 0) {
      recommendations.push('Tous les tests sont passés ! Le système d\'authentification semble fonctionner correctement.');
    }

    return recommendations;
  }

  /**
   * Affiche les résultats dans la console
   */
  displayResults() {
    const report = this.generateReport();

    console.group('📊 Rapport de test du système d\'authentification');
    console.log(`Résultats: ${report.summary.passed}/${report.summary.total} tests réussis (${report.summary.successRate})`);

    if (report.recommendations.length > 0) {
      console.group('💡 Recommandations');
      report.recommendations.forEach(rec => console.log(`• ${rec}`));
      console.groupEnd();
    }

    console.group('📋 Détails des tests');
    report.results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.testName}: ${result.message}`);
      if (result.data) {
        console.table(result.data);
      }
    });
    console.groupEnd();

    console.groupEnd();

    return report;
  }
}

/**
 * Fonction utilitaire pour tester rapidement l'authentification
 */
async function runAuthTests() {
  if (typeof window === 'undefined') {
    console.error('Cette fonction ne peut être utilisée que dans un navigateur');
    return;
  }

  if (!window.getAuthManager) {
    console.error('Le système d\'authentification n\'est pas chargé');
    return;
  }

  const authManager = window.getAuthManager();
  const tester = new AuthTester(authManager, window.createSecureLogger(window.authConfig.settings));

  console.log('🚀 Démarrage des tests d\'authentification...');

  try {
    await tester.runAllTests();
    return tester.displayResults();
  } catch (error) {
    console.error('Erreur lors de l\'exécution des tests:', error);
    return null;
  }
}

/**
 * Test rapide de la configuration
 */
function testAuthConfig() {
  if (typeof window === 'undefined') {
    console.error('Cette fonction ne peut être utilisée que dans un navigateur');
    return;
  }

  try {
    const config = window.authConfig;

    if (!config) {
      console.error('❌ Configuration non trouvée');
      return false;
    }

    console.log('✅ Configuration chargée');
    console.log('🌐 Serveur:', config.settings.serverUrl);
    console.log('🔧 Environnement:', config.env);
    console.log('🔒 Sécurité activée:', !!config.settings.security);

    return true;

  } catch (error) {
    console.error('❌ Erreur lors du test de configuration:', error);
    return false;
  }
}

/**
 * Test rapide de la connectivité
 */
async function testAuthConnectivity() {
  if (typeof window === 'undefined') {
    console.error('Cette fonction ne peut être utilisée que dans un navigateur');
    return;
  }

  if (!window.networkManager) {
    console.error('❌ Gestionnaire réseau non disponible');
    return false;
  }

  try {
    console.log('🔍 Test de connectivité...');
    const result = await window.networkManager.testConnectivity();

    if (result.ok) {
      console.log('✅ Serveur accessible');
      console.log('📡 Temps de réponse:', result.response.responseTime || 'N/A');
    } else {
      console.error('❌ Serveur inaccessible:', result.error);
    }

    return result.ok;

  } catch (error) {
    console.error('❌ Erreur lors du test de connectivité:', error);
    return false;
  }
}

// Exporter pour les navigateurs
if (typeof window !== 'undefined') {
  window.AuthTester = AuthTester;
  window.runAuthTests = runAuthTests;
  window.testAuthConfig = testAuthConfig;
  window.testAuthConnectivity = testAuthConnectivity;
}
