/**
 * TESTEUR DE 2FA POUR EMINIUM LAUNCHER
 * Ce fichier teste la gestion de la 2FA avec des données fictives
 */

// Simuler différentes réponses du serveur Azuriom
const testScenarios = {
  success: {
    id: 123,
    username: 'testuser',
    email: 'test@example.com',
    access_token: 'fake_token_123'
  },

  twoFactorRequired: {
    status: 'pending',
    reason: '2fa',
    message: 'Code de vérification requis'
  },

  twoFactorInMessage: {
    message: 'Veuillez saisir votre code 2FA pour continuer'
  },

  invalidCredentials: {
    message: 'Email ou mot de passe incorrect'
  },

  networkError: new Error('Failed to fetch')
};

// =============================================================================
// TESTEUR DE LOGIQUE 2FA
// =============================================================================

class TwoFactorTester {
  constructor() {
    this.testResults = [];
  }

  // Tester la détection de différents formats de réponse 2FA
  testTwoFactorDetection() {
    console.log('🧪 Test de détection des formats 2FA');

    const tests = [
      {
        name: 'Format 1: status pending + reason 2fa',
        response: { status: 422, ok: false },
        data: testScenarios.twoFactorRequired,
        expected: { requiresTwoFactor: true, status: 'pending', reason: '2fa' }
      },
      {
        name: 'Format 2: message contenant 2fa',
        response: { status: 401, ok: false },
        data: testScenarios.twoFactorInMessage,
        expected: { requiresTwoFactor: true, message: testScenarios.twoFactorInMessage.message }
      },
      {
        name: 'Format 3: succès normal',
        response: { status: 200, ok: true },
        data: testScenarios.success,
        expected: { success: true, user: testScenarios.success }
      },
      {
        name: 'Format 4: erreur normale',
        response: { status: 401, ok: false },
        data: testScenarios.invalidCredentials,
        expected: { success: false, error: testScenarios.invalidCredentials.message }
      }
    ];

    tests.forEach(test => {
      const result = this.analyzeResponse(test.response, test.data);
      const passed = JSON.stringify(result) === JSON.stringify(test.expected);

      console.log(`${passed ? '✅' : '❌'} ${test.name}`);
      if (!passed) {
        console.log('  Attendu:', test.expected);
        console.log('  Obtenu:', result);
      }

      this.testResults.push({
        test: test.name,
        passed,
        expected: test.expected,
        actual: result
      });
    });
  }

  // Analyser une réponse comme le fait le vrai code
  analyzeResponse(response, result) {
    // Format 1: Réponse 422 avec status "pending" et reason "2fa"
    if (response.status === 422 && result.status === 'pending' && result.reason === '2fa') {
      return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis', status: 'pending', reason: '2fa' };
    }

    // Format 2: Réponse avec message contenant "2fa" ou "code"
    if (result.message && (result.message.toLowerCase().includes('2fa') || result.message.toLowerCase().includes('code'))) {
      return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis', message: result.message };
    }

    // Format 3: Réponse 401 avec demande de 2FA
    if (response.status === 401 && result.require_2fa) {
      return { success: false, requiresTwoFactor: true, error: 'Code 2FA requis' };
    }

    // Succès
    if (response.ok && result.id && result.access_token) {
      return { success: true, user: result };
    }

    // Échec normal
    return {
      success: false,
      error: result.message || `Erreur HTTP ${response.status}: ${response.statusText}`,
      code: result.reason || `HTTP_${response.status}`
    };
  }

  // Afficher le résumé des tests
  showTestSummary() {
    const passed = this.testResults.filter(t => t.passed).length;
    const total = this.testResults.length;

    console.log(`\n📊 Résumé des tests: ${passed}/${total} passés`);

    if (passed === total) {
      console.log('🎉 Tous les tests de 2FA sont passés !');
    } else {
      console.log('❌ Certains tests ont échoué. Vérifiez la logique de détection 2FA.');
    }
  }
}

// =============================================================================
// EXÉCUTION DES TESTS
// =============================================================================

console.log('🚀 Testeur de 2FA pour Eminium Launcher');
console.log('=====================================');

const tester = new TwoFactorTester();
tester.testTwoFactorDetection();
tester.showTestSummary();

console.log('\n💡 Si tous les tests passent, la logique de 2FA fonctionne correctement.');
console.log('🔍 Vérifiez que votre serveur Azuriom renvoie bien l\'un des formats de réponse 2FA détectés.');
