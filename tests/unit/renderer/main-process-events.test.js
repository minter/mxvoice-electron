import { describe, expect, it, vi } from 'vitest';
import { setupMainProcessEventBridge } from '../../../src/renderer/modules/event-coordination/main-process-events.js';

function createHarness(overrides = {}) {
  const handlers = {};
  const eventNames = [
    'onHoldingTankLoad', 'onFkeyLoad', 'onAddDialogLoad', 'onBulkAddDialogLoad',
    'onExternalFilesDrop', 'onManageCategories', 'onEditSelectedSong',
    'onDeleteSelectedSong', 'onIncreaseFontSize', 'onDecreaseFontSize',
    'onToggleWaveform', 'onToggleAdvancedSearch'
  ];
  const events = Object.fromEntries(eventNames.map((name) => [name, (handler) => { handlers[name] = handler; }]));
  const harness = {
    electronAPI: { events },
    moduleRegistry: {},
    logWarn: vi.fn(),
    logError: vi.fn(),
    ...overrides
  };
  setupMainProcessEventBridge(harness);
  return { ...harness, handlers };
}

describe('main process event bridge', () => {
  it('registers every supported main-process event', () => {
    const { handlers } = createHarness();
    expect(Object.keys(handlers)).toHaveLength(10);
  });

  it('no longer listens for main-initiated hotkey or holding tank loads', () => {
    const { handlers } = createHarness();
    expect(handlers.onFkeyLoad).toBeUndefined();
    expect(handlers.onHoldingTankLoad).toBeUndefined();
  });

  it('routes song editing to the song management module', () => {
    const moduleHandler = vi.fn();
    const { handlers } = createHarness({
      moduleRegistry: { songManagement: { editSelectedSong: moduleHandler } }
    });

    handlers.onEditSelectedSong();
    expect(moduleHandler).toHaveBeenCalledOnce();
  });

  it('falls back to the registered module when no global exists', () => {
    const moduleHandler = vi.fn();
    const { handlers } = createHarness({
      moduleRegistry: { ui: { toggleWaveform: moduleHandler } }
    });

    handlers.onToggleWaveform();
    expect(moduleHandler).toHaveBeenCalledOnce();
  });

  it('warns when an event has no available target', () => {
    const { handlers, logWarn } = createHarness();
    handlers.onManageCategories();
    expect(logWarn).toHaveBeenCalledWith(
      'openCategoriesModal not yet available when manage_categories fired'
    );
  });

  it('returns false when the events API is unavailable', () => {
    expect(setupMainProcessEventBridge({ electronAPI: {}, moduleRegistry: {} })).toBe(false);
  });
});
