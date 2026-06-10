# In-App Announcements & Email Updates — Design Spec

**Date:** 2026-04-09
**Branch:** `feature/announcements` (off `feature/audio-enhancements`, will land in 4.3.0 or later)
**Status:** Draft — awaiting implementation plan

---

## Problem

Mx. Voice has a real user base, but essentially no way to communicate with those users between releases. The existing channels are:

- **Auto-update release notes modal** (`src/main/index-modular.js:937`, `src/renderer/modules/event-coordination/ui-interaction-events.js:86`). Fires when the auto-updater detects a new version. Only the one human at the keyboard during that detection sees it.
- **GitHub release notes page.** Requires users to know it exists and visit it.
- **The per-profile "What's New" Driver.js tour.** Solves feature-discovery on update, but is tied to release cadence and can't carry urgent or between-release messages.

What's missing is a general-purpose, per-profile, broadcast channel — a way to reach all users (or a targeted subset) with anything from "a new version shipped" to "Dropbox sync is broken, workaround is X" to "here's a useful tip" — on a cadence decoupled from releases.

## Goals

1. A per-profile, broadcast content stream that reaches every profile on every machine, independent of who happened to be at the keyboard during auto-update.
2. Support multiple kinds of content: release news, urgent operational notices, feature tips, community updates.
3. Optional email channel for users who want push notifications, without requiring accounts or breaking the app's anonymous-by-default posture.
4. Clean authoring workflow — publishing a new announcement should feel like committing a file, not operating a CMS.
5. Reuse existing infrastructure wherever possible (DOMPurify markdown rendering, `tours_seen` preference pattern, PostHog analytics, modal component, GitHub Actions).
6. Instrument engagement with PostHog so we can tell whether the channel is working.

## Non-Goals

- **User accounts or authentication.** The app is anonymous-by-default by design; this system must not change that.
- **Two-way communication / in-app replies.** This is broadcast only. Feedback happens elsewhere (GitHub issues, email to a contact address).
- **Unifying release-notes content across the auto-update modal and the announcement system.** They serve different jobs (decision prompt vs broadcast stream); forcing DRY between them introduces coupling without benefit.
- **Per-user targeting within a profile.** We can't identify the human at the keyboard, so we don't try.
- **A retraction/unsend flow for email.** Once sent, it's sent. Publish a follow-up if you need to correct.
- **Localization.** Mx. Voice is English-only; adding i18n to announcements is out of scope.

## Solution Overview

Announcements are **markdown files in git**, with YAML frontmatter declaring title, date, severity, audience targeting, and whether to also send via email. A `manifest.json` derived from those files is fetched by the app on launch. A GitHub Action rebuilds the manifest and (for files flagged `email: true`) sends them to a Mailgun mailing list.

Two delivery surfaces share one content source:

1. **In-app** — per-profile "seen" tracking, severity-driven UI (bell icon + panel + banner + urgent modal), offline cache, version-targeted via `audience` frontmatter.
2. **Email** — opt-in subscription via in-app form, Mailgun mailing list with double opt-in, sent by the same GitHub Action that publishes in-app content.

The two channels are complementary but independent: every announcement goes in-app; only some also go to email. Subscribers who want push notifications get them; everyone else gets in-app-only.

The existing auto-update release notes modal stays as-is — it's a decision prompt at install time, not a broadcast channel, and conflating it with announcements would lose that distinction. Release-day authoring involves two parallel artifacts: the GitHub release (feeds auto-update modal) and an announcement markdown file (feeds the announcement system). They may have similar content with different tone; enforcing identity is a non-goal.

---

## Data Model

### Announcement file

Each announcement is a markdown file at `announcements/YYYY-MM-DD-slug.md` in the `mxvoice-electron` repo, with YAML frontmatter:

```markdown
---
id: 2026-04-15-dropbox-outage           # optional; defaults to filename stem
title: Dropbox sync temporarily unavailable
published: 2026-04-15T14:00:00Z         # ISO 8601 UTC
expires: 2026-04-20T00:00:00Z           # optional; hides from app after this date
severity: urgent                         # info | feature | urgent
audience:                                # optional; omit for "everyone"
  min_version: 4.2.0
  max_version: 4.3.1
  platforms: [darwin, win32, linux]
email: true                              # whether to also send via Mailgun
---

Dropbox's OAuth endpoint is returning errors for some users. We're tracking
it [on the status page](https://status.dropbox.com). As a workaround, you
can re-link your Dropbox account under Preferences → Integrations.
```

**Field semantics:**

| Field | Required | Notes |
|---|---|---|
| `id` | No | Defaults to filename stem (`2026-04-15-dropbox-outage.md` → `2026-04-15-dropbox-outage`). Explicit override allowed if a file gets renamed and you don't want email resend. |
| `title` | Yes | Shown in panel list, banner, urgent modal, and email subject line. |
| `published` | Yes | ISO 8601 UTC. Drives sort order and "N days ago" display. |
| `expires` | No | If set, announcements disappear from the in-app UI after this date. Email already sent is unaffected. |
| `severity` | Yes | `info`, `feature`, or `urgent`. Drives UI treatment — see In-App UI section. |
| `audience` | No | Client-side filter. Omit for universal. |
| `audience.min_version` / `max_version` | No | SemVer range, inclusive. Matched against the running app version. |
| `audience.platforms` | No | Array of `process.platform` values: `darwin`, `win32`, `linux`. |
| `email` | No | Defaults to `false`. When `true`, the publishing GitHub Action sends this to the Mailgun list. |

### Manifest

`announcements/manifest.json` — derived by the publishing GitHub Action from all `.md` files in `announcements/`, sorted by `published` descending. Shape:

```json
{
  "schema_version": 1,
  "generated_at": "2026-04-15T14:05:22Z",
  "announcements": [
    {
      "id": "2026-04-15-dropbox-outage",
      "title": "Dropbox sync temporarily unavailable",
      "published": "2026-04-15T14:00:00Z",
      "expires": "2026-04-20T00:00:00Z",
      "severity": "urgent",
      "audience": { "min_version": "4.2.0", "max_version": "4.3.1" },
      "path": "announcements/2026-04-15-dropbox-outage.md"
    }
  ]
}
```

The manifest does **not** include announcement bodies — those are fetched lazily when the user opens an announcement. This keeps the startup fetch small (a few KB) even as the announcement archive grows.

`schema_version` lets future format changes coexist with old app versions — if a client sees a version it doesn't understand, it silently ignores the manifest and keeps its cache.

### Publishing ledger

`announcements/sent.json` — tracks which announcement IDs have been sent via email, so the publishing GitHub Action doesn't resend on manifest regeneration:

```json
{
  "sent": [
    { "id": "2026-04-15-dropbox-outage", "sent_at": "2026-04-15T14:05:30Z" }
  ]
}
```

Committed back to the repo by the GitHub Action. Human-editable if you ever need to force a resend (remove the entry, trigger the workflow).

---

## In-App UI

### Severity → treatment mapping

| Severity | Treatment | Dismissal | Example |
|---|---|---|---|
| `urgent` | Blocking modal on next launch, one per unseen urgent announcement | Click "Got it" to mark seen for current profile | "Critical crash bug — don't upgrade to 4.3.0 until 4.3.1 ships" |
| `feature` | Dismissible banner at top of main window | × button, or clicking body opens the detail view | "4.3.0 is out — here's what's new" |
| `info` | Bell icon badge + entry in announcements panel | Marked seen when detail view is expanded | "Tip: drag songs between hotkey tabs" |

### Bell icon (persistent entry point)

A bell icon lives in the top chrome of the main window, near existing top controls. Exact placement will be chosen during implementation by inspecting the current chrome layout. It's always visible: prominent with a red badge + count when there are unread announcements, subtle (muted color, no badge) when there are none. Clicking opens the announcements panel.

The bell is always present rather than appearing only when unread, so the "news center" is a discoverable permanent affordance — users can browse past announcements even when nothing is new.

### Announcements panel

A panel or modal listing announcements in reverse-chronological order. Unread items are bold; read items are muted. Severity is shown as a badge. Clicking an item expands it inline (or opens a detail view) and renders the markdown body via the **existing DOMPurify pipeline** from release notes (`src/renderer/modules/event-coordination/ui-interaction-events.js:86`). No new sanitization code; no new attack surface.

At the bottom of the panel, a persistent muted-color line:

> 📧 *Want release news and important updates by email?* **Subscribe**

This CTA is always visible regardless of whether anyone has ever subscribed from this machine — see the Email Subscription section for the rationale.

### Urgent modal

When a new `urgent` announcement arrives, it shows as a blocking modal on next launch for any profile that hasn't seen it yet. Reuses the existing release-notes modal component (only the content source differs). Single "Got it" button marks seen for the current profile. If multiple urgent announcements are unseen, they queue one at a time — each dismissed individually. (In practice we don't expect multiple simultaneous urgents, but the queue is simple enough to build.)

### Feature banner

For `feature` severity, a thin dismissible banner at the top of the main window:

```
┌──────────────────────────────────────────────────────────┐
│ 🎉 Mx. Voice 4.3.0 is out! See what's new          ×  │
└──────────────────────────────────────────────────────────┘
```

Clicking the body opens the detail view in the panel. × dismisses the banner and marks seen for the current profile. One banner at a time — if multiple unread `feature` announcements exist, the newest shows in the banner and older ones remain accessible via the panel.

The feature banner is **additional to** the existing "What's New" Driver.js tour, not a replacement. The tour is an interactive walkthrough of specific UI changes; the banner is a static "here's the news" entry point. They complement each other: the banner links to the release announcement, the tour walks the user through changed UI.

### Multi-announcement precedence on launch

1. All unacknowledged `urgent` items → queue of modals, one at a time.
2. Newest unread `feature` item → banner.
3. All unread `info` items → contribute to the bell badge count.

### Accessibility

All new components (bell icon, badge, panel, banner, modal) support keyboard navigation and include ARIA labels. Badge counts are exposed as `aria-label="3 unread announcements"` rather than solely via visual treatment. The bell icon is focusable and activatable via Space/Enter. The feature banner × button is focusable. Reuse existing modal patterns, which presumably already handle focus trap and Escape dismissal.

---

## Email Subscription

### Design constraint: the fuzzy-user problem

Because the app has no auth and multiple humans may share a profile, **the app fundamentally cannot know whether the person currently at the keyboard has already subscribed**. Any local "you're subscribed" state would lie to somebody.

The implication: **the signup CTA is always visible**, regardless of prior subscribe attempts from this machine. Already-subscribed users ignore it; unsubscribed users (who may be a new human on a shared profile) can act on it. Mailgun handles deduplication.

This means:

- **No local `email_signup_completed` preference.** Don't track it.
- **No "Subscribe" → "You're subscribed" state swap.** The CTA text stays constant.
- **"Already subscribed" response from Mailgun is treated as success**, with friendly messaging: *"You're already subscribed — check your inbox if you haven't confirmed yet."*

### Entry points

Multiple passive placements, no intrusive prompts:

1. **Help menu → "Get Email Updates…"** — primary, always available. Consistent with the existing "Release Notes" item at `src/main/modules/app-setup.js:667`.
2. **Bottom of the announcements panel** — contextual discovery for users who are already engaged with announcements.
3. **Footer of the auto-update release notes modal** — natural moment of engagement when a user sees release news.
4. **Final step of the "What's New" Driver.js tour** — after feature discovery, a single-line CTA.

All four are non-blocking, text-link style. A user who has subscribed will stop noticing them; users who haven't can find them easily. We can cut placements later if telemetry shows fatigue, but erring on the side of more discoverable is correct for the fuzzy-user case.

### Signup dialog

A simple modal triggered from any entry point:

```
┌─ Get Mx. Voice updates by email ──────────────────┐
│                                                   │
│  We'll email you when there's a new release,     │
│  a critical bug, or other important news.         │
│  A few times a year. Not a marketing list.        │
│                                                   │
│  Email: [ ___________________________ ]           │
│                                                   │
│  ☐ Include my Mx. Voice version and OS            │
│    (helps us target relevant updates to you)      │
│                                                   │
│  [Cancel]                        [Subscribe]      │
│                                                   │
│  You can unsubscribe any time via the link in     │
│  any email. Delivered via Mailgun.                │
└───────────────────────────────────────────────────┘
```

The version/OS checkbox is **opt-in and off by default**. If checked, those values are sent to Mailgun as list-member variables, enabling later segmentation (e.g., "only email users on ≤4.2.0"). If unchecked, the list row contains only the email address.

### Submit flow

1. Renderer validates email format inline; disables button on invalid/empty.
2. On submit, renderer calls `window.secureElectronAPI.announcements.subscribe(email, { version?, platform? })`.
3. Main process calls Mailgun Mailing Lists API: `POST /v3/lists/{list}/members` with `address`, optional `vars` (version, platform), and `subscribed=true`. **The Mailgun API key lives only in main.**
4. Mailgun list is configured with **double opt-in enabled** — Mailgun sends a confirmation email; the address isn't active until the user clicks the link.
5. Success → dialog shows: *"Check your email to confirm your subscription."* then closes on OK.
6. "Already subscribed" (Mailgun returns 400 with a specific error code) → dialog shows: *"You're already subscribed. Check your inbox if you haven't confirmed yet."* — **treated as success**, not an error.
7. Network failure → *"Couldn't reach the server. Try again?"* with a retry button.
8. Other failure → generic error with fallback contact email.

### Mailgun list setup (one-time, manual)

- Create a list (e.g., `announcements@mg.mxvoice.app`).
- Enable **double opt-in**.
- Configure the confirmation email template with Mx. Voice branding.
- Configure the unsubscribe footer template (Mailgun fills `%unsubscribe_url%` automatically).
- Access level: restricted — only API/dashboard can send.

### Unsubscribe

Handled entirely by Mailgun. Every sent email includes the `List-Unsubscribe` header and a visible unsubscribe link in the footer. No unsubscribe UI in the app. Mailgun is the source of truth for who's subscribed; the app never asks or stores that information.

### What the app does NOT store

- The email address after submit. It leaves the device once and is forgotten.
- Any "subscribed" state. The CTA is unconditionally present.
- Any link between the user's email and their PostHog device ID (see Privacy Boundary).

---

## Publishing Workflow

The authoring story: **write a markdown file, commit, push**. Everything else is automated.

### End-to-end flow

```
     ┌─ author ───────────────────────────────────┐
     │  1. Write announcements/                   │
     │     YYYY-MM-DD-slug.md with frontmatter    │
     │  2. git commit && git push                 │
     └───────────────────┬────────────────────────┘
                         ▼
     ┌─ GitHub Action (on push to main,           │
     │  triggered by changes under announcements/)│
     │  3. Regenerate manifest.json from all .md  │
     │  4. For each .md not in sent.json with     │
     │     email: true: render + send via Mailgun │
     │  5. Append to sent.json                    │
     │  6. Commit manifest.json + sent.json back  │
     │     with [skip ci]                         │
     └───────────────────┬────────────────────────┘
                         ▼
     ┌─ delivery ─────────────────────────────────┐
     │  7a. Subscribers → email (Mailgun)         │
     │  7b. All users → in-app on next launch     │
     │      (via manifest.json fetch)             │
     └────────────────────────────────────────────┘
```

### GitHub Action

`.github/workflows/publish-announcements.yml`, triggered on push to `main` when files under `announcements/` change. The workflow runs a Node script at `scripts/publish-announcements.mjs` that:

1. **Reads all `.md` files** in `announcements/`, parsing frontmatter with `gray-matter`.
2. **Regenerates `announcements/manifest.json`** — sorted by `published` descending, trimmed to the current schema. Manifest is derived, never hand-edited.
3. **Loads `announcements/sent.json`**.
4. **For each `.md` file:**
   - Skip if `id` is already in `sent.json`.
   - Skip if `email` frontmatter is not `true`.
   - Render markdown → HTML using `marked` (or similar); wrap in the email template at `scripts/email-template.html`.
   - Generate plain-text fallback.
   - POST to Mailgun `/v3/{domain}/messages`: `from`, `to: list address`, `subject: frontmatter.title`, `html`, `text`.
   - On success, append `{ id, sent_at }` to `sent.json`.
5. **Commit `manifest.json` and `sent.json` back** to `main` with `chore: publish announcements [skip ci]`. The `[skip ci]` prevents the workflow from re-triggering itself.

### Secrets

- `MAILGUN_API_KEY` — stored in GitHub Actions repository secrets. Never committed.
- `MAILGUN_DOMAIN` and `MAILGUN_LIST_ADDRESS` — can be committed as workflow env vars or stored as repo variables, not secret.

### Local escape-hatch script

`scripts/publish-announcements.mjs` is runnable locally for testing and manual operations:

- `node scripts/publish-announcements.mjs --dry-run` — renders what would be sent, prints HTML, no network calls.
- `node scripts/publish-announcements.mjs --send` — actually sends (reads `MAILGUN_API_KEY` from local env or gitignored `.env`).
- `node scripts/publish-announcements.mjs --resend <id>` — force resend of a specific announcement (removes from `sent.json` in-memory and runs normal flow).

The action and the local script share the same module — no duplicated logic.

### Email template

A single HTML template at `scripts/email-template.html`, email-compatible (inline styles, table-based layout). Structure:

- Header: "Mx. Voice Announcement" (optional logo).
- Content slot: `{{body}}`.
- Footer: *"You're receiving this because you subscribed to Mx. Voice announcements. [Unsubscribe](%unsubscribe_url%)"* — Mailgun substitutes `%unsubscribe_url%` at send time.

Minimal, not a marketing template. Don't build an email design system for this.

### Mailgun sandbox mode (testing)

The publish script defaults to **sandbox mode**, sending to Mailgun's sandbox subdomain which only delivers to pre-authorized test addresses (configured in the Mailgun dashboard). Production sending must be explicitly opted into.

Resolution logic:

- If `MAILGUN_MODE=production` is set in the environment → production. Used by the GitHub Actions workflow via workflow-level env.
- If `MAILGUN_MODE=sandbox` is set → sandbox. Used for explicit override.
- Otherwise → sandbox (the safe default).

In practice:
- **Local `node scripts/publish-announcements.mjs --send` on a developer machine** → sandbox by default. You authorize your own email address in the Mailgun dashboard and test the full rendering and delivery flow without touching real subscribers.
- **GitHub Actions production workflow** → sets `MAILGUN_MODE=production` in its workflow env, actually sending to the real list.
- **GitHub Actions PR preview or manual-dispatch test runs** → don't set `MAILGUN_MODE`, default to sandbox.

Results of sandbox sends appear in Mailgun's Sending → Logs view in the dashboard so you can verify template rendering, subject line, and unsubscribe link placement before any real subscriber sees anything. Zero marginal cost, ~20 lines of branching in the script.

### Non-goal: unifying with GitHub release notes

When you cut a release, you publish **two** artifacts:

1. The GitHub release (with release notes in the body), which feeds the auto-update modal for installing users.
2. An announcement markdown file with `severity: feature` and `email: true`, which feeds the announcement system for all profiles.

The content can be similar (copy-paste) or deliberately differ in tone. Do not build machinery to keep them in sync. The tiny authoring tax (~90 seconds per release) is worth avoiding the coupling.

---

## Relationship to Existing Auto-Update Release Notes Modal

The existing flow at `src/main/index-modular.js:937` and `src/renderer/modules/event-coordination/ui-interaction-events.js:86` **stays as-is**. Its job is distinct from the announcement system:

| | Auto-update release notes modal | Announcement system |
|---|---|---|
| **Job** | Decision prompt: "new version available, install now?" | Broadcast content stream |
| **Audience** | One human at the keyboard during update detection | Every profile on the machine, independently |
| **Content source** | GitHub release body | Markdown file in `announcements/` |
| **Cadence** | Tied to release binary | Independent, any time |
| **Dismissal** | User clicks install/later | Per-profile seen tracking |

### Expected overlap (intentional)

A user who installs 4.3.1 via the auto-update flow will see release notes in the auto-update modal **and** then see the "4.3.1 is out" announcement banner after the update installs. This is two-beat UX, not duplication:

1. **Decision:** "new version available, here's what's in it, install?" → clicks install.
2. **Confirmation (per profile):** "4.3.1 is installed, here's what's new." → each profile that logs in sees this independently.

**Do not "optimize" this** by suppressing announcement banners when the auto-update modal was seen on the same machine. The overlap is correct behavior — the announcement is the per-profile canonical release notification, and suppressing it based on the installer's modal would defeat per-profile delivery for everyone else.

### Timing lag (acceptable)

There's a small window after update install, before the app's first manifest fetch, where the 4.3.1 announcement isn't yet visible. In practice this is seconds. If it ever becomes a real issue, we can trigger a manifest refetch as part of the post-update launch — a one-line enhancement, not planned for initial implementation.

---

## Per-Profile Seen Tracking

Mirrors the existing `tours_seen` pattern at `src/renderer/modules/whats-new/tour-manager.js:40-52`:

- Preference key: `announcements_seen`
- Storage: per-profile via `window.secureElectronAPI.profile.getPreference('announcements_seen')` / `setPreference('announcements_seen', ...)`
- Shape: array of announcement IDs (strings)

An announcement is marked seen for the current profile when:

- **`urgent`**: user clicks "Got it" on the modal.
- **`feature`**: user clicks × on the banner, **or** expands the detail view in the panel.
- **`info`**: user expands the detail view in the panel.

On launch, the renderer computes unread = `manifest.announcements.filter(a => !seen.includes(a.id) && passesAudienceFilter(a) && !isExpired(a))`. This determines badge count, banner visibility, and urgent modal queue.

**Not transmitted.** Seen tracking stays entirely local. Never sent to PostHog, never sent to Mailgun, never leaves the machine.

---

## Manifest Fetch & Cache

### Remote source

The manifest lives at a GitHub raw URL: `https://raw.githubusercontent.com/minter/mxvoice-electron/main/announcements/manifest.json`. Individual announcement markdown files at `https://raw.githubusercontent.com/minter/mxvoice-electron/main/announcements/<path-from-manifest>`.

GitHub raw has implicit CDN caching and a 300 req/min unauthenticated limit per file — well within our needs even at scale.

### Fetch behavior

- **On app launch**, schedule a manifest fetch ~3 seconds after main window ready (non-blocking — never gates startup on the network).
- **Periodic refetch** every 6 hours while the app is running, for long sessions.
- **Lazy body fetch** — individual announcement markdown files are fetched only when the user opens an announcement. Not prefetched on launch.
- **Local cache** — fetched manifest and fetched bodies are persisted to disk (under the app's user data directory) so offline launches show the last-known-good state.
- **Network failure is silent and non-fatal** — log to debug, show cached content (or nothing if no cache), continue normally.
- **Schema version mismatch** — if the fetched manifest has a `schema_version` the client doesn't recognize, ignore it and keep using the cache. Don't crash, don't show an error.

### Implementation location

A new main-process module at `src/main/modules/announcements.js` handles fetch, cache, and the audience-filter evaluation. Exposed to the renderer via a new `window.secureElectronAPI.announcements` namespace in `src/preload/modules/secure-api-exposer.cjs`, with methods:

- `getManifest()` → Promise<Manifest> — returns cached manifest, triggers refetch if stale.
- `getAnnouncementBody(id)` → Promise<string> — returns markdown body, fetching and caching if needed.
- `subscribe(email, vars)` → Promise<{ ok, code, message }> — posts to Mailgun.

Per-profile seen tracking stays in the renderer (using the existing profile preference API) — it's per-profile state, not per-device.

---

## PostHog Instrumentation

Use the existing `trackEvent` API at `src/main/modules/analytics.js:85` (exposed via `window.secureElectronAPI.analytics.trackEvent(name, properties)` at `src/preload/modules/secure-api-exposer.cjs:509`, handled at `src/main/modules/ipc-handlers.js:2518`). Event names follow existing `snake_case` past-tense conventions (`app_launched`, `song_played`, `auto_update_action`, etc.).

### Events

| Event name | When it fires | Properties |
|---|---|---|
| `announcement_viewed` | User expands the detail view for an announcement | `id`, `severity`, `source` (`panel` / `banner_click` / `urgent_modal`) |
| `announcement_dismissed` | User dismisses a banner (× button) or acknowledges an urgent modal | `id`, `severity`, `source` (`banner_x` / `urgent_got_it`) |
| `announcement_cta_clicked` | User clicks any "Subscribe by email" CTA | `source` (`help_menu` / `panel_footer` / `release_modal_footer` / `tour_final_step`) |
| `announcement_subscribe_completed` | Mailgun subscribe call returned success (or "already subscribed") | `result` (`new` / `already_subscribed`), `included_metadata` (boolean — whether version/OS was sent) |

### What we deliberately don't send

- **The email address.** Never sent to PostHog under any circumstance.
- **Announcement body content.** Only the ID and severity.
- **Any link between PostHog device ID and Mailgun list membership.** See Privacy Boundary.

### Value of these events

- `announcement_viewed` tells us whether the in-app channel is working at all (are people reading them?).
- `announcement_cta_clicked` by `source` tells us which placement is discoverable. If `panel_footer` gets 0 clicks and `help_menu` gets 50, we can remove the panel footer.
- `announcement_subscribe_completed` tells us conversion rate from CTA click to actual subscription.
- The absence of events is a signal too: a `feature`-severity announcement with many `announcement_viewed` but few `announcement_subscribe_completed` tells us the release announcement reached people but didn't convert. That's useful.

---

## Privacy Boundary

Stated explicitly because it would be easy to accidentally violate during implementation:

1. **The email address goes to Mailgun and nowhere else.** It is not stored in the app, not sent to PostHog, not logged in debug logs.
2. **The PostHog device UUID goes to PostHog and nowhere else.** It is never sent to Mailgun, never included in Mailgun list-member variables.
3. **Per-profile `announcements_seen` stays entirely local.** Never transmitted anywhere.
4. **Manifest and body fetches are anonymous GitHub requests** — no custom headers, no identifying information. GitHub's own logs will see the source IP, which is unavoidable but not more identifying than any other network request the app already makes.
5. **Opt-in metadata (version/OS) in the subscribe form is off by default.** Only sent to Mailgun if the user explicitly checks the box.
6. **PostHog event properties include app version** (automatically added by the existing analytics module) but never include any personally identifying information from the announcement subscription flow.

If a future change would link the email address and the PostHog device ID — even "just for debugging" — **that change is out of scope for this spec and requires a separate privacy review**. The anonymity properties of PostHog depend on this boundary.

---

## Testing Strategy

### Unit / component tests

- `scripts/publish-announcements.mjs` — test frontmatter parsing, manifest regeneration, `sent.json` deduplication, template rendering. No network calls (mock Mailgun fetch).
- `src/main/modules/announcements.js` — test cache fallback, schema version rejection, audience filter evaluation, error handling. Mock network.
- Renderer components (bell, panel, banner) — test seen tracking, severity treatment routing, CTA visibility.

### Integration test — in-app flow

- Mock a manifest served from a local fixture URL.
- Boot the app, verify bell shows correct badge count, panel lists items in order, clicking marks seen.
- Verify per-profile isolation: switch profiles, confirm seen state is not shared.

### End-to-end test — email flow

- Configure Mailgun sandbox domain with your own email as an authorized recipient.
- Run `node scripts/publish-announcements.mjs --send` against a test announcement file.
- Verify email arrives, template renders, unsubscribe link works.
- Verify `sent.json` is updated and a second run doesn't resend.

### Dry-run before first real send

Before any real email goes out, run `--dry-run` on the first announcement file and eyeball the rendered HTML. Also do one sandbox-mode end-to-end test. Only then flip the workflow to production mode.

---

## Reuse vs. Build-New

### Reused infrastructure

- **DOMPurify markdown sanitization** from release notes modal — for both panel body rendering and urgent modal rendering.
- **Existing modal component/pattern** from release notes modal — for urgent announcement display.
- **`tours_seen` pattern** from the What's New tour — for `announcements_seen` preference.
- **PostHog `trackEvent` API** from analytics module — for engagement events.
- **Bootstrap styling + light/dark theming** — for panel, banner, and bell components.
- **Profile preference storage** (`window.secureElectronAPI.profile.getPreference/setPreference`) — already supports arbitrary keys.
- **GitHub Actions** — used for other workflows already; adding one more is trivial.

### New code

- Main-process: `src/main/modules/announcements.js` (fetch, cache, audience filter, Mailgun subscribe).
- IPC handlers: new `announcements:*` channel handlers in `src/main/modules/ipc-handlers.js`.
- Preload: new `announcements` namespace in `src/preload/modules/secure-api-exposer.cjs`.
- Renderer components: bell icon, announcements panel, feature banner, subscribe dialog, detail view.
- Renderer module: `src/renderer/modules/announcements/` containing init, seen tracking, audience evaluation (client-side), UI wiring.
- Publishing script: `scripts/publish-announcements.mjs` + `scripts/email-template.html`.
- GitHub Action: `.github/workflows/publish-announcements.yml`.
- Content: `announcements/` directory with initial `manifest.json`, `sent.json`, and one seed announcement (e.g., the 4.3.0 release announcement).

Estimated new code: roughly 500–800 LOC across main, renderer, and script — not counting tests. Not trivial, not huge. Most of the complexity is in the fetch/cache module and the publishing script; the UI components are straightforward given the existing patterns.

---

## Open Questions

None remaining for this spec. Implementation details (exact component placement, precise CSS, final Mailgun list name, GitHub Action YAML specifics) will be nailed down during implementation planning.

---

## Appendix: Directory layout after this lands

```
mxvoice-electron/
├── announcements/                          # NEW
│   ├── manifest.json                       # auto-generated
│   ├── sent.json                           # tracks email dedup
│   ├── 2026-04-20-4.3.0-release.md         # first real content
│   └── 2026-04-09-welcome.md               # optional seed
├── scripts/
│   ├── publish-announcements.mjs           # NEW
│   └── email-template.html                 # NEW
├── .github/workflows/
│   └── publish-announcements.yml           # NEW
├── src/main/modules/
│   └── announcements.js                    # NEW
├── src/renderer/modules/announcements/     # NEW
│   ├── index.js
│   ├── fetcher.js
│   ├── seen-tracking.js
│   ├── audience.js
│   ├── bell.js
│   ├── panel.js
│   ├── banner.js
│   ├── urgent-modal.js
│   └── subscribe-dialog.js
└── docs/superpowers/specs/
    └── 2026-04-09-announcements-design.md  # this file
```
