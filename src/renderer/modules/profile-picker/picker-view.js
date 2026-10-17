/**
 * Profile Picker View
 *
 * The one profile picker UI, mounted by two hosts:
 * - src/launcher.js: the startup window (no main window exists yet)
 * - ./index.js: the Switch Profile dialog in the main window
 *
 * It renders Bootstrap modal parts (header, body, footer) so it looks like
 * every other dialog in the app. Hosts supply the container and the actions.
 * Styles: src/stylesheets/profile-picker.css. Rules: ./picker-model.js.
 *
 * @module profile-picker/picker-view
 */

import {
  sortProfiles,
  filterProfiles,
  initialSelection,
  primaryLabel,
  isSelectable,
  validateNewProfileName
} from './picker-model.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

const TEMPLATE = `
  <div class="modal-header profile-picker-header">
    <img class="profile-picker-icon" alt="" hidden>
    <h6 class="modal-title" id="launcher-title"></h6>
    <span class="profile-picker-current" id="launcher-current" hidden></span>
    <button type="button" class="btn-close" id="modal-close" aria-label="Close" hidden></button>
  </div>
  <div class="modal-body profile-picker-body">
    <div id="error-container"></div>
    <div id="loading-state" class="profile-picker-loading">Loading profiles…</div>
    <div id="profile-content" class="profile-picker-list-view" style="display: none;">
      <input type="text" id="profile-search" class="form-control form-control-sm"
             placeholder="Search profiles" autocomplete="off">
      <ul id="profile-list" class="list-group profile-picker-list"></ul>
    </div>
    <div id="create-profile-modal" class="profile-picker-create" style="display: none;">
      <div class="mb-2">
        <label for="profile-name-input" class="form-label">Profile name</label>
        <input type="text" id="profile-name-input" class="form-control form-control-sm"
               placeholder="Saturday show" maxlength="50">
      </div>
      <div>
        <label for="profile-description-input" class="form-label">Description (optional)</label>
        <input type="text" id="profile-description-input" class="form-control form-control-sm" maxlength="100">
      </div>
    </div>
  </div>
  <div class="modal-footer profile-picker-footer">
    <div class="profile-picker-actions" data-view="list">
      <button type="button" id="create-profile-btn" class="btn btn-secondary btn-sm">New profile</button>
      <span class="profile-picker-spacer"></span>
      <button type="button" id="cancel-switch-btn" class="btn btn-secondary btn-sm" hidden>Cancel</button>
      <button type="button" id="launch-btn" class="btn btn-success btn-sm" disabled></button>
    </div>
    <div class="profile-picker-actions" data-view="create" hidden>
      <span class="profile-picker-spacer"></span>
      <button type="button" id="cancel-create-btn" class="btn btn-secondary btn-sm">Cancel</button>
      <button type="button" id="confirm-create-btn" class="btn btn-success btn-sm">Create profile</button>
    </div>
  </div>
`;

/**
 * Mount the picker.
 * @param {Object} options
 * @param {HTMLElement} options.root - Container; receives the header/body/footer
 * @param {Document|HTMLElement} options.keyTarget - Where to listen for Enter/Esc while the picker is open
 *   (captured, so they win over the main window's own shortcuts)
 * @param {'startup'|'switch'} options.mode
 * @param {string|null} [options.currentProfile] - Running profile (switch mode)
 * @param {string} [options.iconSrc] - App icon for the header (startup)
 * @param {Object} options.api
 * @param {Function} options.api.listProfiles - () => Promise<{success, profiles, error}>
 * @param {Function} options.api.createProfile - (name, description) => Promise<{success, error}>
 * @param {Function} options.api.choose - (name) => Promise<{success, error}>
 * @param {Function} [options.onCancel] - Back out (switch mode only)
 * @param {boolean} [options.fixedListHeight] - Keep the list at its loaded height while
 *   filtering, so a dialog sized by its content doesn't shrink as matches drop
 * @param {Function} [options.onLayoutChange] - After the list (re)loads or the view switches between list and New profile
 * @returns {{ load: Function, focus: Function, destroy: Function }}
 */
export function createProfilePicker({
  root,
  keyTarget,
  mode,
  currentProfile = null,
  iconSrc,
  api,
  onCancel,
  fixedListHeight = false,
  onLayoutChange
}) {
  const isSwitch = mode === 'switch';
  let profiles = [];
  let selected = null;
  let view = 'list';
  let latestRequest = 0;
  let choosing = false;

  root.classList.add('profile-picker');
  root.dataset.mode = mode;
  root.innerHTML = TEMPLATE;
  const $ = (selector) => root.querySelector(selector);

  const title = $('#launcher-title');
  const current = $('#launcher-current');
  const closeButton = $('#modal-close');
  const errorContainer = $('#error-container');
  const listView = $('#profile-content');
  const createView = $('#create-profile-modal');
  const search = $('#profile-search');
  const list = $('#profile-list');
  const launchButton = $('#launch-btn');
  const nameInput = $('#profile-name-input');
  const descriptionInput = $('#profile-description-input');

  if (iconSrc) {
    const icon = $('.profile-picker-icon');
    icon.src = iconSrc;
    icon.hidden = false;
  }
  if (isSwitch) {
    $('#cancel-switch-btn').hidden = false;
    if (currentProfile) {
      current.textContent = `Current: ${currentProfile}`;
    }
  }

  function showError(message) {
    errorContainer.innerHTML = `<div class="alert alert-danger profile-picker-error">${escapeHtml(message)}</div>`;
  }

  function clearError() {
    errorContainer.innerHTML = '';
  }

  function updateChrome() {
    const creating = view === 'create';
    title.textContent = creating ? 'New profile' : (isSwitch ? 'Switch profile' : 'Choose a profile');
    current.hidden = creating || !isSwitch || !currentProfile;
    // The X backs out of whatever is showing; at startup the list has nowhere to go back to
    closeButton.hidden = !creating && !isSwitch;
    listView.style.display = creating ? 'none' : 'flex';
    createView.style.display = creating ? 'block' : 'none';
    root.querySelector('[data-view="list"]').hidden = creating;
    root.querySelector('[data-view="create"]').hidden = !creating;
    launchButton.disabled = !selected;
    launchButton.textContent = primaryLabel({ mode, selected });
  }

  function select(name) {
    if (name && !isSelectable({ mode, name, currentProfile })) return;
    selected = name;
    list.querySelectorAll('.profile-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.profileName === name);
    });
    updateChrome();
  }

  /** @returns {string[]} Names now shown */
  function renderList() {
    const visible = sortProfiles(filterProfiles(profiles, search.value));
    if (!visible.length) {
      const message = search.value.trim()
        ? `No profiles match "${escapeHtml(search.value)}".`
        : 'No profiles yet. Create one to get started.';
      list.innerHTML = `<li class="list-group-item profile-picker-empty">${message}</li>`;
      return [];
    }
    list.innerHTML = visible.map((profile) => {
      const selectable = isSelectable({ mode, name: profile.name, currentProfile });
      const classes = [
        'list-group-item',
        selectable ? 'list-group-item-action' : 'disabled',
        'profile-item',
        profile.name === selected ? 'selected' : ''
      ].filter(Boolean).join(' ');
      return `
      <li class="${classes}" data-profile-name="${escapeHtml(profile.name)}"${selectable ? '' : ' aria-disabled="true"'}>
        <div class="profile-info">
          <span class="profile-name">${escapeHtml(profile.name)}</span>
          ${profile.description ? `<span class="profile-description">${escapeHtml(profile.description)}</span>` : ''}
        </div>
        ${selectable ? '' : '<span class="profile-current-tag">Current</span>'}
      </li>
    `;
    }).join('');
    return visible.map((profile) => profile.name);
  }

  // Measured from the full list, before any filter narrows it
  function lockListHeight() {
    if (!fixedListHeight) return;
    list.style.minHeight = '';
    const height = list.offsetHeight;
    if (height) list.style.minHeight = `${height}px`;
  }

  function onSearch() {
    // The dialog may still have been animating in at load; the full list is
    // on screen now, before this keystroke narrows it
    if (fixedListHeight && !list.style.minHeight) lockListHeight();
    const shown = renderList();
    // A selection the filter hides would still be what Enter or the button acts on
    if (selected && !shown.includes(selected)) select(null);
  }

  async function load({ keepSelection = false } = {}) {
    const request = ++latestRequest;
    let result;
    try {
      result = await api.listProfiles();
    } catch (error) {
      result = { success: false, error: error.message };
    }
    if (request !== latestRequest) return;

    $('#loading-state').style.display = 'none';
    if (result?.success) {
      profiles = result.profiles || [];
      if (!keepSelection) selected = initialSelection({ profiles, mode, currentProfile });
      renderList();
    } else {
      showError(result?.error || 'Failed to load profiles');
    }
    updateChrome();
    lockListHeight();
    onLayoutChange?.();
  }

  async function choose(name = selected) {
    if (!name || choosing || !isSelectable({ mode, name, currentProfile })) return;
    choosing = true;
    try {
      const result = await api.choose(name);
      if (!result?.success) showError(result?.error || 'Failed to open profile');
    } catch (error) {
      showError(`Error opening profile: ${error.message}`);
    } finally {
      choosing = false;
    }
  }

  function showCreate() {
    clearError();
    nameInput.value = '';
    descriptionInput.value = '';
    view = 'create';
    updateChrome();
    onLayoutChange?.();
    setTimeout(() => nameInput.focus(), 50);
  }

  function hideCreate() {
    clearError();
    view = 'list';
    updateChrome();
    onLayoutChange?.();
    search.focus();
  }

  async function submitCreate() {
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    const problem = validateNewProfileName(name, profiles);
    if (problem) {
      showError(problem);
      nameInput.focus();
      return;
    }
    try {
      const result = await api.createProfile(name, description);
      if (!result?.success) {
        showError(result?.error || 'Failed to create profile');
        return;
      }
      view = 'list';
      clearError();
      selected = name;
      await load({ keepSelection: true });
      search.focus();
    } catch (error) {
      showError(`Error creating profile: ${error.message}`);
    }
  }

  function cancel() {
    if (view === 'create') hideCreate();
    else if (isSwitch) onCancel?.();
  }

  // Wiring
  const onListClick = (event) => {
    const item = event.target.closest('.profile-item');
    if (item) select(item.dataset.profileName);
  };
  const onListDoubleClick = (event) => {
    const item = event.target.closest('.profile-item');
    if (item) choose(item.dataset.profileName);
  };
  list.addEventListener('click', onListClick);
  list.addEventListener('dblclick', onListDoubleClick);
  search.addEventListener('input', onSearch);
  launchButton.addEventListener('click', () => choose());
  $('#create-profile-btn').addEventListener('click', showCreate);
  $('#cancel-switch-btn').addEventListener('click', () => onCancel?.());
  closeButton.addEventListener('click', cancel);
  $('#cancel-create-btn').addEventListener('click', hideCreate);
  $('#confirm-create-btn').addEventListener('click', submitCreate);

  // Enter and Esc belong to the picker while it is open: they must not
  // reach the main window's own shortcuts (Enter plays the selected song).
  // Captured on the document: focus can sit on <body>, outside the picker,
  // after the button that had it is hidden
  const onKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.stopPropagation();
      event.preventDefault();
      if (view === 'create') submitCreate();
      else choose();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      cancel();
    }
  };
  keyTarget.addEventListener('keydown', onKeyDown, true);

  updateChrome();

  return {
    load,
    focus: () => (view === 'create' ? nameInput : search).focus(),
    destroy: () => {
      keyTarget.removeEventListener('keydown', onKeyDown, true);
      root.innerHTML = '';
    }
  };
}

export default createProfilePicker;
