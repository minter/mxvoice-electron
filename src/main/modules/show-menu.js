/**
 * Shows menu: pure builder, driven by a snapshot of the show session.
 * Clicks post `menu:show-command` to the renderer through `send`.
 */

import { SHOW_COLORS } from './show-document.js';

const COLOR_LABELS = {
  teal: 'Teal', blue: 'Blue', purple: 'Purple', pink: 'Pink', coral: 'Coral', amber: 'Amber', green: 'Green'
};

// Windows/Linux treat '&' in a label as a mnemonic marker; macOS does not.
function escapeLabel(name, platform) {
  const text = String(name ?? '');
  return platform === 'win32' || platform === 'linux' ? text.replace(/&/g, '&&') : text;
}

/**
 * @param {Object} state - { status, activeShow, shows, dirty, hasPlayed } from the show session
 * @param {Object} [options]
 * @param {Function} [options.rebuild] - rebuilds the application menu from the session
 * @param {Function} [options.swatchImage] - (colorKey|null) => NativeImage for the Color items
 */
function buildShowMenu(state, { platform, send, rebuild, swatchImage } = {}) {
  const status = state?.status ?? 'idle';
  const activeShow = state?.activeShow ?? null;
  const shows = Array.isArray(state?.shows) ? state.shows : [];
  const ready = status === 'ready';
  const label = (name) => escapeLabel(name, platform);
  const emit = (command, showId) => () => send?.(command, showId);

  const quoted = (verb) => (activeShow ? `${verb} "${label(activeShow.name)}"` : verb);
  const hasActive = ready && !!activeShow;

  return {
    label: 'Shows',
    submenu: [
      ...shows.map((show) => {
        const isActive = activeShow?.id === show.id;
        return {
          label: label(show.name),
          type: 'radio',
          checked: isActive,
          enabled: ready,
          // Electron fires click on an already-checked radio; that must not act as a Revert.
          // It also moves the check itself, and the renderer may drop the switch,
          // so rebuild from the session at once; a switch that lands rebuilds again.
          click: () => {
            if (isActive) return;
            send?.('switch', show.id);
            // Not inside Electron's own click dispatch: replacing the menu there is risky on Windows and Linux
            setImmediate(() => rebuild?.());
          }
        };
      }),
      { type: 'separator' },
      // Save and Revert have nothing to do unless the layout on screen differs from the saved show
      { label: `${quoted('Save')}…`, enabled: hasActive && !!state?.dirty, click: emit('save') },
      { label: 'Save As…', enabled: ready, click: emit('save-as') },
      { label: 'Revert to Saved…', enabled: ready && !!state?.dirty, click: emit('revert') },
      // Clears every played count at once, without asking: they are only a reminder
      { label: 'Reset Played', enabled: ready && !!state?.hasPlayed, click: emit('reset-played') },
      // Both act on the show on screen; the renderer reads it from the session
      { label: `${quoted('Rename')}…`, enabled: hasActive, click: emit('rename') },
      { label: `${quoted('Delete')}…`, enabled: hasActive, click: emit('delete') },
      buildColorMenu(activeShow, { enabled: hasActive, send, rebuild, swatchImage }),
      { type: 'separator' },
      { label: 'Import Show…', enabled: ready, click: emit('import') }
    ]
  };
}

/** Shows → Color: None, then the palette; sets the active show's accent color. */
function buildColorMenu(activeShow, { enabled, send, rebuild, swatchImage }) {
  const current = SHOW_COLORS.includes(activeShow?.color) ? activeShow.color : null;
  const item = (label, color) => ({
    label,
    // The swatch sits beside the radio check; None is a hollow ring
    ...(swatchImage ? { icon: swatchImage(color) } : {}),
    type: 'radio',
    checked: current === color,
    enabled,
    click: () => {
      send?.('set-color', null, { color });
      // As for the show radio list: Electron moved the check; rebuild from the session after the click
      setImmediate(() => rebuild?.());
    }
  });
  return {
    label: 'Color',
    enabled,
    submenu: [item('None', null), ...SHOW_COLORS.map((key) => item(COLOR_LABELS[key], key))]
  };
}

export { buildShowMenu };
export default buildShowMenu;
