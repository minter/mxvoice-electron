import { expect } from '@playwright/test';

// The tab strips that end in a ⋯ tab actions button
export const TAB_STRIPS = { hotkeys: '#hotkey_tabs', holdingTank: '#holding_tank_tabs' };

export const CLEAR_TAB_MESSAGE = 'Removes all songs from this tab. The songs stay in your library.';

export function tabActionsMenu(page) {
  return page.locator('#mxv-tab-actions-menu');
}

/** Open the ⋯ menu of a panel's tab row; resolves to the visible menu */
export async function openTabActions(page, panel) {
  await page.locator(`${TAB_STRIPS[panel]} .tab-actions-btn`).click();
  const menu = tabActionsMenu(page);
  await expect(menu).toBeVisible({ timeout: 5000 });
  return menu;
}

/** Choose 'rename' or 'clear' from a panel's ⋯ menu */
export async function chooseTabAction(page, panel, action) {
  const menu = await openTabActions(page, panel);
  await menu.locator(`[data-action="${action}"]`).click();
  await expect(menu).toBeHidden();
}

/** Rename a panel's selected tab through the ⋯ menu */
export async function renameSelectedTab(page, panel, name) {
  await chooseTabAction(page, panel, 'rename');
  const prompt = page.locator('.modal:visible .prompt-input');
  await expect(prompt).toBeVisible({ timeout: 5000 });
  await prompt.fill(name);
  await page.locator('.modal:visible .confirm-btn').click();
  await expect(prompt).not.toBeVisible({ timeout: 5000 });
}

/** The Clear confirm dialog */
export function clearTabDialog(page) {
  return page.locator(`.modal:has-text("${CLEAR_TAB_MESSAGE}")`);
}

/** Clear a panel's selected tab through the ⋯ menu and confirm it */
export async function clearSelectedTab(page, panel) {
  await chooseTabAction(page, panel, 'clear');
  const confirmButton = clearTabDialog(page).locator('.confirm-btn');
  await expect(confirmButton).toBeVisible({ timeout: 5000 });
  await confirmButton.click();
  await expect(confirmButton).not.toBeVisible({ timeout: 5000 });
}

// Whether the panel's selected tab has songs in the model: the rule the app uses to ask before replacing
function selectedTabHasSongs(page, panel) {
  return page.evaluate((which) => {
    const registry = window.moduleRegistry;
    const strip = which === 'hotkeys' ? '#hotkey_tabs' : '#holding_tank_tabs';
    const number = Number(document.querySelector(`${strip} .nav-link.active`)?.getAttribute('href')?.match(/(\d+)$/)?.[1]);
    const tabs = which === 'hotkeys' ? registry?.hotkeys?.getHotkeySnapshot?.() : registry?.holdingTank?.getHoldingTankSnapshot?.();
    const tab = tabs?.find((t) => t.tabNumber === number);
    return which === 'hotkeys' ? Object.values(tab?.hotkeys || {}).some(Boolean) : (tab?.songIds?.length || 0) > 0;
  }, panel);
}

/** Make main's next open dialogs pick `filePath` (or cancel, for null) */
export async function stubOpenDialog(app, filePath) {
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => (file ? { canceled: false, filePaths: [file] } : { canceled: true, filePaths: [] });
  }, filePath);
}

/** Make main's next save dialogs pick `filePath` (or cancel, for null); records each dialog's options */
export async function stubSaveDialog(app, filePath) {
  await app.evaluate(({ dialog }, file) => {
    globalThis.__saveDialogOptions = [];
    dialog.showSaveDialog = async (...args) => {
      globalThis.__saveDialogOptions.push(args.at(-1));
      return file ? { canceled: false, filePath: file } : { canceled: true, filePath: '' };
    };
  }, filePath);
}

/** The options main passed to each stubbed save dialog */
export function saveDialogOptions(app) {
  return app.evaluate(() => globalThis.__saveDialogOptions ?? []);
}

/** Wait until the show session is ready: loads are ignored before then */
export async function waitForShowReady(page) {
  await expect.poll(
    () => page.evaluate(async () => (await window.secureElectronAPI.shows.getState())?.data?.status),
    { timeout: 20000 }
  ).toBe('ready');
}

/** The Load Tab from File replace confirm */
export function replaceTabDialog(page) {
  return page.locator('.modal.show').filter({ has: page.locator('.modal-title', { hasText: 'Load Tab from File' }) });
}

/**
 * ⋯ > Load Tab from File… on a panel's selected tab (stub the open dialog first).
 * confirm: 'auto' answers Replace when the tab has songs in the model (as the app decides); 'replace' or 'cancel'
 * answer the replace confirm; 'none' expects none (a canceled dialog, a bad file).
 */
export async function loadTabFromFile(page, panel, { confirm = 'auto' } = {}) {
  await waitForShowReady(page);
  let answer = confirm;
  if (answer === 'auto') answer = (await selectedTabHasSongs(page, panel)) ? 'replace' : 'none';
  await chooseTabAction(page, panel, 'load');
  if (answer === 'none') return;
  const dialog = replaceTabDialog(page);
  await expect(dialog).toBeVisible({ timeout: 10000 });
  const shown = await dialog.elementHandle();
  await dialog.getByRole('button', { name: answer === 'replace' ? 'Replace' : 'Cancel', exact: true }).click();
  await shown.waitForElementState('hidden');
}

/** ⋯ > Save Tab to File… on a panel's selected tab (stub the save dialog first) */
export async function saveTabToFile(page, panel) {
  await chooseTabAction(page, panel, 'save');
}
