/**
 * Enhanced Updater Manager for Eminium Launcher
 * Provides comprehensive update checking, downloading, and installation with better UX
 */

// Check if updater manager is already initialized
if (typeof window !== 'undefined' && window.UpdaterManager && window.UpdaterManager.initialized) {
  // Already loaded, no need to continue
  throw new Error('UpdaterManager already initialized');
}

// Initialize or get existing updater state
let _updaterState;
if (typeof globalThis !== 'undefined' && !globalThis._updaterState) {
  globalThis._updaterState = _updaterState = {
    checking: false,
    downloading: false,
    applying: false,
    currentVersion: null,
    latestVersion: null,
    downloadProgress: 0,
    updateAvailable: false,
    updateInfo: null,
    error: null,
    lastCheck: null,
    downloaded: false,
    downloadedPath: null
  };
} else if (typeof globalThis !== 'undefined') {
  _updaterState = globalThis._updaterState;
} else {
  _updaterState = {
    checking: false,
    downloading: false,
    applying: false,
    currentVersion: null,
    latestVersion: null,
    downloadProgress: 0,
    updateAvailable: false,
    updateInfo: null,
    error: null,
    lastCheck: null,
    downloaded: false,
    downloadedPath: null
  };
}

// Update configuration
const UPDATE_CONFIG = {
  autoCheckInterval: 30 * 60 * 1000, // 30 minutes
  checkOnStartup: true,
  checkOnNetworkChange: true,
  maxRetries: 3,
  retryDelay: 5000,
  showNotifications: true,
  allowPrerelease: false,
  backupBeforeUpdate: true
};

// Initialize updater manager
async function initUpdaterManager() {
  try {
    console.log('[Updater] Initializing updater manager...');
    
    // Get current version
    if (window.eminium && window.eminium.getVersion) {
      const versionInfo = await window.eminium.getVersion();
      _updaterState.currentVersion = versionInfo.version || '1.0.1';
    } else {
      _updaterState.currentVersion = '1.0.1';
    }
    
    console.log('[Updater] Current version:', _updaterState.currentVersion);
    
    // Set up event listeners
    setupUpdaterEventListeners();
    
    // Load update history
    loadUpdateHistory();
    
    // Initial UI update
    updateUpdateUI();
    
    // Start periodic checks if enabled
    if (UPDATE_CONFIG.checkOnStartup) {
      startPeriodicChecks();
    }
    
    console.log('[Updater] Updater manager initialized');
  } catch (error) {
    console.error('[Updater] Failed to initialize updater manager:', error);
  }
}

// Set up updater event listeners
function setupUpdaterEventListeners() {
  // Listen for online/offline status changes
  window.addEventListener('online', () => {
    console.log('[Updater] Network online, checking for updates...');
    checkForUpdates(false);
  });
  
  // Listen for manual check button click
  const checkForUpdatesBtn = document.getElementById('checkForUpdatesBtn');
  if (checkForUpdatesBtn) {
    checkForUpdatesBtn.addEventListener('click', () => checkForUpdates(true));
  }
  
  // Listen for install update button click
  const installUpdateBtn = document.getElementById('installUpdateBtn');
  if (installUpdateBtn) {
    installUpdateBtn.addEventListener('click', applyUpdate);
  }
}

// Handle update progress
function handleUpdateProgress(data) {
  if (!data) return;
  
  const { type, progress, message } = data;
  
  switch (type) {
    case 'checking':
      _updaterState.checking = true;
      _updaterState.downloading = false;
      _updaterState.applying = false;
      _updaterState.error = null;
      break;
      
    case 'download-progress':
      _updaterState.downloading = true;
      _updaterState.downloadProgress = progress || 0;
      break;
      
    case 'downloaded':
      _updaterState.downloading = false;
      _updaterState.downloaded = true;
      _updaterState.downloadProgress = 100;
      break;
      
    case 'error':
      _updaterState.error = message || 'An error occurred';
      _updaterState.checking = false;
      _updaterState.downloading = false;
      _updaterState.applying = false;
      break;
      
    case 'update-available':
      _updaterState.updateAvailable = true;
      _updaterState.updateInfo = data.updateInfo;
      _updaterState.latestVersion = data.updateInfo.version;
      break;
      
    case 'update-not-available':
      _updaterState.updateAvailable = false;
      _updaterState.updateInfo = null;
      _updaterState.latestVersion = _updaterState.currentVersion;
      break;
  }
  
  updateUpdateUI();
}

// Check for updates
async function checkForUpdates(showProgress = true) {
  if (_updaterState.checking || !window.updater) {
    console.log('[Updater] Check already in progress or updater not available');
    return { ok: false, error: 'Updater not available or already checking' };
  }
  
  _updaterState.checking = true;
  _updaterState.lastCheck = new Date();
  _updaterState.error = null;
  updateUpdateUI();
  
  if (showProgress) {
    window.ProgressUI?.open('Vérification des mises à jour');
    window.ProgressUI?.set(10);
    window.ProgressUI?.addLine('Recherche de mises à jour...');
  }
  
  try {
    const result = await window.updater.checkForUpdates();
    
    if (result?.updateInfo) {
      console.log('[Updater] Update available:', result.updateInfo.version);
      _updaterState.updateAvailable = true;
      _updaterState.updateInfo = result.updateInfo;
      _updaterState.latestVersion = result.updateInfo.version;
      
      if (showProgress) {
        window.ProgressUI?.set(100);
        window.ProgressUI?.addLine(`Mise à jour disponible: v${result.updateInfo.version}`);
        showUpdateNotification(result.updateInfo);
      }
      
      return { ok: true, updateAvailable: true, info: result.updateInfo };
    } else {
      console.log('[Updater] No updates available');
      _updaterState.updateAvailable = false;
      _updaterState.updateInfo = null;
      _updaterState.latestVersion = _updaterState.currentVersion;
      
      if (showProgress) {
        window.ProgressUI?.set(100);
        window.ProgressUI?.addLine('Votre application est à jour');
        window.ProgressUI?.close(2000);
      }
      
      return { ok: true, updateAvailable: false };
    }
  } catch (error) {
    console.error('[Updater] Error checking for updates:', error);
    _updaterState.error = error.message || 'Failed to check for updates';
    
    if (showProgress) {
      window.ProgressUI?.setError('Échec de la vérification des mises à jour');
      handleUpdateError(error);
    }
    
    return { ok: false, error: error.message };
  } finally {
    _updaterState.checking = false;
    _updaterState.lastCheck = new Date();
    updateUpdateUI();
    
    if (showProgress) {
      setTimeout(() => window.ProgressUI?.close(2000), 2000);
    }
  }
}

// Download update
async function downloadUpdate() {
  if (!_updaterState.updateAvailable || !_updaterState.updateInfo) {
    console.log('[Updater] No update available to download');
    return { ok: false, error: 'No update available to download' };
  }
  
  if (_updaterState.downloading) {
    console.log('[Updater] Download already in progress');
    return { ok: false, error: 'Download already in progress' };
  }
  
  _updaterState.downloading = true;
  _updaterState.error = null;
  updateUpdateUI();
  
  window.ProgressUI?.open('Téléchargement de la mise à jour');
  window.ProgressUI?.set(0);
  window.ProgressUI?.addLine('Préparation du téléchargement...');
  
  try {
    console.log('[Updater] Starting download...');
    
    const result = await window.updater.downloadUpdate(_updaterState.updateInfo, (progress) => {
      const percent = Math.round(progress.percent || 0);
      window.ProgressUI?.set(percent);
      window.ProgressUI?.setStatus(`Téléchargement... ${percent}%`);
      
      if (progress.bytesPerSecond) {
        const speed = formatBytes(progress.bytesPerSecond);
        window.ProgressUI?.addLine(`Vitesse: ${speed}/s`);
      }
    });
    
    if (result?.success) {
      console.log('[Updater] Download completed successfully');
      _updaterState.downloaded = true;
      _updaterState.downloadedPath = result.path;
      
      window.ProgressUI?.set(100);
      window.ProgressUI?.addLine('Téléchargement terminé avec succès');
      window.ProgressUI?.addLine('Prêt à installer');
      
      return { ok: true, path: result.path };
    } else {
      throw new Error(result?.error || 'Échec du téléchargement');
    }
  } catch (error) {
    console.error('[Updater] Download error:', error);
    _updaterState.error = error.message || 'Erreur lors du téléchargement';
    
    window.ProgressUI?.setError('Échec du téléchargement');
    window.ProgressUI?.addLine(`Erreur: ${error.message}`);
    
    return { ok: false, error: error.message };
  } finally {
    _updaterState.downloading = false;
    updateUpdateUI();
  }
}

// Apply update
async function applyUpdate() {
  if (!_updaterState.downloaded || !_updaterState.downloadedPath) {
    console.log('[Updater] No update downloaded to apply');
    return { ok: false, error: 'No update downloaded to apply' };
  }
  
  console.log('[Updater] Applying update...');
  
  try {
    window.ProgressUI?.open('Installation de la mise à jour');
    window.ProgressUI?.set(0);
    window.ProgressUI?.addLine('Installation en cours...');
    
    const result = await window.updater.quitAndInstall();
    
    if (result?.success) {
      console.log('[Updater] Update applied successfully');
      return { ok: true };
    } else {
      throw new Error(result?.error || 'Échec de l\'installation');
    }
  } catch (error) {
    console.error('[Updater] Apply update error:', error);
    _updaterState.error = error.message || 'Erreur lors de l\'installation';
    
    window.ProgressUI?.setError('Échec de l\'installation');
    window.ProgressUI?.addLine(`Erreur: ${error.message}`);
    
    return { ok: false, error: error.message };
  }
}

// Show update notification
function showUpdateNotification(updateInfo) {
  if (!updateInfo?.version || !UPDATE_CONFIG.showNotifications) return;
  
  const notification = document.createElement('div');
  notification.className = 'update-notification';
  notification.innerHTML = `
    <div class="update-notification-content">
      <div class="update-notification-title">Mise à jour disponible !</div>
      <div class="update-notification-message">
        Version ${updateInfo.version} disponible. Voulez-vous l'installer maintenant ?
      </div>
      <div class="update-notification-actions">
        <button class="btn-secondary" id="installUpdateBtn">Installer maintenant</button>
        <button class="btn-text" id="remindMeLaterBtn">Plus tard</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  const installBtn = notification.querySelector('#installUpdateBtn');
  const remindBtn = notification.querySelector('#remindMeLaterBtn');
  
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      notification.remove();
      await downloadUpdate();
      await applyUpdate();
    });
  }
  
  if (remindBtn) {
    remindBtn.addEventListener('click', () => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    });
  }
  
  // Auto-close after 30 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }
  }, 30000);
}

// Handle update error
function handleUpdateError(error) {
  if (!error) return;
  
  console.error('[Updater] Update error:', error);
  
  const errorMessage = error.message || 'Une erreur est survenue lors de la mise à jour';
  
  // Show error notification
  const notification = document.createElement('div');
  notification.className = 'update-notification error';
  notification.innerHTML = `
    <div class="update-notification-content">
      <div class="update-notification-title">Erreur de mise à jour</div>
      <div class="update-notification-message">${errorMessage}</div>
      <div class="update-notification-actions">
        <button class="btn-secondary" id="retryUpdateBtn">Réessayer</button>
        <button class="btn-text" id="dismissErrorBtn">Fermer</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  const retryBtn = notification.querySelector('#retryUpdateBtn');
  const dismissBtn = notification.querySelector('#dismissErrorBtn');
  
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      notification.remove();
      checkForUpdates(true);
    });
  }
  
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    });
  }
  
  // Auto-close after 10 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }
  }, 10000);
}

// Start periodic update checks
function startPeriodicChecks() {
  if (_updateCheckInterval) {
    clearInterval(_updateCheckInterval);
  }

  // Check immediately
  checkForUpdates(false);

  // Then check every 4 hours
  _updateCheckInterval = setInterval(() => {
    checkForUpdates(false);
  }, 4 * 60 * 60 * 1000);}

// Stop periodic update checks
function stopPeriodicChecks() {
  if (_updateCheckInterval) {
    clearInterval(_updateCheckInterval);
    _updateCheckInterval = null;
  }
}

// Update UI elements
function updateUpdateUI() {
  const updateButton = document.getElementById('updateButton');
  const updateStatus = document.getElementById('updateStatus');
  const updateIcon = document.getElementById('updateIcon');
  const updateText = document.getElementById('updateText');
  
  if (!updateButton || !updateStatus || !updateIcon || !updateText) return;
  
  // Update button state
  updateButton.disabled = _updaterState.checking || _updaterState.downloading;
  
  // Update status text and icon based on current state
  if (_updaterState.checking) {
    updateIcon.className = 'fas fa-sync fa-spin';
    updateText.textContent = 'Vérification en cours...';
    updateStatus.textContent = 'Vérification des mises à jour';
    updateStatus.className = 'text-info';
  } else if (_updaterState.downloading) {
    updateIcon.className = 'fas fa-download';
    updateText.textContent = 'Téléchargement...';
    updateStatus.textContent = `Téléchargement (${Math.round(_updaterState.downloadProgress || 0)}%)`;
    updateStatus.className = 'text-info';
  } else if (_updaterState.error) {
    updateIcon.className = 'fas fa-exclamation-circle';
    updateText.textContent = 'Réessayer';
    updateStatus.textContent = _updaterState.error || 'Erreur';
    updateStatus.className = 'text-error';
  } else if (_updaterState.updateAvailable) {
    updateIcon.className = 'fas fa-arrow-circle-down';
    updateText.textContent = 'Mettre à jour';
    updateStatus.textContent = `Version ${_updaterState.latestVersion} disponible`;
    updateStatus.className = 'text-success';
  } else {
    updateIcon.className = 'fas fa-check-circle';
    updateText.textContent = 'Vérifier les mises à jour';
    updateStatus.textContent = 'Votre application est à jour';
    updateStatus.className = 'text-success';
  }
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Load update history
function loadUpdateHistory() {
  try {
    const history = localStorage.getItem('updateHistory');
    if (history) {
      _updaterState.history = JSON.parse(history);
    } else {
      _updaterState.history = [];
    }
  } catch (error) {
    console.error('[Updater] Failed to load update history:', error);
    _updaterState.history = [];
  }
}

// Add to update history
function addToUpdateHistory(entry) {
  if (!entry || !entry.version) return;
  
  try {
    if (!_updaterState.history) {
      _updaterState.history = [];
    }
    
    // Add timestamp if not present
    if (!entry.timestamp) {
      entry.timestamp = new Date().toISOString();
    }
    
    // Add to history
    _updaterState.history.unshift(entry);
    
    // Keep only the last 20 entries
    if (_updaterState.history.length > 20) {
      _updaterState.history = _updaterState.history.slice(0, 20);
    }
    
    // Save to localStorage
    localStorage.setItem('updateHistory', JSON.stringify(_updaterState.history));
  } catch (error) {
    console.error('[Updater] Failed to add to update history:', error);
  }
}

// Get update history
function getUpdateHistory() {
  return _updaterState.history || [];
}

// Check for updates manually (user initiated)
async function checkForUpdatesManual() {
  return await checkForUpdates(true);
}

// Cancel update
function cancelUpdate() {
  stopPeriodicChecks();
}

// Retry update
function retryUpdate() {
  return checkForUpdates(true);
}

// Force update function - clears cache and forces recheck
async function forceUpdate() {
  console.log('[Updater] Forcing update check...');
  
  // Clear any cached update info
  _updaterState.lastCheck = 0;
  _updaterState.updateAvailable = false;
  _updaterState.updateInfo = null;
  _updaterState.latestVersion = _updaterState.currentVersion;
  _updaterState.downloaded = false;
  _updaterState.downloadedPath = null;
  
  // Force a fresh check
  await checkForUpdates(true);
  
  // If update is available, automatically download it
  if (_updaterState.updateAvailable) {
    console.log('[Updater] Update found, forcing download...');
    await downloadUpdate();
  }
}

// Initialize update check interval
let _updateCheckInterval = null;

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUpdaterManager);
} else {
  initUpdaterManager();
}

// Export updater manager
const UpdaterManager = {
  initialized: false,
  initUpdaterManager,
  checkForUpdates,
  downloadUpdate,
  applyUpdate,
  showUpdateNotification,
  handleUpdateError,
  startPeriodicChecks,
  stopPeriodicChecks,
  updateUpdateUI,
  formatBytes,
  loadUpdateHistory,
  addToUpdateHistory,
  getUpdateHistory,
  checkForUpdatesManual,
  cancelUpdate,
  retryUpdate,
  forceUpdate,
  getUpdaterState: () => ({ ..._updaterState })
};

// Export to window if in browser environment
if (typeof window !== 'undefined') {
  window.UpdaterManager = UpdaterManager;
}

// Export for CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdaterManager;
}
