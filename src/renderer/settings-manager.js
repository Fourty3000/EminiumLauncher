/**
 * Settings Manager for Eminium Launcher
 * Handles all game settings and system configuration
 */

// Check if already loaded
if (typeof window !== 'undefined' && window.SettingsManager && window.SettingsManager.initialized) {
  // Already loaded, no need to continue
  throw new Error('SettingsManager already initialized');
}

// Settings state
let _settingsState;
if (typeof globalThis !== 'undefined' && !globalThis._settingsState) {
  globalThis._settingsState = _settingsState = {
    initialized: false,
    settings: {},
    listeners: []
  };
} else if (typeof globalThis !== 'undefined') {
  _settingsState = globalThis._settingsState;
} else {
  _settingsState = {
    initialized: false,
    settings: {},
    listeners: []
  };
}

// Default settings
_settingsState.settings = {
  memMB: 2048,
  renderDist: 12,
  fpsCap: 120,
  vsync: false,
  fpsUnlimited: false,
  detectedRamMB: null,
  saveTimer: null
};

// Settings DOM elements
let _settingsElements = {
  memSlider: null,
  memLabel: null,
  ramInfo: null,
  render: null,
  renderLabel: null,
  fps: null,
  fpsLabel: null,
  fpsUnlimited: null,
  vsync: null
};

// Initialize settings elements
function initSettingsElements() {
  if (window.DOMUtils) {
    // Get elements individually since there's no getElements function
    _settingsElements.memSlider = window.DOMUtils.getElement('memSlider');
    _settingsElements.memLabel = window.DOMUtils.getElement('memLabel');
    _settingsElements.ramInfo = window.DOMUtils.getElement('ramInfo');
    _settingsElements.render = window.DOMUtils.getElement('renderDist');
    _settingsElements.renderLabel = window.DOMUtils.getElement('renderLabel');
    _settingsElements.fps = window.DOMUtils.getElement('fpsCap');
    _settingsElements.fpsLabel = window.DOMUtils.getElement('fpsLabel');
    _settingsElements.fpsUnlimited = window.DOMUtils.getElement('fpsUnlimited');
    _settingsElements.vsync = window.DOMUtils.getElement('vsync');
  }
}

// Load settings from storage
async function loadSettings() {
  try {
    const result = await window.eminium.getSettings();
    if (result && result.ok && result.settings) {
      applySettings(result.settings);
    }
  } catch (error) {
    console.warn('Error loading settings:', error);
  }
}

// Save settings to storage
async function saveSettings(patch) {
  try {
    await window.eminium.setSettings(patch);
  } catch (error) {
    console.warn('Error saving settings:', error);
  }
}

// Read current settings from UI
function readCurrentSettings() {
  return {
    memMB: parseInt(_settingsElements.memSlider?.value, 10) || 2048,
    renderDist: parseInt(_settingsElements.render?.value, 10) || 12,
    fpsCap: parseInt(_settingsElements.fps?.value, 10) || 120,
    vsync: _settingsElements.vsync?.classList.contains('active') || false,
    fpsUnlimited: _settingsElements.fpsUnlimited?.classList.contains('active') || false
  };
}

// Apply settings to UI
function applySettings(settings) {
  if (!settings || typeof settings !== 'object') return;

  if (typeof settings.memMB === 'number' && _settingsElements.memSlider) {
    _settingsElements.memSlider.value = String(settings.memMB);
    updateMemLabel();
  }

  if (typeof settings.renderDist === 'number' && _settingsElements.render) {
    _settingsElements.render.value = String(settings.renderDist);
    updateRenderLabel();
  }

  if (typeof settings.fpsCap === 'number' && _settingsElements.fps) {
    _settingsElements.fps.value = String(settings.fpsCap);
    if (!_settingsElements.fpsUnlimited?.classList.contains('active')) {
      _settingsElements.fpsLabel.textContent = String(settings.fpsCap);
    }
  }

  if (typeof settings.vsync === 'boolean' && _settingsElements.vsync) {
    if (settings.vsync && !_settingsElements.vsync.classList.contains('active')) {
      _settingsElements.vsync.classList.add('active');
    } else if (!settings.vsync && _settingsElements.vsync.classList.contains('active')) {
      _settingsElements.vsync.classList.remove('active');
    }
  }

  if (typeof settings.fpsUnlimited === 'boolean' && _settingsElements.fpsUnlimited) {
    if (settings.fpsUnlimited && !_settingsElements.fpsUnlimited.classList.contains('active')) {
      _settingsElements.fpsUnlimited.classList.add('active');
    } else if (!settings.fpsUnlimited && _settingsElements.fpsUnlimited.classList.contains('active')) {
      _settingsElements.fpsUnlimited.classList.remove('active');
    }
  }

  syncFPS();
  warnIfTooHigh(_settingsState.settings.detectedRamMB);
}

// Debounced settings save (optimized performance)
function settingsDebouncedSave() {
  // Clear existing timer
  if (_settingsState.settings.saveTimer) {
    clearTimeout(_settingsState.settings.saveTimer);
  }

  // Set new timer with reduced delay for better responsiveness
  _settingsState.settings.saveTimer = setTimeout(async () => {
    try {
      const currentSettings = readCurrentSettings();
      await saveSettings(currentSettings);
      _settingsState.settings.saveTimer = null;
    } catch (error) {
      console.warn('Error in debounced settings save:', error);
    }
  }, 500); // Reduced from 1000ms to 500ms for better UX
}

// Update memory label
function updateMemLabel() {
  if (_settingsElements.memSlider && _settingsElements.memLabel) {
    _settingsElements.memLabel.textContent = `${_settingsElements.memSlider.value} Mo`;
  }
}

// Update render distance label
function updateRenderLabel() {
  if (_settingsElements.render && _settingsElements.renderLabel) {
    _settingsElements.renderLabel.textContent = `${_settingsElements.render.value} chunks`;
  }
}

// Warn if memory allocation is too high
function warnIfTooHigh(totalMB) {
  if (!_settingsElements.ramInfo || !_settingsElements.memSlider) return;

  const selected = parseInt(_settingsElements.memSlider.value, 10) || 2048;
  if (!totalMB) return;

  const seventy = Math.floor(totalMB * 0.7);
  if (selected > seventy) {
    _settingsElements.ramInfo.innerHTML = `RAM système: ${Math.round(totalMB / 1024)} Go — <span style="color:#fca5a5;">Attention:</span> vous allouez plus de 70% de la RAM.`;
  } else {
    _settingsElements.ramInfo.textContent = `RAM système: ${Math.round(totalMB / 1024)} Go`;
  }
}

// Sync FPS controls
function syncFPS() {
  if (!_settingsElements.fps || !_settingsElements.fpsLabel || !_settingsElements.fpsUnlimited) return;

  const unlimited = _settingsElements.fpsUnlimited.classList.contains('active');
  _settingsElements.fps.disabled = unlimited;

  if (unlimited) {
    _settingsElements.fpsLabel.textContent = 'Illimité';
    _settingsElements.fps.classList.add('dim');
    _settingsElements.fps.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.10), rgba(255,255,255,0.10))';
  } else {
    _settingsElements.fpsLabel.textContent = String(_settingsElements.fps.value);
    _settingsElements.fps.classList.remove('dim');
  }
}

// Detect system RAM and configure slider
async function detectSystemRAM() {
  if (!_settingsElements.memSlider || !_settingsElements.ramInfo) return;

  try {
    const info = await (window.eminium?.getSystemRamMB ? window.eminium.getSystemRamMB() : Promise.resolve({ ok: true, totalMB: 8192 }));
    const total = info?.totalMB || 8192;
    _settingsState.settings.detectedRamMB = total;

    // Set max to 85% of total RAM (rounded to nearest 256MB)
    const maxAlloc = Math.max(1024, Math.floor((total * 0.85) / 256) * 256);
    _settingsElements.memSlider.max = String(maxAlloc);

    // Adjust current value if it exceeds max
    if (parseInt(_settingsElements.memSlider.value, 10) > maxAlloc) {
      _settingsElements.memSlider.value = String(Math.min(maxAlloc, 4096));
    }

    updateMemLabel();
    warnIfTooHigh(total);
    _settingsElements.ramInfo.title = `Total détecté: ${total} Mo`;

  } catch (error) {
    console.warn('Error detecting system RAM:', error);
    _settingsState.settings.detectedRamMB = null;
    updateMemLabel();
    _settingsElements.ramInfo.textContent = 'Impossible de détecter la RAM système';
  }
}

// Initialize settings event listeners
function initSettingsListeners() {
  if (!_settingsElements.memSlider) return;

  // Memory slider
  _settingsElements.memSlider.addEventListener('input', () => {
    updateMemLabel();
    warnIfTooHigh(_settingsState.settings.detectedRamMB);
    settingsDebouncedSave();
  });

  // Render distance
  if (_settingsElements.render) {
    _settingsElements.render.addEventListener('input', () => {
      updateRenderLabel();
    });
    _settingsElements.render.addEventListener('change', settingsDebouncedSave);
  }

  // FPS cap
  if (_settingsElements.fps) {
    _settingsElements.fps.addEventListener('input', () => {
      if (!_settingsElements.fpsUnlimited.classList.contains('active')) {
        _settingsElements.fpsLabel.textContent = String(_settingsElements.fps.value);
      }
    });
    _settingsElements.fps.addEventListener('change', settingsDebouncedSave);
  }

  // FPS unlimited toggle
  if (_settingsElements.fpsUnlimited) {
    _settingsElements.fpsUnlimited.addEventListener('change', () => {
      syncFPS();
      settingsDebouncedSave();
    });
  }

  // VSync toggle
  if (_settingsElements.vsync) {
    _settingsElements.vsync.addEventListener('change', settingsDebouncedSave);
  }
}

// Refresh play options UI
function refreshPlayOptionsUI() {
  syncFPS();
  updateMemLabel();
  updateRenderLabel();
  warnIfTooHigh(_settingsState.settings.detectedRamMB);
}

// Initialize settings manager (optimized to prevent redundant calls)
async function initSettingsManager() {
  // Prevent double initialization
  if (_settingsState.initialized) {
    return;
  }

  try {
    initSettingsElements();
    await detectSystemRAM();
    await loadSettings();
    initSettingsListeners();
    refreshPlayOptionsUI();

    _settingsState.initialized = true;
    console.log('[Settings] Settings manager initialized successfully');
  } catch (error) {
    console.error('[Settings] Failed to initialize settings manager:', error);
  }
}

// Store in globalThis to persist across reloads
if (typeof globalThis !== 'undefined' && !globalThis.SettingsManager) {
  globalThis.SettingsManager = {
    initialized: false,
    loadSettings,
    saveSettings,
    readCurrentSettings,
    applySettings,
    settingsDebouncedSave,
    updateMemLabel,
    updateRenderLabel,
    warnIfTooHigh,
    syncFPS,
    detectSystemRAM,
    initSettingsListeners,
    refreshPlayOptionsUI,
    initSettingsManager
  };
}

// Also expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.SettingsManager = globalThis.SettingsManager;
}
