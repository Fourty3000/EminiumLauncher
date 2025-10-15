// Script de diagnostic d'authentification pour EminiumLauncher
// Utilisez cette fonction dans la console du navigateur pour diagnostiquer les problèmes

window.debugAuthIssues = async function() {
  console.log('🔧 DIAGNOSTIC D\'AUTHENTIFICATION EMINIUM LAUNCHER');
  console.log('==============================================');

  try {
    // 1. Vérifier les éléments DOM
    console.log('\n📋 VÉRIFICATION DES ÉLÉMENTS DOM:');
    const elements = {
      'Formulaire de connexion': document.getElementById('loginForm'),
      'Champ email': document.getElementById('email'),
      'Champ mot de passe': document.getElementById('password'),
      'Champ 2FA': document.getElementById('code2fa'),
      'Bouton de connexion': document.getElementById('loginBtn'),
      'Bouton OAuth': document.getElementById('oauthBtn'),
      'Section d\'authentification': document.getElementById('authSection')
    };

    Object.entries(elements).forEach(([name, element]) => {
      console.log(`${name}: ${element ? '✅' : '❌'}`);
    });

    // 2. Vérifier l'état d'authentification
    console.log('\n🔐 ÉTAT D\'AUTHENTIFICATION:');
    if (window.AuthManager) {
      const authState = window.AuthManager.getAuthState();
      console.log('AuthManager existe:', '✅');
      console.log('État d\'authentification:', authState);
    } else {
      console.log('AuthManager:', '❌ NON TROUVÉ');
    }

    // 3. Tester la connexion réseau
    console.log('\n🌐 TEST DE CONNEXION RÉSEAU:');
    try {
      const response = await fetch('https://eminium.ovh/verify', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'EminiumLauncher/1.0'
        },
        body: JSON.stringify({ access_token: 'test' }),
        signal: AbortSignal.timeout(5000)
      });

      console.log(`Serveur Eminium: ${response.ok ? '✅' : '❌'} (${response.status})`);
      if (!response.ok) {
        console.log('Réponse du serveur:', await response.text());
      }
    } catch (error) {
      console.log('Erreur de connexion:', error.message);
    }

    // 4. Vérifier les dépendances
    console.log('\n📦 VÉRIFICATION DES DÉPENDANCES:');
    const dependencies = {
      'DOMUtils': !!window.DOMUtils,
      'AuthManager': !!window.AuthManager,
      'Logger': !!window.Logger,
      'ErrorManager': !!window.ErrorManager,
      'UIHelpers': !!window.UIHelpers
    };

    Object.entries(dependencies).forEach(([name, exists]) => {
      console.log(`${name}: ${exists ? '✅' : '❌'}`);
    });

    // 5. Vérifier les erreurs JavaScript
    console.log('\n🐛 ERREURS JAVASCRIPT:');
    const errors = window.errorLogs || [];
    console.log(`Erreurs détectées: ${errors.length}`);
    errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });

    // 6. Test de débogage AuthManager
    if (window.AuthManager && window.AuthManager.debugAuth) {
      console.log('\n🔧 TEST DE DÉBOGAGE AUTHMANAGER:');
      const debugResult = await window.AuthManager.debugAuth();
      console.log('Résultat du débogage:', debugResult);
    }

    console.log('\n==============================================');
    console.log('✅ DIAGNOSTIC TERMINÉ');

    return {
      domElements: elements,
      authState: window.AuthManager?.getAuthState(),
      dependencies: dependencies,
      errors: errors
    };

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
    return { error: error.message };
  }
};

// Instructions d'utilisation
console.log(`
📖 INSTRUCTIONS D'UTILISATION:
1. Ouvrez la console du navigateur (F12)
2. Collez et exécutez: await window.debugAuthIssues()
3. Vérifiez les résultats ci-dessus
4. Les problèmes détectés seront marqués avec ❌

🔧 CORRECTIONS COURANTES:
- Si DOMUtils est manquant: Vérifiez que dom-utils.js est chargé
- Si AuthManager est manquant: Vérifiez que auth-manager.js est chargé
- Si le serveur ne répond pas: Vérifiez votre connexion internet
- Si les éléments DOM sont manquants: Vérifiez le HTML
`);
