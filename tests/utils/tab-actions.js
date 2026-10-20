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
