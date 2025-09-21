# Profile Management Module

The Profile Management module provides user profile functionality for the MxVoice application. It allows multiple users to have their own personalized settings while sharing the same database and directories.

## Module Structure

```
profile-management/
├── index.js              # Main module entry point
├── profile-manager.js    # Profile operations and IPC communication
├── profile-ui.js         # UI components and modals
└── README.md            # This documentation
```

## Features

### Profile Manager (`profile-manager.js`)
- **getAvailableProfiles()** - Get list of all available profiles
- **getActiveProfile()** - Get currently active profile name
- **createProfile(name, description, copyFromCurrent)** - Create a new profile
- **deleteProfile(name)** - Delete a profile
- **switchProfile(name)** - Switch to a different profile
- **shouldShowProfileSelection()** - Check if profile selection should be shown
- **markProfileSelectionShown()** - Mark profile selection as shown

### Profile UI (`profile-ui.js`)
- **showProfileSelectionModal(options)** - Show profile selection modal using static HTML
- **showCreateProfileModal()** - Show create profile modal using static HTML
- **showProfileManagementModal()** - Show profile management modal using static HTML
- **showEditProfileModal(name, description)** - Show edit profile modal using static HTML
- **updateProfileIndicator(profileName)** - Update profile indicator in UI

**Theme Integration**: All modals use static HTML in `index.html` for proper Bootstrap 5 and theme system integration. CSS variables automatically inherit from the app's theme classes.

## Usage

The module exports a pre-initialized singleton. To reinitialize with dependencies (as done during bootstrap), call `reinitializeProfileManagement`.

```javascript
import profileManagement from './modules/profile-management/index.js';

// Reinitialize with dependencies
profileManagement.reinitializeProfileManagement({
  electronAPI: window.electronAPI,
  db: window.db,
  store: window.store
});

// Use functions
const profiles = await profileManagement.getAvailableProfiles();
const activeProfile = await profileManagement.getActiveProfile();
await profileManagement.createProfile('John Smith', 'John\'s profile', true);
```

### Backward compatibility
Named bindings are also exported for direct imports if needed.

## Profile System Architecture

### Profile-Specific Settings
- `fade_out_seconds` - Audio fade duration
- `screen_mode` - Light/dark/auto theme
- `font_size` - User's preferred font size
- `browser_width/height` - Window size preferences
- `window_state` - Complete window state
- `debug_log_enabled` - Debug logging preference
- `prerelease_updates` - Beta/alpha updates preference
- `holding_tank_mode` - Storage vs playlist mode
- `holding_tank` - Current holding tank HTML content
- `hotkeys` - Current hotkeys HTML content

### Global Settings (Shared)
- `music_directory` - Shared music library location
- `hotkey_directory` - Shared hotkey/holding tank files location
- `database_directory` - Shared database location
- `first_run_completed` - Global first-run state
- Database content (songs, categories) - Shared inventory

### Profile Rules
- **Default User**: Special protected profile, cannot be deleted
- **Unique names**: Case-insensitive uniqueness enforced
- **Minimum profiles**: Always at least one profile exists
- **Fallback**: Always fallback to Default User on errors
- **New profiles**: Copy current settings as starting point

## UI Components

All modals are implemented as static HTML in `index.html` with IDs:
- `#profileSelectionModal`
- `#createProfileModal`
- `#profileManagementModal`
- `#editProfileModal`

This approach ensures proper Bootstrap 5 integration and automatic theme inheritance.

### Profile Selection Modal (`#profileSelectionModal`)
Shows available profiles with options to:
- Select existing profile (radio button cards with hover effects)
- Create new profile (if enabled)
- Cancel (if allowed)
- Dynamic content population with theme-aware styling

### Create Profile Modal (`#createProfileModal`)
Allows users to:
- Enter profile name (required, max 50 chars)
- Enter description (optional, max 200 chars)
- Choose to copy settings from current profile
- Form validation with focus management

### Profile Management Modal (`#profileManagementModal`)
Shows all profiles with options to:
- View profile details (creation date, last used)
- Switch to different profiles
- Edit profile names and descriptions
- Delete profiles (except Default User)
- Create new profiles
- Active profile indication with badges

### Edit Profile Modal (`#editProfileModal`)
Allows editing existing profiles:
- Update profile name (with validation)
- Update description
- Preserves original name for API calls

### Profile Indicator
Shows current profile in search header with:
- Profile icon with tooltip
- Current profile name in tooltip
- Click handler to open profile management

## Integration Points

### App Startup
- Check if profile selection should be shown
- Show selection modal if needed
- Auto-select if only one profile exists

### Runtime Switching
- Profile indicator in search header
- Profile menu in main application menu
- Confirmation dialogs for switching

### Error Handling
- Fallback to Default User on errors
- Graceful degradation if profile system fails
- Clear error messages for user actions

## Security Considerations

- Profile names are sanitized for filesystem safety
- Validation prevents invalid profile names
- Protected Default User profile cannot be deleted
- IPC communication uses secure channels

## Future Enhancements

- Profile import/export functionality
- Profile templates and sharing
- Advanced profile management features
- Profile usage analytics
- Profile backup and restore
