/**
 * Tab actions menu
 *
 * The ⋯ button at the end of the hotkey and holding tank tab rows, and a
 * right-click on any of their tabs, open one small menu for the selected tab:
 * Rename and Clear, then Save Tab to File and Load Tab from File. It looks like
 * the song context menu (same classes) and calls the panels' own rename and
 * clear functions, and tab-files.js for the files.
 */

import { safeShowTab } from './bootstrap-helpers.js';
import { saveTabToFile, loadTabFromFile } from './tab-files.js';

const MENU_ID = 'mxv-tab-actions-menu';
const LOG_CONTEXT = { module: 'tab-actions-menu' };

/**
 * Tabs (the model's snapshot) and the actions for each tab strip, by the
 * strip's element id. Save and load get the selected tab's number and label.
 */
export const TAB_PANELS = {
  hotkey_tabs: {
    tabs: (registry) => registry?.hotkeys?.getHotkeySnapshot?.(),
    rename: (registry) => registry?.hotkeys?.renameHotkeyTab?.(),
    clear: (registry) => registry?.hotkeys?.clearHotkeys?.(),
    save: (registry, target) => saveTabToFile('hotkeys', target, { registry }),
    load: (registry, target) => loadTabFromFile('hotkeys', target, { registry })
  },
  holding_tank_tabs: {
    tabs: (registry) => registry?.holdingTank?.getHoldingTankSnapshot?.(),
    rename: (registry) => registry?.holdingTank?.renameHoldingTankTab?.(),
    clear: (registry) => registry?.holdingTank?.clearHoldingTank?.(),
    save: (registry, target) => saveTabToFile('holding_tank', target, { registry }),
    load: (registry, target) => loadTabFromFile('holding_tank', target, { registry })
  }
};

// The tab number from a link's href (#hotkeys_list_2, #holding_tank_3)
function tabNumberOf(link) {
  return Number(link?.getAttribute?.('href')?.match(/(\d+)$/)?.[1]) || null;
}

/**
 * The name to show for a tab: the name the user gave it, or "Tab N" when it
 * has none. The model knows which: an unnamed tab still shows its number
 * as link text, and a tab the user named "1" keeps "1".
 * @param {Element|null} link - the tab's .nav-link
 * @param {Array<{ tabNumber: number, tabName: string|null }>} [tabs] - the panel's snapshot
 * @returns {string}
 */
export function tabLabel(link, tabs) {
  const number = tabNumberOf(link);
  if (Array.isArray(tabs) && number) {
    const name = tabs.find((tab) => tab.tabNumber === number)?.tabName;
    return name ? String(name) : `Tab ${number}`;
  }
  // No model: fall back to the link text
  const text = (link?.textContent || '').trim();
  if (text) return text;
  return number ? `Tab ${number}` : 'Tab';
}

/**
 * @param {string} label - from tabLabel
 * @returns {Array<{ action: string, icon: string, text: string } | { separator: true }>}
 */
export function tabActionItems(label) {
  return [
    { action: 'rename', icon: 'fa-pen', text: `Rename "${label}"…` },
    { action: 'clear', icon: 'fa-eraser', text: `Clear "${label}"…` },
    { separator: true },
    { action: 'save', icon: 'fa-file-export', text: 'Save Tab to File…' },
    { action: 'load', icon: 'fa-file-import', text: 'Load Tab from File…' }
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
 * @param {Array} [tabs] - the panel's snapshot, for tabLabel
 * @returns {Promise<boolean>}
 */
export function confirmClearTab(link, confirm, tabs) {
  return confirm(...clearTabConfirmArgs(tabLabel(link, tabs)));
}

/**
 * Run a menu action on the selected tab of a strip.
 * @param {string} tabsId - 'hotkey_tabs' or 'holding_tank_tabs'
 * @param {string} action - 'rename', 'clear', 'save' or 'load'
 * @param {Object} registry - window.moduleRegistry
 * @param {{ tabNumber: number|null, label: string }} [target] - the selected tab, for save and load
 */
export function runTabAction(tabsId, action, registry, target) {
  if (action === 'tabs') return undefined;
  const run = TAB_PANELS[tabsId]?.[action];
  if (!run) return undefined;
  return run(registry, target);
}

/**
 * Fill the menu with one button per action. Labels use textContent only.
 * @param {Element} menu
 * @param {string} label - from tabLabel
 * @param {Document} [doc]
 */
export function renderTabActionItems(menu, label, doc = document) {
  const buttons = tabActionItems(label).map(({ action, icon, text, separator }) => {
    if (separator) {
      const rule = doc.createElement('div');
      rule.className = 'mxv-context-separator';
      rule.setAttribute('role', 'separator');
      return rule;
    }
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

// Resolves when Bootstrap has finished showing the tab, or after a second
function waitForTabShown(link) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      link.removeEventListener('shown.bs.tab', done);
      resolve();
    };
    const timer = setTimeout(done, 1000);
    link.addEventListener('shown.bs.tab', done);
  });
}

/**
 * Wire the ⋯ buttons and tab right-clicks of both tab strips.
 * @param {Object} options
 * @param {Object} options.moduleRegistry
 * @param {Function} [options.showTab] - safeShowTab
 * @param {Object} [options.debugLog]
 * @param {Document} [options.doc]
 * @param {Window} [options.win]
 * @returns {Array<{ name: string, element: EventTarget, event: string, handler: Function, options?: boolean }>}
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
  const listen = (name, element, event, handler, options) => {
    element.addEventListener(event, handler, options);
    handlers.push({ name, element, event, handler, options });
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

  let current = null; // { tabsId, trigger, target }

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
    const label = tabLabel(link, TAB_PANELS[tabsId].tabs(moduleRegistry));
    renderTabActionItems(menu, label, doc);

    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = Math.max(4, Math.min(alignRight ? x - width : x, win.innerWidth - width - 4));
    const top = Math.max(4, Math.min(y, win.innerHeight - height - 4));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = '';

    current = { tabsId, trigger, target: { tabNumber: tabNumberOf(link), label } };
    trigger?.setAttribute('aria-expanded', 'true');
    menu.querySelector('button')?.focus();
  };

  listen('tabActionsMenuClick', menu, 'click', (event) => {
    const item = event.target?.closest?.('[data-action]');
    if (!item || !current) return;
    event.stopPropagation();
    const { tabsId, target } = current;
    hide();
    Promise.resolve(runTabAction(tabsId, item.getAttribute('data-action'), moduleRegistry, target))
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
        // Open once the switch is done: its shown.bs.tab closes the menu
        const shown = waitForTabShown(link);
        await showTab(`#${tabsId} .nav-link[href="${href}"]`, { ...LOG_CONTEXT, function: 'contextmenu' });
        await shown;
      }
      open(tabsId, clientX, clientY);
    });

    // Switching tabs (a click, F-key tab shortcuts, a show loading) closes it
    listen(`tabActionsTabShown:${tabsId}`, strip, 'shown.bs.tab', hide);
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
  // Any scroll, in any panel: the menu is fixed and would float off its tab
  listen('tabActionsScroll', win, 'scroll', hide, true);

  debugLog?.debug?.('Tab actions menus installed', LOG_CONTEXT);
  return handlers;
}
