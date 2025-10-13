/**
 * DOM Utilities for Eminium Launcher
 * Provides common DOM operations to reduce code duplication
 */

(function() {
  // Check if already loaded
  if (window.DOMUtils) {
    return;
  }

  // Cache for DOM elements to avoid repeated queries
  const _domCache = new Map();
  
  // Private helper functions
  function _getElementFromCache(id) {
    return _domCache.get(id) || null;
  }
  
  function _setElementInCache(id, element) {
    if (element) {
      _domCache.set(id, element);
    }
    return element;
  }

  // Get DOM element with caching
  function getElement(id, useCache = true) {
    if (useCache && _domCache.has(id)) {
      return _domCache.get(id);
    }

    const element = document.getElementById(id);
    if (useCache && element) {
      _domCache.set(id, element);
    }
    return element;
  }

  // Get multiple DOM elements by IDs
  function getElements(ids, useCache = true) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    return ids.map(id => getElement(id, useCache));
  }

  // Clear DOM cache (useful when DOM changes)
  function clearDOMCache() {
    _domCache.clear();
  }

  // Safe add event listener with null check
  function addEventListener(elementId, eventType, handler, options = {}) {
    const element = getElement(elementId);
    if (element) {
      element.addEventListener(eventType, handler, options);
      return true;
    }
    return false;
  }

  // Safe add event listener to multiple elements
  function addEventListeners(elementIds, eventType, handler, options = {}) {
    if (!Array.isArray(elementIds)) {
      elementIds = [elementIds];
    }
    
    return elementIds.map(id => addEventListener(id, eventType, handler, options));
  }

  // Remove event listener safely
  function removeEventListener(elementId, eventType, handler) {
    const element = getElement(elementId);
    if (element) {
      element.removeEventListener(eventType, handler);
      return true;
    }
    return false;
  }

  // Set element text content safely
  function setText(elementId, text) {
    const element = getElement(elementId);
    if (element) {
      element.textContent = text;
      return true;
    }
    return false;
  }

  // Get element value safely
  function getValue(elementId, defaultValue = '') {
    const element = getElement(elementId);
    return element ? element.value : defaultValue;
  }

  // Set element value safely
  function setValue(elementId, value) {
    const element = getElement(elementId);
    if (element) {
      element.value = value;
      return true;
    }
    return false;
  }

  // Toggle class on element
  function toggleClass(elementId, className, force) {
    const element = getElement(elementId);
    if (element) {
      element.classList.toggle(className, force);
      return true;
    }
    return false;
  }

  // Add class to element
  function addClass(elementId, className) {
    const element = getElement(elementId);
    if (element) {
      element.classList.add(className);
      return true;
    }
    return false;
  }

  // Remove class from element
  function removeClass(elementId, className) {
    const element = getElement(elementId);
    if (element) {
      element.classList.remove(className);
      return true;
    }
    return false;
  }

  // Check if element has class
  function hasClass(elementId, className) {
    const element = getElement(elementId);
    return element ? element.classList.contains(className) : false;
  }

  // Set element display style
  function setDisplay(elementId, display) {
    const element = getElement(elementId);
    if (element) {
      element.style.display = display;
      return true;
    }
    return false;
  }

  // Show element
  function show(elementId, display = 'block') {
    return setDisplay(elementId, display);
  }

  // Hide element
  function hide(elementId) {
    return setDisplay(elementId, 'none');
  }

  // Toggle element visibility
  function toggle(elementId, display = 'block') {
    const element = getElement(elementId);
    if (element) {
      if (element.style.display === 'none') {
        element.style.display = display;
      } else {
        element.style.display = 'none';
      }
      return true;
    }
    return false;
  }

  // Set element disabled state
  function setDisabled(elementId, disabled) {
    const element = getElement(elementId);
    if (element) {
      element.disabled = !!disabled;
      return true;
    }
    return false;
  }

  // Check if element is disabled
  function isDisabled(elementId) {
    const element = getElement(elementId);
    return element ? element.disabled : false;
  }

  // Set element attribute
  function setAttribute(elementId, attribute, value) {
    const element = getElement(elementId);
    if (element) {
      element.setAttribute(attribute, value);
      return true;
    }
    return false;
  }

  // Get element attribute
  function getAttribute(elementId, attribute, defaultValue = null) {
    const element = getElement(elementId);
    return element ? element.getAttribute(attribute) || defaultValue : defaultValue;
  }

  // Remove element attribute
  function removeAttribute(elementId, attribute) {
    const element = getElement(elementId);
    if (element) {
      element.removeAttribute(attribute);
      return true;
    }
    return false;
  }

  // Create element with attributes and children
  function createElement(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key === 'html') {
        element.innerHTML = value;
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else {
        element[key] = value;
      }
    });
    
    // Append children
    if (Array.isArray(children)) {
      children.forEach(child => {
        if (child instanceof Node) {
          element.appendChild(child);
        } else if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        }
      });
    } else if (children) {
      element.appendChild(children);
    }
    
    return element;
  }

  // Remove element from DOM
  function removeElement(elementId) {
    const element = getElement(elementId);
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
      _domCache.delete(elementId);
      return true;
    }
    return false;
  }

  // Query selector with caching
  function querySelector(selector, useCache = true) {
    if (useCache && _domCache.has(selector)) {
      return _domCache.get(selector);
    }
    
    const element = document.querySelector(selector);
    if (useCache && element) {
      _domCache.set(selector, element);
    }
    return element;
  }

  // Query selector all with caching
  function querySelectorAll(selector, useCache = true) {
    if (useCache && _domCache.has(selector)) {
      return _domCache.get(selector);
    }
    
    const elements = document.querySelectorAll(selector);
    if (useCache && elements.length > 0) {
      _domCache.set(selector, elements);
    }
    return elements;
  }

  // Batch DOM operations for better performance
  function batchDOMOperations(operations) {
    const fragment = document.createDocumentFragment();
    
    operations.forEach(operation => {
      if (typeof operation === 'function') {
        operation(fragment);
      }
    });
    
    return fragment;
  }

  // Debounce function for DOM operations
  function debounceDOM(func, wait = 100) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function for DOM operations
  function throttleDOM(func, limit = 100) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Check if element exists in DOM
  function elementExists(elementId) {
    return !!getElement(elementId, false);
  }

  // Wait for element to exist in DOM
  function waitForElement(elementId, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = getElement(elementId, false);
      if (element) {
        return resolve(element);
      }

      const observer = new MutationObserver(() => {
        const element = getElement(elementId, false);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element with ID "${elementId}" not found within ${timeout}ms`));
      }, timeout);
    });
  }

  // Create public API
  const DOMUtils = {
    getElement,
    getElements,
    clearDOMCache,
    addEventListener,
    addEventListeners,
    removeEventListener,
    setText,
    getValue,
    setValue,
    toggleClass,
    addClass,
    removeClass,
    hasClass,
    setDisplay,
    show,
    hide,
    toggle,
    setDisabled,
    isDisabled,
    setAttribute,
    getAttribute,
    removeAttribute,
    createElement,
    removeElement,
    querySelector,
    querySelectorAll,
    batchDOMOperations,
    debounce: debounceDOM,
    throttle: throttleDOM,
    elementExists,
    waitForElement
  };

  // Expose to window
  window.DOMUtils = DOMUtils;

  // Export for CommonJS
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMUtils;
  }
})();
