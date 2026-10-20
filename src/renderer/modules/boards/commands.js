/**
 * Board Commands
 *
 * Runs each Board menu command main posts as `menu:board-command`: asks
 * first where the command needs it, calls the board session, and applies
 * the new layout when the active board changed.
 *
 * Commands run one at a time; one that arrives while another runs is
 * dropped. A command that would show a dialog is also dropped while any
 * Bootstrap dialog is open, since dialogs don't stack. Switch shows nothing
 * and still runs.
 */

import { droppedSongsMessage, TOAST_MS } from './messages.js';

const LOG_CONTEXT = { module: 'boards', function: 'runBoardCommand' };

const CHANGE_FAILED_MESSAGE = "Mx. Voice couldn't change the board. Your saved boards were not changed.";
const LOAD_FAILED_MESSAGE = "Mx. Voice couldn't load this board.";

// The board-document name checks; these re-prompt instead of alerting
const NAME_ERRORS = new Set([
  'Enter a name for the board.',
  'Board names can be at most 50 characters.',
  'A board with this name already exists.'
]);
// The session refused the command; the menu is rebuilt in main, nothing to tell the user
const REFUSED_ERRORS = new Set(['busy', 'session not ready']);

let running = false;

function unwrap(result, step) {
  if (!result?.success) throw new Error(result?.error || `${step} failed`);
  return result.data;
}

/** The current board document; throws 'session not ready' before any prompt. */
async function readyDoc({ api }) {
  const state = unwrap(await api.getState(), 'Reading the board session');
  if (state?.status !== 'ready' || !state.doc) throw new Error('session not ready');
  return state.doc;
}

function findBoard(doc, boardId) {
  const board = doc.boards.find((b) => b.id === boardId);
  if (!board) throw new Error('Board not found.');
  return board;
}

/**
 * The board that becomes active when `boardId` is deleted, by the rule
 * board-document's deleteBoard uses: the next in creation order, or the
 * previous one for the last. Null when it is the only board.
 */
export function nextBoardAfterDelete(doc, boardId) {
  if (doc.boards.length <= 1) return null;
  const index = doc.boards.findIndex((b) => b.id === boardId);
  const rest = doc.boards.filter((b) => b.id !== boardId);
  return rest[Math.min(index, rest.length - 1)];
}

/**
 * Apply a layout the session handed back and report it. A layout that
 * can't be applied is reported failed, as at startup.
 * @returns {Promise<boolean>} whether the board is now ready
 */
async function openLoaded({ layout, generation }, deps) {
  const { api } = deps;
  try {
    const { dropped, droppedIds = [] } = await deps.applyLayout(layout);
    unwrap(await api.reportReady(generation, true, { droppedIds }), 'Reporting the board ready');
    const message = droppedSongsMessage(dropped);
    if (message) deps.toast(message, TOAST_MS);
    return true;
  } catch (error) {
    window.debugLog?.error('Could not load the board', { ...LOG_CONTEXT, error: error.message });
    try {
      await api.reportReady(generation, false);
    } catch (reportError) {
      window.debugLog?.warn('Could not report the board as failed', { ...LOG_CONTEXT, error: reportError.message });
    }
    deps.alert(LOAD_FAILED_MESSAGE, 'Board not loaded');
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
    if (!NAME_ERRORS.has(result?.error)) unwrap(result, 'Saving the board name');
    message = result.error;
    value = name;
  }
}

const handlers = {
  async switch(boardId, deps) {
    const loaded = unwrap(await deps.api.activate(boardId), 'Switching boards');
    return (await openLoaded(loaded, deps)) ? ['board_switched'] : null;
  },

  async update(_boardId, deps) {
    const doc = await readyDoc(deps);
    const { name } = findBoard(doc, doc.activeBoardId);
    const confirmed = await deps.confirm(
      `"${name}" will open with the layout on screen now. Its saved layout will be replaced.`,
      `Update "${name}"?`,
      { confirmLabel: 'Update' }
    );
    if (!confirmed) return null;
    unwrap(await deps.api.updateActive(deps.extractLayout()), 'Updating the board');
    return ['board_updated'];
  },

  async new(_boardId, deps) {
    await readyDoc(deps);
    const created = await promptForName(
      deps,
      { message: 'Name for the new board', value: '', title: 'New Board' },
      (name) => deps.api.create(name, deps.extractLayout())
    );
    return created ? ['board_created'] : null;
  },

  async revert(_boardId, deps) {
    const doc = await readyDoc(deps);
    const { name } = findBoard(doc, doc.activeBoardId);
    const confirmed = await deps.confirm(
      `Changes since "${name}" was opened will be discarded.`,
      `Revert to "${name}"?`,
      { confirmLabel: 'Revert' }
    );
    if (!confirmed) return null;
    const loaded = unwrap(await deps.api.revert(), 'Reverting the board');
    return (await openLoaded(loaded, deps)) ? ['board_reverted'] : null;
  },

  async rename(boardId, deps) {
    const doc = await readyDoc(deps);
    const { name } = findBoard(doc, boardId);
    const renamed = await promptForName(
      deps,
      { message: 'New name', value: name, title: 'Rename Board' },
      (newName) => deps.api.rename(boardId, newName)
    );
    return renamed ? ['board_renamed'] : null;
  },

  async delete(boardId, deps) {
    const doc = await readyDoc(deps);
    const { name } = findBoard(doc, boardId);
    const wasActive = boardId === doc.activeBoardId;
    let message = "This can't be undone.";
    if (wasActive) {
      const next = nextBoardAfterDelete(doc, boardId);
      message = next
        ? `The layout on screen will be replaced with "${next.name}".`
        : 'The layout on screen will be replaced with an empty board.';
    }
    const confirmed = await deps.confirm(message, `Delete "${name}"?`, {
      confirmLabel: 'Delete',
      defaultAction: 'cancel'
    });
    if (!confirmed) return null;
    const removed = unwrap(await deps.api.remove(boardId), 'Deleting the board');
    // The board is deleted even if the next one then fails to load
    if (removed?.activeChanged) await openLoaded(removed, deps);
    return ['board_deleted', { was_active: wasActive }];
  },

  async import(_boardId, deps) {
    await readyDoc(deps);
    const groups = unwrap(await deps.api.listImportable(), 'Listing boards to import');
    const choice = await deps.chooseImportBoard(groups || []);
    if (!choice) return null;
    const loaded = unwrap(await deps.api.importBoard(choice.profile, choice.boardId), 'Importing the board');
    return (await openLoaded(loaded, deps)) ? ['board_imported'] : null;
  }
};

/**
 * Run one Board menu command.
 *
 * @param {{ command: string, boardId?: string }} command
 * @param {Object} deps
 * @param {Object} deps.api - secureElectronAPI.boards
 * @param {Function} deps.confirm - customConfirm
 * @param {Function} deps.prompt - customPrompt; resolves null on cancel
 * @param {Function} deps.alert
 * @param {Function} deps.toast
 * @param {(name: string, props?: Object) => void} deps.track - analytics; never given names
 * @param {() => boolean} deps.isModalOpen
 * @param {() => Object} deps.extractLayout - the layout on screen
 * @param {(groups: Array) => Promise<{ profile: string, boardId: string }|null>} deps.chooseImportBoard
 * @param {(layout: Object) => Promise<{ dropped: number }>} deps.applyLayout
 * @returns {Promise<void>}
 */
export async function runBoardCommand({ command, boardId } = {}, deps) {
  const handler = Object.hasOwn(handlers, command) ? handlers[command] : null;
  if (!handler) {
    window.debugLog?.warn('Unknown board command', { ...LOG_CONTEXT, command });
    return;
  }
  if (running) {
    window.debugLog?.info('Board command dropped: another is running', { ...LOG_CONTEXT, command });
    return;
  }
  if (command !== 'switch' && deps.isModalOpen()) {
    window.debugLog?.info('Board command dropped: a dialog is open', { ...LOG_CONTEXT, command });
    return;
  }

  running = true;
  try {
    const event = await handler(boardId, deps);
    if (event) deps.track(event[0], event[1]);
  } catch (error) {
    if (REFUSED_ERRORS.has(error.message)) {
      window.debugLog?.info('Board command refused by the session', { ...LOG_CONTEXT, command, error: error.message });
    } else {
      window.debugLog?.error('Board command failed', { ...LOG_CONTEXT, command, error: error.message });
      deps.alert(CHANGE_FAILED_MESSAGE, 'Board not changed');
    }
  } finally {
    running = false;
  }
}

export default { runBoardCommand, nextBoardAfterDelete };
