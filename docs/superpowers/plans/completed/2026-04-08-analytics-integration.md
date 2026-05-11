# Analytics Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anonymous product analytics to Mx. Voice using PostHog to track usage scale, feature adoption, and app stability.

**Architecture:** PostHog Node.js SDK runs in the main process only. Renderer communicates via IPC through the existing secure API pattern. A new `analytics.js` module wraps all PostHog calls. Anonymous device ID (UUID) stored in electron-store.

**Tech Stack:** posthog-node, uuid (already installed), electron-store (already installed), Vitest (unit tests)

**Spec:** `docs/superpowers/specs/2026-04-08-analytics-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/main/modules/analytics.js` | PostHog SDK wrapper: init, trackEvent, opt-out, shutdown, stack scrubbing |
| Modify | `src/main/index-modular.js` | Import analytics module, add store defaults, init on ready, shutdown on quit, replace `trackUser()` |
| Modify | `src/main/modules/ipc-handlers.js` | Register 3 new IPC handlers for analytics |
| Modify | `src/main/modules/app-setup.js` | Flush analytics on `before-quit` |
| Modify | `src/preload/modules/secure-api-exposer.cjs` | Expose `analytics` namespace in secure API |
| Modify | `src/index.html` | Add analytics toggle + first-run banner HTML |
| Modify | `src/renderer/modules/preferences/settings-controller.js` | Capture analytics toggle on save |
| Modify | `src/renderer/modules/preferences/preference-manager.js` | Load analytics toggle state |
| Modify | `src/renderer/modules/audio/audio-manager.js` | Track `song_played` event |
| Modify | `src/renderer/modules/search/search-engine.js` | Track `search_performed` event |
| Modify | `src/renderer/modules/hotkeys/hotkey-operations.js` | Track `hotkey_configured` event |
| Modify | `src/renderer/modules/holding-tank/index.js` | Track `holding_tank_used` events |
| Modify | `src/renderer/modules/categories/category-operations.js` | Track `category_browsed` event |
| Modify | `src/renderer/modules/ui/controls.js` | Track `waveform_viewed` event |
| Modify | `src/renderer/modules/profile-state/index.js` | Track `profile_switched` event |
| Modify | `src/renderer/modules/library-transfer/index.js` | Track `library_imported` event |
| Create | `tests/unit/main/analytics.test.js` | Unit tests for analytics module |

---

### Task 1: Install posthog-node and add store defaults

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/main/index-modular.js:239-248` (store defaults)

- [ ] **Step 1: Install posthog-node**

Run: `npm install posthog-node`
Expected: Package added to `dependencies` in package.json

- [ ] **Step 2: Add analytics store defaults**

In `src/main/index-modular.js`, add two new keys to the `defaults` object at line 247 (before the closing brace):

```javascript
const defaults = {
  browser_width: 1280,
  browser_height: 1024,
  music_directory: path.join(app.getPath('userData'), 'mp3'),
  hotkey_directory: path.join(app.getPath('userData'), 'hotkeys'),
  database_directory: app.getPath('userData'),
  fade_out_seconds: 2,
  debug_log_enabled: true,
  first_run_completed: false,
  analytics_device_id: '',
  analytics_opt_out: false
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/main/index-modular.js
git commit -m "chore: install posthog-node and add analytics store defaults"
```

---

### Task 2: Create the analytics module

**Files:**
- Create: `src/main/modules/analytics.js`
- Create: `tests/unit/main/analytics.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/main/analytics.test.js`:

```javascript
/**
 * Unit tests for analytics module.
 *
 * Mocks posthog-node and electron-store to test:
 * - Initialization and device ID generation
 * - Event tracking when opted in
 * - Event suppression when opted out
 * - Stack trace scrubbing
 * - Shutdown/flush behavior
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock posthog-node
const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);
const mockPostHogInstance = {
  capture: mockCapture,
  shutdown: mockShutdown,
};

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(() => mockPostHogInstance),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// In-memory store
let storeData = {};
const mockStore = {
  get: vi.fn((key) => storeData[key]),
  set: vi.fn((key, value) => { storeData[key] = value; }),
};

const mockDebugLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Import after mocks
const { createAnalytics } = await import('../../../src/main/modules/analytics.js');

describe('analytics module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeData = {};
    mockCapture.mockClear();
    mockShutdown.mockClear();
  });

  describe('init', () => {
    it('generates a device ID on first init when none exists', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      expect(mockStore.set).toHaveBeenCalledWith('analytics_device_id', 'test-uuid-1234');
    });

    it('reuses existing device ID if already stored', () => {
      storeData.analytics_device_id = 'existing-device-id';
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      expect(mockStore.set).not.toHaveBeenCalledWith('analytics_device_id', expect.anything());
    });
  });

  describe('trackEvent', () => {
    it('sends event to PostHog when opted in', () => {
      storeData.analytics_opt_out = false;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      analytics.trackEvent('song_played', { trigger_method: 'hotkey' });

      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: 'test-uuid-1234',
        event: 'song_played',
        properties: expect.objectContaining({
          trigger_method: 'hotkey',
          app_version: '1.0.0',
        }),
      });
    });

    it('does not send event when opted out', () => {
      storeData.analytics_opt_out = true;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      analytics.trackEvent('song_played', { trigger_method: 'hotkey' });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('does not send event before init is called', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });

      analytics.trackEvent('song_played', { trigger_method: 'hotkey' });

      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe('opt-out', () => {
    it('setOptOut(true) persists to store and suppresses events', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      analytics.setOptOut(true);

      expect(mockStore.set).toHaveBeenCalledWith('analytics_opt_out', true);

      analytics.trackEvent('song_played', {});
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('setOptOut(false) re-enables tracking', () => {
      storeData.analytics_opt_out = true;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      analytics.setOptOut(false);
      analytics.trackEvent('song_played', {});

      expect(mockCapture).toHaveBeenCalled();
    });

    it('getOptOutStatus returns current state', () => {
      storeData.analytics_opt_out = true;
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      expect(analytics.getOptOutStatus()).toBe(true);
    });
  });

  describe('scrubStackTrace', () => {
    it('removes absolute file paths from stack traces', () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      analytics.trackEvent('app_error', {
        stack_trace: 'Error: fail\n    at Object.<anonymous> (/Users/john/projects/mxvoice/src/main/index.js:42:5)',
      });

      const capturedProps = mockCapture.mock.calls[0][0].properties;
      expect(capturedProps.stack_trace).not.toContain('/Users/john');
      expect(capturedProps.stack_trace).toContain('src/main/index.js:42:5');
    });
  });

  describe('shutdown', () => {
    it('flushes PostHog client on shutdown', async () => {
      const analytics = createAnalytics({ store: mockStore, debugLog: mockDebugLog, appVersion: '1.0.0' });
      analytics.init();

      await analytics.shutdown();

      expect(mockShutdown).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/main/analytics.test.js`
Expected: FAIL — module `src/main/modules/analytics.js` does not exist yet

- [ ] **Step 3: Create the analytics module**

Create `src/main/modules/analytics.js`:

```javascript
/**
 * Analytics Module
 *
 * Wraps PostHog Node.js SDK for anonymous product analytics.
 * All tracking calls are no-ops when the user has opted out.
 *
 * @module analytics
 */

import { PostHog } from 'posthog-node';
import { v4 as uuidv4 } from 'uuid';

// PostHog project API key (client-side keys are public by design)
const POSTHOG_API_KEY = 'phc_PLACEHOLDER';
const POSTHOG_HOST = 'https://us.i.posthog.com';

/**
 * Create an analytics instance.
 *
 * @param {Object} options
 * @param {Object} options.store - electron-store instance
 * @param {Object} options.debugLog - debug log instance
 * @param {string} options.appVersion - current app version string
 * @returns {Object} analytics interface
 */
export function createAnalytics({ store, debugLog, appVersion }) {
  let client = null;
  let deviceId = null;
  let optedOut = false;
  let initialized = false;

  /**
   * Scrub absolute file paths from a stack trace string.
   * Keeps the relative path from the project root onward.
   */
  function scrubStackTrace(stack) {
    if (typeof stack !== 'string') return stack;
    // Replace absolute paths, keeping from src/ or node_modules/ onward
    return stack.replace(/(?:\/[\w.-]+)+\/(src\/)/g, '$1')
               .replace(/(?:\/[\w.-]+)+\/(node_modules\/)/g, '$1')
               .replace(/(?:[A-Z]:\\[\w.-\\]+\\)(src\\)/gi, '$1')
               .replace(/(?:[A-Z]:\\[\w.-\\]+\\)(node_modules\\)/gi, '$1');
  }

  function init() {
    // Get or create device ID
    deviceId = store.get('analytics_device_id');
    if (!deviceId) {
      deviceId = uuidv4();
      store.set('analytics_device_id', deviceId);
    }

    // Read opt-out preference
    optedOut = !!store.get('analytics_opt_out');

    // Initialize PostHog client
    client = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      flushAt: 20,
      flushInterval: 30000,
    });

    initialized = true;
    debugLog.info('Analytics initialized', {
      module: 'analytics',
      function: 'init',
      deviceId,
      optedOut,
    });
  }

  function trackEvent(name, properties = {}) {
    if (!initialized || optedOut || !client) return;

    // Scrub stack traces in error events
    const scrubbed = { ...properties };
    if (scrubbed.stack_trace) {
      scrubbed.stack_trace = scrubStackTrace(scrubbed.stack_trace);
    }

    client.capture({
      distinctId: deviceId,
      event: name,
      properties: {
        ...scrubbed,
        app_version: appVersion,
      },
    });
  }

  function setOptOut(value) {
    optedOut = !!value;
    store.set('analytics_opt_out', optedOut);
    debugLog.info('Analytics opt-out changed', {
      module: 'analytics',
      function: 'setOptOut',
      optedOut,
    });
  }

  function getOptOutStatus() {
    return optedOut;
  }

  async function shutdown() {
    if (client) {
      await client.shutdown();
      debugLog.info('Analytics shut down', {
        module: 'analytics',
        function: 'shutdown',
      });
    }
  }

  return { init, trackEvent, setOptOut, getOptOutStatus, shutdown };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/main/analytics.test.js`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/modules/analytics.js tests/unit/main/analytics.test.js
git commit -m "feat: add analytics module with PostHog integration"
```

---

### Task 3: Register IPC handlers for analytics

**Files:**
- Modify: `src/main/modules/ipc-handlers.js` (add handlers near end of file, after existing store handlers)

- [ ] **Step 1: Add analytics IPC handlers**

At the end of the handler registrations in `src/main/modules/ipc-handlers.js` (before the closing of the `registerIpcHandlers` function), add:

```javascript
  // Analytics handlers
  ipcMain.handle('analytics:track-event', async (event, name, properties) => {
    try {
      if (analytics) {
        analytics.trackEvent(name, properties || {});
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Analytics track-event error', { module: 'ipc-handlers', function: 'analytics:track-event', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('analytics:get-opt-out-status', async () => {
    try {
      if (analytics) {
        return { success: true, value: analytics.getOptOutStatus() };
      }
      return { success: true, value: false };
    } catch (error) {
      debugLog?.error('Analytics get-opt-out error', { module: 'ipc-handlers', function: 'analytics:get-opt-out-status', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('analytics:set-opt-out', async (event, value) => {
    try {
      if (analytics) {
        analytics.setOptOut(!!value);
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Analytics set-opt-out error', { module: 'ipc-handlers', function: 'analytics:set-opt-out', error: error.message });
      return { success: false, error: error.message };
    }
  });
```

The `analytics` object needs to be passed into the IPC handlers. Check how the existing `registerIpcHandlers` function receives its dependencies (it takes `{ store, db, debugLog, ... }` as options). Add `analytics` to that options object and destructure it alongside the others.

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build:preload`
Expected: Build succeeds (IPC handlers are main-process only, not part of preload bundle)

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/ipc-handlers.js
git commit -m "feat: register analytics IPC handlers"
```

---

### Task 4: Expose analytics in the secure API

**Files:**
- Modify: `src/preload/modules/secure-api-exposer.cjs:491-501` (add analytics namespace before `testing`)

- [ ] **Step 1: Add analytics namespace to secure API**

In `src/preload/modules/secure-api-exposer.cjs`, add a new `analytics` namespace to the `secureElectronAPI` object, just before the `testing` namespace (before line 494):

```javascript
  // Analytics
  analytics: {
    trackEvent: (name, properties) => ipcRenderer.invoke('analytics:track-event', name, properties),
    getOptOutStatus: () => ipcRenderer.invoke('analytics:get-opt-out-status'),
    setOptOut: (value) => ipcRenderer.invoke('analytics:set-opt-out', value),
  },
```

- [ ] **Step 2: Add analytics to legacy compatibility layer**

In the same file, in the `electronAPI` legacy compatibility object (around line 546), add:

```javascript
        analytics: secureElectronAPI.analytics,
```

- [ ] **Step 3: Rebuild preload bundle**

Run: `npm run build:preload`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/preload/modules/secure-api-exposer.cjs
git commit -m "feat: expose analytics API in preload secure bridge"
```

---

### Task 5: Initialize analytics in main process and wire up lifecycle

**Files:**
- Modify: `src/main/index-modular.js:42-51` (import), `:650-656` (replace trackUser), plus app lifecycle
- Modify: `src/main/modules/app-setup.js:1078-1086` (add analytics shutdown to before-quit)

- [ ] **Step 1: Import analytics module**

In `src/main/index-modular.js`, add the import at line 51 (after the other module imports):

```javascript
import { createAnalytics } from './modules/analytics.js';
```

- [ ] **Step 2: Replace trackUser placeholder with analytics initialization**

Replace the `trackUser()` function (lines 650-656) with:

```javascript
// Initialize analytics
let analytics = null;

function initializeAnalytics() {
  const appVersion = app.getVersion();
  analytics = createAnalytics({ store, debugLog, appVersion });
  analytics.init();

  // Track app launch
  analytics.trackEvent('app_launched', {
    os: process.platform,
    arch: process.arch,
    electron_version: process.versions.electron,
  });
}
```

- [ ] **Step 3: Call initializeAnalytics during app ready**

Find where `checkFirstRun()` and module initialization happen in the `app.whenReady()` flow. Call `initializeAnalytics()` after the store is ready but before IPC handlers are registered. Pass `analytics` to `ipcHandlers.registerIpcHandlers(...)` in the options object.

- [ ] **Step 4: Add analytics shutdown to before-quit**

In `src/main/modules/app-setup.js`, in the `before-quit` handler (line 1078), add analytics shutdown. The analytics instance needs to be accessible — pass it in through the existing options pattern used by `setupAppLifecycle`. Add before the autoBackupTimer stop:

```javascript
    // Flush analytics before quit
    if (analytics) {
      analytics.shutdown().catch(err => {
        debugLog?.error('Analytics shutdown error', {
          module: 'app-setup',
          function: 'before-quit',
          error: err.message,
        });
      });
    }
```

- [ ] **Step 5: Track app_closed with session duration**

Add a `const appStartTime = Date.now();` near the top of `index-modular.js` (after imports). In the `before-quit` handler, track:

```javascript
    if (analytics) {
      const sessionDuration = Math.floor((Date.now() - appStartTime) / 1000);
      analytics.trackEvent('app_closed', { session_duration_seconds: sessionDuration });
    }
```

- [ ] **Step 6: Wire up global error handlers**

In `index-modular.js`, after analytics is initialized, add:

```javascript
  // Track uncaught errors
  process.on('uncaughtException', (error) => {
    if (analytics) {
      analytics.trackEvent('app_error', {
        error_message: error.message,
        stack_trace: error.stack,
      });
    }
  });

  process.on('unhandledRejection', (reason) => {
    if (analytics) {
      analytics.trackEvent('app_error', {
        error_message: reason instanceof Error ? reason.message : String(reason),
        stack_trace: reason instanceof Error ? reason.stack : undefined,
      });
    }
  });
```

- [ ] **Step 7: Verify app starts**

Run: `npm start`
Expected: App launches without errors. Check debug log for "Analytics initialized" message.

- [ ] **Step 8: Commit**

```bash
git add src/main/index-modular.js src/main/modules/app-setup.js
git commit -m "feat: initialize analytics on app start with lifecycle hooks"
```

---

### Task 6: Add first-run analytics banner and preferences toggle

**Files:**
- Modify: `src/index.html:581` (add analytics fieldset before closing preferences modal body)
- Modify: `src/index.html` (add first-run banner HTML)
- Modify: `src/renderer/modules/preferences/settings-controller.js:46-53` (capture analytics toggle)
- Modify: `src/renderer/modules/preferences/preference-manager.js:99-107` (load analytics pref)

- [ ] **Step 1: Add analytics toggle to preferences modal**

In `src/index.html`, after the "Update Options" fieldset closing `</fieldset>` (line 581), add a new fieldset:

```html
              <fieldset>
                <legend>Privacy</legend>
                <div class="row g-2 mb-3">
                  <div class="col-sm-9 offset-sm-3">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" role="switch" id="preferences-analytics-enabled" checked>
                      <label class="form-check-label" for="preferences-analytics-enabled">
                        Send anonymous usage data
                      </label>
                    </div>
                    <small class="form-text text-muted">Helps improve Mx. Voice. No personal data is collected.</small>
                  </div>
                </div>
              </fieldset>
```

- [ ] **Step 2: Add first-run analytics banner HTML**

In `src/index.html`, add a dismissible banner element (hidden by default) somewhere in the main body area. This will be shown by JavaScript on first run:

```html
        <!-- Analytics consent banner (shown on first run) -->
        <div id="analytics-consent-banner" class="alert alert-info alert-dismissible fade d-none" role="alert" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 1060; max-width: 600px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <strong>Usage Analytics</strong><br>
          Mx. Voice collects anonymous usage data to help improve the app &mdash; things like which features are used and crash reports. No personal information is collected. You can disable this anytime in Preferences.
          <div class="mt-2">
            <button type="button" class="btn btn-primary btn-sm me-2" id="analytics-consent-ok">OK</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" id="analytics-consent-disable">Disable Analytics</button>
          </div>
        </div>
```

- [ ] **Step 3: Update settings controller to capture analytics toggle**

In `src/renderer/modules/preferences/settings-controller.js`, add to the `formValues` capture (line 53, after `screen_mode`):

```javascript
      analytics_enabled: !!document.getElementById('preferences-analytics-enabled')?.checked,
```

Then in the preferences save logic, add after the other preference saves complete — use the analytics API directly since this is not a profile or store preference:

```javascript
      // Handle analytics opt-out separately (uses analytics API, not store)
      const analyticsAPI = electronAPI?.analytics || window.secureElectronAPI?.analytics;
      if (analyticsAPI) {
        await analyticsAPI.setOptOut(!formValues.analytics_enabled);
      }
```

- [ ] **Step 4: Update preference manager to load analytics toggle**

In `src/renderer/modules/preferences/preference-manager.js`, inside `loadPreferences()`, after the existing preference loads (after line 176), add:

```javascript
        // Load analytics opt-out status
        const analyticsAPI = currentAPI?.analytics;
        if (analyticsAPI) {
          try {
            const analyticsResult = await analyticsAPI.getOptOutStatus();
            if (analyticsResult.success) {
              const el = document.getElementById('preferences-analytics-enabled');
              if (el) {
                // The checkbox is "enabled" but the store tracks "opt_out", so invert
                el.checked = !analyticsResult.value;
                debugLog?.info('[PREFS-LOAD] Set analytics enabled field', { optedOut: analyticsResult.value, checked: el.checked });
              }
            }
          } catch (error) {
            debugLog?.warn('[PREFS-LOAD] Could not load analytics preference', { error: error.message });
          }
        }
```

- [ ] **Step 5: Add first-run banner show/dismiss logic**

This logic should run in the renderer after app init. Add it to the appropriate renderer initialization flow. The banner should show when the app detects first run (check `first_run_completed` was recently set). A simpler approach: check a `analytics_banner_shown` store key. If false, show the banner:

```javascript
// Show analytics consent banner if not yet shown
async function showAnalyticsBannerIfNeeded() {
  const api = window.secureElectronAPI || window.electronAPI;
  if (!api?.store) return;

  const result = await api.store.get('analytics_banner_shown');
  if (result.success && result.value) return;

  const banner = document.getElementById('analytics-consent-banner');
  if (!banner) return;

  banner.classList.remove('d-none');
  banner.classList.add('show');

  document.getElementById('analytics-consent-ok')?.addEventListener('click', async () => {
    banner.classList.add('d-none');
    await api.store.set('analytics_banner_shown', true);
  });

  document.getElementById('analytics-consent-disable')?.addEventListener('click', async () => {
    banner.classList.add('d-none');
    await api.store.set('analytics_banner_shown', true);
    if (api.analytics) {
      await api.analytics.setOptOut(true);
    }
  });
}
```

Call this function from the renderer's initialization flow after the DOM is ready.

- [ ] **Step 6: Add `analytics_banner_shown` to store defaults**

In `src/main/index-modular.js`, add to the defaults object:

```javascript
  analytics_banner_shown: false
```

- [ ] **Step 7: Verify preferences toggle and banner work**

Run: `npm start`
Expected: 
- First-run banner appears at the bottom of the window
- Clicking "OK" dismisses it
- Preferences modal shows the "Send anonymous usage data" toggle
- Toggling it off and saving suppresses analytics

- [ ] **Step 8: Commit**

```bash
git add src/index.html src/renderer/modules/preferences/settings-controller.js src/renderer/modules/preferences/preference-manager.js src/main/index-modular.js
git commit -m "feat: add analytics consent banner and preferences toggle"
```

---

### Task 7: Instrument renderer feature events

**Files:**
- Modify: `src/renderer/modules/audio/audio-manager.js:729` (after `playSongWithFilename` call)
- Modify: `src/renderer/modules/search/search-engine.js:48+` (after search completes)
- Modify: `src/renderer/modules/hotkeys/hotkey-operations.js:21+` (after hotkey save)
- Modify: `src/renderer/modules/holding-tank/index.js:32+, 315, 421` (add/remove/clear)
- Modify: `src/renderer/modules/categories/category-operations.js:24+` (category browse)
- Modify: `src/renderer/modules/ui/controls.js:97+` (waveform toggle)
- Modify: `src/renderer/modules/profile-state/index.js:870+` (profile switch)
- Modify: `src/renderer/modules/library-transfer/index.js:237+` (library import)

All renderer instrumentation follows the same pattern — a single line calling the analytics API through the existing secure API:

```javascript
(window.secureElectronAPI?.analytics?.trackEvent || (() => {}))('event_name', { property: 'value' });
```

This is a fire-and-forget call. It's wrapped in a safe fallback so it never throws even if the API isn't available.

For brevity, use a helper at the top of each modified file (or inline the one-liner if only used once):

```javascript
const trackEvent = (name, props) => window.secureElectronAPI?.analytics?.trackEvent?.(name, props);
```

- [ ] **Step 1: Instrument song playback**

In `src/renderer/modules/audio/audio-manager.js`, inside `playSongFromId()` at line 729 (right after the `playSongWithFilename(filename, row, song_id)` call), add:

```javascript
        window.secureElectronAPI?.analytics?.trackEvent?.('song_played', { trigger_method: 'direct' });
```

Note: The trigger method here is 'direct' (from the song table). Hotkey playback goes through a different path — the hotkey modules call `playSongFromId` but we track those via the hotkey event handlers. To avoid double-counting, the `song_played` event in audio-manager tracks *all* plays, and the trigger_method can be refined later. For now, 'direct' is fine as the default.

- [ ] **Step 2: Instrument search**

In `src/renderer/modules/search/search-engine.js`, find where search results are rendered/returned (after the database query resolves and results are displayed). Add:

```javascript
window.secureElectronAPI?.analytics?.trackEvent?.('search_performed', { result_count: results.length });
```

Where `results.length` is the number of rows returned. Check the actual variable name used in the search results callback.

- [ ] **Step 3: Instrument hotkey configuration**

In `src/renderer/modules/hotkeys/hotkey-operations.js`, inside `saveHotkeysToStore()` (around line 21), add after the save completes:

```javascript
window.secureElectronAPI?.analytics?.trackEvent?.('hotkey_configured');
```

- [ ] **Step 4: Instrument holding tank**

In `src/renderer/modules/database/data-population.js`, inside `addToHoldingTank()` (line 32), add after the song is added:

```javascript
window.secureElectronAPI?.analytics?.trackEvent?.('holding_tank_used', { action: 'add' });
```

In `src/renderer/modules/holding-tank/index.js`, inside `removeFromHoldingTank()` (line 315), add:

```javascript
window.secureElectronAPI?.analytics?.trackEvent?.('holding_tank_used', { action: 'remove' });
```

In `src/renderer/modules/holding-tank/index.js`, inside `clearHoldingTank()` (line 421), add:

```javascript
window.secureElectronAPI?.analytics?.trackEvent?.('holding_tank_used', { action: 'clear' });
```

- [ ] **Step 5: Instrument category browsing**

In `src/renderer/modules/categories/category-operations.js`, inside `getCategories()` (line 24) or the category select change handler, add:

```javascript
window.secureElectronAPI?.analytics?.trackEvent?.('category_browsed');
```

- [ ] **Step 6: Instrument waveform viewer**

In `src/renderer/modules/ui/controls.js`, inside `toggleWaveform()` (line 97), add when the waveform is being shown (inside the `if (Dom.hasClass('#waveform', 'hidden'))` branch, around line 102):

```javascript
      window.secureElectronAPI?.analytics?.trackEvent?.('waveform_viewed');
```

- [ ] **Step 7: Instrument profile switching**

In `src/renderer/modules/profile-state/index.js`, inside `switchProfileWithSave()` (line 870), add after a successful switch:

```javascript
window.secureElectronAPI?.analytics?.trackEvent?.('profile_switched');
```

- [ ] **Step 8: Instrument library import**

In `src/renderer/modules/library-transfer/index.js`, inside `importLibrary()` (line 237), add after a successful import, using the imported song count:

```javascript
window.secureElectronAPI?.analytics?.trackEvent?.('library_imported', { song_count: importedCount });
```

Where `importedCount` is the count from the import result.

- [ ] **Step 9: Instrument auto-update actions**

In `src/main/modules/ipc-handlers.js`, in the `download-update` handler (line 1050), add after `autoUpdater.downloadUpdate()`:

```javascript
      if (analytics) {
        analytics.trackEvent('auto_update_action', { action: 'accepted' });
      }
```

- [ ] **Step 10: Instrument preferences save**

In `src/renderer/modules/preferences/settings-controller.js`, add at the beginning of `savePreferences()` after form values are captured:

```javascript
    window.secureElectronAPI?.analytics?.trackEvent?.('preferences_changed', {
      setting_names: Object.keys(formValues),
    });
```

- [ ] **Step 11: Verify instrumentation**

Run: `npm start`
Expected: App launches without errors. Perform actions (play a song, search, open waveform, etc.) and check debug logs for analytics tracking messages.

- [ ] **Step 12: Commit**

```bash
git add src/renderer/modules/audio/audio-manager.js \
        src/renderer/modules/search/search-engine.js \
        src/renderer/modules/hotkeys/hotkey-operations.js \
        src/renderer/modules/holding-tank/index.js \
        src/renderer/modules/database/data-population.js \
        src/renderer/modules/categories/category-operations.js \
        src/renderer/modules/ui/controls.js \
        src/renderer/modules/profile-state/index.js \
        src/renderer/modules/library-transfer/index.js \
        src/renderer/modules/preferences/settings-controller.js \
        src/main/modules/ipc-handlers.js
git commit -m "feat: instrument renderer features with analytics events"
```

---

### Task 8: Renderer error tracking

**Files:**
- Modify: Renderer initialization code (wherever the renderer's main entry point is)

- [ ] **Step 1: Add renderer error handler**

In the renderer's main initialization flow, add a global error handler that sends renderer errors to the main process via the analytics IPC:

```javascript
// Track renderer errors
window.addEventListener('error', (event) => {
  window.secureElectronAPI?.analytics?.trackEvent?.('renderer_error', {
    error_message: event.message,
    stack_trace: event.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  window.secureElectronAPI?.analytics?.trackEvent?.('renderer_error', {
    error_message: reason instanceof Error ? reason.message : String(reason),
    stack_trace: reason instanceof Error ? reason.stack : undefined,
  });
});
```

- [ ] **Step 2: Verify error tracking works**

Run: `npm start`
Open DevTools, run `throw new Error('test analytics')` in the console. Check debug logs for the error event.

- [ ] **Step 3: Commit**

```bash
git add <renderer entry file>
git commit -m "feat: track renderer errors via analytics"
```

---

### Task 9: Set up PostHog project and replace placeholder key

**Files:**
- Modify: `src/main/modules/analytics.js:15` (replace `phc_PLACEHOLDER`)

- [ ] **Step 1: Create PostHog account and project**

1. Go to https://posthog.com and sign up (free tier)
2. Create a new project (e.g., "Mx. Voice")
3. Copy the project API key (starts with `phc_`)

- [ ] **Step 2: Replace placeholder API key**

In `src/main/modules/analytics.js`, replace `phc_PLACEHOLDER` with your actual PostHog project API key.

- [ ] **Step 3: Verify events arrive in PostHog**

Run: `npm start`
Perform some actions in the app, then check the PostHog dashboard to confirm events are arriving.

- [ ] **Step 4: Commit**

```bash
git add src/main/modules/analytics.js
git commit -m "feat: configure PostHog project API key"
```

---

### Task 10: Run full test suite

**Files:** None (verification only)

- [ ] **Step 1: Run unit tests**

Run: `npm run test:unit`
Expected: All tests pass, including the new analytics tests.

- [ ] **Step 2: Run e2e tests**

Run: `npm test`
Expected: All existing e2e tests still pass. The analytics module should not interfere with any existing functionality (it's additive and the PostHog calls are fire-and-forget).

- [ ] **Step 3: Fix any failures**

If any tests fail, diagnose and fix. Common issues:
- PostHog SDK making network calls during tests — ensure test mode suppresses them (the `APP_TEST_MODE` env var pattern already exists)
- New IPC handlers not registered in test fixtures — add them to test setup if needed

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve test issues from analytics integration"
```
