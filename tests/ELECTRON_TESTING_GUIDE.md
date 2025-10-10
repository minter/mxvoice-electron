## Electron Testing with Playwright

### Overview
- Tests launch the real Electron app using Playwright’s Electron driver.
- Each suite runs in an isolated user profile so your real data is never touched.
- We have two styles of tests:
  - Minimal smoke check to ensure the app boots and renders
  - Scenario tests (e.g., first‑run flow) that validate real user behavior

### Isolation Model
- Main process honors `APP_TEST_MODE=1` and an optional `E2E_USER_DATA_DIR` to override `app.getPath('userData')` very early in startup.
- Tests pass a clean `E2E_USER_DATA_DIR`, and also set `HOME` and `APPDATA` to temp dirs to prevent legacy config migration.
- See `src/main/index-modular.js` for the early `app.setPath('userData', ...)` logic.

### Profile Selection
- The app now requires profile selection on startup (via the launcher window).
- Tests bypass the launcher by passing `--profile=Default User` as a command line argument.
- This allows tests to launch directly into the main app without manual profile selection.
- See `src/main/index-modular.js` (around line 898) for the profile argument handling logic.

### Running Tests
```bash
yarn test            # All tests
yarn test:smoke      # Minimal boot check
yarn test:ui         # Interactive UI mode
yarn test:headed     # Headed runs
yarn test:debug      # Debug mode
yarn test:report     # Open HTML report
```

### How Suites Launch the App
```js
import { _electron as electron, test } from '@playwright/test';
import { TEST_CONFIG } from './config/test-environment.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

test.beforeAll(async () => {
  const userDataDir = TEST_CONFIG.testAppDirs.userDataDirectory;
  if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true, force: true });
  fs.mkdirSync(userDataDir, { recursive: true });
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mxv-home-'));

  app = await electron.launch({
    args: ['.', '--profile=Default User'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      APP_TEST_MODE: '1',
      DISABLE_HARDWARE_ACCELERATION: '1',
      AUTO_UPDATE: '0',
      E2E_USER_DATA_DIR: userDataDir,
      HOME: fakeHome,
      APPDATA: fakeHome,
    },
  });
  page = await app.firstWindow();
});
```

### Current Suites
- `tests/e2e/smoke.spec.js`
  - Verifies the app boots and the main window renders content
- `tests/e2e/first-run.spec.js`
  - Validates first‑run flow end‑to‑end:
    - First‑run modal appears and can be dismissed
    - Empty search returns the seeded “Rock Bumper”
    - Double‑click plays the track; stop button stops playback
    - Timer/duration counters progress during playback
    - DB file and sample MP3 are created under isolated `userData`

### Notes
- Do not start the app manually; tests own the lifecycle.
- Avoid using Node/Electron APIs directly in the renderer; our app uses secure preload IPC. Tests interact via DOM/UI.
- When adding scenario suites that require preset data, create fixtures under `tests/fixtures/` and point the app to them via the store or initial setup in a dedicated global setup step.

### Audio measurements (local vs CI)
Some playback tests perform real audio checks using renderer tap helpers (`rms(page)`, `waitForAudible(page)`, `waitForSilence(page)`). To keep CI reliable:

- On GitHub Actions: audio tap checks are skipped; tests assert UI state and timing instead (e.g., waiting for fade‑out completion).
- Locally: full audio verification runs (audible/silence verification, volume relationship checks, fade‑out sampling).

Tip: To mimic CI locally, run with `CI=true`:
```bash
CI=true yarn test
```

### Troubleshooting
- If you see your real data, ensure the suite sets `APP_TEST_MODE=1`, `E2E_USER_DATA_DIR`, and temp `HOME/APPDATA`.
- Use `yarn test:ui` or `yarn test:headed` to inspect UI state live.

### References
- Playwright Electron: https://playwright.dev/docs/api/class-electron
