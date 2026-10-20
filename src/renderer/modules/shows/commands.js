/**
 * Show Commands
 *
 * Runs each Shows menu command main posts as `menu:show-command`: asks
 * first where the command needs it, calls the show session, and applies
 * the new layout when the active show changed.
 *
 * Commands run one at a time; one that arrives while another runs is
 * dropped. A command that would show a dialog is also dropped while any
 * Bootstrap dialog is open, since dialogs don't stack. Switch shows nothing
 * and still runs.
 */

import { droppedSongsMessage, LOAD_FAILED_MESSAGE, TOAST_MS } from './messages.js';
import { unwrap } from './ipc-result.js';

const LOG_CONTEXT = { module: 'shows', function: 'runShowCommand' };

const CHANGE_FAILED_MESSAGE = "Mx. Voice couldn't change the show. Your saved shows were not changed.";
// The session refused the command; the menu is rebuilt in main, nothing to tell the user
const REFUSED_ERRORS = new Set(['busy', 'session not ready']);

let running = false;

/** The current show document; throws 'session not ready' before any prompt. */
async function readyDoc({ api }) {
  const state = unwrap(await api.getState(), 'Reading the show session');
  if (state?.status !== 'ready' || !state.doc) throw new Error('session not ready');
  return state.doc;
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

const handlers = {
  async switch(showId, deps) {
    const loaded = unwrap(await deps.api.activate(showId), 'Switching shows');
    return (await openLoaded(loaded, deps)) ? ['show_switched'] : null;
  },

  async update(_showId, deps) {
    const doc = await readyDoc(deps);
    const { name } = findShow(doc, doc.activeShowId);
    const confirmed = await deps.confirm(
      `"${name}" will open with the layout on screen now. Its saved layout will be replaced.`,
      `Update "${name}"?`,
      { confirmLabel: 'Update' }
    );
    if (!confirmed) return null;
    unwrap(await deps.api.updateActive(deps.extractLayout()), 'Updating the show');
    return ['show_updated'];
  },

  async new(_showId, deps) {
    await readyDoc(deps);
    const created = await promptForName(
      deps,
      { message: 'Name for the new show', value: '', title: 'New Show' },
      (name) => deps.api.create(name, deps.extractLayout())
    );
    return created ? ['show_created'] : null;
  },

  async revert(_showId, deps) {
    const doc = await readyDoc(deps);
    const { name } = findShow(doc, doc.activeShowId);
    const confirmed = await deps.confirm(
      `Changes since "${name}" was opened will be discarded.`,
      `Revert to "${name}"?`,
      { confirmLabel: 'Revert' }
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

  async import(_showId, deps) {
    await readyDoc(deps);
    const groups = unwrap(await deps.api.listImportable(), 'Listing shows to import');
    const choice = await deps.chooseImportShow(groups || []);
    if (!choice) return null;
    const loaded = unwrap(await deps.api.importShow(choice.profile, choice.showId), 'Importing the show');
    return (await openLoaded(loaded, deps)) ? ['show_imported'] : null;
  }
};

/**
 * Run one Shows menu command.
 *
 * @param {{ command: string, showId?: string }} command
 * @param {Object} deps
 * @param {Object} deps.api - secureElectronAPI.shows
 * @param {Function} deps.confirm - customConfirm
 * @param {Function} deps.prompt - customPrompt; resolves null on cancel
 * @param {Function} deps.alert
 * @param {Function} deps.toast
 * @param {(name: string, props?: Object) => void} deps.track - analytics; never given names
 * @param {() => boolean} deps.isModalOpen
 * @param {() => Object} deps.extractLayout - the layout on screen
 * @param {(groups: Array) => Promise<{ profile: string, showId: string }|null>} deps.chooseImportShow
 * @param {(layout: Object) => Promise<{ dropped: number }>} deps.applyLayout
 * @returns {Promise<void>}
 */
export async function runShowCommand({ command, showId } = {}, deps) {
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
    const event = await handler(showId, deps);
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
