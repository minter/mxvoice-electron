/**
 * Boards Module
 *
 * Opens the profile's active saved board when the page starts, asking about
 * a show in progress first if the app didn't close normally. Live edits go
 * to the crash-recovery record through profile-state; nothing here saves a
 * board.
 */

import { applyLayout } from './layout-applier.js';
import sharedState from '../shared-state.js';
import { customAlert, customConfirm } from '../utils/modal-utils.js';
import { showDropToast } from '../utils/toast-utils.js';
import { clearProfileRestorationLock } from '../profile-state/index.js';

const LOG_CONTEXT = { module: 'boards', function: 'openSessionOnStartup' };
const TOAST_MS = 6000;

const UNREADABLE_MESSAGE =
  "Mx. Voice couldn't read this profile's boards. The file has been kept so it can be recovered.";
const LOAD_FAILED_MESSAGE = "Mx. Voice couldn't load this board. Your saved boards were not changed.";

/** "N song(s) in this board aren't in the library.", or null for none. */
export function droppedSongsMessage(dropped) {
  if (!dropped) return null;
  return dropped === 1
    ? "1 song in this board isn't in the library."
    : `${dropped} songs in this board aren't in the library.`;
}

function crashMessage(savedAt) {
  const time = new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Mx. Voice didn't close normally. Restore the show in progress from ${time}?`;
}

function unwrap(result, step) {
  if (!result?.success) throw new Error(result?.error || `${step} failed`);
  return result.data;
}

/**
 * The layout applier wired to the live collection modules.
 * @param {{ hotkeys: Object, holdingTank: Object }} modules
 */
export function buildLayoutDeps({ hotkeys, holdingTank }) {
  return {
    hotkeys,
    holdingTank,
    getSongsByIds: (ids) => window.secureElectronAPI.database.getSongsByIds(ids),
    sharedState
  };
}

function defaultDeps(overrides) {
  const deps = {
    api: window.secureElectronAPI?.boards,
    confirm: customConfirm,
    alert: (message, title) => { void customAlert(message, title); },
    toast: showDropToast,
    quit: () => window.secureElectronAPI?.app?.quit?.(),
    clearRestorationLock: clearProfileRestorationLock,
    ...overrides
  };
  if (!deps.applyLayout) {
    const layoutDeps = buildLayoutDeps(overrides);
    deps.applyLayout = (layout) => applyLayout(layout, layoutDeps);
  }
  return deps;
}

/**
 * Open the current profile's active board.
 *
 * Holds the restoration lock until the board has been reported, ready or not.
 * On failure the startup (empty) layout is left as it is and never reported
 * as the board.
 *
 * @param {Object} [overrides] - hotkeys and holdingTank modules, or test doubles
 *   for api, confirm, alert, toast, quit, applyLayout and clearRestorationLock
 * @returns {Promise<{ status: 'ready'|'failed' }>}
 */
export async function openSessionOnStartup(overrides = {}) {
  const deps = defaultDeps(overrides);
  const { api } = deps;
  window.isRestoringProfileState = true;
  let generation = null;
  try {
    const opened = unwrap(await api.open(), 'Opening the board');
    generation = opened.generation;
    let layout;

    if (opened.failed) {
      throw new Error(`The board could not be opened (${opened.error})`);
    } else if (opened.unreadable) {
      const startEmpty = await deps.confirm(UNREADABLE_MESSAGE, 'Boards unreadable', {
        confirmLabel: 'Start with an empty board',
        cancelLabel: 'Quit'
      });
      if (!startEmpty) {
        window.debugLog?.info('Quitting: boards unreadable', LOG_CONTEXT);
        await deps.quit();
        return { status: 'failed' };
      }
      const empty = unwrap(await api.startEmpty(), 'Starting an empty board');
      generation = empty.generation;
      layout = empty.layout;
    } else {
      let choice = 'discard';
      if (opened.recovery?.handoff) {
        choice = 'restore';
      } else if (opened.recovery) {
        const restore = await deps.confirm(crashMessage(opened.recovery.savedAt), 'Restore show?', {
          confirmLabel: 'Restore show in progress',
          cancelLabel: 'Open saved board',
          defaultAction: 'cancel'
        });
        choice = restore ? 'restore' : 'discard';
      }
      layout = unwrap(await api.resolveRecovery(choice), 'Resolving recovery').layout;
      window.debugLog?.info('Opening board', { ...LOG_CONTEXT, choice, handoff: opened.recovery?.handoff ?? null });
    }

    const { dropped } = await deps.applyLayout(layout);
    unwrap(await api.reportReady(generation, true), 'Reporting the board ready');

    const message = [opened.notice, droppedSongsMessage(dropped)].filter(Boolean).join(' ');
    if (message) deps.toast(message, TOAST_MS);
    return { status: 'ready' };
  } catch (error) {
    window.debugLog?.error('Could not open the board', { ...LOG_CONTEXT, error: error.message });
    if (generation !== null) {
      try {
        await api.reportReady(generation, false);
      } catch (reportError) {
        window.debugLog?.warn('Could not report the board as failed', { ...LOG_CONTEXT, error: reportError.message });
      }
    }
    deps.alert(LOAD_FAILED_MESSAGE, 'Board not loaded');
    return { status: 'failed' };
  } finally {
    deps.clearRestorationLock();
  }
}

export default {
  openSessionOnStartup,
  buildLayoutDeps,
  droppedSongsMessage
};
