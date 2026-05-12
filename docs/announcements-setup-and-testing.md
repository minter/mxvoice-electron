# In-App Announcements — Setup & Testing Guide

Operational guide for setting up Mailgun, configuring GitHub secrets, and testing
the in-app announcements feature locally.

## Part 1: Mailgun Setup (one-time)

### 1. Account & domain

You'll need:

- **A verified sending domain** (e.g., `mg.mxvoice.app` or similar). This is the
  domain Mailgun sends mail from. If you don't have one configured yet, add it
  under **Sending → Domains → Add New Domain**, then set up the DNS records
  Mailgun provides (SPF, DKIM, MX, TXT). This can take a few minutes to an hour
  to verify.
- **The sandbox domain** Mailgun auto-creates for every account (looks like
  `sandboxXXXXXXXXXXXX.mailgun.org`). This is where local/test sends go. Find it
  under **Sending → Domains** — it's the one labeled "sandbox".

### 2. Authorize your own email for sandbox testing

Sandbox domains can only send to pre-authorized recipients — this is the key
feature that makes local testing safe.

1. Go to **Sending → Domains → [your sandbox domain]**
2. Find the **Authorized Recipients** section
3. Add your own email address, click **Save**
4. You'll get a confirmation email from Mailgun — click the confirmation link

After this, any email the script sends through the sandbox domain will only be
delivered to your authorized email. Real subscriber lists are untouchable from
sandbox mode — that's the point.

### 3. Create the production mailing list

Under **Sending → Mailing Lists → Create Mailing List**:

- **Alias address:** `announcements@mg.yourdomain.com` (pick whatever local
  part you want — this is what subscribers' emails will be added to)
- **Name:** "Mx. Voice Announcements" or similar
- **Description:** optional
- **Access level:** set to "Read only" or "Everyone can read" (the API subscribe
  call uses your API key, not the access level)

### 4. Enable double opt-in on the list

This is the important privacy/safety feature that makes "already subscribed"
responses meaningful and protects you from bad actors typing in someone else's
email.

On the mailing list's settings page, find **Subscription confirmation** and
enable it. Mailgun will then:

- Send a confirmation email to any new subscriber before adding them to the list
- Keep unconfirmed addresses in a "pending" state (they don't receive broadcasts
  until they confirm)
- Treat re-subscriptions of already-confirmed addresses as "already exists"
  errors, which the app code handles as a success with `code: 'already_subscribed'`

### 5. Create a sandbox mailing list (optional but recommended)

Also under **Sending → Mailing Lists**, create a second list on the sandbox
domain:

- **Alias address:** something like `test-announcements@sandboxXXXXXXXX.mailgun.org`

This isn't strictly required — the publish script accepts a separate sandbox
list address via `MAILGUN_SANDBOX_LIST_ADDRESS`, but you could also just point
sandbox mode at the same production list address if you trust the sandbox
domain restriction. Having a separate sandbox list is cleaner though — it keeps
the list member count unpolluted by test subscriptions.

### 6. Generate an API key

Under **Settings → API Keys**:

- Use your **Private API Key** (not the public validation key)
- This goes into the `MAILGUN_API_KEY` environment variable. **Never commit this.**

### 7. (Optional) Customize the confirmation + unsubscribe templates

Under the mailing list's **Templates** section:

- **Confirmation email** — the "please confirm your subscription" email Mailgun
  sends. Add Mx. Voice branding if you want.
- **Unsubscribe page** — where clicks on `%unsubscribe_url%` land. Mailgun
  provides a default that works fine.

---

## Part 2: GitHub Repo Configuration

Under **Settings → Secrets and variables → Actions**:

### Secrets (encrypted, for `${{ secrets.NAME }}`)

| Name | Value |
|---|---|
| `MAILGUN_API_KEY` | Your Private API Key from step 6 |

### Variables (plain text, for `${{ vars.NAME }}`)

| Name | Value |
|---|---|
| `MAILGUN_DOMAIN` | e.g., `mg.mxvoice.app` |
| `MAILGUN_LIST_ADDRESS` | e.g., `announcements@mg.mxvoice.app` |
| `MAILGUN_FROM` | e.g., `Mx. Voice <announcements@mg.mxvoice.app>` |

The GitHub Action workflow at `.github/workflows/publish-announcements.yml`
reads these and passes them to the publish script with `MAILGUN_MODE=production`.
This workflow only runs on push to `main` that touches `announcements/*.md`,
`scripts/publish-announcements.mjs`, or `scripts/email-template.html`.

**Do NOT add the sandbox env vars here.** The production workflow always runs
in production mode against the real list. Sandbox is local-only.

---

## Part 3: Local Testing — the Publish Script

The publish script is at `scripts/publish-announcements.mjs`. It runs under
plain Node (no Electron) and has three modes: `--dry-run`, `--send`, and
`--resend <id>`.

### Local .env setup

Create a `.env` file in the repo root (gitignored) with your **sandbox** values:

```bash
MAILGUN_API_KEY=your-private-key-here
MAILGUN_SANDBOX_DOMAIN=sandboxXXXXXXXXXXXX.mailgun.org
MAILGUN_SANDBOX_LIST_ADDRESS=test-announcements@sandboxXXXXXXXXXXXX.mailgun.org
MAILGUN_FROM=Mx. Voice Test <test@sandboxXXXXXXXXXXXX.mailgun.org>
```

**Notice:** no `MAILGUN_MODE` — that means sandbox is the default.
**No `MAILGUN_DOMAIN` or `MAILGUN_LIST_ADDRESS`** — those are the production
values and should live only in GitHub secrets, not on your disk.

To load the .env automatically, either:

- Run with `env $(cat .env | xargs) node scripts/publish-announcements.mjs --send`
- Or install `dotenv-cli` once: `npm install -g dotenv-cli`, then
  `dotenv node scripts/publish-announcements.mjs --send`
- Or just `export` the vars manually in your shell session

### Dry run — previews without touching anything

```bash
node scripts/publish-announcements.mjs --dry-run
```

- Reads `announcements/*.md`
- Prints the generated manifest JSON
- For each `email: true` announcement not in `sent.json`: renders the email
  template and prints subject + HTML length + text preview
- **Never writes files, never calls Mailgun, never exits with a non-zero status**
- No env vars needed for dry run

This is safe to run any time. Use it to sanity-check a new announcement file
before committing.

### Sandbox send — real Mailgun API call, restricted delivery

```bash
node scripts/publish-announcements.mjs --send
```

With the `.env` loaded, this will:

- Regenerate `manifest.json` (writes to disk — you'll see it as dirty in git)
- Send each unsent `email: true` announcement through the **sandbox domain** to
  the sandbox list address
- Append each sent announcement to `sent.json` (also writes to disk)
- Exit 0 on success

Since only your authorized email is on the sandbox list, you'll receive the
email at your own inbox. Check the rendered HTML, click the unsubscribe link
(Mailgun's sandbox respects it), verify the subject line.

**After testing:** `git checkout announcements/manifest.json announcements/sent.json`
to revert the disk writes so your test doesn't pollute the real state on main.

### Resending a specific announcement for repeat testing

```bash
node scripts/publish-announcements.mjs --send --resend 2026-04-20-4-3-1-release
```

The `--resend <id>` flag removes that ID from the in-memory ledger before
filtering, forcing the script to send it again regardless of whether it was
already sent. Use this when you want to iterate on template rendering or fix a
typo and re-send.

### Viewing logs in Mailgun

After any sandbox send, go to **Sending → Logs** in the Mailgun dashboard.
You'll see:

- The send attempt with timestamp, recipient, subject
- Whether it was delivered, opened, clicked
- The actual HTML payload (click "Details" on an entry)
- Click tracking on the unsubscribe link

This is where you verify the template rendered correctly.

---

## Part 4: Local Testing — The Electron App

Separate from the publish script, there's the in-app side (bell, panel,
subscribe dialog). This is what users actually see.

### Running the app with analytics on

```bash
cd /path/to/mxvoice-electron
ANALYTICS_ENABLED=1 npm start
```

`ANALYTICS_ENABLED=1` is needed because PostHog analytics are disabled in dev
by default. The announcements feature fires 4 event types you'll want to see
flowing:

- `announcement_cta_clicked` — every time you click a subscribe CTA, with `source`
- `announcement_viewed` — opening an announcement's detail view
- `announcement_dismissed` — × on banner, "Got it" on urgent modal
- `announcement_subscribe_completed` — after a successful/already-subscribed
  Mailgun response

Check your PostHog dashboard's "Live Events" view to see them stream in.

### What to test in the running app

**Bell icon:**

- Appears in the search column header next to the profile indicator
- Subtle (grey) when no unread, red with a badge number when unread

**Panel:**

- Clicking the bell opens the "Announcements" modal
- Empty state: "No announcements yet. Check back later." — this is expected when
  the manifest is empty (the seed welcome announcement will only appear once the
  branch lands on main and the GitHub Action regenerates `manifest.json`)
- Subscribe CTA at the bottom of the panel:
  "📧 Want these by email? **Subscribe**"

**Subscribe dialog — reachable three ways:**

1. Panel footer CTA → click "Subscribe"
2. Help menu → **Get Email Updates…**
3. (Not yet testable locally) Final step of the What's New tour → appears after
   you trigger the tour

**Subscribe dialog behavior:**

- Invalid email → red border + validation message on submit
- Valid email + `MAILGUN_API_KEY` unset (default dev state) → error
  "Something went wrong. Email support@mxvoice.app…" — this proves the IPC
  path works, even though the actual send fails
- Valid email + `MAILGUN_API_KEY` set in your main-process env → actual Mailgun
  call (in development this will hit the real API — so either use the sandbox
  env vars or leave the key unset)
- The "Include my Mx. Voice version and OS" checkbox is opt-in; should be
  unchecked by default

### Pre-populating announcement content locally for fuller testing

Since the manifest is empty by default and the GitHub Action only runs on
`main`, local full-UI testing needs a workaround. Two options:

**Option A: Point the app at a branch-local manifest URL temporarily.**

Edit `src/main/index-modular.js` where `createAnnouncements` is called and
change the `manifestUrl` / `bodyUrlBase` to point at the `feature/announcements`
branch:

```javascript
manifestUrl: 'https://raw.githubusercontent.com/minter/mxvoice-electron/feature/announcements/announcements/manifest.json',
bodyUrlBase: 'https://raw.githubusercontent.com/minter/mxvoice-electron/feature/announcements/',
```

Then **commit and push a test announcement with `email: false`** to the branch.
Run the publish script's dry-run locally to regenerate `manifest.json`, commit
that too, and push. The app will then fetch from that URL. **Remember to revert
the URL change before merging to main.**

**Option B: Manually seed the electron-store cache.**

The main-process module caches the manifest under the key
`announcements_manifest_cache` in electron-store. You can seed it by dropping
a JSON blob into `~/Library/Application Support/MxVoice/config.json` (macOS)
under that key. Slightly hacky but doesn't require pushing to a branch. The
cache will be used until the next successful fetch from the real URL (which
will wipe it).

**Option C: Spin up a local static server.**

Run `python3 -m http.server 8080` from the repo root, then change the
`manifestUrl` to `http://localhost:8080/announcements/manifest.json` and
`bodyUrlBase` to `http://localhost:8080/`. Regenerate `manifest.json` with the
publish script and put your test announcements in `announcements/`. Simplest
for rapid iteration. Same caveat: revert before merging.

### Clearing the seen state between tests

Per-profile "seen" state lives in the electron-store profile preferences under
the key `announcements_seen` as an array of IDs. To reset:

- In the app: switch to a fresh profile
- Or directly edit:
  `~/Library/Application Support/MxVoice/profiles/<Profile>/preferences.json`
  and delete the `announcements_seen` entry

---

## Part 5: First Real Send (after everything tests clean)

Once you're satisfied with sandbox testing and ready to send to real subscribers:

1. Merge `feature/announcements` (or whichever integration branch carries it) to `main`.
2. On the first push to `main` that includes an announcement with `email: true`,
   the GitHub Action runs.
3. Watch the Actions run in the repo's **Actions** tab — you want to see it
   succeed and commit back `manifest.json` + `sent.json` updates.
4. Check **Mailgun → Sending → Logs** to confirm the message was delivered to
   the production list.
5. Verify you receive the email yourself if you're on the list.

**Before the first real send:**

- Start with a low-stakes announcement (a welcome/intro message)
- Double-check `email: true` in the frontmatter, not `email: "true"` or missing
  entirely
- Confirm your production list has double opt-in enabled so Mailgun's error
  shapes match what the code expects for the "already subscribed" case

**If something goes wrong mid-send and the Action fails:**

- The ledger fix means any already-sent items are recorded in `sent.json` before
  the process exits, so re-running won't duplicate
- Check the Action logs for the specific Mailgun error (status code + response
  body)
- Common causes: wrong API key, wrong list address, wrong domain, list not yet
  verified

---

## Quick Reference — Environment Variables

| Variable | Used by | Scope |
|---|---|---|
| `MAILGUN_API_KEY` | Publish script | Both sandbox and production |
| `MAILGUN_MODE` | Publish script | Defaults to `sandbox`; set to `production` only in GitHub Actions |
| `MAILGUN_DOMAIN` | Publish script | Production only |
| `MAILGUN_LIST_ADDRESS` | Publish script | Production only |
| `MAILGUN_SANDBOX_DOMAIN` | Publish script | Sandbox only |
| `MAILGUN_SANDBOX_LIST_ADDRESS` | Publish script | Sandbox only |
| `MAILGUN_FROM` | Publish script | Both |
| `MAILGUN_API_KEY` | Electron main process | For in-app Subscribe dialog — optional for dev, not set means Subscribe returns `not_configured` |
| `MAILGUN_DOMAIN` | Electron main process | For in-app Subscribe — same |
| `MAILGUN_LIST_ADDRESS` | Electron main process | For in-app Subscribe — same |
| `ANALYTICS_ENABLED` | Electron main process | Set to `1` to enable PostHog in dev |
