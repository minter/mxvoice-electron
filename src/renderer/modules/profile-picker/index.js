/**
 * Profile Picker Module: the Switch Profile dialog
 *
 * Hosts the shared picker (./picker-view.js) in a Bootstrap dialog in the
 * main window, like Preferences. Choosing a different profile asks the main
 * process to switch in-process, which reloads this window into the new
 * profile. Backing out just closes the dialog: the session never left.
 * The startup launcher (src/launcher.js) hosts the same picker as a window.
 *
 * @module profile-picker
 */

import { createProfilePicker } from './picker-view.js';
import { DEFAULT_PROFILE } from './picker-model.js';
import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';

const MODAL_ID = 'profileSwitchModal';
const CONTEXT = { module: 'profile-picker' };

let picker = null;
let opening = false;
// Bootstrap ignores hide() while the dialog is still animating in, so a
// close requested then (a quick Esc or Cancel) waits for 'shown'
let shown = false;
let closeWhenShown = false;
// Set from hide() until 'hidden': reopening then waits instead of being dropped
let hiding = null;
let afterDelete = false;
let switching = false;

function ensureModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = MODAL_ID;
  modal.tabIndex = -1;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-labelledby', 'launcher-title');
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered" role="document">
      <div class="modal-content"></div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener('shown.bs.modal', () => {
    shown = true;
    if (closeWhenShown) {
      closeWhenShown = false;
      close();
      return;
    }
    picker?.focus();
  });
  // Any close (Esc, Cancel, X, backdrop click): stop taking keys right away,
  // not after the fade-out
  modal.addEventListener('hide.bs.modal', () => picker?.deactivate());
  modal.addEventListener('hidden.bs.modal', () => {
    shown = false;
    picker?.destroy();
    picker = null;
    hiding?.resolve();
    hiding = null;
    // The deleted profile can't be returned to: closing lands on Default User
    if (afterDelete && !switching) fallBackToDefaultUser();
  });
  return modal;
}

// After Delete Current Profile the window must not stay on the deleted
// profile (its saves are locked). If the switch fails, ask again.
async function fallBackToDefaultUser() {
  let result;
  try {
    result = await switchTo(DEFAULT_PROFILE);
  } catch (error) {
    result = { success: false, error: error?.message };
  }
  if (result?.success) return;
  window.debugLog?.error('Failed to fall back to Default User; reopening the picker', {
    ...CONTEXT, function: 'fallBackToDefaultUser', error: result?.error
  });
  open({ afterDelete: true });
}

async function switchTo(name) {
  switching = true;
  const result = await window.secureElectronAPI.profile.switchToProfile(name, 'launcher');
  // On success the main process reloads this window; nothing more to do here
  if (!result?.success) switching = false;
  return result;
}

function close() {
  picker?.deactivate();
  if (!shown) {
    closeWhenShown = true;
    return Promise.resolve();
  }
  if (!hiding) {
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    hiding = { done, resolve };
  }
  return safeHideModal(`#${MODAL_ID}`, { ...CONTEXT, function: 'close' });
}

/**
 * Open the Switch Profile dialog.
 * @param {{ afterDelete?: boolean }} [options] - afterDelete: the running
 *   profile was just deleted; it is not marked, and closing the dialog
 *   switches to Default User
 */
async function open(options = {}) {
  // Closed while still animating in, then reopened: the latest request wins,
  // so drop the queued close and keep it open
  if (picker && closeWhenShown) {
    closeWhenShown = false;
    picker.activate();
    return;
  }
  // Still closing from a moment ago: open once that has finished
  if (hiding) await hiding.done;
  // One picker at a time: a second one would leave the first one's document
  // key listener behind. `opening` covers the await below.
  if (picker || opening) return;
  if (!window.bootstrap?.Modal) {
    window.debugLog?.error('Bootstrap Modal unavailable; cannot open Switch Profile', { ...CONTEXT, function: 'open' });
    return;
  }
  // Bootstrap dialogs don't stack: over another open dialog this one would
  // stay invisible while still capturing Enter and Esc for the whole page
  const otherDialog = [...document.querySelectorAll('.modal.show')].find((el) => el.id !== MODAL_ID);
  if (otherDialog) {
    window.debugLog?.warn('Another dialog is open; not opening Switch Profile over it', {
      ...CONTEXT, function: 'open', openDialog: otherDialog.id || null
    });
    return;
  }
  opening = true;
  shown = false;
  closeWhenShown = false;
  afterDelete = !!options.afterDelete;
  switching = false;

  let currentProfile = null;
  try {
    if (!afterDelete) {
      const current = await window.secureElectronAPI.profile.getCurrent();
      currentProfile = current?.success ? current.profile : null;
    }
  } catch (error) {
    window.debugLog?.warn('Could not read the current profile', { ...CONTEXT, function: 'open', error: error?.message });
  } finally {
    opening = false;
  }

  const modal = ensureModal();
  picker = createProfilePicker({
    root: modal.querySelector('.modal-content'),
    keyTarget: document,
    mode: 'switch',
    currentProfile,
    // The dialog sizes to its content; filtering shouldn't make it shrink
    fixedListHeight: true,
    api: {
      listProfiles: () => window.secureElectronAPI.profile.listProfiles(),
      createProfile: (name, description) => window.secureElectronAPI.profile.createProfile(name, description),
      choose: switchTo
    },
    onCancel: close
  });

  // Esc is the picker's: it closes the New profile form before the dialog
  await safeShowModal(`#${MODAL_ID}`, { ...CONTEXT, function: 'open' }, { backdrop: true, keyboard: false });
  await picker?.load();
}

export { open, close };

export default { open, close };
