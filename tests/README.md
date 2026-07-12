# Testing

This directory contains the test suite for Mx. Voice Electron application.

## Test Structure

- **`e2e/`** - End-to-end tests using Playwright with Electron
- **`fixtures/` - Test data and resources
- **`utils/` - Test utilities and helpers
- **`setup/` - Test environment setup and teardown
- **`config/` - Test configuration files

## Running Tests

```bash
npm test            # All tests
npm run test:unit   # Unit tests without a coverage report
npm run test:unit:coverage # Unit tests with required coverage thresholds
npm run test:no-skips # Reject skipped or fixme tests
npm run test:smoke  # Minimal boot check
npm run test:ui     # Interactive UI mode
npm run test:headed # Headed runs
npm run test:debug  # Debug mode
npm run test:report # Open HTML report
```

## CI Test Policy

Pull requests and pushes to `main` must pass two independent test gates:

1. **Unit and policy gate (Ubuntu)**
   - Installs dependencies with `npm ci`.
   - Builds the context-isolated preload bundle.
   - Rejects all `test.skip`, `test.fixme`, `it.skip`, `describe.skip`, and equivalent skip directives under `tests/`.
   - Runs `npm run test:unit:coverage`, which enforces the thresholds in `vitest.config.js`.
   - Uploads the HTML coverage report for 14 days.
2. **Electron E2E gate (macOS and Windows)**
   - Runs the complete Playwright suite on both supported desktop platforms.
   - Uploads reports, traces, screenshots, and videos when available.

Coverage and E2E results are deliberately separate. Unit coverage measures deterministic code execution and failure paths; Playwright protects real Electron lifecycle, IPC, filesystem, audio-control, and DOM behavior. Passing one gate does not replace the other.

Skipped tests are not allowed. If a scenario cannot run in a particular environment, keep the deterministic state/UI assertions active and condition only the environment-specific measurement, such as physical audio RMS. If that is not possible, replace the scenario with a lower-level contract test before merging.

When coverage rises, raise the thresholds in `vitest.config.js` in the same change. Threshold reductions require an explicit explanation in the pull request.

## Windows-Specific Considerations

The test suite includes platform-specific configurations to handle differences between Windows and macOS/Linux:

### Audio Testing
- **Windows**: Uses increased tolerance (0.05) and longer stabilization times (200ms) for audio measurements
- **macOS/Linux**: Uses standard tolerance (0.01) and shorter stabilization times (100ms)

### Modal Timing
- **Windows**: Extended timeouts (10s) and additional modal dismissal strategies
- **macOS/Linux**: Standard timeouts (5s) and standard modal behavior

### Configuration
Platform-specific settings are automatically applied via `tests/config/test-environment.js`:

```javascript
export const TEST_CONFIG = {
  platform: {
    isWindows: process.platform === 'win32',
    audioStabilizationTime: isWindows ? 200 : 100,
    modalAnimationTime: isWindows ? 500 : 100,
    defaultTimeout: isWindows ? 10000 : 5000,
    audioTolerance: isWindows ? 0.05 : 0.01
  }
  // ... other config
};
```

### Common Windows Issues and Solutions

1. **Audio Level Tests Failing**: Windows audio drivers may have different characteristics
   - Solution: Increased tolerance and stabilization time
   
2. **Modal Dismissal Timeouts**: Bootstrap modals may animate slower on Windows
   - Solution: Extended timeouts and fallback dismissal strategies (Escape key, outside clicks)

3. **Volume Level Tests**: Windows volume control may be less precise
   - Solution: More lenient volume level expectations (5% vs 10% differences)

## Test Isolation

Each test suite runs in complete isolation:
- Separate user data directories
- Isolated database instances
- Clean test fixtures
- No interference with real app data

### Profile Selection

The app requires profile selection on startup. Tests bypass the launcher window by passing `--profile=Default User` as a command line argument:

```javascript
app = await electron.launch({
  args: ['.', '--profile=Default User'],
  env: { /* ... */ }
});
```

This allows tests to launch directly into the main app without requiring manual profile selection.

## Audio Testing

Audio tests use real audio measurements when running locally:
- RMS level monitoring
- Volume relationship verification
- Fade-out pattern analysis

On CI environments, audio state and UI assertions still run; only physical RMS measurements that require an audio device are omitted.

## Troubleshooting

### Windows-Specific Issues
- If audio tests fail, check that audio drivers are working properly
- For modal timeouts, ensure the system isn't under heavy load
- Volume tests may need adjustment based on your audio hardware

### General Issues
- Ensure test environment is properly isolated
- Check that all test dependencies are installed
- Verify Electron is accessible in the test environment

## References

- [Playwright Electron Testing](https://playwright.dev/docs/api/class-electron)
- [Electron Testing Guide](ELECTRON_TESTING_GUIDE.md)
