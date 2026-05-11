# Analytics Integration Design

## Overview

Add anonymous product analytics to Mx. Voice using PostHog (cloud free tier) to answer three questions: how many people use the app, which features they use, and whether the app is stable.

## Decisions

- **Provider**: PostHog cloud (free tier: 1M events/month). Self-hosted Docker migration path available if needed.
- **Consent model**: Opt-out with transparency. Analytics enabled by default; users informed on first run and can disable in Preferences.
- **Architecture**: PostHog Node.js SDK in the main process only. Renderer communicates via IPC, consistent with existing patterns.
- **Identity**: Anonymous random UUID per device, stored in electron-store. No PII collected.

## Events

### Usage / Scale

| Event | Properties | Purpose |
|-------|-----------|---------|
| `app_launched` | `app_version`, `os`, `arch`, `electron_version` | Count users, track version adoption |
| `app_closed` | `session_duration_seconds` | Understand session length |

A stable anonymous `distinct_id` (UUID) stored in electron-store as `analytics_device_id` enables unique user counting.

### Feature Adoption

| Event | Properties | Purpose |
|-------|-----------|---------|
| `song_played` | `trigger_method` (hotkey, button, search_result, holding_tank, playlist) | Which playback methods are popular |
| `search_performed` | `result_count` | How often search is used, how useful results are |
| `hotkey_configured` | none | Hotkey feature adoption |
| `holding_tank_used` | `action` (add, remove, clear) | Holding tank engagement |
| `playlist_used` | `action` (create, play) | Playlist feature adoption |
| `category_browsed` | none | Category navigation usage |
| `waveform_viewed` | none | Waveform visualizer adoption |
| `preferences_changed` | `setting_name` (not value) | Which settings users care about |
| `profile_switched` | none | Multi-profile usage |
| `library_imported` | `song_count` | Library growth patterns |
| `auto_update_action` | `action` (accepted, deferred, prerelease_opted_in) | Update adoption behavior |

### Stability

| Event | Properties | Purpose |
|-------|-----------|---------|
| `app_error` | `error_message`, `stack_trace` (scrubbed of file paths) | Uncaught exceptions in main process |
| `renderer_error` | `error_message`, `stack_trace` (scrubbed of file paths) | Uncaught exceptions in renderer |

### Privacy boundaries

Never collected: song names, file paths, search query text, user-entered text, IP-derived location (PostHog config), or any PII.

## Architecture

```
Renderer
  │
  │  secureElectronAPI.trackEvent('song_played', { method: 'hotkey' })
  ▼
IPC Handler (analytics:track-event)
  │
  ▼
src/main/analytics.js  ──►  PostHog Node SDK  ──►  PostHog Cloud
  │
  ├─ init(): Initialize SDK, load device ID, check opt-out state
  ├─ trackEvent(name, properties): Send event (no-op if opted out)
  ├─ getOptOutStatus(): Return current opt-out boolean
  ├─ setOptOut(boolean): Toggle opt-out, persist to electron-store
  └─ shutdown(): Flush pending events on app quit
```

### Components

**`src/main/analytics.js`** — Analytics module wrapping PostHog SDK.

- Initializes PostHog with project API key (stored as constant, not secret — PostHog client keys are public by design).
- Manages device ID: generates UUID on first run, persists in electron-store as `analytics_device_id`.
- Respects opt-out: checks `analytics_opt_out` in electron-store. When true, all tracking calls are no-ops. Uses PostHog's built-in `opt_out_capturing()` method.
- Scrubs stack traces of local file paths before sending error events.
- Flushes pending events on `app.on('before-quit')`.

**IPC handlers** (added to existing IPC handler setup):

- `analytics:track-event` — accepts `{ name, properties }`, forwards to analytics module.
- `analytics:get-opt-out-status` — returns boolean.
- `analytics:set-opt-out` — accepts boolean, updates analytics module and electron-store.

**Preload / secure API** — Extend existing secure API exposure with:

- `trackEvent(name, properties)` — invokes `analytics:track-event`.
- `getAnalyticsOptOut()` — invokes `analytics:get-opt-out-status`.
- `setAnalyticsOptOut(value)` — invokes `analytics:set-opt-out`.

**Renderer instrumentation** — One-liner calls added at natural action points in existing feature modules. No new files in renderer for this; calls go inline where actions already happen.

## User Consent

### First-run notification

On first launch (when `first_run_completed` is `false`), display a non-blocking informational banner/dialog:

> "Mx. Voice collects anonymous usage data to help improve the app — things like which features are used and crash reports. No personal information is collected. You can disable this anytime in Preferences."

Two actions: **"OK"** (dismiss) and **"Disable Analytics"** (opts out and dismisses).

This is not a blocking modal — the app is usable behind/around it.

### Preferences toggle

Add to the existing Preferences modal:

- **Send anonymous usage data** — checkbox, default on.
- Help text: "Helps improve Mx. Voice. No personal data is collected."

Toggling calls `setAnalyticsOptOut()` via the secure API, which immediately silences all tracking.

## Dependencies

One new npm package: `posthog-node` (PostHog Node.js SDK).

## Configuration

PostHog project API key stored as a constant in `src/main/analytics.js`. PostHog client-side API keys are public by design (they identify the project, not authenticate).

New electron-store keys:

- `analytics_device_id` (string, UUID) — generated on first init
- `analytics_opt_out` (boolean, default `false`) — user preference

## Testing

- Unit tests for the analytics module: verify events are sent when opted in, suppressed when opted out, device ID is stable across restarts.
- Integration test: verify the first-run banner appears, the preferences toggle works, and opting out silences network calls.
- Manual verification: check PostHog dashboard receives events after integration.
