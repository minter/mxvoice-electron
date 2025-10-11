/**
 * Preload Module Entry Point
 * 
 * This is the main entry point for the preload process in the MxVoice Electron application.
 * It handles IPC bridge setup, API exposure, and database initialization.
 * 
 * CONTEXT ISOLATION ENABLED - This version uses secure API exposure via contextBridge.
 */

const { ipcRenderer, contextBridge } = require('electron');
const { Howl, Howler } = require('howler');
const log = require('electron-log');
const Store = require('electron-store');

// Import preload modules
const ipcBridge = require('./modules/ipc-bridge.cjs');
const secureApiExposer = require('./modules/secure-api-exposer.cjs');

// Initialize debug logger using electron-log directly
// Use the same config file name as main for consistency
const store = new Store({ name: 'config' });
const debugLog = {
  info: (message, context) => log.info(message, context),
  error: (message, context) => log.error(message, context),
  warn: (message, context) => log.warn(message, context),
  debug: (message, context) => log.debug(message, context)
};

  // Note: Console override removed for security - use debug logger instead

// Register IPC handlers
ipcBridge.registerIpcHandlers();

// Enable context isolation by exposing secure API via contextBridge
try {
  const secureAPIExposed = secureApiExposer.exposeSecureAPI(debugLog);
  if (secureAPIExposed) {
    debugLog.info('✅ Secure API exposed via contextBridge (context isolation enabled)');
    
    // Expose E2E environment flag for testing
    if (process.env.APP_TEST_MODE === '1') {
      try {
        const _e2eState = { isE2E: true, probe: null };
        contextBridge.exposeInMainWorld('electronTest', {
          isE2E: _e2eState.isE2E,
          environment: {
            E2E: true,
            APP_TEST_MODE: '1'
          },
          setAudioProbe: (probe) => { _e2eState.probe = probe || null; return true; },
          getAudioProbe: () => _e2eState.probe || null
        });
        debugLog.info('✅ E2E test environment exposed via contextBridge');
      } catch (error) {
        debugLog.error('Failed to expose E2E environment:', { 
          module: 'preload', 
          function: 'e2e-exposure',
          error: error?.message || 'Unknown error' 
        });
      }
    }
    // Capture runtime errors and unhandled rejections for persistence
    try {
                window.addEventListener('error', (ev) => {
        try {
          const payload = {
            message: ev?.message || 'Unhandled error',
            stack: ev?.error?.stack || null,
            filename: ev?.filename,
            lineno: ev?.lineno,
            colno: ev?.colno,
            type: ev?.type
          };
          window.secureElectronAPI?.logs?.write('ERROR', payload.message, payload, { source: 'unhandled' });
        } catch (error) {
          // Log error in error handling to avoid infinite recursion
          try {
            debugLog.error('Failed to capture unhandled error', { 
              module: 'preload', 
              function: 'error-capture',
              originalError: error?.message || 'Unknown error' 
            });
          } catch (_) {
            // Fallback to prevent infinite recursion
          }
        }
      });
      window.addEventListener('unhandledrejection', (ev) => {
        try {
          const reason = ev?.reason;
          let message = 'unhandledrejection';
          let stack = null;
          if (reason instanceof Error) {
            message = reason.message || message;
            stack = reason.stack || null;
          } else if (typeof reason === 'string') {
            message = reason;
          } else {
            message = 'unhandledrejection (non-error)';
          }
          const context = { stack };
          window.secureElectronAPI?.logs?.write('ERROR', message, context, { source: 'unhandled' });
        } catch (error) {
          // Log error in error handling to avoid infinite recursion
          try {
            debugLog.error('Failed to capture unhandled rejection', { 
              module: 'preload', 
              function: 'rejection-capture',
              originalError: error?.message || 'Unknown error' 
            });
          } catch (_) {
            // Fallback to prevent infinite recursion
          }
        }
      });
    } catch (error) {
      debugLog.error('Failed to set up error event listeners', { 
        module: 'preload', 
        function: 'error-listener-setup',
        error: error?.message || 'Unknown error' 
      });
    }

    // Mirror console errors and warnings to file logs while preserving DevTools output
    try {
      const origError = console.error.bind(console);
      console.error = (...args) => {
        try {
          const msg = typeof args[0] === 'string' ? args[0] : String(args[0]);
          const context = args.length > 1 ? { args } : null;
          window.secureElectronAPI?.logs?.write('ERROR', msg, context, { source: 'console' });
        } catch (error) {
          // Log error in error handling to avoid infinite recursion
          try {
            debugLog.error('Failed to mirror console error to logs', { 
              module: 'preload', 
              function: 'console-mirror',
              originalError: error?.message || 'Unknown error' 
            });
          } catch (_) {
            // Fallback to prevent infinite recursion
          }
        }
        origError(...args);
      };

      const origWarn = console.warn.bind(console);
      console.warn = (...args) => {
        try {
          const msg = typeof args[0] === 'string' ? args[0] : String(args[0]);
          const context = args.length > 1 ? { args } : null;
          window.secureElectronAPI?.logs?.write('WARN', msg, context, { source: 'console' });
        } catch (error) {
          // Log error in error handling to avoid infinite recursion
          try {
            debugLog.error('Failed to mirror console warn to logs', { 
              module: 'preload', 
              function: 'console-mirror',
              originalError: error?.message || 'Unknown error' 
            });
          } catch (_) {
            // Fallback to prevent infinite recursion
          }
        }
        origWarn(...args);
      };
    } catch (error) {
      debugLog.error('Failed to set up console mirroring', { 
        module: 'preload', 
        function: 'console-mirror-setup',
        error: error?.message || 'Unknown error' 
      });
    }
  } else {
    debugLog.error('❌ Failed to expose secure API - context isolation may not work properly');
  }
} catch (error) {
  const errorMessage = error && error.message ? error.message : 'Unknown error';
  debugLog.error('❌ Secure API exposure failed:', errorMessage);
}

// Test function to verify modular preload is working
function testModularPreload() {
  debugLog.debug('🧪 Testing Modular Preload...');
  
  // Test IPC bridge
  const ipcTest = ipcBridge.testIpcBridge();
  
  if (ipcTest) {
    debugLog.info('✅ Modular preload is working correctly!');
    return true;
  } else {
    debugLog.error('❌ Modular preload has issues');
    return false;
  }
}

// Make test function available globally via contextBridge
if (typeof window !== 'undefined') {
  // Note: In context isolation, we can't directly set window properties
  // The test function is available through the secure API
  debugLog.info('Preload script loaded in renderer context');
}

debugLog.info('Modular preload initialized successfully with context isolation enabled'); 