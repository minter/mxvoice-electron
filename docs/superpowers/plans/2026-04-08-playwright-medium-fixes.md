# Playwright E2E Test Medium-Severity Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four medium-severity issues in the Playwright E2E test suite: shared mutable state between tests, excessive retry logic, global DB reset race conditions, and weak navigation assertions.

**Architecture:** Each fix is isolated to specific test files or utilities. No changes to the application code — only test infrastructure and spec files. The fixes improve test determinism, remove flaky workarounds, and strengthen assertions.

**Tech Stack:** Playwright `@playwright/test`, Electron, node-sqlite3-wasm

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `tests/e2e/seeded/songs/edit.spec.js` | Modify | Fix shared state + remove retry logic |
| `tests/e2e/seeded/songs/delete.spec.js` | Modify | Fix shared state between delete tests |
| `tests/e2e/seeded/navigation/basic.spec.js` | Modify | Strengthen Tab/Shift+Tab assertions |
| `tests/utils/seeded-launch.js` | Modify | Remove `resetTestEnvironment()` dependency |

---

### Task 1: Remove `resetTestEnvironment()` calls from seeded test suites

The `resetTestEnvironment()` in `beforeAll` resets the *global* seeded DB, but `launchSeededApp()` already copies the global DB into an isolated per-suite directory. The reset is unnecessary and introduces a race condition when suites run in parallel (4 workers). Since each suite gets its own copy via `launchSeededApp`, the global reset adds no value.

**Files:**
- Modify: `tests/e2e/seeded/songs/edit.spec.js:8-16`
- Modify: `tests/e2e/seeded/songs/delete.spec.js:8-16`
- Modify: `tests/e2e/seeded/songs/add.spec.js:13-21`
- Modify: `tests/e2e/seeded/songs/menu-operations.spec.js:8-14`
- Modify: `tests/e2e/seeded/search/basic.spec.js:8-16`
- Modify: `tests/e2e/seeded/playback/basic.spec.js:29-37`
- Modify: `tests/e2e/seeded/playback/fade.spec.js:21-27`
- Modify: `tests/e2e/seeded/navigation/basic.spec.js:8-16`
- Modify: `tests/e2e/seeded/hotkeys/basic.spec.js:17-24`
- Modify: `tests/e2e/seeded/ui/basic.spec.js:10-12`
- Modify: `tests/e2e/seeded/holding_tank/basic.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/holding_tank/file-operations.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/hotkeys/file-operations.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/hotkeys/songid-persistence.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/preferences/basic.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/backups/basic.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/backups/restore.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/categories/basic.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/drag-drop/basic.spec.js` (same pattern)
- Modify: `tests/e2e/seeded/theme-management/basic.spec.js` (same pattern)

Every seeded test file has this same pattern in `beforeAll`:

```javascript
try {
  const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
  await resetTestEnvironment();
  console.log('✅ Test environment reset for XYZ tests');
} catch (error) {
  console.log(`⚠️ Could not reset test environment: ${error.message}`);
}
```

- [ ] **Step 1: Remove `resetTestEnvironment()` from `songs/edit.spec.js`**

In `tests/e2e/seeded/songs/edit.spec.js`, replace the `beforeAll` with:

```javascript
test.beforeAll(async () => {
  ({ app, page } = await launchSeededApp(electron, 'songs-edit'));

  // After launch, refresh the page to clear any cached search state
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
});
```

Remove the `resetTestEnvironment` import attempt and its try/catch entirely.

- [ ] **Step 2: Remove `resetTestEnvironment()` from `songs/delete.spec.js`**

Same pattern — replace beforeAll:

```javascript
test.beforeAll(async () => {
  ({ app, page } = await launchSeededApp(electron, 'songs-delete'));

  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
});
```

- [ ] **Step 3: Remove `resetTestEnvironment()` from all remaining seeded test files**

Apply the same removal to every file listed above. Each `beforeAll` should just call `launchSeededApp` (with its existing suffix) followed by any setup that was already there (like `waitForAppReady`, window focus, etc). Do NOT remove any non-reset setup code.

The pattern for files that use `waitForAppReady`:
```javascript
test.beforeAll(async () => {
  ({ app, page } = await launchSeededApp(electron, 'navigation'));
  await waitForAppReady(page, app);
});
```

The pattern for files that do manual window focus:
```javascript
test.beforeAll(async () => {
  ({ app, page } = await launchSeededApp(electron, 'playback'));

  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.show();
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  await page.bringToFront();
  await page.click('body');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
});
```

- [ ] **Step 4: Run the full test suite to verify nothing broke**

Run: `npx playwright test 2>&1 | tail -30`

Expected: All tests pass. If any fail, investigate whether they actually depended on the global reset (they shouldn't — `launchSeededApp` creates isolated copies).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/seeded/
git commit -m "test: remove redundant resetTestEnvironment() calls from seeded E2E tests

Each seeded suite already gets an isolated DB copy via launchSeededApp().
The global reset was unnecessary and could race with parallel workers."
```

---

### Task 2: Remove excessive retry/fallback logic from `songs/edit.spec.js`

The first test in `edit.spec.js` has ~40 lines of defensive code before the actual test begins: empty searches to "prime" the DB, reset button clicks, try/catch retry loops. Since `launchSeededApp` provides a fully seeded isolated environment, none of this should be needed. If the app needs priming, that belongs in `launchSeededApp` or `waitForAppReady`, not in individual tests.

**Files:**
- Modify: `tests/e2e/seeded/songs/edit.spec.js:31-96`

- [ ] **Step 1: Simplify the first test's search setup**

Replace lines 31-96 of the `'Edit song via context menu → modify fields → save changes'` test with a clean search:

```javascript
test('Edit song via context menu → modify fields → save changes', async () => {
  // Search for Anthrax
  const searchInput = page.locator('#omni_search');
  await searchInput.click();
  await searchInput.fill('Anthrax');
  await searchInput.press('Enter');

  const rows = page.locator('#search_results tbody tr');
  await expect(rows).toHaveCount(1, { timeout: 8000 });

  // Verify it's the expected Anthrax song
  await expect(page.locator('#search_results')).toContainText('Got The Time');
  await expect(page.locator('#search_results')).toContainText('Anthrax');
  await expect(page.locator('#search_results')).toContainText('Countdown');
```

Keep the rest of the test (from "Right-click on the song" onward) unchanged.

- [ ] **Step 2: Run the edit spec to verify it passes**

Run: `npx playwright test tests/e2e/seeded/songs/edit.spec.js`

Expected: Both tests pass. If the first test fails on `toHaveCount(1)`, that indicates a real app timing issue that should be investigated separately — the retry logic was masking it.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/seeded/songs/edit.spec.js
git commit -m "test: remove defensive retry logic from song edit test

The isolated seeded environment from launchSeededApp provides a ready
database. Retry loops and empty search priming were masking timing issues
rather than testing real behavior."
```

---

### Task 3: Fix shared mutable state — give mutating tests their own app instances

The `songs/edit.spec.js` file has two tests sharing one app: the first test edits "Got The Time" → "Got The Time (Edited)", and the second test searches for "Weird Al". If the first test fails partway through, the second test operates on corrupted state. Similarly, `songs/delete.spec.js` has three tests where the first deletes "Anthrax", leaving fewer songs for subsequent tests.

The fix: use `test.describe.configure({ mode: 'serial' })` (already implied by shared state) and add a comment documenting the dependency. For `edit.spec.js`, split into separate describes with their own app launches since edits mutate the DB irreversibly.

**Files:**
- Modify: `tests/e2e/seeded/songs/edit.spec.js` (split into two describes)
- Modify: `tests/e2e/seeded/songs/delete.spec.js` (add serial config + document dependency)

- [ ] **Step 1: Split `edit.spec.js` into two independent describe blocks**

Rewrite `tests/e2e/seeded/songs/edit.spec.js` so each test gets its own app:

```javascript
import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';

test.describe('Songs - edit and save', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'songs-edit-save'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('Edit song via context menu → modify fields → save changes', async () => {
    // ... (keep the simplified version from Task 2, then the rest unchanged from line 98 onward)
  });
});

test.describe('Songs - edit and cancel', () => {
  let app; let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchSeededApp(electron, 'songs-edit-cancel'));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !!window.moduleRegistry, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  test('Edit song → cancel flow → no changes saved', async () => {
    // ... (keep existing test body unchanged from line 208 onward)
  });
});
```

- [ ] **Step 2: Add serial configuration and dependency documentation to `delete.spec.js`**

At the top of the describe block in `tests/e2e/seeded/songs/delete.spec.js`, add:

```javascript
// Tests are ordered: first test deletes Anthrax, second test verifies cancel preserves
// Edie Brickell, third test uses Weird Al. They share one app for performance but
// MUST run in declared order.
test.describe.configure({ mode: 'serial' });
```

Add this right after `test.describe('Songs - delete', () => {` on line 4.

- [ ] **Step 3: Run both spec files**

Run: `npx playwright test tests/e2e/seeded/songs/edit.spec.js tests/e2e/seeded/songs/delete.spec.js`

Expected: All tests pass. The edit tests now have independent state. The delete tests are explicitly marked serial.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/seeded/songs/edit.spec.js tests/e2e/seeded/songs/delete.spec.js
git commit -m "test: isolate song edit tests and mark delete tests as serial

Split edit.spec.js into two describe blocks with independent app instances
so the save test's DB mutations don't affect the cancel test. Explicitly
configure delete tests as serial since they share mutable state."
```

---

### Task 4: Strengthen navigation Tab/Shift+Tab assertions

The current tests press Tab and Shift+Tab but only check that `#hotkeys-column` / `#holding-tank-column` are visible — which they always are. The tests should verify the actual behavior: `sendToHotkeys()` assigns the selected song to the first empty hotkey slot, and `sendToHoldingTank()` adds the selected song to the active holding tank.

**Files:**
- Modify: `tests/e2e/seeded/navigation/basic.spec.js:26-88`

- [ ] **Step 1: Rewrite the Tab key test to verify song assignment to hotkeys**

Replace the `'tab key navigation sends to hotkeys'` test (lines 26-56) with:

```javascript
test('tab key sends selected song to hotkeys', async () => {
  // 1) Search for a song and select it
  const searchInput = page.locator('#omni_search');
  await searchInput.fill('Anthrax');
  await searchInput.press('Enter');

  const rows = page.locator('#search_results tbody tr');
  await expect(rows).toHaveCount(1, { timeout: 5000 });

  // 2) Select the row (Tab from search selects first row)
  await page.keyboard.press('Tab');
  const selectedRow = page.locator('#selected_row');
  await expect(selectedRow).toBeVisible({ timeout: 5000 });

  // 3) Verify the selected row has a songid attribute
  const songId = await selectedRow.getAttribute('songid');
  expect(songId).toBeTruthy();

  // 4) Press Tab again to send the selected song to hotkeys
  await page.keyboard.press('Tab');

  // 5) Verify the song was assigned to the first empty hotkey slot
  // sendToHotkeys() finds the first <li> without a songid and assigns it
  const hotkeySlot = page.locator('.hotkeys.active li[songid]').first();
  await expect(hotkeySlot).toHaveAttribute('songid', songId, { timeout: 5000 });

  // Clean up: remove the hotkey assignment
  await page.evaluate(() => {
    document.querySelectorAll('.hotkeys.active li[songid]').forEach(li => {
      li.removeAttribute('songid');
      const span = li.querySelector('.song');
      if (span) span.textContent = '';
    });
  });

  // Reset search
  await page.locator('#reset_button').click();
});
```

- [ ] **Step 2: Rewrite the Shift+Tab test to verify song added to holding tank**

Replace the `'shift+tab key navigation sends to holding tank'` test (lines 58-88) with:

```javascript
test('shift+tab key sends selected song to holding tank', async () => {
  // 1) Search for a song and select it
  const searchInput = page.locator('#omni_search');
  await searchInput.fill('Edie Brickell');
  await searchInput.press('Enter');

  const rows = page.locator('#search_results tbody tr');
  await expect(rows).toHaveCount(1, { timeout: 5000 });

  // 2) Select the row
  await page.keyboard.press('Tab');
  const selectedRow = page.locator('#selected_row');
  await expect(selectedRow).toBeVisible({ timeout: 5000 });

  // 3) Count holding tank items before
  const holdingTankItems = page.locator('.holding_tank.active li');
  const countBefore = await holdingTankItems.count();

  // 4) Press Shift+Tab to send to holding tank
  await page.keyboard.press('Shift+Tab');

  // 5) Verify a new item was added to the holding tank
  await expect(holdingTankItems).toHaveCount(countBefore + 1, { timeout: 5000 });

  // 6) Verify the new item contains the song
  const lastItem = holdingTankItems.last();
  await expect(lastItem).toContainText('Edie Brickell', { timeout: 5000 });

  // Reset search
  await page.locator('#reset_button').click();
});
```

- [ ] **Step 3: Remove the unused `isHotkeysFocused` and `isHoldingTankFocused` variables**

These were computed but never asserted. They're removed by the rewrite above, but double-check no other code references them.

- [ ] **Step 4: Run the navigation spec**

Run: `npx playwright test tests/e2e/seeded/navigation/basic.spec.js`

Expected: All tests pass. If the Tab/Shift+Tab tests fail, it means the navigation functions require a selected row with a `songid` attribute — adjust the setup to ensure one is selected (the Tab from search should do this).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/seeded/navigation/basic.spec.js
git commit -m "test: strengthen Tab/Shift+Tab navigation assertions

Replace visibility-only checks with assertions that verify sendToHotkeys()
actually assigns the song to a hotkey slot and sendToHoldingTank() actually
adds the song to the holding tank."
```

---

## Verification

After all four tasks, run the full suite:

```bash
npx playwright test
```

All tests should pass. The suite should also run faster since we removed unnecessary `resetTestEnvironment()` calls that were re-creating the global database before each suite.
