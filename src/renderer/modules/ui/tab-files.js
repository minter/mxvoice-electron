/**
 * Tab files
 *
 * Save Tab to File… and Load Tab from File… in the tab actions menu. A hotkey
 * tab is a .mrv file and a holding tank tab a .hld file, in the formats older
 * versions read and write. Main shows the dialogs, writes, reads and validates;
 * loading goes through the panels' own populate functions.
 */

import { customAlert, customConfirm } from '../utils/modal-utils.js';
import { showDropToast } from '../utils/toast-utils.js';
import { TOAST_MS, droppedSongsFileMessage, IMPORT_NOT_READY_MESSAGE, NO_SONGS_MESSAGE } from '../shows/messages.js';

const LOG_CONTEXT = { module: 'tab-files' };
const SAVE_TITLE = 'Save Tab to File';
const LOAD_TITLE = 'Load Tab from File';

/** Per panel: the tab from the model, and how its files are saved, loaded and populated */
export const TAB_FILE_KINDS = {
  hotkeys: {
    tab: (registry, tabNumber) => registry?.hotkeys?.getHotkeySnapshot?.()?.find((tab) => tab.tabNumber === tabNumber),
    hasSongs: (tab) => Object.values(tab?.hotkeys || {}).some(Boolean),
    save: (api, tab, label) => api?.fileOperations?.saveHotkeyTab?.(
      { tabNumber: tab.tabNumber, tabName: tab.tabName ?? null, hotkeys: { ...tab.hotkeys } },
      label
    ),
    load: (api) => api?.fileOperations?.loadHotkeyTab?.(),
    fileHasSongs: (data) => Object.values(data?.hotkeys || {}).some(Boolean),
    populate: (registry, data) => registry?.hotkeys?.populateHotkeys?.(data.hotkeys, data.tabName)
  },
  holding_tank: {
    tab: (registry, tabNumber) => registry?.holdingTank?.getHoldingTankSnapshot?.()?.find((tab) => tab.tabNumber === tabNumber),
    hasSongs: (tab) => (tab?.songIds?.length || 0) > 0,
    save: (api, tab, label) => api?.fileOperations?.saveHoldingTankTab?.([...(tab.songIds || [])], label),
    load: (api) => api?.fileOperations?.loadHoldingTankTab?.(),
    fileHasSongs: (data) => (data?.songIds?.length || 0) > 0,
    populate: (registry, data) => registry?.holdingTank?.populateHoldingTank?.(data.songIds)
  }
};

/**
 * Arguments for customConfirm before a file replaces a tab's songs.
 * @param {string} label - from tabLabel
 */
export function replaceTabConfirmArgs(label) {
  return [
    `Replace the songs in "${label}"?`,
    LOAD_TITLE,
    { confirmLabel: 'Replace', defaultAction: 'cancel' }
  ];
}

function resolveDeps(deps) {
  return {
    registry: deps.registry || window.moduleRegistry || {},
    electronAPI: deps.electronAPI || window.secureElectronAPI,
    confirm: deps.confirm || customConfirm,
    alert: deps.alert || customAlert,
    toast: deps.toast || showDropToast
  };
}

function track(electronAPI, event, kind) {
  try {
    electronAPI?.analytics?.trackEvent?.(event, { kind });
  } catch (_error) {
    // Analytics never block a save or a load
  }
}

// A file only loads into a show that has finished loading
async function showIsReady(electronAPI) {
  try {
    const state = await electronAPI?.shows?.getState?.();
    return state?.success === true && state.data?.status === 'ready';
  } catch (_error) {
    return false;
  }
}

/**
 * Save a tab to a file the user picks.
 * @param {'hotkeys'|'holding_tank'} kind
 * @param {{ tabNumber: number, label: string }} target - the selected tab and its label
 * @param {Object} [deps] - registry, electronAPI, alert (defaults: the app's)
 * @returns {Promise<{ status: 'saved', path: string } | { status: 'canceled'|'unavailable' } | { status: 'error', error: string }>}
 */
export async function saveTabToFile(kind, { tabNumber, label } = {}, deps = {}) {
  const panel = TAB_FILE_KINDS[kind];
  const { registry, electronAPI, alert } = resolveDeps(deps);
  const tab = panel?.tab(registry, tabNumber);
  if (!panel || !tab) return { status: 'unavailable' };

  try {
    const result = await panel.save(electronAPI, tab, label);
    if (!result?.success) {
      const error = result?.error || 'Unknown error';
      await alert(`Mx. Voice couldn’t save this tab: ${error}`, SAVE_TITLE);
      return { status: 'error', error };
    }
    if (result.data?.canceled) return { status: 'canceled' };
    track(electronAPI, 'tab_file_saved', kind);
    window.debugLog?.info('Tab saved to file', { ...LOG_CONTEXT, function: 'saveTabToFile', kind, tabNumber });
    return { status: 'saved', path: result.data?.path };
  } catch (error) {
    window.debugLog?.error('Tab save failed', { ...LOG_CONTEXT, function: 'saveTabToFile', kind, error: error?.message });
    return { status: 'error', error: error?.message };
  }
}

/**
 * Load a file the user picks into the selected tab. A tab that has songs asks
 * before they are replaced; an empty tab loads without asking.
 * @param {'hotkeys'|'holding_tank'} kind
 * @param {{ tabNumber: number, label: string }} target - the selected tab and its label
 * @param {Object} [deps] - registry, electronAPI, confirm, alert, toast (defaults: the app's)
 * @returns {Promise<{ status: 'loaded'|'canceled'|'declined'|'empty'|'not-ready'|'unavailable' } | { status: 'error', error: string }>}
 */
export async function loadTabFromFile(kind, { tabNumber, label } = {}, deps = {}) {
  const panel = TAB_FILE_KINDS[kind];
  if (!panel) return { status: 'unavailable' };
  const { registry, electronAPI, confirm, alert, toast } = resolveDeps(deps);

  if (!(await showIsReady(electronAPI))) {
    toast(IMPORT_NOT_READY_MESSAGE, TOAST_MS);
    return { status: 'not-ready' };
  }

  try {
    const result = await panel.load(electronAPI);
    if (!result?.success) {
      const error = result?.error || 'Unknown error';
      await alert(error, LOAD_TITLE);
      return { status: 'error', error };
    }
    if (result.data?.canceled) return { status: 'canceled' };
    if (!panel.fileHasSongs(result.data)) {
      toast(NO_SONGS_MESSAGE, TOAST_MS);
      return { status: 'empty' };
    }

    if (panel.hasSongs(panel.tab(registry, tabNumber)) && !(await confirm(...replaceTabConfirmArgs(label)))) {
      return { status: 'declined' };
    }

    const outcome = await panel.populate(registry, result.data);
    if (outcome?.success === false) {
      toast(NO_SONGS_MESSAGE, TOAST_MS);
      return { status: 'empty' };
    }
    const message = droppedSongsFileMessage(outcome?.dropped);
    if (message) toast(message, TOAST_MS);
    track(electronAPI, 'legacy_file_imported', kind);
    return { status: 'loaded' };
  } catch (error) {
    window.debugLog?.error('Tab load failed', { ...LOG_CONTEXT, function: 'loadTabFromFile', kind, error: error?.message });
    return { status: 'error', error: error?.message };
  }
}
