/**
 * Show Commands
 *
 * Runs each Shows menu command main posts as `menu:show-command`: asks
 * first where the command needs it, calls the show session, and applies
 * the new layout when the active show changed.
 *
 * Commands run one at a time; one that arrives while another runs is
 * dropped. A command that would show a dialog is also dropped while any
 * Bootstrap dialog is open, since dialogs don't stack. Switch is a dialog only
 * when the show on screen has unsaved changes; otherwise it shows nothing and
 * still runs.
 */

import { droppedSongsMessage, LOAD_FAILED_MESSAGE, TOAST_MS } from './messages.js';
import { unwrap } from './ipc-result.js';

const LOG_CONTEXT = { module: 'shows', function: 'runShowCommand' };

const CHANGE_FAILED_MESSAGE = "Mx. Voice couldn't change the show. Your saved shows were not changed.";
// The session refused the command; the menu is rebuilt in main, nothing to tell the user
const REFUSED_ERRORS = new Set(['busy', 'session not ready']);

let running = false;

/** The current show document; throws 'session not ready' before any prompt. */
async function readyState({ api }) {
  const state = unwrap(await api.getState(), 'Reading the show session');
  if (state?.status !== 'ready' || !state.doc) throw new Error('session not ready');
  return state;
}

async function readyDoc(deps) {
  return (await readyState(deps)).doc;
}

function findShow(doc, showId) {
  const show = doc.shows.find((b) => b.id === showId);
  if (!show) throw new Error('Show not found.');
  return show;
}

/**
 * The show that becomes active when `showId` is deleted, by the rule
 * show-document's deleteShow uses: the next in creation order, or the
 * previous one for the last. Null when it is the only show.
 */
export function nextShowAfterDelete(doc, showId) {
  if (doc.shows.length <= 1) return null;
  const index = doc.shows.findIndex((b) => b.id === showId);
  const rest = doc.shows.filter((b) => b.id !== showId);
  return rest[Math.min(index, rest.length - 1)];
}

/**
 * Apply a layout the session handed back and report it. A layout that
 * can't be applied is reported failed, as at startup.
 * @returns {Promise<boolean>} whether the show is now ready
 */
async function openLoaded({ layout, generation }, deps) {
  const { api } = deps;
  try {
    const { dropped, droppedIds = [] } = await deps.applyLayout(layout);
    unwrap(await api.reportReady(generation, true, { droppedIds }), 'Reporting the show ready');
    const message = droppedSongsMessage(dropped);
    if (message) deps.toast(message, TOAST_MS);
    return true;
  } catch (error) {
    window.debugLog?.error('Could not load the show', { ...LOG_CONTEXT, error: error.message });
    try {
      await api.reportReady(generation, false);
    } catch (reportError) {
      window.debugLog?.warn('Could not report the show as failed', { ...LOG_CONTEXT, error: reportError.message });
    }
    deps.alert(LOAD_FAILED_MESSAGE, 'Show not loaded');
    return false;
  }
}

/**
 * Ask for a name until `save(name)` accepts it or the user cancels. A name
 * error re-asks with its message, keeping what was typed.
 * @returns {Promise<boolean>} whether a name was saved
 */
async function promptForName(deps, { message, value, title }, save) {
  for (;;) {
    const name = await deps.prompt(message, value, title);
    if (name === null || name === undefined) return false;
    const result = await save(name);
    if (result?.success) return true;
    // A name the user can correct re-asks instead of alerting
    if (result?.code !== 'invalid-name') unwrap(result, 'Saving the show name');
    message = result.error;
    value = name;
  }
}

/** Write the layout on screen into the active show. */
async function saveActive(deps) {
  unwrap(await deps.api.updateActive(deps.extractLayout()), 'Saving the show');
}

/**
 * Whether the layout on screen differs from the saved show. The pending
 * recovery save is flushed first, since the session judges what it has been sent.
 * A flush that failed counts as unsaved changes: the session never saw the
 * latest layout, so it can't say the screen matches the saved show.
 */
async function hasUnsavedChanges(deps) {
  let flushFailed = false;
  try {
    const result = await deps.flushRecovery?.();
    // A save skipped by the restoration lock is not a failure
    flushFailed = result?.success === false && !result.skipped;
    if (flushFailed) window.debugLog?.warn('Could not flush the recovery save', { ...LOG_CONTEXT, error: result.error });
  } catch (error) {
    flushFailed = true;
    window.debugLog?.warn('Could not flush the recovery save', { ...LOG_CONTEXT, error: error.message });
  }
  const state = unwrap(await deps.api.getState(), 'Reading the show session');
  if (state?.status !== 'ready' || !state.doc) return null;
  return state.dirty === true || flushFailed ? state : null;
}

/**
 * Before the layout on screen is replaced: when it has unsaved changes, ask
 * to save them. Save writes the show first (a failure throws, so nothing is
 * replaced); Cancel and a dismissed prompt both stop.
 * @returns {Promise<{ proceed: boolean, saved?: string }>} whether to go on,
 *   and the name of the show Save wrote
 */
async function settleUnsavedChanges(trigger, deps, state = null) {
  const unsaved = state || await hasUnsavedChanges(deps);
  if (!unsaved) return { proceed: true };
  const { name } = findShow(unsaved.doc, unsaved.doc.activeShowId);
  const choice = await deps.choose(
    `Save changes to "${name}"?`,
    'Unsaved changes',
    [
      { value: 'discard', label: "Don't Save", variant: 'secondary' },
      { value: 'cancel', label: 'Cancel', variant: 'outline' },
      { value: 'save', label: 'Save', variant: 'primary' }
    ],
    { defaultValue: 'cancel' }
  );
  const answer = choice === 'save' || choice === 'discard' ? choice : 'cancel';
  deps.track('show_save_prompt', { choice: answer, trigger });
  if (answer === 'cancel') return { proceed: false };
  if (answer === 'save') {
    await saveActive(deps);
    return { proceed: true, saved: name };
  }
  return { proceed: true };
}

const handlers = {
  async switch(showId, deps) {
    // Dialogs don't stack: a switch that would ask is dropped behind another dialog
    const unsaved = await hasUnsavedChanges(deps);
    if (unsaved && deps.isModalOpen()) {
      window.debugLog?.info('Show command dropped: a dialog is open', { ...LOG_CONTEXT, command: 'switch' });
      return null;
    }
    const { proceed, saved } = await settleUnsavedChanges('switch', deps, unsaved);
    if (!proceed) return null;
    let loaded;
    try {
      loaded = unwrap(await deps.api.activate(showId), 'Switching shows');
    } catch (error) {
      if (saved === undefined) throw error;
      // The prompt's Save went through, so "not changed" would be wrong
      window.debugLog?.error('Show command failed after saving', { ...LOG_CONTEXT, command: 'switch', error: error.message });
      deps.alert(`Your changes to "${saved}" were saved, but Mx. Voice couldn't open the other show.`, 'Show not opened');
      return null;
    }
    return (await openLoaded(loaded, deps)) ? ['show_switched'] : null;
  },

  async save(_showId, deps) {
    const doc = await readyDoc(deps);
    const { name } = findShow(doc, doc.activeShowId);
    const confirmed = await deps.confirm(
      `"${name}" will open with the layout on screen now. Its saved layout will be replaced.`,
      `Save "${name}"?`,
      { confirmLabel: 'Save' }
    );
    if (!confirmed) return null;
    await saveActive(deps);
    return ['show_saved'];
  },

  async 'save-as'(_showId, deps) {
    await readyDoc(deps);
    const created = await promptForName(
      deps,
      { message: 'Name for the new show', value: '', title: 'Save As' },
      (name) => deps.api.create(name, deps.extractLayout())
    );
    return created ? ['show_saved_as'] : null;
  },

  async revert(_showId, deps) {
    const { doc, dirty } = await readyState(deps);
    // Nothing to discard; the menu item is disabled then, this is a backstop
    if (!dirty) return null;
    const { name } = findShow(doc, doc.activeShowId);
    const confirmed = await deps.confirm(
      `Changes since "${name}" was last saved will be discarded.`,
      'Revert to Saved?',
      { confirmLabel: 'Revert', defaultAction: 'cancel' }
    );
    if (!confirmed) return null;
    const loaded = unwrap(await deps.api.revert(), 'Reverting the show');
    return (await openLoaded(loaded, deps)) ? ['show_reverted'] : null;
  },

  // Rename and Delete act on the show on screen, whatever id came with the command
  async rename(_showId, deps) {
    const doc = await readyDoc(deps);
    const { id, name } = findShow(doc, doc.activeShowId);
    const renamed = await promptForName(
      deps,
      { message: 'New name', value: name, title: 'Rename Show' },
      (newName) => deps.api.rename(id, newName)
    );
    return renamed ? ['show_renamed'] : null;
  },

  async delete(_showId, deps) {
    const doc = await readyDoc(deps);
    const { id, name } = findShow(doc, doc.activeShowId);
    const next = nextShowAfterDelete(doc, id);
    const message = next
      ? `The layout on screen will be replaced with "${next.name}".`
      : 'The layout on screen will be replaced with an empty show.';
    const confirmed = await deps.confirm(message, `Delete "${name}"?`, {
      confirmLabel: 'Delete',
      defaultAction: 'cancel'
    });
    if (!confirmed) return null;
    const removed = unwrap(await deps.api.remove(id), 'Deleting the show');
    // The show is deleted even if the next one then fails to load
    if (removed?.activeChanged) await openLoaded(removed, deps);
    return ['show_deleted'];
  },

  // Shows → Color: a show property, like the name, saved at once without asking
  async 'set-color'(_showId, deps, { color = null } = {}) {
    const doc = await readyDoc(deps);
    unwrap(await deps.api.setColor(doc.activeShowId, color), 'Setting the show color');
    return ['show_color_set', { color: color ?? 'none' }];
  },

  // Shows → Reset Played: the counts are only a reminder, so nothing asks first
  async 'reset-played'(_showId, deps) {
    deps.playedCounts.clearAll();
    return ['played_reset'];
  },

  async import(_showId, deps) {
    await readyDoc(deps);
    const groups = unwrap(await deps.api.listImportable(), 'Listing shows to import');
    // An empty list still opens the dialog, which says there is nothing to import
    const choice = await deps.chooseImportShow(groups || []);
    if (!choice) return null;
    // Asked only once there is a show to import, and before it replaces the screen
    if (!(await settleUnsavedChanges('import', deps)).proceed) return null;
    const loaded = unwrap(await deps.api.importShow(choice.profile, choice.showId), 'Importing the show');
    return (await openLoaded(loaded, deps)) ? ['show_imported'] : null;
  }
};

/**
 * Run one Shows menu command.
 *
 * @param {{ command: string, showId?: string, color?: string|null }} command
 * @param {Object} deps
 * @param {Object} deps.api - secureElectronAPI.shows
 * @param {Function} deps.confirm - customConfirm
 * @param {Function} deps.choose - customChoice
 * @param {() => Promise<*>} [deps.flushRecovery] - flushProfileState; makes `dirty` current
 * @param {Function} deps.prompt - customPrompt; resolves null on cancel
 * @param {Function} deps.alert
 * @param {Function} deps.toast
 * @param {(name: string, props?: Object) => void} deps.track - analytics; never given names
 * @param {() => boolean} deps.isModalOpen
 * @param {() => Object} deps.extractLayout - the layout on screen
 * @param {(groups: Array) => Promise<{ profile: string, showId: string }|null>} deps.chooseImportShow
 * @param {(layout: Object) => Promise<{ dropped: number }>} deps.applyLayout
 * @param {{ clearAll: Function }} deps.playedCounts - played-counts.js
 * @returns {Promise<void>}
 */
export async function runShowCommand({ command, showId, ...details } = {}, deps) {
  const handler = Object.hasOwn(handlers, command) ? handlers[command] : null;
  if (!handler) {
    window.debugLog?.warn('Unknown show command', { ...LOG_CONTEXT, command });
    return;
  }
  if (running) {
    window.debugLog?.info('Show command dropped: another is running', { ...LOG_CONTEXT, command });
    return;
  }
  if (command !== 'switch' && deps.isModalOpen()) {
    window.debugLog?.info('Show command dropped: a dialog is open', { ...LOG_CONTEXT, command });
    return;
  }

  running = true;
  try {
    const event = await handler(showId, deps, details);
    if (event) deps.track(event[0], event[1]);
  } catch (error) {
    if (REFUSED_ERRORS.has(error.message)) {
      window.debugLog?.info('Show command refused by the session', { ...LOG_CONTEXT, command, error: error.message });
    } else {
      window.debugLog?.error('Show command failed', { ...LOG_CONTEXT, command, error: error.message });
      deps.alert(CHANGE_FAILED_MESSAGE, 'Show not changed');
    }
  } finally {
    running = false;
  }
}

export default { runShowCommand, nextShowAfterDelete };
