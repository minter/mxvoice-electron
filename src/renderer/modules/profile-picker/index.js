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
import { safeShowModal, safeHideModal, findOpenModal } from '../ui/bootstrap-helpers.js';

const MODAL_ID = 'profileSwitchModal';
const CONTEXT = { module: 'profile-picker' };

// After Delete Current Profile, how often to retry landing on Default User
const FALLBACK_RETRY_MS = 500;
const FALLBACK_ATTEMPTS = 3;

/**
 * One dialog lifecycle:
 *   closed → opening (reading the current profile) → showing (Bootstrap is
 *   animating it in) → open → closing (animating out) → closed
 * Bootstrap ignores hide() while showing, so a close requested then is
 * remembered in closeAfterShow and runs on 'shown'.
 */
let state = 'closed';
let closeAfterShow = false;
let picker = null;
// Per opening: { afterDelete, preview, switching }
let session = null;
// Resolved on 'hidden', for an open() that arrives while closing
let hidden = null;

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
    state = 'open';
    if (closeAfterShow) {
      closeAfterShow = false;
      close();
      return;
    }
    picker?.focus();
  });
  // Any close (Esc, Cancel, X, backdrop click): stop taking keys right away,
  // not after the fade-out
  modal.addEventListener('hide.bs.modal', () => {
    picker?.deactivate();
    state = 'closing';
  });
  modal.addEventListener('hidden.bs.modal', () => {
    const ended = session;
    state = 'closed';
    closeAfterShow = false;
    session = null;
    picker?.destroy();
    picker = null;
    hidden?.resolve();
    hidden = null;
    // The deleted profile can't be returned to: closing lands on Default User
    if (ended?.afterDelete && !ended.switching) fallBackToDefaultUser();
  });
  return modal;
}

function whenHidden() {
  if (!hidden) {
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    hidden = { done, resolve };
  }
  return hidden.done;
}

async function switchTo(name) {
  if (session) session.switching = true;
  const result = await window.secureElectronAPI.profile.switchToProfile(name, 'launcher');
  // On success the main process reloads this window; nothing more to do here
  if (!result?.success && session) session.switching = false;
  return result;
}

/**
 * After Delete Current Profile the window must not stay on the deleted
 * profile (its saves are locked). Retry the switch, then ask again; if the
 * dialog can't open either (another dialog is up), keep trying until it lands.
 */
async function fallBackToDefaultUser(attempt = 1) {
  let result;
  try {
    result = await window.secureElectronAPI.profile.switchToProfile(DEFAULT_PROFILE, 'launcher');
  } catch (error) {
    result = { success: false, error: error?.message };
  }
  if (result?.success) return;
  window.debugLog?.warn('Fallback to Default User failed', {
    ...CONTEXT, function: 'fallBackToDefaultUser', attempt, error: result?.error
  });
  if (attempt < FALLBACK_ATTEMPTS) {
    setTimeout(() => fallBackToDefaultUser(attempt + 1), FALLBACK_RETRY_MS);
    return;
  }
  const opened = await open({ afterDelete: true });
  if (!opened) setTimeout(() => fallBackToDefaultUser(1), FALLBACK_RETRY_MS * 2);
}

function close() {
  if (state === 'closed' || state === 'closing') return Promise.resolve();
  picker?.deactivate();
  if (state === 'opening' || state === 'showing') {
    closeAfterShow = true;
    return Promise.resolve();
  }
  state = 'closing';
  return safeHideModal(`#${MODAL_ID}`, { ...CONTEXT, function: 'close' });
}

/**
 * Open the Switch Profile dialog.
 * @param {{ afterDelete?: boolean, preview?: boolean }} [options]
 *   afterDelete: the running profile was just deleted; nothing is marked
 *   current, and closing the dialog switches to Default User.
 *   preview: for the What's New tour; shown but not usable (no key capture,
 *   nothing selected or clickable), so tour keys can't switch profiles.
 * @returns {Promise<boolean>} whether the dialog is open (or opening)
 */
async function open(options = {}) {
  // Closed while still animating in, then reopened: the latest request wins
  if (closeAfterShow && (state === 'opening' || state === 'showing')) {
    closeAfterShow = false;
    if (!session?.preview) picker?.activate();
    return true;
  }
  if (state === 'closing') await whenHidden();
  if (state !== 'closed') return true;

  if (!window.bootstrap?.Modal) {
    window.debugLog?.error('Bootstrap Modal unavailable; cannot open Switch Profile', { ...CONTEXT, function: 'open' });
    return false;
  }
  // Bootstrap dialogs don't stack: over another open dialog this one would
  // stay invisible while still capturing Enter and Esc for the whole page
  const otherDialog = findOpenModal(MODAL_ID);
  if (otherDialog) {
    window.debugLog?.warn('Another dialog is open; not opening Switch Profile over it', {
      ...CONTEXT, function: 'open', openDialog: otherDialog.id || null
    });
    return false;
  }

  state = 'opening';
  closeAfterShow = false;
  session = { afterDelete: !!options.afterDelete, preview: !!options.preview, switching: false };

  let currentProfile = null;
  if (!session.afterDelete) {
    try {
      const current = await window.secureElectronAPI.profile.getCurrent();
      currentProfile = current?.success ? current.profile : null;
    } catch (error) {
      window.debugLog?.warn('Could not read the current profile', { ...CONTEXT, function: 'open', error: error?.message });
    }
  }

  const modal = ensureModal();
  picker = createProfilePicker({
    root: modal.querySelector('.modal-content'),
    keyTarget: document,
    mode: 'switch',
    currentProfile,
    preview: session.preview,
    // The dialog sizes to its content; filtering shouldn't make it shrink
    fixedListHeight: true,
    api: {
      listProfiles: () => window.secureElectronAPI.profile.listProfiles(),
      createProfile: (name, description) => window.secureElectronAPI.profile.createProfile(name, description),
      choose: switchTo
    },
    onCancel: close
  });
  if (closeAfterShow) picker.deactivate();

  state = 'showing';
  // Esc is the picker's: it closes the New profile form before the dialog
  await safeShowModal(`#${MODAL_ID}`, { ...CONTEXT, function: 'open' }, { backdrop: true, keyboard: false });
  await picker?.load();
  return true;
}

export { open, close };

export default { open, close };
