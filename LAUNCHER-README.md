# 🚀 Eminium Launcher

Un launcher Minecraft moderne avec authentification Azuriom complète.

## ✨ Fonctionnalités

- **Authentification Azuriom** complète selon l'API officielle
- **Support du 2FA** automatique
- **Interface moderne** et responsive
- **Gestion d'erreurs** robuste
- **Logs détaillés** pour le débogage

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 16+
- Un serveur Azuriom fonctionnel

### Installation
```bash
npm install
```

### Configuration
1. Modifiez `launcher-config.env` :
```env
AZURIOM_URL=https://votre-serveur-azuriom.com
DEBUG=true
```

### Démarrage
```bash
# Linux/Mac
./start.sh

# Windows
start.bat

# Ou directement
npm start
```

## 🔧 Configuration

### Variables d'environnement
| Variable | Description | Défaut |
|----------|-------------|---------|
| `AZURIOM_URL` | URL de votre serveur Azuriom | `https://eminium.ovh` |
| `DEBUG` | Activer les logs détaillés | `true` |

### Authentification Azuriom
Le launcher utilise l'API directe d'Azuriom :
- ✅ Authentification par email/mot de passe
- ✅ Support automatique du 2FA
- ✅ Gestion des erreurs HTTP
- ✅ Interface utilisateur intuitive

## 🛠️ Développement

### Structure du projet
```
src/
├── main.js           # Processus principal Electron
├── preload.js        # Script de preload sécurisé
├── renderer/
│   ├── index.html    # Interface utilisateur
│   └── launcher.js   # Logique d'authentification
└── setup.js          # Installation et préparation
```

### Logs de débogage
Ouvrez la console développeur (F12) pour voir :
- ✅ Initialisation de l'application
- ✅ Tentatives d'authentification
- ✅ Réponses du serveur Azuriom
- ✅ Gestion des erreurs

## 🔒 Sécurité

- ✅ Gestion sécurisée des tokens
- ✅ Prévention des attaques CSRF
- ✅ Validation des entrées utilisateur
- ✅ Gestion des erreurs sans fuite d'informations

## 📝 Support

Pour les problèmes d'authentification Azuriom :
1. Vérifiez que votre serveur répond correctement
2. Consultez les logs dans la console
3. Vérifiez la configuration réseau

---

**Développé avec ❤️ pour la communauté Eminium**
