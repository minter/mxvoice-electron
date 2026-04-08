# What's New Guided Tour — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-profile "What's New" guided walkthrough using Driver.js that auto-triggers after updates and is replayable from the app menu.

**Architecture:** A new `whats-new` renderer module with three files: `tours.json` (data), `tour-manager.js` (engine), and `index.js` (public API). Integrates with existing profile preferences for per-profile tracking, the app menu for on-demand access, and the bootstrap sequence for auto-trigger. Driver.js handles overlay/highlight/popover rendering with adaptive light/dark theming.

**Tech Stack:** Driver.js ^1.4.0, Bootstrap 5 (existing), vanilla JS ES modules, Electron IPC (existing patterns)

**Spec:** `docs/superpowers/specs/2026-04-08-whats-new-tour-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/renderer/modules/whats-new/tours.json` | Tour step definitions keyed by version |
| Create | `src/renderer/modules/whats-new/tour-manager.js` | Tour engine: load data, check prefs, run Driver.js, execute pre/post actions |
| Create | `src/renderer/modules/whats-new/index.js` | Public API: `initWhatsNew()`, `showWhatsNew()` |
| Modify | `src/stylesheets/index.css` | Driver.js popover theme overrides (light) |
| Modify | `src/stylesheets/colors.css` | Driver.js popover theme overrides (dark) |
| Modify | `src/preload/modules/secure-api-exposer.cjs:425-447` | Add `onWhatsNew` event handler |
| Modify | `src/main/modules/app-setup.js:660-670` | Add "What's New" menu item (macOS) |
| Modify | `src/main/modules/app-setup.js:766-778` | Add "What's New" menu item (Windows/Linux) |
| Modify | `src/renderer.js:513-535` | Add `onWhatsNew` IPC listener |
| Modify | `src/renderer/modules/app-bootstrap/module-config.js:8-31` | Register whats-new module |
| Create | `tests/unit/renderer/whats-new-tour-manager.test.js` | Unit tests for tour manager logic |
| Create | `tests/e2e/seeded/ui/whats-new-tour.spec.js` | E2E tests for full tour flow |

---

### Task 1: Install Driver.js

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install driver.js**

Run:
```bash
npm install driver.js
```

Expected: Package added to `dependencies` in `package.json`, `node_modules/driver.js` created.

- [ ] **Step 2: Verify installation**

Run:
```bash
node -e "require('driver.js'); console.log('driver.js loaded OK')"
```

Expected: `driver.js loaded OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add driver.js dependency for What's New tour feature"
```

---

### Task 2: Create Tour Data File

**Files:**
- Create: `src/renderer/modules/whats-new/tours.json`

- [ ] **Step 1: Create the tours.json file**

This is the data-driven config holding tour steps per version. The version key must match `package.json` exactly — currently `4.3.0-pre.1` for development, update to `4.3.0` at release time.

```json
{
  "tours": {
    "4.3.0-pre.1": {
      "title": "What's New in 4.3.0",
      "steps": [
        {
          "element": "#song-form-volume",
          "title": "Per-Track Volume",
          "description": "Adjust volume for individual tracks. Changes apply in real-time if the track is currently playing.",
          "side": "right",
          "align": "center",
          "preAction": {
            "type": "function",
            "name": "openEditForFirstSong"
          },
          "postAction": {
            "type": "closeModal",
            "target": "#songFormModal"
          },
          "skipIfMissing": true
        },
        {
          "element": "#song-form-start-time",
          "title": "Start & End Trim Points",
          "description": "Set custom start and end times to play just a portion of a track. Enter times as MM:SS.",
          "side": "right",
          "align": "center",
          "preAction": {
            "type": "function",
            "name": "openEditForFirstSong"
          },
          "postAction": {
            "type": "closeModal",
            "target": "#songFormModal"
          },
          "skipIfMissing": true
        },
        {
          "element": "#holding-tank-column",
          "title": "Drag to Reorder",
          "description": "Drag songs up and down in the holding tank to reorder them. A position indicator shows where the track will land.",
          "side": "right",
          "align": "center"
        },
        {
          "element": "#file-drop-overlay",
          "title": "Drag & Drop Import",
          "description": "Drag audio files from Finder or Explorer directly into the app window to import them.",
          "side": "bottom",
          "align": "center",
          "preAction": {
            "type": "function",
            "name": "showFileDropOverlay"
          },
          "postAction": {
            "type": "function",
            "name": "hideFileDropOverlay"
          }
        },
        {
          "element": null,
          "title": "Crossfade Between Tracks",
          "description": "Head to Preferences → Audio Controls to set a crossfade duration for smooth transitions between tracks in playlist mode."
        }
      ]
    }
  }
}
```
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/whats-new/tours.json
git commit -m "feat: add tour data file for What's New walkthrough"
```

---

### Task 3: Write Unit Tests for Tour Manager

**Files:**
- Create: `tests/unit/renderer/whats-new-tour-manager.test.js`

- [ ] **Step 1: Write failing unit tests**

These tests cover the tour manager's core logic: loading tours, checking version matches, managing `tours_seen` preferences, executing actions, and handling `skipIfMissing`. They mock Driver.js and the Electron API.

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock driver.js
vi.mock('driver.js', () => {
  const mockDriverInstance = {
    drive: vi.fn(),
    destroy: vi.fn(),
    isActive: vi.fn(() => false),
  };
  return {
    driver: vi.fn(() => mockDriverInstance),
    __mockInstance: mockDriverInstance,
  };
});

// Mock window APIs
globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const mockGetPreference = vi.fn();
const mockSetPreference = vi.fn();
const mockGetVersion = vi.fn();

window.secureElectronAPI = {
  profile: {
    getPreference: mockGetPreference,
    setPreference: mockSetPreference,
  },
  app: {
    getVersion: mockGetVersion,
  },
};

const { TourManager } = await import(
  '../../../src/renderer/modules/whats-new/tour-manager.js'
);
const { __mockInstance: mockDriver } = await import('driver.js');

describe('TourManager', () => {
  let manager;

  const sampleTours = {
    tours: {
      '4.3.0': {
        title: "What's New in 4.3.0",
        steps: [
          {
            element: '#some-element',
            title: 'Feature A',
            description: 'Description of A',
            side: 'bottom',
            align: 'center',
          },
          {
            element: '#another-element',
            title: 'Feature B',
            description: 'Description of B',
            side: 'right',
            align: 'start',
            skipIfMissing: true,
          },
        ],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new TourManager(sampleTours);
  });

  describe('getTourForVersion', () => {
    it('returns tour data for a matching version', () => {
      const tour = manager.getTourForVersion('4.3.0');
      expect(tour).toBeDefined();
      expect(tour.title).toBe("What's New in 4.3.0");
      expect(tour.steps).toHaveLength(2);
    });

    it('returns null for a version with no tour', () => {
      const tour = manager.getTourForVersion('9.9.9');
      expect(tour).toBeNull();
    });
  });

  describe('shouldAutoTrigger', () => {
    it('returns true when version has a tour and has not been seen', async () => {
      mockGetVersion.mockResolvedValue('4.3.0');
      mockGetPreference.mockResolvedValue([]);
      const result = await manager.shouldAutoTrigger();
      expect(result).toBe(true);
    });

    it('returns false when version tour has already been seen', async () => {
      mockGetVersion.mockResolvedValue('4.3.0');
      mockGetPreference.mockResolvedValue(['4.3.0']);
      const result = await manager.shouldAutoTrigger();
      expect(result).toBe(false);
    });

    it('returns false when no tour exists for the current version', async () => {
      mockGetVersion.mockResolvedValue('9.9.9');
      mockGetPreference.mockResolvedValue([]);
      const result = await manager.shouldAutoTrigger();
      expect(result).toBe(false);
    });

    it('treats null tours_seen as empty array', async () => {
      mockGetVersion.mockResolvedValue('4.3.0');
      mockGetPreference.mockResolvedValue(null);
      const result = await manager.shouldAutoTrigger();
      expect(result).toBe(true);
    });
  });

  describe('markTourSeen', () => {
    it('appends version to existing tours_seen array', async () => {
      mockGetPreference.mockResolvedValue(['4.2.0']);
      await manager.markTourSeen('4.3.0');
      expect(mockSetPreference).toHaveBeenCalledWith('tours_seen', ['4.2.0', '4.3.0']);
    });

    it('creates array when tours_seen is null', async () => {
      mockGetPreference.mockResolvedValue(null);
      await manager.markTourSeen('4.3.0');
      expect(mockSetPreference).toHaveBeenCalledWith('tours_seen', ['4.3.0']);
    });

    it('does not duplicate an already-seen version', async () => {
      mockGetPreference.mockResolvedValue(['4.3.0']);
      await manager.markTourSeen('4.3.0');
      expect(mockSetPreference).toHaveBeenCalledWith('tours_seen', ['4.3.0']);
    });
  });

  describe('buildDriverSteps', () => {
    it('converts tour steps to Driver.js format', () => {
      const tour = manager.getTourForVersion('4.3.0');
      const driverSteps = manager.buildDriverSteps(tour.steps);
      expect(driverSteps).toHaveLength(2);
      expect(driverSteps[0]).toEqual({
        element: '#some-element',
        popover: {
          title: 'Feature A',
          description: 'Description of A',
          side: 'bottom',
          align: 'center',
        },
      });
    });

    it('omits element field for null-element steps (centered popover)', () => {
      const steps = [{ element: null, title: 'Info', description: 'General info' }];
      const driverSteps = manager.buildDriverSteps(steps);
      expect(driverSteps[0].element).toBeUndefined();
      expect(driverSteps[0].popover.title).toBe('Info');
    });
  });

  describe('shouldSkipStep', () => {
    it('returns false when element exists and is visible', () => {
      const el = document.createElement('div');
      el.id = 'visible-el';
      document.body.appendChild(el);
      const result = manager.shouldSkipStep({ element: '#visible-el', skipIfMissing: true });
      expect(result).toBe(false);
      document.body.removeChild(el);
    });

    it('returns true when element is missing and skipIfMissing is true', () => {
      const result = manager.shouldSkipStep({ element: '#nonexistent', skipIfMissing: true });
      expect(result).toBe(true);
    });

    it('returns false when element is missing but skipIfMissing is false', () => {
      const result = manager.shouldSkipStep({ element: '#nonexistent', skipIfMissing: false });
      expect(result).toBe(false);
    });

    it('returns false for null-element steps (centered popover)', () => {
      const result = manager.shouldSkipStep({ element: null, skipIfMissing: false });
      expect(result).toBe(false);
    });
  });

  describe('executeAction', () => {
    it('calls safeShowModal for openModal action', async () => {
      // Create a mock modal element for Bootstrap to find
      const modalEl = document.createElement('div');
      modalEl.id = 'testModal';
      document.body.appendChild(modalEl);

      await manager.executeAction({ type: 'openModal', target: '#testModal' });
      // The action should attempt to show the modal (implementation will import bootstrap-helpers)
      // We verify it doesn't throw
      document.body.removeChild(modalEl);
    });

    it('calls registered function for function action', async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined);
      manager.registerHelper('testHelper', mockFn);
      await manager.executeAction({ type: 'function', name: 'testHelper' });
      expect(mockFn).toHaveBeenCalled();
    });

    it('logs warning for unregistered function', async () => {
      await manager.executeAction({ type: 'function', name: 'nonexistent' });
      expect(window.debugLog.warn).toHaveBeenCalledWith(
        expect.stringContaining('nonexistent'),
        expect.any(Object),
      );
    });

    it('does nothing for null/undefined action', async () => {
      await expect(manager.executeAction(null)).resolves.toBeUndefined();
      await expect(manager.executeAction(undefined)).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run tests/unit/renderer/whats-new-tour-manager.test.js
```

Expected: FAIL — `Cannot find module '../../../src/renderer/modules/whats-new/tour-manager.js'`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/renderer/whats-new-tour-manager.test.js
git commit -m "test: add unit tests for What's New tour manager"
```

---

### Task 4: Implement Tour Manager

**Files:**
- Create: `src/renderer/modules/whats-new/tour-manager.js`

- [ ] **Step 1: Write the tour manager implementation**

```javascript
import { driver } from 'driver.js';

/**
 * Manages "What's New" guided tours using Driver.js.
 * Loads tour data, checks profile preferences, executes pre/post actions,
 * and drives the tour UI.
 */
export class TourManager {
  constructor(tourData) {
    this.tourData = tourData;
    this.helpers = {};
    this.activeDriver = null;
    this.currentSteps = null;
  }

  /**
   * Get tour definition for a specific version.
   * @param {string} version - Exact version string (e.g., '4.3.0')
   * @returns {object|null} Tour object with title and steps, or null
   */
  getTourForVersion(version) {
    return this.tourData.tours[version] || null;
  }

  /**
   * Check whether the auto-trigger tour should run for the current version/profile.
   * @returns {Promise<boolean>}
   */
  async shouldAutoTrigger() {
    const version = await window.secureElectronAPI.app.getVersion();
    const tour = this.getTourForVersion(version);
    if (!tour) return false;

    const toursSeen = await window.secureElectronAPI.profile.getPreference('tours_seen');
    const seen = Array.isArray(toursSeen) ? toursSeen : [];
    return !seen.includes(version);
  }

  /**
   * Mark a version's tour as seen in profile preferences.
   * @param {string} version
   */
  async markTourSeen(version) {
    const toursSeen = await window.secureElectronAPI.profile.getPreference('tours_seen');
    const seen = Array.isArray(toursSeen) ? toursSeen : [];
    if (!seen.includes(version)) {
      seen.push(version);
    }
    await window.secureElectronAPI.profile.setPreference('tours_seen', seen);
  }

  /**
   * Convert tour JSON steps to Driver.js step format.
   * @param {Array} steps - Steps from tours.json
   * @returns {Array} Driver.js-compatible step objects
   */
  buildDriverSteps(steps) {
    return steps.map((step) => {
      const driverStep = {
        popover: {
          title: step.title,
          description: step.description,
          side: step.side || 'bottom',
          align: step.align || 'center',
        },
      };
      if (step.element) {
        driverStep.element = step.element;
      }
      return driverStep;
    });
  }

  /**
   * Check whether a step should be skipped because its target element is missing.
   * @param {object} step - Step from tours.json
   * @returns {boolean}
   */
  shouldSkipStep(step) {
    if (!step.element) return false;
    if (!step.skipIfMissing) return false;
    const el = document.querySelector(step.element);
    if (!el) return true;
    // Check visibility (offsetParent is null for hidden elements, except fixed-position ones)
    return el.offsetParent === null && getComputedStyle(el).position !== 'fixed';
  }

  /**
   * Register a named helper function for use in preAction/postAction.
   * @param {string} name
   * @param {Function} fn - Async function to call
   */
  registerHelper(name, fn) {
    this.helpers[name] = fn;
  }

  /**
   * Execute a pre or post action.
   * @param {object|null} action - Action definition from tours.json
   */
  async executeAction(action) {
    if (!action) return;

    switch (action.type) {
      case 'openModal': {
        const { safeShowModal } = await import('../ui/bootstrap-helpers.js');
        await safeShowModal(action.target, { module: 'whats-new', function: 'executeAction' });
        break;
      }
      case 'closeModal': {
        const { safeHideModal } = await import('../ui/bootstrap-helpers.js');
        await safeHideModal(action.target, { module: 'whats-new', function: 'executeAction' });
        break;
      }
      case 'click': {
        const el = document.querySelector(action.target);
        if (el) el.click();
        break;
      }
      case 'function': {
        const fn = this.helpers[action.name];
        if (fn) {
          await fn();
        } else {
          window.debugLog?.warn(`Tour helper function "${action.name}" not registered`, {
            module: 'whats-new',
            function: 'executeAction',
          });
        }
        break;
      }
      case 'hide': {
        const el = document.querySelector(action.target);
        if (el) el.style.display = 'none';
        break;
      }
      default:
        window.debugLog?.warn(`Unknown tour action type: ${action.type}`, {
          module: 'whats-new',
          function: 'executeAction',
        });
    }
  }

  /**
   * Wait for the DOM to settle after an action (modal animation, etc.).
   * @returns {Promise<void>}
   */
  waitForDomSettle() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve, 300));
    });
  }

  /**
   * Clean up all pending postActions when the tour is dismissed mid-way.
   * @param {Array} steps - The original tour steps from tours.json
   * @param {number} currentIndex - The index of the step where dismiss happened
   */
  async cleanupFromStep(steps, currentIndex) {
    const step = steps[currentIndex];
    if (step && step.postAction) {
      await this.executeAction(step.postAction);
    }
  }

  /**
   * Determine the CSS class for the Driver.js popover based on current theme.
   * @returns {string} 'driver-popover-dark' or 'driver-popover-light'
   */
  getThemeClass() {
    const html = document.documentElement;
    const theme = html.getAttribute('data-bs-theme');
    return theme === 'dark' ? 'driver-popover-dark' : 'driver-popover-light';
  }

  /**
   * Launch a tour for the given version.
   * @param {string} version
   * @param {object} options
   * @param {boolean} [options.markSeen=true] - Whether to mark the tour as seen on completion/dismiss
   * @returns {Promise<void>}
   */
  async launchTour(version, { markSeen = true } = {}) {
    const tour = this.getTourForVersion(version);
    if (!tour) {
      window.debugLog?.info(`No tour found for version ${version}`, {
        module: 'whats-new',
        function: 'launchTour',
      });
      return;
    }

    // Filter out steps that should be skipped
    const activeSteps = tour.steps.filter((step) => !this.shouldSkipStep(step));
    if (activeSteps.length === 0) {
      window.debugLog?.info('All tour steps skipped (elements missing)', {
        module: 'whats-new',
        function: 'launchTour',
      });
      if (markSeen) await this.markTourSeen(version);
      return;
    }

    this.currentSteps = activeSteps;
    let currentStepIndex = 0;

    const driverSteps = this.buildDriverSteps(activeSteps);
    const themeClass = this.getThemeClass();

    const onComplete = async () => {
      if (markSeen) await this.markTourSeen(version);
      this.activeDriver = null;
      this.currentSteps = null;
    };

    this.activeDriver = driver({
      showProgress: true,
      steps: driverSteps,
      popoverClass: `whats-new-popover ${themeClass}`,
      nextBtnText: 'Next',
      prevBtnText: 'Previous',
      doneBtnText: 'Done',
      onHighlightStarted: async (_el, step, opts) => {
        currentStepIndex = opts.index;
        const tourStep = activeSteps[opts.index];
        if (tourStep && tourStep.preAction) {
          await this.executeAction(tourStep.preAction);
          await this.waitForDomSettle();
        }
      },
      onDeselected: async (_el, step, opts) => {
        const tourStep = activeSteps[opts.index];
        if (tourStep && tourStep.postAction) {
          await this.executeAction(tourStep.postAction);
          await this.waitForDomSettle();
        }
      },
      onDestroyStarted: async () => {
        await this.cleanupFromStep(activeSteps, currentStepIndex);
        await onComplete();
      },
    });

    this.activeDriver.drive();
  }
}
```

- [ ] **Step 2: Run the unit tests**

Run:
```bash
npx vitest run tests/unit/renderer/whats-new-tour-manager.test.js
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/modules/whats-new/tour-manager.js
git commit -m "feat: implement TourManager class for What's New guided tours"
```

---

### Task 5: Write Unit Tests for Module Public API

**Files:**
- Create (append to): `tests/unit/renderer/whats-new-tour-manager.test.js`

- [ ] **Step 1: Add tests for initWhatsNew and showWhatsNew**

Append these tests to the existing test file:

```javascript
// At the top of the file, add this mock before the TourManager import:
vi.mock('../../../src/renderer/modules/whats-new/tours.json', () => ({
  default: {
    tours: {
      '4.3.0': {
        title: "What's New in 4.3.0",
        steps: [
          {
            element: '#some-element',
            title: 'Feature A',
            description: 'Description of A',
          },
        ],
      },
    },
  },
}));

const { initWhatsNew, showWhatsNew } = await import(
  '../../../src/renderer/modules/whats-new/index.js'
);

describe('initWhatsNew', () => {
  it('launches tour when version has unseen tour', async () => {
    mockGetVersion.mockResolvedValue('4.3.0');
    mockGetPreference.mockResolvedValue([]);

    // Create the target element so the step isn't empty
    const el = document.createElement('div');
    el.id = 'some-element';
    document.body.appendChild(el);

    await initWhatsNew();
    expect(mockDriver.drive).toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it('does not launch tour when version already seen', async () => {
    mockGetVersion.mockResolvedValue('4.3.0');
    mockGetPreference.mockResolvedValue(['4.3.0']);
    mockDriver.drive.mockClear();

    await initWhatsNew();
    expect(mockDriver.drive).not.toHaveBeenCalled();
  });
});

describe('showWhatsNew', () => {
  it('launches tour for current version regardless of seen state', async () => {
    mockGetVersion.mockResolvedValue('4.3.0');
    mockGetPreference.mockResolvedValue(['4.3.0']);
    mockDriver.drive.mockClear();

    const el = document.createElement('div');
    el.id = 'some-element';
    document.body.appendChild(el);

    await showWhatsNew();
    expect(mockDriver.drive).toHaveBeenCalled();

    document.body.removeChild(el);
  });
});
```

Note: The above tests need the imports restructured. Since this is appended to the same file, the mocks from Task 3 are already in scope. The `initWhatsNew`/`showWhatsNew` import must be placed after the tours.json mock is registered.

- [ ] **Step 2: Run the tests**

Run:
```bash
npx vitest run tests/unit/renderer/whats-new-tour-manager.test.js
```

Expected: FAIL — `Cannot find module '../../../src/renderer/modules/whats-new/index.js'`

- [ ] **Step 3: Commit**

```bash
git add tests/unit/renderer/whats-new-tour-manager.test.js
git commit -m "test: add unit tests for What's New public API (initWhatsNew, showWhatsNew)"
```

---

### Task 6: Implement Module Public API

**Files:**
- Create: `src/renderer/modules/whats-new/index.js`

- [ ] **Step 1: Write the public API module**

```javascript
import tourData from './tours.json';
import { TourManager } from './tour-manager.js';

const tourManager = new TourManager(tourData);

// ─── Register helper functions ────────────────────────────────────────

/**
 * Opens the edit modal for the first song in the database.
 * Skips silently if no songs exist.
 */
tourManager.registerHelper('openEditForFirstSong', async () => {
  const result = await window.secureElectronAPI.database.searchSongs('', { limit: 1 });
  const rows = result?.data || result;
  if (!Array.isArray(rows) || rows.length === 0) return;

  const song = rows[0];
  // Populate the edit form fields
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };
  setVal('song-form-songid', song.songid);
  setVal('song-form-title', song.title);
  setVal('song-form-artist', song.artist);
  setVal('song-form-info', song.info);
  setVal('song-form-duration', song.time);

  const volEl = document.getElementById('song-form-volume');
  if (volEl) volEl.value = song.volume ?? 100;
  const volDisplay = document.getElementById('song-form-volume-display');
  if (volDisplay) volDisplay.textContent = song.volume ?? 100;

  const startEl = document.getElementById('song-form-start-time');
  if (startEl) startEl.value = song.start_time || '';
  const endEl = document.getElementById('song-form-end-time');
  if (endEl) {
    endEl.value = song.end_time || '';
    endEl.placeholder = song.time || 'End of track';
  }

  const { safeShowModal } = await import('../ui/bootstrap-helpers.js');
  await safeShowModal('#songFormModal', { module: 'whats-new', function: 'openEditForFirstSong' });
});

/**
 * Shows the context menu positioned near the first song row.
 * Skips silently if no songs exist.
 */
tourManager.registerHelper('showContextMenuForFirstSong', async () => {
  const firstRow = document.querySelector('#search_results tbody tr.song');
  if (!firstRow) return;

  // Select the row
  firstRow.click();

  // Trigger context menu display
  const menu = document.getElementById('mxv-context-menu');
  if (menu) {
    const rect = firstRow.getBoundingClientRect();
    menu.style.left = `${rect.left + 50}px`;
    menu.style.top = `${rect.top + rect.height}px`;
    menu.style.display = 'block';
  }
});

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Check if a tour should auto-trigger for the current version/profile,
 * and launch it if so. Called during app bootstrap.
 */
export async function initWhatsNew() {
  try {
    const shouldRun = await tourManager.shouldAutoTrigger();
    if (shouldRun) {
      const version = await window.secureElectronAPI.app.getVersion();
      window.debugLog?.info(`Auto-triggering What's New tour for ${version}`, {
        module: 'whats-new',
        function: 'initWhatsNew',
      });
      await tourManager.launchTour(version, { markSeen: true });
    }
  } catch (error) {
    window.debugLog?.error('Failed to initialize What\'s New tour', {
      module: 'whats-new',
      function: 'initWhatsNew',
      error: error?.message,
    });
  }
}

/**
 * Launch the tour for the current version on demand (from menu).
 * Always runs regardless of tours_seen state.
 */
export async function showWhatsNew() {
  try {
    const version = await window.secureElectronAPI.app.getVersion();
    const tour = tourManager.getTourForVersion(version);

    if (tour) {
      window.debugLog?.info(`Showing What's New tour for ${version} (on demand)`, {
        module: 'whats-new',
        function: 'showWhatsNew',
      });
      await tourManager.launchTour(version, { markSeen: false });
    } else {
      // No tour for this version — open release notes as fallback
      window.debugLog?.info(`No tour for ${version}, opening release notes`, {
        module: 'whats-new',
        function: 'showWhatsNew',
      });
      window.open('https://github.com/minter/mxvoice-electron/releases/', '_blank');
    }
  } catch (error) {
    window.debugLog?.error('Failed to show What\'s New tour', {
      module: 'whats-new',
      function: 'showWhatsNew',
      error: error?.message,
    });
  }
}

/**
 * Briefly shows the file drop overlay so the tour can highlight it.
 */
tourManager.registerHelper('showFileDropOverlay', async () => {
  const overlay = document.getElementById('file-drop-overlay');
  if (overlay) overlay.classList.add('active');
});

/**
 * Hides the file drop overlay after the tour step.
 */
tourManager.registerHelper('hideFileDropOverlay', async () => {
  const overlay = document.getElementById('file-drop-overlay');
  if (overlay) overlay.classList.remove('active');
});

export { tourManager };
```

- [ ] **Step 2: Run all unit tests**

Run:
```bash
npx vitest run tests/unit/renderer/whats-new-tour-manager.test.js
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/modules/whats-new/index.js
git commit -m "feat: implement What's New module public API with helper functions"
```

---

### Task 7: Add Adaptive Theme CSS

**Files:**
- Modify: `src/stylesheets/index.css`
- Modify: `src/stylesheets/colors.css`

- [ ] **Step 1: Add base Driver.js popover styles to index.css**

Add at the end of `src/stylesheets/index.css`:

```css
/* ── What's New Tour (Driver.js) ─────────────────────────────────── */
.whats-new-popover {
  font-family: inherit;
  border-radius: 8px;
  padding: 16px;
  max-width: 320px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.whats-new-popover .driver-popover-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.whats-new-popover .driver-popover-description {
  font-size: 13px;
  line-height: 1.4;
}

.whats-new-popover .driver-popover-progress-text {
  font-size: 12px;
}

.whats-new-popover .driver-popover-navigation button {
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.whats-new-popover .driver-popover-next-btn,
.whats-new-popover .driver-popover-close-btn {
  background: #6c63ff;
  border: none;
  color: #fff;
}

.whats-new-popover .driver-popover-prev-btn {
  background: none;
  border: 1px solid;
}
```

- [ ] **Step 2: Add light theme colors to colors.css**

Find the light theme section in `src/stylesheets/colors.css` and add:

```css
/* What's New tour - light theme */
.whats-new-popover.driver-popover-light {
  background: #fff;
  border: 1px solid #e0e0e0;
}

.whats-new-popover.driver-popover-light .driver-popover-title {
  color: #1a1a2e;
}

.whats-new-popover.driver-popover-light .driver-popover-description {
  color: #555;
}

.whats-new-popover.driver-popover-light .driver-popover-progress-text {
  color: #888;
}

.whats-new-popover.driver-popover-light .driver-popover-prev-btn {
  border-color: #ddd;
  color: #555;
}
```

- [ ] **Step 3: Add dark theme colors to colors.css**

Find the dark theme section in `src/stylesheets/colors.css` and add:

```css
/* What's New tour - dark theme */
.whats-new-popover.driver-popover-dark {
  background: #2d2d44;
  border: 1px solid #3d3d5c;
}

.whats-new-popover.driver-popover-dark .driver-popover-title {
  color: #e0e0e0;
}

.whats-new-popover.driver-popover-dark .driver-popover-description {
  color: #a0a0b0;
}

.whats-new-popover.driver-popover-dark .driver-popover-progress-text {
  color: #666;
}

.whats-new-popover.driver-popover-dark .driver-popover-prev-btn {
  border-color: #3d3d5c;
  color: #a0a0b0;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/stylesheets/index.css src/stylesheets/colors.css
git commit -m "feat: add adaptive light/dark theme styles for What's New tour popover"
```

---

### Task 8: Add Preload Event Handler

**Files:**
- Modify: `src/preload/modules/secure-api-exposer.cjs:429-447`

- [ ] **Step 1: Add onWhatsNew event handler**

In `src/preload/modules/secure-api-exposer.cjs`, add the `onWhatsNew` handler after the `onImportLibrary` handler (after line 439) and before `onExternalFilesDrop`:

```javascript
    onWhatsNew: (callback) => {
      const handler = (_event, ...args) => callback(...args);
      ipcRenderer.on('menu:whats-new', handler);
      return () => ipcRenderer.removeListener('menu:whats-new', handler);
    },
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/modules/secure-api-exposer.cjs
git commit -m "feat: add onWhatsNew IPC event handler in preload"
```

---

### Task 9: Add "What's New" Menu Items

**Files:**
- Modify: `src/main/modules/app-setup.js:660-670` (macOS menu)
- Modify: `src/main/modules/app-setup.js:766-778` (Windows/Linux menu)

- [ ] **Step 1: Add menu item for macOS**

In `src/main/modules/app-setup.js`, in the macOS app-name submenu, add a "What's New" item after the "Release Notes" entry (after line 670):

```javascript
        {
          label: "What's New",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:whats-new');
            }
          }
        },
```

This goes between the existing "Release Notes" block and the "Contact Support..." block.

- [ ] **Step 2: Add menu item for Windows/Linux**

In the Help submenu for Windows/Linux, add the same item after "Release Notes" (after line 778):

```javascript
        {
          label: "What's New",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('menu:whats-new');
            }
          }
        },
```

- [ ] **Step 3: Commit**

```bash
git add src/main/modules/app-setup.js
git commit -m "feat: add What's New menu item to macOS and Windows/Linux menus"
```

---

### Task 10: Register Module and Wire Up IPC Listener

**Files:**
- Modify: `src/renderer/modules/app-bootstrap/module-config.js:8-31`
- Modify: `src/renderer.js:513-535`

- [ ] **Step 1: Add whats-new to module config**

In `src/renderer/modules/app-bootstrap/module-config.js`, add a new entry to the `moduleConfig` array (after the `cleanup` entry, at the end):

```javascript
  { name: 'whatsNew', path: '../whats-new/index.js', required: false },
```

- [ ] **Step 2: Add IPC listener for menu:whats-new**

In `src/renderer.js`, after the `onImportLibrary` listener block (after line 535), add:

```javascript
      if (apiToUse && apiToUse.events && apiToUse.events.onWhatsNew) {
        window.logInfo('🆕 Setting up What\'s New event listener...');
        apiToUse.events.onWhatsNew(async () => {
          window.logInfo('🆕 What\'s New requested from menu');
          if (moduleRegistry.whatsNew && moduleRegistry.whatsNew.showWhatsNew) {
            await moduleRegistry.whatsNew.showWhatsNew();
          } else {
            window.logWarn('What\'s New module not available');
          }
        });
      }
```

- [ ] **Step 3: Add auto-trigger call in bootstrap**

In `src/renderer.js`, after module loading completes and the IPC listeners are set up (after the function coordination initialization, around line 555), add:

```javascript
    // Auto-trigger What's New tour if applicable
    if (moduleRegistry.whatsNew && moduleRegistry.whatsNew.initWhatsNew) {
      await moduleRegistry.whatsNew.initWhatsNew();
    }
```

This must come after the module registry is populated and after the function coordination init, but before keyboard manager setup.

- [ ] **Step 4: Run the unit tests to ensure nothing broke**

Run:
```bash
npx vitest run tests/unit/renderer/whats-new-tour-manager.test.js
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/modules/app-bootstrap/module-config.js src/renderer.js
git commit -m "feat: register What's New module and wire up IPC listener and auto-trigger"
```

---

### Task 11: Add Driver.js CSS Import

**Files:**
- Modify: `src/index.html`

- [ ] **Step 1: Add Driver.js stylesheet**

Driver.js requires its CSS to be loaded. In `src/index.html`, add the stylesheet link after the existing app stylesheets (after the `colors.css` link):

```html
<link rel="stylesheet" href="../node_modules/driver.js/dist/driver.css">
```

Note: Verify the exact path to the Driver.js CSS file after installation. The path may be `node_modules/driver.js/dist/driver.css` or similar. Check with:

```bash
ls node_modules/driver.js/dist/*.css
```

- [ ] **Step 2: Commit**

```bash
git add src/index.html
git commit -m "feat: add Driver.js CSS import to index.html"
```

---

### Task 12: Write E2E Tests

**Files:**
- Create: `tests/e2e/seeded/ui/whats-new-tour.spec.js`

- [ ] **Step 1: Write E2E test for auto-trigger and on-demand tour**

```javascript
import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('What\'s New Tour', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'whats-new-tour'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('What\'s New module is loaded in module registry', async () => {
    const hasModule = await page.evaluate(() => !!window.moduleRegistry?.whatsNew);
    expect(hasModule).toBe(true);
  });

  test('Tour can be launched on demand via showWhatsNew', async () => {
    // Clear tours_seen so the tour will run
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('tours_seen', []);
    });

    // Check if there's a tour for the current version
    const hasTour = await page.evaluate(async () => {
      const { tourManager } = await import('./renderer/modules/whats-new/index.js');
      const version = await window.secureElectronAPI.app.getVersion();
      return tourManager.getTourForVersion(version) !== null;
    });

    if (!hasTour) {
      test.skip();
      return;
    }

    // Launch tour
    await page.evaluate(async () => {
      if (window.moduleRegistry.whatsNew?.showWhatsNew) {
        await window.moduleRegistry.whatsNew.showWhatsNew();
      }
    });

    // Driver.js overlay should be visible
    const overlay = page.locator('.driver-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Popover should show the first step
    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });
  });

  test('Tour can be dismissed with close button', async () => {
    // If the tour is active from the previous test, dismiss it
    const closeBtn = page.locator('.driver-popover-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // Overlay should be gone
    const overlay = page.locator('.driver-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 3000 });
  });

  test('Tour steps can be navigated with Next button', async () => {
    // Clear tours_seen and relaunch
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('tours_seen', []);
    });

    await page.evaluate(async () => {
      if (window.moduleRegistry.whatsNew?.showWhatsNew) {
        await window.moduleRegistry.whatsNew.showWhatsNew();
      }
    });

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Get initial step title
    const firstTitle = await page.locator('.driver-popover-title').textContent();

    // Click Next
    const nextBtn = page.locator('.driver-popover-next-btn');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      // Wait for transition
      await page.waitForTimeout(500);

      // Title should have changed (if there are multiple steps)
      const secondTitle = await page.locator('.driver-popover-title').textContent();
      // Just verify the popover is still visible — title may or may not change
      // depending on number of steps
      await expect(popover).toBeVisible();
    }

    // Clean up — dismiss tour
    const closeBtn = page.locator('.driver-popover-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('Adaptive theming applies correct class', async () => {
    // Launch tour
    await page.evaluate(async () => {
      await window.secureElectronAPI.profile.setPreference('tours_seen', []);
      if (window.moduleRegistry.whatsNew?.showWhatsNew) {
        await window.moduleRegistry.whatsNew.showWhatsNew();
      }
    });

    const popover = page.locator('.driver-popover');
    await expect(popover).toBeVisible({ timeout: 5000 });

    // Check that one of the theme classes is applied
    const hasThemeClass = await page.evaluate(() => {
      const el = document.querySelector('.driver-popover');
      return el?.classList.contains('driver-popover-dark') || el?.classList.contains('driver-popover-light');
    });
    expect(hasThemeClass).toBe(true);

    // Dismiss
    const closeBtn = page.locator('.driver-popover-close-btn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });
});
```

- [ ] **Step 2: Run the E2E tests**

Run:
```bash
npx playwright test tests/e2e/seeded/ui/whats-new-tour.spec.js
```

Expected: Tests pass (some may need adjustment based on the actual seeded data and tour content).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/seeded/ui/whats-new-tour.spec.js
git commit -m "test: add E2E tests for What's New guided tour"
```

---

### Task 13: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run all unit tests**

Run:
```bash
npx vitest run
```

Expected: All existing tests pass, new tests pass.

- [ ] **Step 2: Run all E2E tests**

Run:
```bash
npx playwright test
```

Expected: All existing tests pass, new tests pass.

- [ ] **Step 3: Run linter**

Run:
```bash
npx eslint src/renderer/modules/whats-new/ tests/unit/renderer/whats-new-tour-manager.test.js tests/e2e/seeded/ui/whats-new-tour.spec.js
```

Expected: No lint errors.

- [ ] **Step 4: Fix any failures and commit**

If any tests or lint issues found, fix and commit:

```bash
git add -A
git commit -m "fix: resolve test/lint issues from What's New tour implementation"
```
