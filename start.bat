@echo off
REM Script de démarrage pour Eminium Launcher (Windows)
echo 🚀 Démarrage d'Eminium Launcher...
echo 📁 Interface : src/renderer/index.html
echo 📦 JavaScript : src/renderer/launcher.js
echo ⚙️  Configuration : launcher-config.env
echo.
echo 💡 Ouvrez la console développeur (F12) pour voir les logs détaillés
echo.
electron . --dev
