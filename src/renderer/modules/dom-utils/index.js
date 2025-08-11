/**
 * DOM Utilities Module
 * Replaces jQuery DOM manipulation functions with vanilla JavaScript
 * Provides jQuery-like syntax for easy migration
 */

import DebugLog from '../debug-log/index.js';
const debugLog = DebugLog;

// jQuery-like selector functions
export const $ = (selector) => {
  if (typeof selector === 'string') {
    return document.querySelector(selector);
  }
  return selector; // Return element if already passed
};

export const $$ = (selector) => {
  if (typeof selector === 'string') {
    return document.querySelectorAll(selector);
  }
  return [selector]; // Return array with element if already passed
};

// DOM manipulation utilities
export const domUtils = {
  // Text content management
  text: (element, text) => {
    const el = $(element);
    if (!el) {
      debugLog.warn('Element not found for text operation');
      return null;
    }
    
    if (text !== undefined) {
      el.textContent = text;
      return el;
    }
    return el.textContent;
  },

  // HTML content management
  html: (element, html) => {
    const el = $(element);
    if (!el) {
      debugLog.warn('Element not found for html operation');
      return null;
    }
    
    if (html !== undefined) {
      el.innerHTML = html;
      return el;
    }
    return el.innerHTML;
  },

  // Form value management
  val: (element, value) => {
    const el = $(element);
    if (!el) {
      debugLog.warn('Element not found for val operation');
      return null;
    }
    
    if (value !== undefined) {
      if (el.type === 'checkbox') {
        el.checked = Boolean(value);
      } else if (el.type === 'radio') {
        el.checked = el.value === value;
      } else {
        el.value = value;
      }
      return el;
    }
    
    if (el.type === 'checkbox') {
      return el.checked;
    } else if (el.type === 'radio') {
      return el.checked ? el.value : null;
    }
    return el.value;
  },

  // Element visibility
  show: (element) => {
    const el = $(element);
    if (el) {
      el.style.display = '';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      debugLog.debug(`Element shown: ${el.tagName}`);
    }
    return el;
  },

  hide: (element) => {
    const el = $(element);
    if (el) {
      el.style.display = 'none';
      debugLog.debug(`Element hidden: ${el.tagName}`);
    }
    return el;
  },

  // CSS class management
  addClass: (element, className) => {
    const el = $(element);
    if (el && className) {
      el.classList.add(...className.split(' '));
      debugLog.debug(`Classes added to ${el.tagName}: ${className}`);
    }
    return el;
  },

  removeClass: (element, className) => {
    const el = $(element);
    if (el && className) {
      el.classList.remove(...className.split(' '));
      debugLog.debug(`Classes removed from ${el.tagName}: ${className}`);
    }
    return el;
  },

  hasClass: (element, className) => {
    const el = $(element);
    return el ? el.classList.contains(className) : false;
  },

  toggleClass: (element, className) => {
    const el = $(element);
    if (el && className) {
      el.classList.toggle(className);
      debugLog.debug(`Class toggled on ${el.tagName}: ${className}`);
    }
    return el;
  },

  // Element state
  isVisible: (element) => {
    const el = $(element);
    if (!el) return false;
    
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  },

  isHidden: (element) => {
    return !domUtils.isVisible(element);
  },

  // Element properties
  attr: (element, attribute, value) => {
    const el = $(element);
    if (!el) return null;
    
    if (value !== undefined) {
      el.setAttribute(attribute, value);
      return el;
    }
    return el.getAttribute(attribute);
  },

  removeAttr: (element, attribute) => {
    const el = $(element);
    if (el) {
      el.removeAttribute(attribute);
      debugLog.debug(`Attribute removed from ${el.tagName}: ${attribute}`);
    }
    return el;
  },

  // Element dimensions
  width: (element) => {
    const el = $(element);
    return el ? el.offsetWidth : 0;
  },

  height: (element) => {
    const el = $(element);
    return el ? el.offsetHeight : 0;
  },

  // Element position
  offset: (element) => {
    const el = $(element);
    if (!el) return null;
    
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top + window.pageYOffset,
      left: rect.left + window.pageXOffset
    };
  },

  // Element traversal
  parent: (element) => {
    const el = $(element);
    return el ? el.parentElement : null;
  },

  children: (element) => {
    const el = $(element);
    return el ? Array.from(el.children) : [];
  },

  find: (element, selector) => {
    const el = $(element);
    return el ? el.querySelectorAll(selector) : [];
  },

  closest: (element, selector) => {
    const el = $(element);
    return el ? el.closest(selector) : null;
  },

  // Element creation
  create: (tagName, attributes = {}, content = '') => {
    const element = document.createElement(tagName);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    
    // Set content
    if (content) {
      if (typeof content === 'string') {
        element.textContent = content;
      } else {
        element.appendChild(content);
      }
    }
    
    return element;
  },

  // Element removal
  remove: (element) => {
    const el = $(element);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
      debugLog.debug(`Element removed: ${el.tagName}`);
      return true;
    }
    return false;
  },

  // Element content management
  empty: (element) => {
    const el = $(element);
    if (el) {
      el.innerHTML = '';
      debugLog.debug(`Element emptied: ${el.tagName}`);
    }
    return el;
  },

  append: (element, content) => {
    const el = $(element);
    if (el) {
      if (typeof content === 'string') {
        el.insertAdjacentHTML('beforeend', content);
      } else {
        el.appendChild(content);
      }
      debugLog.debug(`Content appended to: ${el.tagName}`);
    }
    return el;
  },

  // Element relationship checking
  has: (parent, child) => {
    const parentEl = $(parent);
    const childEl = $(child);
    if (parentEl && childEl) {
      return parentEl.contains(childEl);
    }
    return false;
  },

  // Form change event
  change: (element) => {
    const el = $(element);
    if (el) {
      const event = new Event('change', { bubbles: true });
      el.dispatchEvent(event);
      debugLog.debug(`Change event triggered on: ${el.tagName}`);
    }
    return el;
  },

  // Element replacement
  replaceWith: (element, newElement) => {
    const el = $(element);
    const newEl = $(newElement);
    
    if (el && newEl && el.parentNode) {
      el.parentNode.replaceChild(newEl, el);
      debugLog.debug(`Element replaced: ${el.tagName}`);
      return true;
    }
    return false;
  }
};

// Event handling utilities
export const eventUtils = {
  on: (element, eventType, handler, options = {}) => {
    const el = $(element);
    if (el) {
      el.addEventListener(eventType, handler, options);
      debugLog.debug(`Event listener added: ${eventType} on ${el.tagName}`);
    }
    return el;
  },

  off: (element, eventType, handler, options = {}) => {
    const el = $(element);
    if (el) {
      el.removeEventListener(eventType, handler, options);
      debugLog.debug(`Event listener removed: ${eventType} from ${el.tagName}`);
    }
    return el;
  },

  trigger: (element, eventType, detail = {}) => {
    const el = $(element);
    if (el) {
      const event = new CustomEvent(eventType, { detail, bubbles: true });
      el.dispatchEvent(event);
      debugLog.debug(`Event triggered: ${eventType} on ${el.tagName}`);
    }
    return el;
  }
};

// Form utilities
export const formUtils = {
  serialize: (form) => {
    const formEl = $(form);
    if (!formEl || formEl.tagName !== 'FORM') return '';
    
    const formData = new FormData(formEl);
    const params = new URLSearchParams();
    
    for (const [key, value] of formData.entries()) {
      params.append(key, value);
    }
    
    return params.toString();
  },

  reset: (form) => {
    const formEl = $(form);
    if (formEl && formEl.tagName === 'FORM') {
      formEl.reset();
      debugLog.debug('Form reset');
    }
    return formEl;
  },

  validate: (form) => {
    const formEl = $(form);
    if (!formEl || formEl.tagName !== 'FORM') return false;
    
    return formEl.checkValidity();
  }
};

// Export all utilities as a single object for convenience
export default {
  $,
  $$,
  ...domUtils,
  ...eventUtils,
  ...formUtils
};
