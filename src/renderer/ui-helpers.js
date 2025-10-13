/**
 * UI Helper Functions for Eminium Launcher
 * Contains all UI-related helper functions and utilities
 */

// Create animated background particles (optimized for performance)
function createParticles() {
  const particlesContainer = document.querySelector('.bg-particles');
  if (!particlesContainer) return;
  
  // Clear existing particles
  particlesContainer.innerHTML = '';
  
  // Reduce particle count for better performance
  const particleCount = Math.min(30, Math.floor(window.innerWidth / 50));
  
  // Use requestAnimationFrame for smoother animation
  requestAnimationFrame(() => {
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 20 + 's';
      particle.style.animationDuration = (15 + Math.random() * 10) + 's';
      
      // Add will-change for better performance
      particle.style.willChange = 'transform, opacity';
      
      fragment.appendChild(particle);
    }
    
    particlesContainer.appendChild(fragment);
  });
}

// Lazy loading for images (optimized performance)
function initLazyLoading() {
  const images = document.querySelectorAll('img[data-src]');
  if (!images.length) return;
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        observer.unobserve(img);
        
        // Add fade-in effect
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
          img.style.opacity = '1';
        }, 50);
      }
    });
  }, {
    rootMargin: '50px 0px',
    threshold: 0.1
  });
  
  images.forEach(img => imageObserver.observe(img));
}

// Tab switching functionality (optimized with event delegation)
function initTabSwitching() {
  const navContainer = document.querySelector('.nav-container');
  if (!navContainer) return;
  
  // Use event delegation for better performance
  navContainer.addEventListener('click', (e) => {
    const tab = e.target.closest('.nav-item');
    if (!tab) return;
    
    // Remove active class from all tabs and content sections
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    
    // Add active class to clicked tab
    tab.classList.add('active');
    
    // Show corresponding content section
    const tabId = tab.getAttribute('data-tab');
    const contentSection = document.getElementById(tabId);
    if (contentSection) {
      contentSection.classList.add('active');
    }
  });
}

// Set tabs visibility based on authentication state
function setTabsForAuth(logged, isAdmin = false) {
  const tabs = document.querySelectorAll('.nav-item');
  tabs.forEach(tab => {
    const tabId = tab.getAttribute('data-tab');
    if (tabId === 'auth') {
      tab.style.display = logged ? 'none' : 'flex';
    } else if (tabId === 'admin') {
      tab.style.display = (logged && isAdmin) ? 'flex' : 'none';
    } else {
      tab.style.display = logged ? 'flex' : 'none';
    }
  });
}

// Admin helpers
function isAdminClient(profile) {
  if (!profile || !profile.grade) return false;
  const grade = formatGrade(profile.grade);
  return ['admin', 'administrateur', 'modérateur', 'helper'].some(
    role => grade.toLowerCase().includes(role)
  );
}

function hasPrivilegedAccess(profile) {
  return isAdminClient(profile);
}

// Ensure we can toggle Play content with a replacement image
function ensurePlayReplacement() {
  const playSection = window.DOMUtils?.getElement('play', false);
  if (!playSection) return;
  
  const existingReplacement = playSection.querySelector('.play-replacement');
  if (existingReplacement) return;
  
  const replacement = window.DOMUtils?.createElement('div', { className: 'play-replacement' });
  replacement.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <img src="https://via.placeholder.com/400x200?text=Connectez-vous+pour+jouer" 
           alt="Connectez-vous pour jouer" 
           style="max-width: 100%; height: auto; border-radius: 12px; opacity: 0.7;">
      <p style="margin-top: 20px; color: var(--text-secondary); font-size: 16px;">
        Veuillez vous connecter pour accéder aux options de jeu
      </p>
    </div>
  `;
  replacement.style.display = 'none';
  playSection.appendChild(replacement);
}

function setPlayRestricted(restricted) {
  const playSection = window.DOMUtils?.getElement('play', false);
  if (!playSection) return;
  
  const replacement = playSection.querySelector('.play-replacement');
  const actualContent = playSection.querySelector('.panel');
  
  if (restricted) {
    if (replacement) replacement.style.display = 'block';
    if (actualContent) actualContent.style.display = 'none';
  } else {
    if (replacement) replacement.style.display = 'none';
    if (actualContent) actualContent.style.display = 'block';
  }
}

// Helper: hide/show Connexion tab
function setAuthTabHidden(hidden) {
  const authTab = document.querySelector('.nav-item[data-tab="auth"]');
  if (authTab) {
    authTab.style.display = hidden ? 'none' : 'flex';
  }
}

// Toggle functionality
function initToggleButtons() {
  document.querySelectorAll('.toggle').forEach(toggle => {
    if (!toggle) return;
    
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      
      // Handle specific toggle behaviors
      if (toggle.id === 'fpsUnlimited') {
        const isUnlimited = toggle.classList.contains('active');
        
        if (window.DOMUtils) {
          window.DOMUtils.setDisabled('fps', isUnlimited);
          const fpsValue = window.DOMUtils.getValue('fps', '120');
          window.DOMUtils.setText('fpsLabel', isUnlimited ? 'Illimité' : fpsValue);
          
          if (isUnlimited) {
            window.DOMUtils.addClass('fps', 'dim');
            const fpsSlider = window.DOMUtils.getElement('fps', false);
            if (fpsSlider) {
              fpsSlider.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.10), rgba(255,255,255,0.10))';
            }
          } else {
            window.DOMUtils.removeClass('fps', 'dim');
          }
        }
      }
    });
  });
}

// Grade color helpers
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgba(hex, a) {
  const rgb = hexToRgb(hex);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})` : hex;
}

function paletteColorForGrade(name) {
  const colors = {
    'admin': '#ef4444',
    'administrateur': '#ef4444',
    'modérateur': '#f59e0b',
    'helper': '#10b981',
    'vip': '#8b5cf6',
    'membre': '#6b7280',
    'default': '#6b7280'
  };
  
  const normalizedName = name.toLowerCase().trim();
  return colors[normalizedName] || colors.default;
}

function applyGradeStyle(el, hex, name) {
  if (!el) return;
  el.style.background = hex;
  el.style.color = '#ffffff';
  el.style.boxShadow = `0 4px 12px ${rgba(hex, 0.3)}`;
}

// Toggle skeleton state for profile UI
function setProfileSkeleton(on) {
  const profileCard = document.querySelector('.profile-card');
  if (!profileCard) return;
  
  const profileName = profileCard.querySelector('.profile-name');
  const profileGrade = profileCard.querySelector('.profile-grade');
  
  if (on) {
    if (profileName) profileName.textContent = 'Chargement...';
    if (profileGrade) profileGrade.style.display = 'none';
    profileCard.style.opacity = '0.6';
  } else {
    profileCard.style.opacity = '1';
  }
}

// Format grade text from possible shapes (string | object | array)
function formatGrade(v) {
  if (!v) return 'Membre';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.name) return v.name;
  if (Array.isArray(v) && v.length > 0) return formatGrade(v[0]);
  return 'Membre';
}

// Switch to Play tab
function switchToPlayTab() {
  const playTab = document.querySelector('.nav-item[data-tab="play"]');
  if (playTab) {
    playTab.click();
  }
}

// Show notification to user
function showNotification(message, type = 'info', duration = 5000) {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-icon">${getNotificationIcon(type)}</div>
      <div class="notification-text">${message}</div>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;

  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${getNotificationColor(type)};
    color: white;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 400px;
    animation: slideInRight 0.3s ease-out;
    font-family: 'Inter', sans-serif;
  `;

  // Add to DOM
  document.body.appendChild(notification);

  // Auto remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, duration);
  }

  return notification;
}

// Get notification icon based on type
function getNotificationIcon(type) {
  const icons = {
    'success': '✓',
    'error': '⚠',
    'warning': '⚠',
    'info': 'ℹ'
  };
  return icons[type] || icons.info;
}

// Get notification color based on type
function getNotificationColor(type) {
  const colors = {
    'success': 'rgba(34, 197, 94, 0.9)',
    'error': 'rgba(239, 68, 68, 0.9)',
    'warning': 'rgba(245, 158, 11, 0.9)',
    'info': 'rgba(59, 130, 246, 0.9)'
  };
  return colors[type] || colors.info;
}

// Show modal dialog
function showModal(title, content, buttons = []) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
  `;

  // Create modal content
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  modal.style.cssText = `
    background: var(--gradient-card);
    border: 1px solid var(--border-primary);
    border-radius: 16px;
    padding: 2rem;
    max-width: 500px;
    width: 90%;
    box-shadow: var(--shadow-xl);
    animation: slideUp 0.3s ease;
  `;

  modal.innerHTML = `
    <h3 style="margin-bottom: 1rem; color: var(--text-primary);">${title}</h3>
    <div style="margin-bottom: 1.5rem; color: var(--text-secondary);">${content}</div>
    <div style="display: flex; gap: 1rem; justify-content: flex-end;"></div>
  `;

  // Add buttons
  const buttonContainer = modal.querySelector('div:last-child');
  buttons.forEach(button => {
    const btn = document.createElement('button');
    btn.textContent = button.text;
    btn.className = `btn-${button.type || 'secondary'}`;
    btn.onclick = () => {
      if (button.action) button.action();
      overlay.remove();
    };
    buttonContainer.appendChild(btn);
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  return overlay;
}

// Hide modal dialog
function hideModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Format time ago (e.g., "2 hours ago")
function formatTimeAgo(date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} jour${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} heure${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return `${seconds} seconde${seconds > 1 ? 's' : ''} ago`;
  }
// Set loading state for elements
function setLoadingState(elementId, loading) {
  const element = document.getElementById(elementId);
  if (!element) return;

  if (loading) {
    element.disabled = true;
    element.classList.add('loading');
    const originalText = element.textContent;
    element.setAttribute('data-original-text', originalText);
    element.innerHTML = '<div class="loading-spinner"></div>';
  } else {
    element.disabled = false;
    element.classList.remove('loading');
    const originalText = element.getAttribute('data-original-text');
    if (originalText) {
      element.textContent = originalText;
      element.removeAttribute('data-original-text');
    }
  }
}

// Enhanced animation management for smooth UX
function initEnhancedAnimations() {
  // Smooth scroll behavior
  document.documentElement.style.scrollBehavior = 'smooth';
  
  // Add ripple effect to buttons
  document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.5);
        left: ${x}px;
        top: ${y}px;
        pointer-events: none;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
      `;
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
  
  // Add hover effect to interactive elements
  document.querySelectorAll('.nav-item, .profile-card, .panel, .toggle').forEach(element => {
    element.addEventListener('mouseenter', function() {
      this.style.transform = this.style.transform + ' scale(1.02)';
    });
    
    element.addEventListener('mouseleave', function() {
      this.style.transform = this.style.transform.replace(' scale(1.02)', '');
    });
  });
  
  // Add smooth focus transitions to form inputs
  document.querySelectorAll('.form-input').forEach(input => {
    input.addEventListener('focus', function() {
      this.parentElement.style.transform = 'translateY(-2px)';
    });
    
    input.addEventListener('blur', function() {
      this.parentElement.style.transform = 'translateY(0)';
    });
  });
}

// Add ripple animation to CSS
function addRippleAnimation() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Initialize all UI helpers
function initUIHelpers() {
  createParticles();
  initTabSwitching();
  initLazyLoading();
  initEnhancedAnimations();
  addRippleAnimation();
  
  // Optimize resize handling
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      createParticles();
    }, 250); // Debounced resize handling
  });
}

initToggleButtons();

// Export UI helpers - use globalThis to avoid redeclaration
const UIHelpers = {
  createParticles,
  initTabSwitching,
  initLazyLoading,
  initEnhancedAnimations,
  setProfileSkeleton,
  applyGradeStyle,
  paletteColorForGrade,
  showNotification,
  showModal,
  hideModal,
  setLoadingState,
  formatTimeAgo,
  formatBytes
};

// Merge with existing globalThis.UIHelpers if it exists
Object.assign(UIHelpers, globalThis.UIHelpers || {});

// Store in globalThis to persist across reloads
if (!globalThis.UIHelpers) {
  globalThis.UIHelpers = UIHelpers;
}

// Also expose to window for backward compatibility
if (typeof window !== 'undefined') {
  window.UIHelpers = UIHelpers;
}
}
