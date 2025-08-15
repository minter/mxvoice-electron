/**
 * Theme Management Module
 *
 * This module handles theme switching functionality for the application.
 * It manages dark/light mode based on user preferences and system settings.
 */

// Import debug logger
let debugLog = null;
try {
  // Try to get debug logger from global scope
  if (window.debugLog) {
    debugLog = window.debugLog;
  }
} catch (error) {
  // Debug logger not available
}

/**
 * Theme Management Singleton
 *
 * Provides a unified interface for all theme management operations
 */
class ThemeManagementModule {
  constructor() {
    // Initialize module state
    this.currentTheme = 'auto'; // 'auto', 'light', or 'dark'
    this.systemTheme = 'light'; // 'light' or 'dark'
    this.effectiveTheme = 'light'; // The actual theme being applied
    this.mediaQuery = null;
    this.preferencesModule = null;
  }

  /**
   * Initialize the theme management module
   * @param {Object} options - Configuration options
   * @param {Object} options.preferencesModule - Preferences module reference
   */
  async initThemeManagement(options = {}) {
    debugLog?.info('Initializing Theme Management Module', {
      module: 'theme-management',
      function: 'initThemeManagement',
    });

    this.preferencesModule = options.preferencesModule;

    try {
      // Set up system theme detection
      this.setupSystemThemeDetection();
      
      // Load user preference
      await this.loadUserThemePreference();
      
      // Apply the appropriate theme
      await this.applyTheme();
      
      return { success: true, theme: this.effectiveTheme };
    } catch (error) {
      debugLog?.error('Failed to initialize theme management', {
        module: 'theme-management',
        function: 'initThemeManagement',
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Set up system theme detection using media queries
   */
  setupSystemThemeDetection() {
    try {
      // Create media query for system dark mode preference
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      // Set initial system theme
      this.systemTheme = this.mediaQuery.matches ? 'dark' : 'light';
      
      // Listen for system theme changes
      this.mediaQuery.addEventListener('change', (event) => {
        this.systemTheme = event.matches ? 'dark' : 'light';
        debugLog?.info('System theme changed', {
          module: 'theme-management',
          function: 'setupSystemThemeDetection',
          newTheme: this.systemTheme,
        });
        
        // If user preference is 'auto', update the effective theme
        if (this.currentTheme === 'auto') {
          this.updateEffectiveTheme();
          this.applyThemeToDOM();
        }
      });
      
      debugLog?.info('System theme detection set up', {
        module: 'theme-management',
        function: 'setupSystemThemeDetection',
        initialSystemTheme: this.systemTheme,
      });
    } catch (error) {
      debugLog?.warn('Failed to set up system theme detection', {
        module: 'theme-management',
        function: 'setupSystemThemeDetection',
        error: error.message,
      });
      // Fallback to light theme
      this.systemTheme = 'light';
    }
  }

  /**
   * Load user theme preference from preferences module
   */
  async loadUserThemePreference() {
    try {
      if (this.preferencesModule && this.preferencesModule.getScreenMode) {
        const userTheme = await this.preferencesModule.getScreenMode();
        this.currentTheme = userTheme || 'auto';
        
        debugLog?.info('User theme preference loaded', {
          module: 'theme-management',
          function: 'loadUserThemePreference',
          userTheme: this.currentTheme,
        });
      } else {
        // Fallback to auto if preferences module not available
        this.currentTheme = 'auto';
        debugLog?.warn('Preferences module not available, using auto theme', {
          module: 'theme-management',
          function: 'loadUserThemePreference',
        });
      }
    } catch (error) {
      debugLog?.warn('Failed to load user theme preference', {
        module: 'theme-management',
        function: 'loadUserThemePreference',
        error: error.message,
      });
      // Fallback to auto theme
      this.currentTheme = 'auto';
    }
  }

  /**
   * Update the effective theme based on user preference and system theme
   */
  updateEffectiveTheme() {
    if (this.currentTheme === 'auto') {
      this.effectiveTheme = this.systemTheme;
    } else {
      this.effectiveTheme = this.currentTheme;
    }
    
    debugLog?.info('Effective theme updated', {
      module: 'theme-management',
      function: 'updateEffectiveTheme',
      userPreference: this.currentTheme,
      systemTheme: this.systemTheme,
      effectiveTheme: this.effectiveTheme,
    });
  }

  /**
   * Apply the current theme to the application
   */
  async applyTheme() {
    try {
      this.updateEffectiveTheme();
      this.applyThemeToDOM();
      
      debugLog?.info('Theme applied successfully', {
        module: 'theme-management',
        function: 'applyTheme',
        theme: this.effectiveTheme,
      });
      
      return { success: true, theme: this.effectiveTheme };
    } catch (error) {
      debugLog?.error('Failed to apply theme', {
        module: 'theme-management',
        function: 'applyTheme',
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Apply the theme to the DOM by setting CSS classes and variables
   */
  applyThemeToDOM() {
    try {
      const body = document.body;
      
      // Remove existing theme classes
      body.classList.remove('theme-light', 'theme-dark');
      
      // Add the current theme class
      body.classList.add(`theme-${this.effectiveTheme}`);
      
      // Set CSS custom property for JavaScript access
      document.documentElement.style.setProperty('--current-theme', this.effectiveTheme);
      
      // Trigger a custom event for other modules to listen to
      const themeChangeEvent = new CustomEvent('themeChanged', {
        detail: {
          theme: this.effectiveTheme,
          userPreference: this.currentTheme,
          systemTheme: this.systemTheme,
        },
      });
      document.dispatchEvent(themeChangeEvent);
      
      // Add console log for immediate feedback during development
      console.log(`🎨 Theme applied: ${this.effectiveTheme} (User preference: ${this.currentTheme}, System: ${this.systemTheme})`);
      console.log(`📱 Body classes: ${body.className}`);
      
      debugLog?.info('Theme applied to DOM', {
        module: 'theme-management',
        function: 'applyThemeToDOM',
        theme: this.effectiveTheme,
        bodyClasses: body.className,
      });
    } catch (error) {
      debugLog?.error('Failed to apply theme to DOM', {
        module: 'theme-management',
        function: 'applyThemeToDOM',
        error: error.message,
      });
    }
  }

  /**
   * Set the user's theme preference
   * @param {string} theme - The theme to set ('auto', 'light', or 'dark')
   * @returns {Promise<Object>} - Result of the operation
   */
  async setUserTheme(theme) {
    debugLog?.info('Setting user theme preference', {
      module: 'theme-management',
      function: 'setUserTheme',
      theme: theme,
    });

    if (!['auto', 'light', 'dark'].includes(theme)) {
      const error = `Invalid theme: ${theme}. Must be 'auto', 'light', or 'dark'`;
      debugLog?.error('Invalid theme specified', {
        module: 'theme-management',
        function: 'setUserTheme',
        error: error,
      });
      return { success: false, error: error };
    }

    this.currentTheme = theme;
    
    try {
      // Save to preferences if available
      if (this.preferencesModule && this.preferencesModule.setPreference) {
        const result = await this.preferencesModule.setPreference('screen_mode', theme);
        if (!result) {
          debugLog?.warn('Failed to save theme preference', {
            module: 'theme-management',
            function: 'setUserTheme',
            theme: theme,
          });
        }
      }
      
      // Apply the new theme
      await this.applyTheme();
      
      return { success: true, theme: this.effectiveTheme };
    } catch (error) {
      debugLog?.error('Failed to set user theme', {
        module: 'theme-management',
        function: 'setUserTheme',
        theme: theme,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get the current effective theme
   * @returns {string} - Current effective theme ('light' or 'dark')
   */
  getCurrentTheme() {
    return this.effectiveTheme;
  }

  /**
   * Get the user's theme preference
   * @returns {string} - User's theme preference ('auto', 'light', or 'dark')
   */
  getUserThemePreference() {
    return this.currentTheme;
  }

  /**
   * Get the system's current theme
   * @returns {string} - System theme ('light' or 'dark')
   */
  getSystemTheme() {
    return this.systemTheme;
  }

  /**
   * Check if the current theme is dark
   * @returns {boolean} - True if dark theme is active
   */
  isDarkTheme() {
    return this.effectiveTheme === 'dark';
  }

  /**
   * Check if the current theme is light
   * @returns {boolean} - True if light theme is active
   */
  isLightTheme() {
    return this.effectiveTheme === 'light';
  }

  /**
   * Check if the user preference is set to auto
   * @returns {boolean} - True if auto theme is selected
   */
  isAutoTheme() {
    return this.currentTheme === 'auto';
  }

  /**
   * Refresh the theme (useful after preferences change)
   * @returns {Promise<Object>} - Result of the operation
   */
  async refreshTheme() {
    debugLog?.info('Refreshing theme', {
      module: 'theme-management',
      function: 'refreshTheme',
    });

    try {
      await this.loadUserThemePreference();
      await this.applyTheme();
      
      return { success: true, theme: this.effectiveTheme };
    } catch (error) {
      debugLog?.error('Failed to refresh theme', {
        module: 'theme-management',
        function: 'refreshTheme',
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize the module (alias for initThemeManagement)
   */
  async init(options = {}) {
    return this.initThemeManagement(options);
  }

  /**
   * Get all theme management functions
   *
   * @returns {Object} - Object containing all theme management functions
   */
  getAllThemeManagementFunctions() {
    return {
      initThemeManagement: this.initThemeManagement.bind(this),
      setUserTheme: this.setUserTheme.bind(this),
      getCurrentTheme: this.getCurrentTheme.bind(this),
      getUserThemePreference: this.getUserThemePreference.bind(this),
      getSystemTheme: this.getSystemTheme.bind(this),
      isDarkTheme: this.isDarkTheme.bind(this),
      isLightTheme: this.isLightTheme.bind(this),
      isAutoTheme: this.isAutoTheme.bind(this),
      refreshTheme: this.refreshTheme.bind(this),
    };
  }

  /**
   * Test all theme management functions
   *
   * @returns {Object} - Test results
   */
  test() {
    const results = {};

    // Test each function
    const functions = [
      'initThemeManagement',
      'setUserTheme',
      'getCurrentTheme',
      'getUserThemePreference',
      'getSystemTheme',
      'isDarkTheme',
      'isLightTheme',
      'isAutoTheme',
      'refreshTheme',
    ];

    for (const funcName of functions) {
      if (typeof this[funcName] === 'function') {
        results[funcName] = '✅ Function exists';
      } else {
        results[funcName] = '❌ Function missing';
      }
    }

    return results;
  }

  /**
   * Get module information
   *
   * @returns {Object} - Module information
   */
  getInfo() {
    return {
      name: 'Theme Management Module',
      version: '1.0.0',
      description: 'Provides theme switching functionality',
      functions: this.getAllThemeManagementFunctions(),
      currentState: {
        userPreference: this.currentTheme,
        systemTheme: this.systemTheme,
        effectiveTheme: this.effectiveTheme,
      },
    };
  }

  /**
   * Test theme switching (for debugging)
   * @param {string} theme - Theme to test ('light', 'dark', or 'auto')
   */
  async testThemeSwitch(theme) {
    debugLog?.info('Testing theme switch', { theme });
    console.log(`🧪 Testing theme switch to: ${theme}`);
    
    try {
      const result = await this.setUserTheme(theme);
      console.log(`✅ Theme switch result:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Theme switch failed:`, error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export a singleton instance
const themeManagementModule = new ThemeManagementModule();

// Export individual functions for backward compatibility
export const initThemeManagement =
  themeManagementModule.initThemeManagement.bind(themeManagementModule);
export const setUserTheme =
  themeManagementModule.setUserTheme.bind(themeManagementModule);
export const getCurrentTheme =
  themeManagementModule.getCurrentTheme.bind(themeManagementModule);
export const getUserThemePreference =
  themeManagementModule.getUserThemePreference.bind(themeManagementModule);
export const getSystemTheme =
  themeManagementModule.getSystemTheme.bind(themeManagementModule);
export const isDarkTheme =
  themeManagementModule.isDarkTheme.bind(themeManagementModule);
export const isLightTheme =
  themeManagementModule.isLightTheme.bind(themeManagementModule);
export const isAutoTheme =
  themeManagementModule.isAutoTheme.bind(themeManagementModule);
export const refreshTheme =
  themeManagementModule.refreshTheme.bind(themeManagementModule);
export const testThemeSwitch =
  themeManagementModule.testThemeSwitch.bind(themeManagementModule);

// Default export for module loading
export default themeManagementModule;
