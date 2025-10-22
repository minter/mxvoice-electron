# Profile Management Tests

Tests for the profile selection launcher and profile management functionality.

## Overview

These tests verify the profile management system, including:
- Profile selection UI
- Profile creation
- Profile switching
- Profile isolation (preferences don't bleed between profiles)

## Test Structure

### `management.spec.js`

Comprehensive test suite covering all aspects of profile management.

### `state-persistence.spec.js` ⚠️ CRITICAL

**These tests prevent regressions of the data loss bug** where hotkeys and holding tank data were lost during profile operations (duplication, switching).

Test coverage:
- ✅ **Duplication preserves data** - The exact bug scenario (duplicate Profile A → Profile B, switch back to A, verify data persists)
- ✅ **Repeated switching preserves data** - Switch A → B → A → B → A multiple times without data loss
- ✅ **Quit/restart preserves data** - Close app, restart with same profile, data should persist
- ✅ **New profiles start empty** - Fresh profiles should not inherit data from other profiles
- ✅ **state.json structure** - Verify file format is correct after operations

**Root cause of the bug:** Race condition during profile state restoration where partial DOM state was saved during restoration, overwriting good state.json files. The fix introduces a restoration lock (`window.isRestoringProfileState`) that prevents saves during DOM reconstruction.

**These tests MUST pass before releasing any profile-related changes.**

#### Profile Launcher Tests
- **Default profile display**: Verifies "Default User" profile appears on first launch
- **Profile selection**: Tests clicking and selecting profiles
- **App launching**: Tests launching the main app from a selected profile
- **Double-click launch**: Tests double-clicking a profile to launch directly
- **Keyboard navigation**: Tests Enter key to launch after selecting a profile

#### Profile Creation Tests
- **Create new profile**: Tests creating a profile with name and description
- **Auto-selection**: Verifies newly created profiles are auto-selected
- **Name validation**: Tests empty name prevention
- **Duplicate detection**: Prevents creating profiles with duplicate names
- **Modal interactions**: Tests Cancel button, close button, and clicking outside modal
- **Keyboard shortcuts**: Tests Enter key in name field to create quickly

#### Profile Organization Tests
- **Search/filter**: Tests search functionality to filter profiles by name
- **Alphabetical sorting**: Verifies profiles are sorted (Default User always first)

#### Profile Isolation Tests
- **Preferences isolation**: Verifies preferences changes in one profile don't affect another profile
- **Profile switching**: Tests closing app and reopening with a different profile
- **Persistence**: Verifies each profile maintains its own settings across app restarts

## Key Architecture Points

### No `--profile` Argument

Unlike other tests, profile tests **do not** pass `--profile=Default User` when launching:

```javascript
app = await electron.launch({
  args: ['.'], // No --profile argument
  // ...
});
```

This is intentional because we need to test the launcher window itself.

### Isolated Test Environments

Each test uses a unique `userDataDir` to ensure complete isolation:

```javascript
const testId = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
userDataDir = path.join(__dirname, `../../fixtures/test-user-data-${testId}`);
```

This prevents tests from interfering with each other.

### Window Management

Profile tests deal with two windows:
1. **Launcher window** - Shows profile selection
2. **Main app window** - Appears after launching with a profile

Tests use `app.windows()` to manage both windows during profile switching scenarios.

## Running the Tests

```bash
# Run all profile tests
unset ELECTRON_RUN_AS_NODE && yarn test tests/e2e/profiles/

# Run specific test
unset ELECTRON_RUN_AS_NODE && yarn test tests/e2e/profiles/management.spec.js

# Run with UI mode for debugging
unset ELECTRON_RUN_AS_NODE && yarn test:ui tests/e2e/profiles/

# Run in headed mode to watch the launcher
unset ELECTRON_RUN_AS_NODE && yarn test:headed tests/e2e/profiles/
```

## Debugging Tips

### Watch the Launcher Window

Run tests in headed mode to see the launcher window:

```bash
unset ELECTRON_RUN_AS_NODE && yarn test:headed tests/e2e/profiles/management.spec.js
```

### Inspect Test Data

Each test creates isolated directories. Check the fixtures folder during/after test runs:

```bash
ls tests/fixtures/test-user-data-profile-*
```

### Profile Registry Location

Profiles are stored in `userData/profiles.json`. In tests, this is:

```
tests/fixtures/test-user-data-<testId>/profiles.json
```

### Profile Preferences Location

Each profile's preferences are stored in:

```
tests/fixtures/test-user-data-<testId>/profiles/<ProfileName>/preferences.json
```

## Completed Test Coverage

✅ **Profile Duplication** - Covered in `state-persistence.spec.js`
✅ **Hotkey Isolation** - Covered in `state-persistence.spec.js`
✅ **Holding Tank Isolation** - Covered in `state-persistence.spec.js`

## Future Test Additions

Potential areas for expanded test coverage:

1. **Profile Deletion** - When delete functionality is added
2. **Profile Renaming** - When rename functionality is added
3. **Profile Export/Import** - When import/export is added
4. **File Loading (.mrv/.hld)** - Verify loading files doesn't corrupt state
5. **Window State Isolation** - Verify window size/position is per-profile
6. **Last Used Tracking** - Verify profiles track when they were last used
7. **Profile Avatars** - When avatar/icon support is added
8. **Profile Colors** - When custom theming per profile is added

## Related Files

- **Profile Manager**: `src/main/modules/profile-manager.js`
- **Launcher Window**: `src/main/modules/launcher-window.js`
- **Launcher HTML**: `src/launcher.html`
- **Launcher Script**: `src/launcher.js`
- **Launcher Preload**: `src/preload/launcher-preload.js`
- **Main Process**: `src/main/index-modular.js` (profile arg handling)

