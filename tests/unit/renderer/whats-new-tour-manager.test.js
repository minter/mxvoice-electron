import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock tours.json for index.js
vi.mock('../../../src/renderer/modules/whats-new/tours.json', () => ({
  default: {
    tours: {
      '4.3.0': {
        title: "What's New in 4.3.0",
        steps: [{ element: '#some-element', title: 'Feature A', description: 'Description of A' }],
      },
    },
  },
}));

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

// Mock bootstrap-helpers for dynamic imports in executeAction
vi.mock('../../../src/renderer/modules/ui/bootstrap-helpers.js', () => ({
  safeShowModal: vi.fn(),
  safeHideModal: vi.fn(),
}));

// Provide a minimal DOM stub (test environment is node, not jsdom)
globalThis.window = globalThis.window || {};

// Simple element factory for testing
function makeElement(tag, attrs = {}) {
  const el = {
    _tag: tag,
    _children: [],
    id: attrs.id || '',
    style: {},
    offsetParent: {},  // non-null = "visible"
    getAttribute: vi.fn(() => null),
    click: vi.fn(),
  };
  return el;
}

const domElements = {};

globalThis.document = {
  createElement: vi.fn((tag) => makeElement(tag)),
  querySelector: vi.fn((selector) => {
    // Support #id selectors
    if (selector.startsWith('#')) {
      return domElements[selector.slice(1)] || null;
    }
    return null;
  }),
  querySelectorAll: vi.fn(() => []),
  documentElement: {
    getAttribute: vi.fn(() => null),
  },
  body: {
    appendChild: vi.fn((el) => {
      if (el.id) domElements[el.id] = el;
    }),
    removeChild: vi.fn((el) => {
      if (el.id) delete domElements[el.id];
    }),
  },
};

globalThis.getComputedStyle = vi.fn(() => ({ position: 'static' }));
globalThis.requestAnimationFrame = vi.fn((cb) => cb());

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
const { initWhatsNew, showWhatsNew } = await import(
  '../../../src/renderer/modules/whats-new/index.js'
);

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
      const modalEl = document.createElement('div');
      modalEl.id = 'testModal';
      document.body.appendChild(modalEl);

      await manager.executeAction({ type: 'openModal', target: '#testModal' });
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

describe('initWhatsNew', () => {
  it('launches tour when version has unseen tour', async () => {
    mockGetVersion.mockResolvedValue('4.3.0');
    mockGetPreference.mockResolvedValue([]);

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
