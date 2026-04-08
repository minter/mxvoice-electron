## What's New Module

Provides guided "What's New" tours using Driver.js to highlight new features after version upgrades. Tours are version-specific and auto-trigger once per profile.

### Structure
```
whats-new/
├── index.js         # Public API: initWhatsNew, showWhatsNew; registers tour helpers
├── tour-manager.js  # TourManager class: version matching, step execution, driver lifecycle
├── tours.js         # Tour data: version-keyed steps with element selectors and descriptions
└── README.md
```

### How It Works

1. **Auto-trigger**: On app load, `TourManager.shouldAutoTrigger()` checks if the current app version has a tour and whether the profile has already seen it.
2. **Manual trigger**: Users can launch the tour from the Help menu ("What's New").
3. **Step execution**: Each step can have `preActions` (e.g., open a modal, scroll to an element) that run before the step is shown, and `skipIfMissing` to gracefully skip steps when target elements don't exist.
4. **Seen tracking**: Once completed or dismissed, the version is added to the profile's `tours_seen` preference.

### Tour Helpers

Helpers are registered in `index.js` and referenced by name in tour step `preActions`:
- `openEditForFirstSong` — Opens the song edit modal with the first song loaded
- `showContextMenuForFirstSong` — Shows context menu for the first search result
- `openPreferencesModal` — Opens the Preferences modal and scrolls to a target element

### Exports

- `initWhatsNew()` — Initialize the module; auto-triggers tour if applicable
- `showWhatsNew()` — Manually launch the tour for the current version

### Usage

```javascript
import { initWhatsNew, showWhatsNew } from './modules/whats-new/index.js';

// During app bootstrap (auto-triggers if new version)
await initWhatsNew();

// From menu item
showWhatsNew();
```

### Adding a Tour for a New Version

Add an entry to `tours.js` keyed by the version string:

```javascript
'4.4.0': {
  title: "What's New in 4.4.0",
  steps: [
    {
      element: '#some-element',
      popover: { title: 'New Feature', description: 'Description here' }
    }
  ]
}
```

### Dependencies

- **Driver.js** — Guided tour library
- **secureElectronAPI** — For version detection and profile preferences
- **Bootstrap helpers** — For opening modals in preActions

### Theming

Tour popover styles adapt to the app's light/dark theme via CSS custom properties defined in `src/stylesheets/colors.css`.
