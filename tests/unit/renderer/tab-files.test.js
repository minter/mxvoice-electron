import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};
window.debugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const { saveTabToFile, loadTabFromFile, replaceTabConfirmArgs } = await import('../../../src/renderer/modules/ui/tab-files.js');

const READY = { success: true, data: { status: 'ready' } };

function harness({
  status = 'ready',
  hotkeyTabs = [{ tabNumber: 1, tabName: null, hotkeys: {} }, { tabNumber: 2, tabName: 'Intros', hotkeys: { f1: '1001', f3: '1003' } }],
  holdingTabs = [{ tabNumber: 1, tabName: null, songIds: [] }, { tabNumber: 2, tabName: 'Preshow', songIds: ['1004', '1002'] }],
  files = {}
} = {}) {
  const fileOperations = {
    saveHotkeyTab: vi.fn(async () => files.saveHotkeyTab ?? { success: true, data: { path: '/tmp/Intros.mrv' } }),
    saveHoldingTankTab: vi.fn(async () => files.saveHoldingTankTab ?? { success: true, data: { path: '/tmp/Preshow.hld' } }),
    loadHotkeyTab: vi.fn(async () => files.loadHotkeyTab ?? { success: true, data: { hotkeys: { f1: '1005', f2: '' }, tabName: 'Drops' } }),
    loadHoldingTankTab: vi.fn(async () => files.loadHoldingTankTab ?? { success: true, data: { songIds: ['1001', '1003'] } })
  };
  const electronAPI = {
    fileOperations,
    shows: { getState: vi.fn(async () => (status === 'ready' ? READY : { success: true, data: { status } })) },
    analytics: { trackEvent: vi.fn() }
  };
  const registry = {
    hotkeys: {
      getHotkeySnapshot: vi.fn(() => hotkeyTabs),
      populateHotkeys: vi.fn(async () => ({ dropped: 0 }))
    },
    holdingTank: {
      getHoldingTankSnapshot: vi.fn(() => holdingTabs),
      populateHoldingTank: vi.fn(async () => ({ success: true, count: 2, dropped: 0 }))
    }
  };
  const deps = {
    registry,
    electronAPI,
    confirm: vi.fn(async () => true),
    alert: vi.fn(async () => {}),
    toast: vi.fn()
  };
  return { deps, registry, electronAPI, fileOperations };
}

describe('replace confirm', () => {
  it('names the tab and defaults to Cancel', () => {
    expect(replaceTabConfirmArgs('Tab 3')).toEqual([
      'Replace the songs in "Tab 3"?',
      'Load Tab from File',
      { confirmLabel: 'Replace', defaultAction: 'cancel' }
    ]);
  });
});

describe('saving a tab to a file', () => {
  it('sends the hotkey tab from the model and its label, and tracks the save', async () => {
    const { deps, fileOperations, electronAPI } = harness();
    await expect(saveTabToFile('hotkeys', { tabNumber: 2, label: 'Intros' }, deps)).resolves.toEqual({ status: 'saved', path: '/tmp/Intros.mrv' });
    expect(fileOperations.saveHotkeyTab).toHaveBeenCalledWith({ tabNumber: 2, tabName: 'Intros', hotkeys: { f1: '1001', f3: '1003' } }, 'Intros');
    expect(electronAPI.analytics.trackEvent).toHaveBeenCalledWith('tab_file_saved', { kind: 'hotkeys' });
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it('sends the holding tank tab’s song ids in order', async () => {
    const { deps, fileOperations, electronAPI } = harness();
    await saveTabToFile('holding_tank', { tabNumber: 2, label: 'Preshow' }, deps);
    expect(fileOperations.saveHoldingTankTab).toHaveBeenCalledWith(['1004', '1002'], 'Preshow');
    expect(electronAPI.analytics.trackEvent).toHaveBeenCalledWith('tab_file_saved', { kind: 'holding_tank' });
  });

  it('does nothing more when the save dialog is canceled', async () => {
    const { deps, electronAPI } = harness({ files: { saveHotkeyTab: { success: true, data: { canceled: true } } } });
    await expect(saveTabToFile('hotkeys', { tabNumber: 2, label: 'Intros' }, deps)).resolves.toEqual({ status: 'canceled' });
    expect(electronAPI.analytics.trackEvent).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it('shows a failed save in an alert', async () => {
    const { deps, electronAPI } = harness({ files: { saveHoldingTankTab: { success: false, error: 'Disk full' } } });
    await expect(saveTabToFile('holding_tank', { tabNumber: 1, label: 'Tab 1' }, deps)).resolves.toEqual({ status: 'error', error: 'Disk full' });
    expect(deps.alert).toHaveBeenCalledWith('Mx. Voice couldn’t save this tab: Disk full', 'Save Tab to File');
    expect(electronAPI.analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('ignores an unknown kind or a missing tab', async () => {
    const { deps, fileOperations } = harness();
    await expect(saveTabToFile('search', { tabNumber: 1, label: 'X' }, deps)).resolves.toEqual({ status: 'unavailable' });
    await expect(saveTabToFile('hotkeys', { tabNumber: 9, label: 'X' }, deps)).resolves.toEqual({ status: 'unavailable' });
    expect(fileOperations.saveHotkeyTab).not.toHaveBeenCalled();
  });
});

describe('loading a tab from a file', () => {
  it('loads into an empty tab without asking, and tracks the load', async () => {
    const { deps, registry, electronAPI } = harness();
    await expect(loadTabFromFile('hotkeys', { tabNumber: 1, label: 'Tab 1' }, deps)).resolves.toEqual({ status: 'loaded' });
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(registry.hotkeys.populateHotkeys).toHaveBeenCalledWith({ f1: '1005', f2: '' }, 'Drops');
    expect(electronAPI.analytics.trackEvent).toHaveBeenCalledWith('legacy_file_imported', { kind: 'hotkeys' });
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it('asks before replacing a tab that has songs, with Cancel as the default', async () => {
    const { deps, registry } = harness();
    await loadTabFromFile('holding_tank', { tabNumber: 2, label: 'Preshow' }, deps);
    expect(deps.confirm).toHaveBeenCalledWith('Replace the songs in "Preshow"?', 'Load Tab from File', { confirmLabel: 'Replace', defaultAction: 'cancel' });
    expect(registry.holdingTank.populateHoldingTank).toHaveBeenCalledWith(['1001', '1003']);
  });

  it('changes nothing when the replace confirm is canceled', async () => {
    const { deps, registry, electronAPI } = harness();
    deps.confirm.mockResolvedValue(false);
    await expect(loadTabFromFile('hotkeys', { tabNumber: 2, label: 'Intros' }, deps)).resolves.toEqual({ status: 'declined' });
    expect(registry.hotkeys.populateHotkeys).not.toHaveBeenCalled();
    expect(electronAPI.analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('changes nothing when the open dialog is canceled', async () => {
    const { deps, registry } = harness({ files: { loadHoldingTankTab: { success: true, data: { canceled: true } } } });
    await expect(loadTabFromFile('holding_tank', { tabNumber: 2, label: 'Preshow' }, deps)).resolves.toEqual({ status: 'canceled' });
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(registry.holdingTank.populateHoldingTank).not.toHaveBeenCalled();
    expect(deps.toast).not.toHaveBeenCalled();
  });

  it('shows a file that fails validation in an alert and changes nothing', async () => {
    const { deps, registry } = harness({ files: { loadHotkeyTab: { success: false, error: "This isn't a valid hotkey file: Line 1: invalid song ID for f1." } } });
    await expect(loadTabFromFile('hotkeys', { tabNumber: 1, label: 'Tab 1' }, deps)).resolves.toMatchObject({ status: 'error' });
    expect(deps.alert).toHaveBeenCalledWith("This isn't a valid hotkey file: Line 1: invalid song ID for f1.", 'Load Tab from File');
    expect(registry.hotkeys.populateHotkeys).not.toHaveBeenCalled();
  });

  it('waits for the show to be ready, and says so', async () => {
    const { deps, fileOperations } = harness({ status: 'loading' });
    await expect(loadTabFromFile('hotkeys', { tabNumber: 1, label: 'Tab 1' }, deps)).resolves.toEqual({ status: 'not-ready' });
    expect(deps.toast).toHaveBeenCalledWith('Wait for the show to finish loading, then try again.', 6000);
    expect(fileOperations.loadHotkeyTab).not.toHaveBeenCalled();
  });

  it('treats a failed show state check as not ready', async () => {
    const { deps, electronAPI } = harness();
    electronAPI.shows.getState.mockRejectedValue(new Error('gone'));
    await expect(loadTabFromFile('hotkeys', { tabNumber: 1, label: 'Tab 1' }, deps)).resolves.toEqual({ status: 'not-ready' });
  });

  it('says a file with no songs has none, without asking or loading', async () => {
    const { deps, registry } = harness({ files: { loadHotkeyTab: { success: true, data: { hotkeys: { f1: '', f2: '' }, tabName: 'Empty' } } } });
    await expect(loadTabFromFile('hotkeys', { tabNumber: 2, label: 'Intros' }, deps)).resolves.toEqual({ status: 'empty' });
    expect(deps.toast).toHaveBeenCalledWith('This file has no songs to import.', 6000);
    expect(deps.confirm).not.toHaveBeenCalled();
    expect(registry.hotkeys.populateHotkeys).not.toHaveBeenCalled();
  });

  it('reports songs missing from the library', async () => {
    const { deps, registry } = harness();
    registry.holdingTank.populateHoldingTank.mockResolvedValue({ success: true, count: 1, dropped: 1 });
    await loadTabFromFile('holding_tank', { tabNumber: 1, label: 'Tab 1' }, deps);
    expect(deps.toast).toHaveBeenCalledWith("1 song in this file isn't in your library.", 6000);
    registry.hotkeys.populateHotkeys.mockResolvedValue({ dropped: 2 });
    await loadTabFromFile('hotkeys', { tabNumber: 1, label: 'Tab 1' }, deps);
    expect(deps.toast).toHaveBeenLastCalledWith("2 songs in this file aren't in your library.", 6000);
  });

  it('says the file has no songs when none are in the library, and does not track it', async () => {
    const { deps, registry, electronAPI } = harness();
    registry.hotkeys.populateHotkeys.mockResolvedValue({ success: false, error: 'No songs in the library', dropped: 1 });
    await expect(loadTabFromFile('hotkeys', { tabNumber: 1, label: 'Tab 1' }, deps)).resolves.toEqual({ status: 'empty' });
    expect(deps.toast).toHaveBeenCalledWith('This file has no songs to import.', 6000);
    expect(electronAPI.analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('logs a load that throws', async () => {
    const { deps, registry } = harness();
    registry.holdingTank.populateHoldingTank.mockRejectedValue(new Error('boom'));
    await expect(loadTabFromFile('holding_tank', { tabNumber: 1, label: 'Tab 1' }, deps)).resolves.toEqual({ status: 'error', error: 'boom' });
    expect(window.debugLog.error).toHaveBeenCalled();
  });

  it('ignores an unknown kind', async () => {
    const { deps } = harness();
    await expect(loadTabFromFile('search', { tabNumber: 1, label: 'X' }, deps)).resolves.toEqual({ status: 'unavailable' });
  });
});

describe("What's New", () => {
  it('the Tab Actions Moved step mentions saving and loading a tab', async () => {
    const { default: tourData } = await import('../../../src/renderer/modules/whats-new/tours.js');
    const step = Object.values(tourData.tours).flatMap((tour) => tour.steps).find((s) => s.title === 'Tab Actions Moved');
    expect(step.description).toContain('Save Tab to File');
    expect(step.description).toContain('Load Tab from File');
  });
});
