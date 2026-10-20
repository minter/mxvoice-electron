/**
 * Shows Module
 *
 * Opens the profile's active saved show when the page starts, asking about
 * a show in progress first if the app didn't close normally, then runs the
 * Shows menu commands (commands.js). Live edits go to the crash-recovery
 * record through profile-state; only a Shows menu command saves a show.
 */

import { applyLayout } from './layout-applier.js';
import sharedState from '../shared-state.js';
import { customAlert, customConfirm, customPrompt } from '../utils/modal-utils.js';
import { showDropToast } from '../utils/toast-utils.js';
import { isAnyModalOpen } from '../ui/bootstrap-helpers.js';
import { clearProfileRestorationLock, extractLayout } from '../profile-state/index.js';
import { droppedSongsMessage, LOAD_FAILED_MESSAGE, TOAST_MS } from './messages.js';
import { unwrap } from './ipc-result.js';
import { runShowCommand } from './commands.js';
import { chooseImportShow } from './import-dialog.js';
import { installHeaderListeners, refreshHeader } from './header.js';

export { droppedSongsMessage };

const LOG_CONTEXT = { module: 'shows', function: 'openSessionOnStartup' };

const UNREADABLE_MESSAGE =
  "Mx. Voice couldn't read this profile's shows. The file has been kept so it can be recovered.";

function crashMessage(savedAt) {
  const time = new Date(savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `Mx. Voice didn't close normally. Restore the show in progress from ${time}?`;
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

// Analytics never receive show or profile names
function trackEvent(name, props) {
  try {
    window.secureElectronAPI?.analytics?.trackEvent?.(name, props);
  } catch (error) {
    window.debugLog?.warn('Could not send a show analytics event', { module: 'shows', function: 'trackEvent', error: error.message });
  }
}

function defaultDeps(overrides) {
  const deps = {
    api: window.secureElectronAPI?.shows,
    confirm: customConfirm,
    prompt: customPrompt,
    alert: (message, title) => { void customAlert(message, title); },
    toast: showDropToast,
    track: trackEvent,
    quit: () => window.secureElectronAPI?.app?.quit?.(),
    clearRestorationLock: clearProfileRestorationLock,
    isModalOpen: () => isAnyModalOpen(),
    extractLayout,
    chooseImportShow: (groups) => chooseImportShow(groups),
    refreshHeader: () => refreshHeader(),
    ...overrides
  };
  if (!deps.applyLayout) {
    const layoutDeps = buildLayoutDeps(overrides);
    deps.applyLayout = (layout) => applyLayout(layout, layoutDeps);
  }
  return deps;
}

/**
 * Settle a show in progress: a fresh handoff restores silently, any other
 * record asks, and no record opens the saved show.
 * @returns {Promise<Object>} the layout to apply
 */
async function resolveRecovery(recovery, deps) {
  let choice = 'discard';
  if (recovery?.handoff) {
    choice = 'restore';
  } else if (recovery) {
    deps.track('crash_restore_offered');
    const restore = await deps.confirm(crashMessage(recovery.savedAt), 'Restore show?', {
      confirmLabel: 'Restore show in progress',
      cancelLabel: 'Open saved show',
      defaultAction: 'cancel'
    });
    choice = restore ? 'restore' : 'discard';
    deps.track('crash_restore_chosen', { choice });
  }
  const { layout } = unwrap(await deps.api.resolveRecovery(choice), 'Resolving recovery');
  window.debugLog?.info('Opening show', { ...LOG_CONTEXT, choice, handoff: recovery?.handoff ?? null });
  return layout;
}

/**
 * Open the current profile's active show.
 *
 * Holds the restoration lock until the show has been reported, ready or not.
 * On failure the startup (empty) layout is left as it is and never reported
 * as the show.
 *
 * @param {Object} [overrides] - hotkeys and holdingTank modules, or test doubles
 *   for api, confirm, alert, toast, quit, applyLayout and clearRestorationLock
 * @returns {Promise<{ status: 'ready'|'failed' }>}
 */
export async function openSessionOnStartup(overrides = {}) {
  const deps = defaultDeps(overrides);
  const { api } = deps;
  installHeaderListeners();
  window.isRestoringProfileState = true;
  let generation = null;
  try {
    const opened = unwrap(await api.open(), 'Opening the show');
    generation = opened.generation;
    let layout;

    if (opened.failed) {
      throw new Error(`The show could not be opened (${opened.error})`);
    } else if (opened.unreadable) {
      const startEmpty = await deps.confirm(UNREADABLE_MESSAGE, 'Shows unreadable', {
        confirmLabel: 'Start with an empty show',
        cancelLabel: 'Quit'
      });
      if (!startEmpty) {
        window.debugLog?.info('Quitting: shows unreadable', LOG_CONTEXT);
        await deps.quit();
        return { status: 'failed' };
      }
      const empty = unwrap(await api.startEmpty(), 'Starting an empty show');
      generation = empty.generation;
      layout = empty.recovery ? await resolveRecovery(empty.recovery, deps) : empty.layout;
    } else {
      layout = await resolveRecovery(opened.recovery, deps);
    }

    const { dropped, droppedIds = [] } = await deps.applyLayout(layout);
    unwrap(await api.reportReady(generation, true, { droppedIds }), 'Reporting the show ready');

    const message = [opened.notice, droppedSongsMessage(dropped)].filter(Boolean).join(' ');
    if (message) deps.toast(message, TOAST_MS);
    return { status: 'ready' };
  } catch (error) {
    window.debugLog?.error('Could not open the show', { ...LOG_CONTEXT, error: error.message });
    if (generation !== null) {
      try {
        await api.reportReady(generation, false);
      } catch (reportError) {
        window.debugLog?.warn('Could not report the show as failed', { ...LOG_CONTEXT, error: reportError.message });
      }
    }
    deps.alert(LOAD_FAILED_MESSAGE, 'Show not loaded');
    return { status: 'failed' };
  } finally {
    deps.clearRestorationLock();
    await deps.refreshHeader();
  }
}

/**
 * Run each Shows menu command (`menu:show-command`) from now on. Call once,
 * after openSessionOnStartup.
 *
 * @param {Object} [overrides] - hotkeys and holdingTank modules, or test doubles
 *   for onShowCommand and any runShowCommand dependency
 * @returns {Function|null} unsubscribe, or null without the preload event
 */
export function initializeShowCommands(overrides = {}) {
  const { onShowCommand = window.secureElectronAPI?.events?.onShowCommand, ...rest } = overrides;
  if (typeof onShowCommand !== 'function') {
    window.debugLog?.error('Shows menu commands unavailable', { module: 'shows', function: 'initializeShowCommands' });
    return null;
  }
  const deps = defaultDeps(rest);
  return onShowCommand((command) => { void runShowCommand(command, deps).finally(() => deps.refreshHeader()); });
}

export default {
  openSessionOnStartup,
  initializeShowCommands,
  buildLayoutDeps,
  droppedSongsMessage
};
