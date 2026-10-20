/**
 * Tab actions menu
 *
 * The ⋯ button at the end of the hotkey and holding tank tab rows, and a
 * right-click on any of their tabs, open one small menu: Rename and Clear for
 * the selected tab. It looks like the song context menu (same classes) and
 * calls the panels' own rename and clear functions.
 */

import { safeShowTab } from './bootstrap-helpers.js';

const MENU_ID = 'mxv-tab-actions-menu';
const LOG_CONTEXT = { module: 'tab-actions-menu' };

/** Rename and clear for each tab strip, by the strip's element id */
export const TAB_PANELS = {
  hotkey_tabs: {
    rename: (registry) => registry?.hotkeys?.renameHotkeyTab?.(),
    clear: (registry) => registry?.hotkeys?.clearHotkeys?.()
  },
  holding_tank_tabs: {
    rename: (registry) => registry?.holdingTank?.renameHoldingTankTab?.(),
    clear: (registry) => registry?.holdingTank?.clearHoldingTank?.()
  }
};

/**
 * The name to show for a tab: its label, or "Tab N" when it has none.
 * @param {Element|null} link - the tab's .nav-link
 * @returns {string}
 */
export function tabLabel(link) {
  const name = (link?.textContent || '').trim();
  if (name) return name;
  const number = link?.getAttribute?.('href')?.match(/(\d+)$/)?.[1];
  return number ? `Tab ${number}` : 'Tab';
}

/**
 * @param {string} label - from tabLabel
 * @returns {Array<{ action: string, icon: string, text: string }>}
 */
export function tabActionItems(label) {
  return [
    { action: 'rename', icon: 'fa-pen', text: `Rename "${label}"…` },
    { action: 'clear', icon: 'fa-eraser', text: `Clear "${label}"…` }
  ];
}

/**
 * Arguments for customConfirm when clearing a tab.
 * @param {string} label - from tabLabel
 */
export function clearTabConfirmArgs(label) {
  return [
    'Removes all songs from this tab. The songs stay in your library.',
    `Clear "${label}"?`,
    { confirmLabel: 'Clear', defaultAction: 'cancel' }
  ];
}

/**
 * Ask before clearing a tab.
 * @param {Element|null} link - the tab's .nav-link
 * @param {Function} confirm - customConfirm
 * @returns {Promise<boolean>}
 */
export function confirmClearTab(link, confirm) {
  return confirm(...clearTabConfirmArgs(tabLabel(link)));
}

/**
 * Run a menu action on the selected tab of a strip.
 * @param {string} tabsId - 'hotkey_tabs' or 'holding_tank_tabs'
 * @param {string} action - 'rename' or 'clear'
 * @param {Object} registry - window.moduleRegistry
 */
export function runTabAction(tabsId, action, registry) {
  const run = TAB_PANELS[tabsId]?.[action];
  if (!run) return undefined;
  return run(registry);
}

/**
 * Fill the menu with one button per action. Labels use textContent only.
 * @param {Element} menu
 * @param {string} label - from tabLabel
 * @param {Document} [doc]
 */
export function renderTabActionItems(menu, label, doc = document) {
  const buttons = tabActionItems(label).map(({ action, icon, text }) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'mxv-context-item tab-actions-menu-item';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('data-action', action);
    const glyph = doc.createElement('i');
    glyph.className = `fas ${icon} fa-fw`;
    glyph.setAttribute('aria-hidden', 'true');
    const caption = doc.createElement('span');
    caption.textContent = text;
    button.append(glyph, caption);
    return button;
  });
  menu.replaceChildren(...buttons);
}

/**
 * Wire the ⋯ buttons and tab right-clicks of both tab strips.
 * @param {Object} options
 * @param {Object} options.moduleRegistry
 * @param {Function} [options.showTab] - safeShowTab
 * @param {Object} [options.debugLog]
 * @param {Document} [options.doc]
 * @param {Window} [options.win]
 * @returns {Array<{ name: string, element: EventTarget, event: string, handler: Function }>}
 *   the listeners added, for the caller to remove
 */
export function installTabActionsMenus({
  moduleRegistry = {},
  showTab = safeShowTab,
  debugLog = window.debugLog,
  doc = document,
  win = window
} = {}) {
  const handlers = [];
  const listen = (name, element, event, handler) => {
    element.addEventListener(event, handler);
    handlers.push({ name, element, event, handler });
  };

  let menu = doc.getElementById(MENU_ID);
  if (!menu) {
    menu = doc.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'mxv-context-menu tab-actions-menu';
    menu.setAttribute('role', 'menu');
    menu.style.display = 'none';
    doc.body.appendChild(menu);
  }

  let current = null; // { tabsId, trigger }

  const hide = () => {
    if (menu.style.display === 'none') return;
    menu.style.display = 'none';
    current?.trigger?.setAttribute('aria-expanded', 'false');
    current = null;
  };

  // x/y: the pointer, or the button's bottom-right corner when alignRight
  const open = (tabsId, x, y, { alignRight = false, trigger = null } = {}) => {
    hide();
    const link = doc.querySelector(`#${tabsId} .nav-link.active`);
    renderTabActionItems(menu, tabLabel(link), doc);

    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = Math.max(4, Math.min(alignRight ? x - width : x, win.innerWidth - width - 4));
    const top = Math.max(4, Math.min(y, win.innerHeight - height - 4));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = '';

    current = { tabsId, trigger };
    trigger?.setAttribute('aria-expanded', 'true');
    menu.querySelector('button')?.focus();
  };

  listen('tabActionsMenuClick', menu, 'click', (event) => {
    const item = event.target?.closest?.('[data-action]');
    if (!item || !current) return;
    event.stopPropagation();
    const { tabsId } = current;
    hide();
    Promise.resolve(runTabAction(tabsId, item.getAttribute('data-action'), moduleRegistry))
      .catch((error) => debugLog?.error('Tab action failed', { ...LOG_CONTEXT, function: 'runTabAction', tabsId, error: error?.message }));
  });

  Object.keys(TAB_PANELS).forEach((tabsId) => {
    const strip = doc.getElementById(tabsId);
    if (!strip) return;
    const button = strip.querySelector('.tab-actions-btn');

    if (button) {
      listen(`tabActionsButton:${tabsId}`, button, 'click', (event) => {
        event.preventDefault();
        if (current?.tabsId === tabsId) {
          hide();
          return;
        }
        const rect = button.getBoundingClientRect();
        open(tabsId, rect.right, rect.bottom, { alignRight: true, trigger: button });
      });
    }

    listen(`tabActionsContextMenu:${tabsId}`, strip, 'contextmenu', async (event) => {
      const link = event.target?.closest?.('.nav-link');
      if (!link || !strip.contains(link)) return;
      event.preventDefault();
      const { clientX, clientY } = event;
      const href = link.getAttribute('href');
      if (!link.classList.contains('active') && href) {
        await showTab(`#${tabsId} .nav-link[href="${href}"]`, { ...LOG_CONTEXT, function: 'contextmenu' });
      }
      open(tabsId, clientX, clientY);
    });
  });

  // Any click outside the menu and the ⋯ buttons closes it
  listen('tabActionsDocumentClick', doc, 'click', (event) => {
    if (menu.contains(event.target) || event.target?.closest?.('.tab-actions-btn')) return;
    hide();
  });
  // A right-click elsewhere (the song menu) closes it too
  listen('tabActionsDocumentContextMenu', doc, 'contextmenu', (event) => {
    if (event.target?.closest?.('.nav-link') && Object.keys(TAB_PANELS).some((id) => doc.getElementById(id)?.contains(event.target))) return;
    hide();
  });
  listen('tabActionsKeydown', doc, 'keydown', (event) => {
    if (event.key === 'Escape' && current) {
      const trigger = current.trigger;
      hide();
      trigger?.focus?.();
    }
  });
  listen('tabActionsBlur', win, 'blur', hide);
  listen('tabActionsResize', win, 'resize', hide);

  debugLog?.debug?.('Tab actions menus installed', LOG_CONTEXT);
  return handlers;
}
