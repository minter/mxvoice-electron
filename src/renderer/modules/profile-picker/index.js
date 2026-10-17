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

  modal.addEventListener('shown.bs.modal', () => picker?.focus());
  modal.addEventListener('hidden.bs.modal', () => {
    picker?.destroy();
    picker = null;
    // The deleted profile can't be returned to: closing lands on Default User
    if (afterDelete && !switching) {
      switchTo(DEFAULT_PROFILE).catch((error) => {
        window.debugLog?.error('Failed to fall back to Default User', { ...CONTEXT, function: 'hidden', error: error?.message });
      });
    }
  });
  return modal;
}

async function switchTo(name) {
  switching = true;
  const result = await window.secureElectronAPI.profile.switchToProfile(name, 'launcher');
  // On success the main process reloads this window; nothing more to do here
  if (!result?.success) switching = false;
  return result;
}

function close() {
  return safeHideModal(`#${MODAL_ID}`, { ...CONTEXT, function: 'close' });
}

/**
 * Open the Switch Profile dialog.
 * @param {{ afterDelete?: boolean }} [options] - afterDelete: the running
 *   profile was just deleted; it is not marked, and closing the dialog
 *   switches to Default User
 */
async function open(options = {}) {
  if (picker) return;
  afterDelete = !!options.afterDelete;
  switching = false;

  let currentProfile = null;
  if (!afterDelete) {
    const current = await window.secureElectronAPI.profile.getCurrent();
    currentProfile = current?.success ? current.profile : null;
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
