# In-App Announcements & Email Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a per-profile in-app announcement stream with optional Mailgun email subscription, fed by markdown files in git via a GitHub Action.

**Architecture:** Announcement content lives as markdown files with YAML frontmatter in `announcements/`. A GitHub Action regenerates `manifest.json` and sends flagged items to a Mailgun mailing list. The Electron main process fetches and caches the manifest; the renderer shows severity-driven UI (bell icon, panel, banner, urgent modal) with per-profile seen tracking via the existing `profile.getPreference`/`setPreference` API. Email signup posts to Mailgun from main (API key stays in main).

**Tech Stack:**
- **Publishing script:** Node.js, `gray-matter` (frontmatter), `marked` (markdown→HTML), built-in `fetch` (Node 18+), Mailgun REST API
- **Main process:** built-in `fetch`, `electron-store` for caching, existing analytics and profile preference APIs
- **Renderer:** Bootstrap 5 modals/panels, DOMPurify for markdown sanitization (already in use), `semver` for version comparison
- **CI:** GitHub Actions
- **Testing:** vitest (existing), mocked fetch + Mailgun

**Design spec:** `docs/superpowers/specs/2026-04-09-announcements-design.md`

**Rendering policy (important for every renderer task below):** Never use the DOM `innerHTML` property to insert user-controlled content. For markdown bodies, use `DOMPurify.sanitize(marked.parse(md))` fed into `Range.createContextualFragment`, then `element.replaceChildren(fragment)`. For plain text, use `element.textContent = ...`. For dynamic lists, use `document.createElement` and `element.appendChild` / `element.replaceChildren`. The existing release-notes flow uses `innerHTML` with DOMPurify, but new code in this plan uses the safer DOM-methods approach.

---

## File Structure

**New files:**

| Path | Responsibility |
|---|---|
| `announcements/manifest.json` | Derived manifest (auto-generated). |
| `announcements/sent.json` | Email-sent ledger (auto-updated). |
| `announcements/2026-04-09-welcome.md` | Seed content. |
| `scripts/publish-announcements.mjs` | CLI script: regenerate manifest, send Mailgun emails, update sent.json. |
| `scripts/email-template.html` | Email HTML template with `{{body}}` placeholder. |
| `.github/workflows/publish-announcements.yml` | GitHub Action workflow. |
| `src/main/modules/announcements.js` | Main-process module: manifest fetch + cache, body fetch + cache, Mailgun subscribe. |
| `src/renderer/modules/announcements/index.js` | Module orchestration + public API. |
| `src/renderer/modules/announcements/fetcher.js` | Wrapper around `secureElectronAPI.announcements`. |
| `src/renderer/modules/announcements/seen-tracking.js` | Per-profile seen state. |
| `src/renderer/modules/announcements/audience.js` | Client-side audience filter. |
| `src/renderer/modules/announcements/dom-utils.js` | Shared DOM helpers (safe markdown rendering, list item factories). |
| `src/renderer/modules/announcements/bell.js` | Bell icon + badge. |
| `src/renderer/modules/announcements/panel.js` | Panel (list, detail, CTA). |
| `src/renderer/modules/announcements/banner.js` | Feature banner. |
| `src/renderer/modules/announcements/urgent-modal.js` | Urgent blocking modal. |
| `src/renderer/modules/announcements/subscribe-dialog.js` | Email subscribe dialog. |
| `tests/unit/scripts/publish-announcements.test.js` | Publish script tests. |
| `tests/unit/main/announcements.test.js` | Main-process module tests. |
| `tests/unit/renderer/announcements-seen-tracking.test.js` | Seen tracking tests. |
| `tests/unit/renderer/announcements-audience.test.js` | Audience filter tests. |
| `tests/fixtures/announcements/` | Test fixture markdown files. |

**Modified files:**

| Path | Change |
|---|---|
| `package.json` | Add `gray-matter`, `marked`, `semver`; add npm scripts. |
| `src/main/modules/ipc-handlers.js` | Add `announcements:*` handlers. |
| `src/main/index-modular.js` | Instantiate announcements module. |
| `src/preload/modules/secure-api-exposer.cjs` | Add `announcements` namespace + `onOpenSubscribe` event. |
| `src/index.html` | Add bell, banner, panel, subscribe dialog, urgent modal HTML. |
| `src/main/modules/app-setup.js` | Help menu "Get Email Updates…" item. |
| `src/renderer.js` | Initialize announcements module, wire `onOpenSubscribe`. |
| `src/renderer/modules/whats-new/tours.js` | Append final tour step. |
| `src/renderer/modules/whats-new/index.js` | Wire subscribe link click from tour. |
| `src/renderer/modules/event-coordination/ui-interaction-events.js` | Append subscribe CTA to release-notes modal footer. |
| `src/stylesheets/style.css` (or equivalent) | CSS for new components. |

---

## Task 1: Dependencies and content scaffolding

**Files:**
- Modify: `package.json`
- Create: `announcements/manifest.json`
- Create: `announcements/sent.json`

- [ ] **Step 1: Install dependencies**

Run: `npm install --save gray-matter marked semver`
Expected: packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `announcements/manifest.json`**

```json
{
  "schema_version": 1,
  "generated_at": "2026-04-09T00:00:00Z",
  "announcements": []
}
```

- [ ] **Step 3: Create `announcements/sent.json`**

```json
{
  "sent": []
}
```

- [ ] **Step 4: Add npm scripts**

Edit the `"scripts"` block in `package.json`, adding:
```json
"announcements:publish:dry-run": "node scripts/publish-announcements.mjs --dry-run",
"announcements:publish": "node scripts/publish-announcements.mjs --send"
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json announcements/manifest.json announcements/sent.json
git commit -m "feat(announcements): add dependencies and content scaffolding"
```

---

## Task 2: Publish script — frontmatter reader + manifest builder

**Files:**
- Create: `scripts/publish-announcements.mjs`
- Create: `tests/unit/scripts/publish-announcements.test.js`
- Create: `tests/fixtures/announcements/2026-01-01-first.md`
- Create: `tests/fixtures/announcements/2026-02-01-second.md`

- [ ] **Step 1: Create first fixture**

Create `tests/fixtures/announcements/2026-01-01-first.md`:
```markdown
---
title: First announcement
published: 2026-01-01T12:00:00Z
severity: info
email: false
---
Body of first.
```

- [ ] **Step 2: Create second fixture**

Create `tests/fixtures/announcements/2026-02-01-second.md`:
```markdown
---
id: custom-id
title: Second announcement
published: 2026-02-01T12:00:00Z
severity: feature
email: true
audience:
  min_version: 4.0.0
  platforms: [darwin, win32]
---
Body of second with **markdown**.
```

- [ ] **Step 3: Write failing test**

Create `tests/unit/scripts/publish-announcements.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { readAnnouncements, buildManifest } from '../../../scripts/publish-announcements.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/announcements');

describe('publish-announcements script', () => {
  describe('readAnnouncements', () => {
    it('reads markdown files and parses frontmatter', () => {
      const items = readAnnouncements(fixturesDir);
      expect(items).toHaveLength(2);
      const first = items.find(a => a.id === '2026-01-01-first');
      expect(first.title).toBe('First announcement');
      expect(first.severity).toBe('info');
      expect(first.email).toBe(false);
      expect(first.body).toContain('Body of first.');
    });

    it('uses explicit id from frontmatter when present', () => {
      const items = readAnnouncements(fixturesDir);
      const second = items.find(a => a.id === 'custom-id');
      expect(second).toBeDefined();
      expect(second.title).toBe('Second announcement');
    });

    it('defaults id to filename stem when not in frontmatter', () => {
      const items = readAnnouncements(fixturesDir);
      const first = items.find(a => a.id === '2026-01-01-first');
      expect(first).toBeDefined();
    });
  });

  describe('buildManifest', () => {
    it('produces schema version 1 and sorts by published descending', () => {
      const items = readAnnouncements(fixturesDir);
      const manifest = buildManifest(items);
      expect(manifest.schema_version).toBe(1);
      expect(manifest.announcements).toHaveLength(2);
      expect(manifest.announcements[0].id).toBe('custom-id');
      expect(manifest.announcements[1].id).toBe('2026-01-01-first');
    });

    it('excludes body from manifest entries', () => {
      const items = readAnnouncements(fixturesDir);
      const manifest = buildManifest(items);
      expect(manifest.announcements[0].body).toBeUndefined();
    });

    it('includes audience and path in manifest entries', () => {
      const items = readAnnouncements(fixturesDir);
      const manifest = buildManifest(items);
      const second = manifest.announcements.find(a => a.id === 'custom-id');
      expect(second.audience.min_version).toBe('4.0.0');
      expect(second.path).toBe('announcements/2026-02-01-second.md');
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/unit/scripts/publish-announcements.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 5: Implement `readAnnouncements` and `buildManifest`**

Create `scripts/publish-announcements.mjs`:
```javascript
#!/usr/bin/env node
/**
 * Publish announcements: regenerate manifest.json, send new email-flagged
 * announcements via Mailgun, update sent.json.
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export function readAnnouncements(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(filename => {
    const filePath = path.join(dir, filename);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const stem = filename.replace(/\.md$/, '');
    return {
      id: parsed.data.id || stem,
      title: parsed.data.title,
      published: parsed.data.published,
      expires: parsed.data.expires,
      severity: parsed.data.severity,
      audience: parsed.data.audience,
      email: parsed.data.email === true,
      body: parsed.content.trim(),
      path: `announcements/${filename}`,
    };
  });
}

export function buildManifest(items) {
  const sorted = [...items].sort((a, b) =>
    new Date(b.published).getTime() - new Date(a.published).getTime()
  );
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    announcements: sorted.map(item => {
      const entry = {
        id: item.id,
        title: item.title,
        published: item.published,
        severity: item.severity,
        path: item.path,
      };
      if (item.expires) entry.expires = item.expires;
      if (item.audience) entry.audience = item.audience;
      return entry;
    }),
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/scripts/publish-announcements.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/publish-announcements.mjs tests/unit/scripts/publish-announcements.test.js tests/fixtures/announcements/
git commit -m "feat(announcements): publish script - frontmatter reader + manifest builder"
```

---

## Task 3: Publish script — sent ledger dedup

**Files:**
- Modify: `scripts/publish-announcements.mjs`
- Modify: `tests/unit/scripts/publish-announcements.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/scripts/publish-announcements.test.js`:
```javascript
import { beforeEach, afterEach } from 'vitest';
import os from 'os';
import fs from 'fs';
import { loadSentLedger, isAlreadySent, appendSent, saveSentLedger } from '../../../scripts/publish-announcements.mjs';

describe('sent ledger', () => {
  let tmpPath;
  beforeEach(() => { tmpPath = path.join(os.tmpdir(), `sent-${Date.now()}.json`); });
  afterEach(() => { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); });

  it('returns empty sent list if file does not exist', () => {
    expect(loadSentLedger(tmpPath).sent).toEqual([]);
  });

  it('loads existing sent ledger from file', () => {
    fs.writeFileSync(tmpPath, JSON.stringify({ sent: [{ id: 'a', sent_at: '2026-01-01T00:00:00Z' }] }));
    const ledger = loadSentLedger(tmpPath);
    expect(ledger.sent).toHaveLength(1);
  });

  it('isAlreadySent returns true for known ids', () => {
    const ledger = { sent: [{ id: 'a' }] };
    expect(isAlreadySent(ledger, 'a')).toBe(true);
    expect(isAlreadySent(ledger, 'b')).toBe(false);
  });

  it('appendSent adds an entry with timestamp', () => {
    const ledger = { sent: [] };
    appendSent(ledger, 'new-id');
    expect(ledger.sent).toHaveLength(1);
    expect(ledger.sent[0].id).toBe('new-id');
    expect(ledger.sent[0].sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('saveSentLedger writes the ledger to disk', () => {
    const ledger = { sent: [{ id: 'z', sent_at: '2026-01-01T00:00:00Z' }] };
    saveSentLedger(tmpPath, ledger);
    const reloaded = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
    expect(reloaded.sent[0].id).toBe('z');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/scripts/publish-announcements.test.js`
Expected: FAIL — exports do not exist.

- [ ] **Step 3: Implement ledger functions**

Append to `scripts/publish-announcements.mjs`:
```javascript
export function loadSentLedger(sentJsonPath) {
  if (!fs.existsSync(sentJsonPath)) return { sent: [] };
  const raw = fs.readFileSync(sentJsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  return { sent: Array.isArray(parsed.sent) ? parsed.sent : [] };
}

export function isAlreadySent(ledger, id) {
  return ledger.sent.some(entry => entry.id === id);
}

export function appendSent(ledger, id) {
  ledger.sent.push({ id, sent_at: new Date().toISOString() });
}

export function saveSentLedger(sentJsonPath, ledger) {
  fs.writeFileSync(sentJsonPath, JSON.stringify(ledger, null, 2) + '\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/scripts/publish-announcements.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/publish-announcements.mjs tests/unit/scripts/publish-announcements.test.js
git commit -m "feat(announcements): publish script - sent ledger dedup"
```

---

## Task 4: Publish script — email template rendering

**Files:**
- Create: `scripts/email-template.html`
- Modify: `scripts/publish-announcements.mjs`
- Modify: `tests/unit/scripts/publish-announcements.test.js`

- [ ] **Step 1: Create email template**

Create `scripts/email-template.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{title}}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f4;padding:20px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
      <tr><td style="background-color:#343a40;color:#ffffff;padding:24px;text-align:center;">
        <h1 style="margin:0;font-size:20px;font-weight:600;">Mx. Voice Announcement</h1>
      </td></tr>
      <tr><td style="padding:24px;color:#212529;line-height:1.6;font-size:15px;">
        {{body}}
      </td></tr>
      <tr><td style="background-color:#f8f9fa;padding:16px 24px;color:#6c757d;font-size:12px;text-align:center;border-top:1px solid #dee2e6;">
        You're receiving this because you subscribed to Mx. Voice announcements.<br>
        <a href="%unsubscribe_url%" style="color:#6c757d;text-decoration:underline;">Unsubscribe</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
```

- [ ] **Step 2: Write failing test**

Append to `tests/unit/scripts/publish-announcements.test.js`:
```javascript
import { renderEmail } from '../../../scripts/publish-announcements.mjs';

describe('email rendering', () => {
  it('wraps rendered markdown body in the template', () => {
    const item = { id: 'test', title: 'Test Title', body: 'Hello **world**.' };
    const { subject, html, text } = renderEmail(item);
    expect(subject).toBe('Test Title');
    expect(html).toContain('<strong>world</strong>');
    expect(html).toContain('Test Title');
    expect(html).toContain('%unsubscribe_url%');
    expect(text).toContain('Hello');
    expect(text).toContain('world');
  });

  it('text version strips tags', () => {
    const item = { id: 't', title: 'T', body: '# Heading\n\nParagraph.' };
    const { text } = renderEmail(item);
    expect(text).not.toContain('<');
    expect(text).toContain('Heading');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/scripts/publish-announcements.test.js`
Expected: FAIL.

- [ ] **Step 4: Implement `renderEmail`**

At the top of `scripts/publish-announcements.mjs`, add the `marked` and `url` imports:
```javascript
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
```

Then append:
```javascript
export function renderEmail(item) {
  const templatePath = path.join(scriptDir, 'email-template.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyHtml = marked.parse(item.body);
  const html = template
    .replace(/\{\{title\}\}/g, escapeHtml(item.title))
    .replace(/\{\{body\}\}/g, bodyHtml);
  const text = stripHtml(bodyHtml);
  return { subject: item.title, html, text };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/scripts/publish-announcements.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/publish-announcements.mjs scripts/email-template.html tests/unit/scripts/publish-announcements.test.js
git commit -m "feat(announcements): publish script - email template rendering"
```

---

## Task 5: Publish script — Mailgun send with sandbox default

**Files:**
- Modify: `scripts/publish-announcements.mjs`
- Modify: `tests/unit/scripts/publish-announcements.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/scripts/publish-announcements.test.js`:
```javascript
import { vi } from 'vitest';
import { sendToMailgun, resolveMailgunConfig } from '../../../scripts/publish-announcements.mjs';

describe('resolveMailgunConfig', () => {
  it('defaults to sandbox mode', () => {
    expect(resolveMailgunConfig({}).mode).toBe('sandbox');
  });
  it('uses production when MAILGUN_MODE=production', () => {
    expect(resolveMailgunConfig({ MAILGUN_MODE: 'production' }).mode).toBe('production');
  });
  it('uses sandbox when MAILGUN_MODE=sandbox', () => {
    expect(resolveMailgunConfig({ MAILGUN_MODE: 'sandbox' }).mode).toBe('sandbox');
  });
});

describe('sendToMailgun', () => {
  let fetchMock;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    globalThis.fetch = fetchMock;
  });
  afterEach(() => { delete globalThis.fetch; });

  const baseConfig = {
    apiKey: 'key-abc',
    sandboxDomain: 'sandbox-xyz.mailgun.org',
    sandboxListAddress: 'test@sandbox-xyz.mailgun.org',
    productionDomain: 'mg.example.com',
    productionListAddress: 'list@mg.example.com',
    fromAddress: 'Mx. Voice <a@mg.example.com>',
  };

  it('sends to sandbox domain in sandbox mode', async () => {
    const result = await sendToMailgun({ ...baseConfig, mode: 'sandbox' }, { subject: 'S', html: '<p>H</p>', text: 'T' });
    expect(result.ok).toBe(true);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('sandbox-xyz.mailgun.org');
    expect(options.headers.Authorization).toMatch(/^Basic /);
  });

  it('sends to production domain in production mode', async () => {
    await sendToMailgun({ ...baseConfig, mode: 'production' }, { subject: 'S', html: '<p>H</p>', text: 'T' });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('mg.example.com');
    expect(url).not.toContain('sandbox');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/scripts/publish-announcements.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `resolveMailgunConfig` and `sendToMailgun`**

Append to `scripts/publish-announcements.mjs`:
```javascript
export function resolveMailgunConfig(env) {
  const mode = env.MAILGUN_MODE === 'production' ? 'production' : 'sandbox';
  return {
    mode,
    apiKey: env.MAILGUN_API_KEY || '',
    productionDomain: env.MAILGUN_DOMAIN || '',
    productionListAddress: env.MAILGUN_LIST_ADDRESS || '',
    sandboxDomain: env.MAILGUN_SANDBOX_DOMAIN || '',
    sandboxListAddress: env.MAILGUN_SANDBOX_LIST_ADDRESS || '',
    fromAddress: env.MAILGUN_FROM || `Mx. Voice <announcements@${env.MAILGUN_DOMAIN || 'example.com'}>`,
  };
}

export async function sendToMailgun(config, rendered) {
  const domain = config.mode === 'production' ? config.productionDomain : config.sandboxDomain;
  const listAddress = config.mode === 'production' ? config.productionListAddress : config.sandboxListAddress;
  if (!domain || !listAddress || !config.apiKey) {
    return { ok: false, status: 0, body: 'missing Mailgun configuration' };
  }
  const url = `https://api.mailgun.net/v3/${domain}/messages`;
  const auth = Buffer.from(`api:${config.apiKey}`).toString('base64');
  const form = new URLSearchParams();
  form.append('from', config.fromAddress);
  form.append('to', listAddress);
  form.append('subject', rendered.subject);
  form.append('html', rendered.html);
  form.append('text', rendered.text);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/scripts/publish-announcements.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/publish-announcements.mjs tests/unit/scripts/publish-announcements.test.js
git commit -m "feat(announcements): publish script - Mailgun send with sandbox default"
```

---

## Task 6: Publish script — CLI entry point

**Files:**
- Modify: `scripts/publish-announcements.mjs`

- [ ] **Step 1: Append CLI main function**

Append to `scripts/publish-announcements.mjs`:
```javascript
export async function main(argv, env, cwd) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const send = args.includes('--send');
  const resendFlag = args.indexOf('--resend');
  const resendId = resendFlag !== -1 ? args[resendFlag + 1] : null;

  if (!dryRun && !send) {
    console.error('Usage: publish-announcements.mjs [--dry-run | --send] [--resend <id>]');
    process.exit(1);
  }

  const announcementsDir = path.join(cwd, 'announcements');
  const manifestPath = path.join(announcementsDir, 'manifest.json');
  const sentPath = path.join(announcementsDir, 'sent.json');

  const items = readAnnouncements(announcementsDir);
  console.log(`Read ${items.length} announcement(s)`);

  const manifest = buildManifest(items);
  const ledger = loadSentLedger(sentPath);
  if (resendId) {
    ledger.sent = ledger.sent.filter(e => e.id !== resendId);
    console.log(`Removed '${resendId}' from ledger for resend`);
  }

  const toSend = items.filter(item => item.email && !isAlreadySent(ledger, item.id));
  console.log(`${toSend.length} new email-flagged announcement(s) to send`);

  if (dryRun) {
    console.log('--- DRY RUN ---');
    console.log('Would write manifest.json:');
    console.log(JSON.stringify(manifest, null, 2));
    for (const item of toSend) {
      const rendered = renderEmail(item);
      console.log(`\n--- Would send: ${item.id} ---`);
      console.log(`Subject: ${rendered.subject}`);
      console.log(`HTML length: ${rendered.html.length}`);
      console.log(`Text preview: ${rendered.text.slice(0, 200)}`);
    }
    return;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${manifestPath}`);

  const config = resolveMailgunConfig(env);
  console.log(`Mailgun mode: ${config.mode}`);
  for (const item of toSend) {
    const rendered = renderEmail(item);
    const result = await sendToMailgun(config, rendered);
    if (!result.ok) {
      console.error(`FAIL ${item.id}: ${result.status} ${result.body}`);
      process.exit(2);
    }
    console.log(`SENT ${item.id} (${result.status})`);
    appendSent(ledger, item.id);
  }

  saveSentLedger(sentPath, ledger);
  console.log(`Wrote ${sentPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv, process.env, process.cwd()).catch(err => {
    console.error(err);
    process.exit(3);
  });
}
```

- [ ] **Step 2: Smoke-test the script**

Run: `node scripts/publish-announcements.mjs --dry-run`
Expected: Reports "Read 0 announcement(s)" (since the repo's `announcements/` dir has no `.md` files yet). No errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/publish-announcements.mjs
git commit -m "feat(announcements): publish script - CLI entry point"
```

---

## Task 7: GitHub Action workflow

**Files:**
- Create: `.github/workflows/publish-announcements.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/publish-announcements.yml`:
```yaml
name: Publish Announcements

on:
  push:
    branches: [main]
    paths:
      - 'announcements/**.md'
      - 'scripts/publish-announcements.mjs'
      - 'scripts/email-template.html'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Publish announcements
        env:
          MAILGUN_MODE: production
          MAILGUN_API_KEY: ${{ secrets.MAILGUN_API_KEY }}
          MAILGUN_DOMAIN: ${{ vars.MAILGUN_DOMAIN }}
          MAILGUN_LIST_ADDRESS: ${{ vars.MAILGUN_LIST_ADDRESS }}
          MAILGUN_FROM: ${{ vars.MAILGUN_FROM }}
        run: node scripts/publish-announcements.mjs --send

      - name: Commit updated manifest and ledger
        run: |
          if [[ -n "$(git status --porcelain announcements/manifest.json announcements/sent.json)" ]]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add announcements/manifest.json announcements/sent.json
            git commit -m "chore: publish announcements [skip ci]"
            git push
          else
            echo "No manifest or ledger changes to commit."
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish-announcements.yml
git commit -m "feat(announcements): GitHub Action for publishing"
```

---

## Task 8: Main-process module — manifest fetch + cache

**Files:**
- Create: `src/main/modules/announcements.js`
- Create: `tests/unit/main/announcements.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/main/announcements.test.js`:
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDebugLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

let storeData = {};
const mockStore = {
  get: vi.fn(key => storeData[key]),
  set: vi.fn((key, value) => { storeData[key] = value; }),
};

const { createAnnouncements } = await import('../../../src/main/modules/announcements.js');

describe('announcements module - fetchManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeData = {};
    globalThis.fetch = vi.fn();
  });

  it('fetches and caches the manifest on success', async () => {
    const manifest = { schema_version: 1, generated_at: '2026-04-09T00:00:00Z', announcements: [] };
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => manifest });
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    const result = await ann.fetchManifest();
    expect(result).toEqual(manifest);
    expect(mockStore.set).toHaveBeenCalledWith('announcements_manifest_cache', manifest);
  });

  it('returns cache when network fails', async () => {
    const cached = { schema_version: 1, announcements: [{ id: 'cached', title: 'C', severity: 'info', published: '2026-04-01T00:00:00Z', path: 'p' }] };
    storeData.announcements_manifest_cache = cached;
    globalThis.fetch.mockRejectedValue(new Error('network down'));
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    const result = await ann.fetchManifest();
    expect(result).toEqual(cached);
    expect(mockDebugLog.warn).toHaveBeenCalled();
  });

  it('ignores manifest with unknown schema_version', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ schema_version: 99, announcements: [] }) });
    const cached = { schema_version: 1, announcements: [] };
    storeData.announcements_manifest_cache = cached;
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    const result = await ann.fetchManifest();
    expect(result).toEqual(cached);
  });

  it('returns null when no cache and network fails', async () => {
    globalThis.fetch.mockRejectedValue(new Error('down'));
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    expect(await ann.fetchManifest()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/main/announcements.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement the module**

Create `src/main/modules/announcements.js`:
```javascript
/**
 * Announcements Module
 *
 * Main-process module for fetching and caching announcements from GitHub,
 * and calling Mailgun for email subscribe.
 */
const SUPPORTED_SCHEMA_VERSION = 1;
const MANIFEST_CACHE_KEY = 'announcements_manifest_cache';
const BODY_CACHE_KEY_PREFIX = 'announcements_body_cache__';

export function createAnnouncements({ store, debugLog, manifestUrl, bodyUrlBase, mailgun }) {
  async function fetchManifest() {
    try {
      const res = await fetch(manifestUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();
      if (manifest.schema_version !== SUPPORTED_SCHEMA_VERSION) {
        debugLog.warn('Announcements: unknown schema version, ignoring', {
          module: 'announcements', function: 'fetchManifest',
          received: manifest.schema_version, supported: SUPPORTED_SCHEMA_VERSION,
        });
        return store.get(MANIFEST_CACHE_KEY) || null;
      }
      store.set(MANIFEST_CACHE_KEY, manifest);
      return manifest;
    } catch (err) {
      debugLog.warn('Announcements: manifest fetch failed, using cache', {
        module: 'announcements', function: 'fetchManifest',
        error: err?.message || String(err),
      });
      return store.get(MANIFEST_CACHE_KEY) || null;
    }
  }

  function getCachedManifest() {
    return store.get(MANIFEST_CACHE_KEY) || null;
  }

  return { fetchManifest, getCachedManifest };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/main/announcements.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/modules/announcements.js tests/unit/main/announcements.test.js
git commit -m "feat(announcements): main-process module - manifest fetch + cache"
```

---

## Task 9: Main-process module — body fetch + Mailgun subscribe

**Files:**
- Modify: `src/main/modules/announcements.js`
- Modify: `tests/unit/main/announcements.test.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/main/announcements.test.js`:
```javascript
describe('announcements module - fetchBody', () => {
  beforeEach(() => {
    storeData = {};
    globalThis.fetch = vi.fn();
  });

  it('fetches and caches an announcement body', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '---\ntitle: T\n---\nBody.' });
    const ann = createAnnouncements({
      store: mockStore, debugLog: mockDebugLog,
      manifestUrl: 'https://example.com/m.json', bodyUrlBase: 'https://example.com/',
    });
    const body = await ann.fetchBody('announcements/test.md');
    expect(body).toContain('Body.');
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/announcements/test.md', expect.any(Object));
  });

  it('returns cached body without network call on second fetch', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'body' });
    const ann = createAnnouncements({
      store: mockStore, debugLog: mockDebugLog,
      manifestUrl: 'https://example.com/m.json', bodyUrlBase: 'https://example.com/',
    });
    await ann.fetchBody('announcements/x.md');
    globalThis.fetch.mockClear();
    const second = await ann.fetchBody('announcements/x.md');
    expect(second).toBe('body');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('announcements module - subscribeEmail', () => {
  beforeEach(() => {
    storeData = {};
    globalThis.fetch = vi.fn();
  });

  const mailgun = { apiKey: 'key-abc', domain: 'mg.example.com', listAddress: 'list@mg.example.com' };

  it('returns ok with code "subscribed" on 200', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' });
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json', mailgun });
    const result = await ann.subscribeEmail('a@b.com', {});
    expect(result.ok).toBe(true);
    expect(result.code).toBe('subscribed');
  });

  it('treats 400 "already exists" as ok with code "already_subscribed"', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 400, text: async () => '{"message":"Address already exists"}' });
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json', mailgun });
    const result = await ann.subscribeEmail('a@b.com', {});
    expect(result.ok).toBe(true);
    expect(result.code).toBe('already_subscribed');
  });

  it('returns ok=false code "network_error" on fetch rejection', async () => {
    globalThis.fetch.mockRejectedValue(new Error('offline'));
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json', mailgun });
    const result = await ann.subscribeEmail('a@b.com', {});
    expect(result.ok).toBe(false);
    expect(result.code).toBe('network_error');
  });

  it('returns ok=false code "not_configured" when mailgun missing', async () => {
    const ann = createAnnouncements({ store: mockStore, debugLog: mockDebugLog, manifestUrl: 'https://example.com/m.json' });
    const result = await ann.subscribeEmail('a@b.com', {});
    expect(result.ok).toBe(false);
    expect(result.code).toBe('not_configured');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/main/announcements.test.js`
Expected: FAIL — functions not implemented.

- [ ] **Step 3: Extend the module**

In `src/main/modules/announcements.js`, inside the `createAnnouncements` function (before the `return`), append:
```javascript
async function fetchBody(relativePath) {
  const cacheKey = BODY_CACHE_KEY_PREFIX + relativePath;
  const cached = store.get(cacheKey);
  if (cached) return cached;
  try {
    const url = (bodyUrlBase || '') + relativePath;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    store.set(cacheKey, text);
    return text;
  } catch (err) {
    debugLog.warn('Announcements: body fetch failed', {
      module: 'announcements', function: 'fetchBody', path: relativePath,
      error: err?.message || String(err),
    });
    return null;
  }
}

async function subscribeEmail(email, vars = {}) {
  if (!mailgun || !mailgun.apiKey || !mailgun.domain || !mailgun.listAddress) {
    return { ok: false, code: 'not_configured', message: 'Email subscription is not configured in this build.' };
  }
  const url = `https://api.mailgun.net/v3/lists/${encodeURIComponent(mailgun.listAddress)}/members`;
  const auth = Buffer.from(`api:${mailgun.apiKey}`).toString('base64');
  const form = new URLSearchParams();
  form.append('address', email);
  form.append('subscribed', 'yes');
  form.append('upsert', 'no');
  if (vars && Object.keys(vars).length > 0) form.append('vars', JSON.stringify(vars));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const body = await res.text();
    if (res.ok) return { ok: true, code: 'subscribed', message: 'Subscribed successfully.' };
    if (res.status === 400 && /already exists/i.test(body)) {
      return { ok: true, code: 'already_subscribed', message: 'You are already subscribed.' };
    }
    debugLog.warn('Announcements: subscribe failed', { module: 'announcements', function: 'subscribeEmail', status: res.status });
    return { ok: false, code: 'api_error', message: `Mailgun returned ${res.status}.` };
  } catch (err) {
    debugLog.warn('Announcements: subscribe network error', { module: 'announcements', function: 'subscribeEmail', error: err?.message || String(err) });
    return { ok: false, code: 'network_error', message: 'Could not reach the subscription server.' };
  }
}
```

And update the `return` statement to:
```javascript
return { fetchManifest, getCachedManifest, fetchBody, subscribeEmail };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/main/announcements.test.js`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/modules/announcements.js tests/unit/main/announcements.test.js
git commit -m "feat(announcements): main-process module - body fetch + Mailgun subscribe"
```

---

## Task 10: IPC handlers, preload namespace, main wiring

**Files:**
- Modify: `src/main/modules/ipc-handlers.js`
- Modify: `src/main/index-modular.js`
- Modify: `src/preload/modules/secure-api-exposer.cjs`

- [ ] **Step 1: Instantiate the announcements module in main**

In `src/main/index-modular.js`, import and instantiate the module near where `analytics` is instantiated (search for `createAnalytics` call):
```javascript
import { createAnnouncements } from './modules/announcements.js';

const announcements = createAnnouncements({
  store,
  debugLog,
  manifestUrl: 'https://raw.githubusercontent.com/minter/mxvoice-electron/main/announcements/manifest.json',
  bodyUrlBase: 'https://raw.githubusercontent.com/minter/mxvoice-electron/main/',
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || '',
    domain: process.env.MAILGUN_DOMAIN || '',
    listAddress: process.env.MAILGUN_LIST_ADDRESS || '',
  },
});

// Non-blocking manifest fetch 3 seconds after startup
setTimeout(() => { announcements.fetchManifest().catch(() => {}); }, 3000);
// Periodic refresh every 6 hours
setInterval(() => { announcements.fetchManifest().catch(() => {}); }, 6 * 60 * 60 * 1000);
```

Also pass `announcements` to the IPC handler registration call. Find the call to `registerAllHandlers` (or whichever function registers IPC handlers) and add `announcements` to the options object.

- [ ] **Step 2: Add IPC handlers**

In `src/main/modules/ipc-handlers.js`:

At the top of `registerAllHandlers` (or wherever `analytics` is destructured from the options), add `announcements` to the destructure.

Then near the analytics handlers (around line 2515), append:
```javascript
// Announcements handlers
ipcMain.handle('announcements:get-manifest', async () => {
  try {
    if (!announcements) return { success: true, value: null };
    const manifest = await announcements.fetchManifest();
    return { success: true, value: manifest };
  } catch (error) {
    debugLog?.error('Announcements get-manifest error', { module: 'ipc-handlers', function: 'announcements:get-manifest', error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('announcements:get-body', async (event, relativePath) => {
  try {
    if (!announcements) return { success: true, value: null };
    const body = await announcements.fetchBody(relativePath);
    return { success: true, value: body };
  } catch (error) {
    debugLog?.error('Announcements get-body error', { module: 'ipc-handlers', function: 'announcements:get-body', error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('announcements:subscribe', async (event, email, vars) => {
  try {
    if (!announcements) return { success: true, value: { ok: false, code: 'not_configured', message: 'Subscription unavailable.' } };
    const result = await announcements.subscribeEmail(email, vars || {});
    return { success: true, value: result };
  } catch (error) {
    debugLog?.error('Announcements subscribe error', { module: 'ipc-handlers', function: 'announcements:subscribe', error: error.message });
    return { success: false, error: error.message };
  }
});
```

- [ ] **Step 3: Add preload namespace**

In `src/preload/modules/secure-api-exposer.cjs`, right after the `analytics` namespace (around line 512), add:
```javascript
// Announcements
announcements: {
  getManifest: () => ipcRenderer.invoke('announcements:get-manifest'),
  getBody: (relativePath) => ipcRenderer.invoke('announcements:get-body', relativePath),
  subscribe: (email, vars) => ipcRenderer.invoke('announcements:subscribe', email, vars),
},
```

Also in the `events` namespace (around line 318 where `onDisplayReleaseNotes` is defined), add:
```javascript
onOpenSubscribe: (callback) => {
  const handler = () => callback();
  ipcRenderer.on('announcements:open-subscribe', handler);
  return () => ipcRenderer.removeListener('announcements:open-subscribe', handler);
},
```

And in the exposed merge block (around line 571 where `analytics: secureElectronAPI.analytics` lives), add `announcements: secureElectronAPI.announcements` and `onOpenSubscribe: secureElectronAPI.events.onOpenSubscribe` (matching wherever other event listeners are exposed).

- [ ] **Step 4: Rebuild preload**

Run: `npm run build:preload`
Expected: clean build.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/main/announcements.test.js tests/unit/scripts/publish-announcements.test.js`
Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/modules/ipc-handlers.js src/main/index-modular.js src/preload/modules/secure-api-exposer.cjs src/preload/preload-bundle.cjs
git commit -m "feat(announcements): IPC handlers, preload namespace, main wiring"
```

---

## Task 11: Renderer — seen tracking

**Files:**
- Create: `src/renderer/modules/announcements/seen-tracking.js`
- Create: `tests/unit/renderer/announcements-seen-tracking.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/unit/renderer/announcements-seen-tracking.test.js`:
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

let prefs = {};
globalThis.window = {
  secureElectronAPI: {
    profile: {
      getPreference: vi.fn(async key => ({ success: true, value: prefs[key] })),
      setPreference: vi.fn(async (key, value) => { prefs[key] = value; return { success: true }; }),
    },
  },
};

const { createSeenTracking } = await import('../../../src/renderer/modules/announcements/seen-tracking.js');

describe('announcements seen tracking', () => {
  beforeEach(() => { prefs = {}; vi.clearAllMocks(); });

  it('returns empty array when no preference is set', async () => {
    expect(await createSeenTracking().getSeen()).toEqual([]);
  });

  it('markSeen adds an id and persists', async () => {
    const t = createSeenTracking();
    await t.markSeen('a');
    await t.markSeen('b');
    expect(prefs.announcements_seen).toEqual(['a', 'b']);
  });

  it('markSeen is idempotent', async () => {
    const t = createSeenTracking();
    await t.markSeen('a');
    await t.markSeen('a');
    expect(prefs.announcements_seen).toEqual(['a']);
  });

  it('isSeen returns true for marked ids', async () => {
    const t = createSeenTracking();
    await t.markSeen('a');
    expect(await t.isSeen('a')).toBe(true);
    expect(await t.isSeen('b')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/announcements-seen-tracking.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/renderer/modules/announcements/seen-tracking.js`:
```javascript
const PREF_KEY = 'announcements_seen';

function unwrap(response) {
  if (response && typeof response === 'object' && 'value' in response) return response.value;
  return response;
}

export function createSeenTracking() {
  async function getSeen() {
    const raw = unwrap(await window.secureElectronAPI.profile.getPreference(PREF_KEY));
    return Array.isArray(raw) ? raw : [];
  }
  async function markSeen(id) {
    const seen = await getSeen();
    if (!seen.includes(id)) {
      seen.push(id);
      await window.secureElectronAPI.profile.setPreference(PREF_KEY, seen);
    }
  }
  async function isSeen(id) {
    const seen = await getSeen();
    return seen.includes(id);
  }
  return { getSeen, markSeen, isSeen };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/announcements-seen-tracking.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/modules/announcements/seen-tracking.js tests/unit/renderer/announcements-seen-tracking.test.js
git commit -m "feat(announcements): renderer seen tracking"
```

---

## Task 12: Renderer — audience filter

**Files:**
- Create: `src/renderer/modules/announcements/audience.js`
- Create: `tests/unit/renderer/announcements-audience.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/unit/renderer/announcements-audience.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { passesAudienceFilter, isExpired } from '../../../src/renderer/modules/announcements/audience.js';

describe('audience filter', () => {
  const ctx = { version: '4.3.0', platform: 'darwin' };
  it('passes when audience is undefined', () => {
    expect(passesAudienceFilter({ id: 'x' }, ctx)).toBe(true);
  });
  it('filters by min_version', () => {
    expect(passesAudienceFilter({ audience: { min_version: '4.2.0' } }, ctx)).toBe(true);
    expect(passesAudienceFilter({ audience: { min_version: '4.4.0' } }, ctx)).toBe(false);
  });
  it('filters by max_version', () => {
    expect(passesAudienceFilter({ audience: { max_version: '4.3.0' } }, ctx)).toBe(true);
    expect(passesAudienceFilter({ audience: { max_version: '4.2.9' } }, ctx)).toBe(false);
  });
  it('filters by platforms array', () => {
    expect(passesAudienceFilter({ audience: { platforms: ['darwin', 'linux'] } }, ctx)).toBe(true);
    expect(passesAudienceFilter({ audience: { platforms: ['win32'] } }, ctx)).toBe(false);
  });
  it('combines version and platform filters with AND', () => {
    expect(passesAudienceFilter({ audience: { min_version: '4.2.0', platforms: ['darwin'] } }, ctx)).toBe(true);
    expect(passesAudienceFilter({ audience: { min_version: '4.2.0', platforms: ['win32'] } }, ctx)).toBe(false);
  });
});

describe('isExpired', () => {
  it('returns false when expires is not set', () => {
    expect(isExpired({ id: 'x' }, new Date('2026-06-01'))).toBe(false);
  });
  it('returns true when expires is in the past', () => {
    expect(isExpired({ expires: '2026-01-01T00:00:00Z' }, new Date('2026-06-01'))).toBe(true);
  });
  it('returns false when expires is in the future', () => {
    expect(isExpired({ expires: '2026-12-01T00:00:00Z' }, new Date('2026-06-01'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/renderer/announcements-audience.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/renderer/modules/announcements/audience.js`:
```javascript
import semver from 'semver';

export function passesAudienceFilter(announcement, ctx) {
  const a = announcement.audience;
  if (!a) return true;
  if (a.min_version && semver.lt(ctx.version, a.min_version)) return false;
  if (a.max_version && semver.gt(ctx.version, a.max_version)) return false;
  if (Array.isArray(a.platforms) && a.platforms.length > 0 && !a.platforms.includes(ctx.platform)) return false;
  return true;
}

export function isExpired(announcement, now = new Date()) {
  if (!announcement.expires) return false;
  return new Date(announcement.expires).getTime() <= now.getTime();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/renderer/announcements-audience.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/modules/announcements/audience.js tests/unit/renderer/announcements-audience.test.js
git commit -m "feat(announcements): renderer audience filter"
```

---

## Task 13: Renderer HTML skeleton

**Files:**
- Modify: `src/index.html`

- [ ] **Step 1: Add bell icon in search column header**

Find the `#profile-indicator` element inside `#search-column`'s card-header (around line 120 in `src/index.html`). Add the bell trigger element adjacent to it (sibling of `#profile-indicator`):
```html
<a href="#" id="announcements-bell" class="announcements-bell" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Announcements">
  <i class="fas fa-bell"></i>
  <span id="announcements-badge" class="announcements-badge d-none">0</span>
</a>
```

- [ ] **Step 2: Add feature banner**

Right after the opening `<body>` tag in `src/index.html`, before `#file-drop-overlay`, add:
```html
<div id="announcements-banner" class="announcements-banner d-none" role="status" aria-live="polite">
  <div class="announcements-banner-body">
    <span id="announcements-banner-icon" aria-hidden="true">🎉</span>
    <span id="announcements-banner-text"></span>
  </div>
  <button type="button" id="announcements-banner-close" class="btn-close btn-close-white" aria-label="Dismiss announcement"></button>
</div>
```

- [ ] **Step 3: Add announcements panel modal**

Add near the existing `#newReleaseModal` block (around line 717):
```html
<div class="modal fade" id="announcementsPanel" tabindex="-1" role="dialog" aria-labelledby="announcementsPanelTitle">
  <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h6 class="modal-title" id="announcementsPanelTitle">Announcements</h6>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div id="announcements-list"></div>
        <div id="announcements-detail" class="d-none"></div>
        <div id="announcements-empty" class="d-none text-muted text-center py-4">
          No announcements yet. Check back later.
        </div>
      </div>
      <div class="modal-footer justify-content-between">
        <a href="#" id="announcements-subscribe-cta" class="text-muted small">
          <span aria-hidden="true">📧</span> Want these by email? <strong>Subscribe</strong>
        </a>
        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add subscribe dialog modal**

```html
<div class="modal fade" id="announcementsSubscribeDialog" tabindex="-1" role="dialog" aria-labelledby="announcementsSubscribeTitle">
  <div class="modal-dialog modal-dialog-centered" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h6 class="modal-title" id="announcementsSubscribeTitle">Get Mx. Voice updates by email</h6>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <p>We'll email you when there's a new release, a critical bug, or other important news. A few times a year. Not a marketing list.</p>
        <form id="announcements-subscribe-form" novalidate>
          <div class="mb-3">
            <label for="announcements-subscribe-email" class="form-label">Email address</label>
            <input type="email" class="form-control" id="announcements-subscribe-email" required>
            <div class="invalid-feedback">Please enter a valid email address.</div>
          </div>
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="announcements-subscribe-metadata">
            <label class="form-check-label" for="announcements-subscribe-metadata">
              Include my Mx. Voice version and OS
              <small class="text-muted d-block">(helps us target relevant updates to you)</small>
            </label>
          </div>
          <div id="announcements-subscribe-result" class="d-none"></div>
        </form>
      </div>
      <div class="modal-footer">
        <small class="text-muted me-auto">You can unsubscribe any time via the link in any email. Delivered via Mailgun.</small>
        <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-success btn-sm" id="announcements-subscribe-submit">Subscribe</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add urgent announcement modal**

```html
<div class="modal fade" id="announcementsUrgentModal" tabindex="-1" role="dialog" data-bs-backdrop="static" data-bs-keyboard="false" aria-labelledby="announcementsUrgentTitle">
  <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
    <div class="modal-content">
      <div class="modal-header bg-warning">
        <h6 class="modal-title" id="announcementsUrgentTitle">
          <i class="fas fa-exclamation-triangle" aria-hidden="true"></i> Important
        </h6>
      </div>
      <div class="modal-body">
        <h5 id="announcements-urgent-title"></h5>
        <div id="announcements-urgent-body"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary btn-sm" id="announcements-urgent-ok">Got it</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/index.html
git commit -m "feat(announcements): HTML skeleton (bell, banner, panel, dialogs)"
```

---

## Task 14: Renderer — DOM utilities (safe markdown rendering, list factory)

**Files:**
- Create: `src/renderer/modules/announcements/dom-utils.js`

- [ ] **Step 1: Create DOM utils module**

Create `src/renderer/modules/announcements/dom-utils.js`:
```javascript
/**
 * Shared DOM helpers for the announcements UI.
 *
 * Never assigns untrusted content via the DOM element property for HTML.
 * For markdown bodies: DOMPurify sanitizes, then Range.createContextualFragment
 * builds a DocumentFragment, then element.replaceChildren accepts it.
 * For static content: createElement + textContent + appendChild.
 */
import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Strip YAML frontmatter if present, then render markdown to a sanitized
 * DocumentFragment and replace the element's children with it.
 */
export function renderMarkdownInto(element, markdownText) {
  if (!element) return;
  const stripped = (markdownText || '').replace(/^---\n[\s\S]*?\n---\n/, '');
  const rawHtml = marked.parse(stripped);
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','em','u','ul','ol','li','a','code','pre','blockquote'],
    ALLOWED_ATTR: ['href','target','rel'],
  });
  const range = document.createRange();
  const fragment = range.createContextualFragment(cleanHtml);
  element.replaceChildren(fragment);
}

/**
 * Build a list-item DOM node for an announcement using only createElement and
 * textContent. No HTML strings.
 */
export function buildAnnouncementListItem(announcement, isUnread) {
  const item = document.createElement('div');
  item.classList.add('announcement-item');
  if (isUnread) item.classList.add('unread');
  item.dataset.id = announcement.id;
  item.dataset.path = announcement.path;

  const title = document.createElement('div');
  title.classList.add('announcement-item-title');
  title.textContent = announcement.title || '';
  item.appendChild(title);

  const meta = document.createElement('div');
  meta.classList.add('announcement-item-meta');

  const dateSpan = document.createElement('span');
  dateSpan.classList.add('announcement-date');
  dateSpan.textContent = announcement.published
    ? new Date(announcement.published).toLocaleDateString()
    : '';
  meta.appendChild(dateSpan);

  const severitySpan = document.createElement('span');
  severitySpan.classList.add('announcement-severity', `severity-${announcement.severity || 'info'}`);
  severitySpan.textContent = announcement.severity || 'info';
  meta.appendChild(severitySpan);

  item.appendChild(meta);
  return item;
}

/**
 * Build a result alert element for the subscribe dialog.
 */
export function buildResultAlert(kind, message) {
  const alert = document.createElement('div');
  const cls = kind === 'success' ? 'alert-success' : (kind === 'info' ? 'alert-info' : 'alert-danger');
  alert.classList.add('alert', cls, 'py-2', 'mb-0');
  alert.textContent = message;
  return alert;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/announcements/dom-utils.js
git commit -m "feat(announcements): renderer DOM utilities with safe markdown rendering"
```

---

## Task 15: Renderer — fetcher wrapper

**Files:**
- Create: `src/renderer/modules/announcements/fetcher.js`

- [ ] **Step 1: Create the fetcher**

Create `src/renderer/modules/announcements/fetcher.js`:
```javascript
/**
 * Thin wrapper around the secureElectronAPI.announcements namespace.
 * Unwraps the { success, value } envelope and normalizes errors.
 */
function unwrap(response) {
  if (!response) return null;
  if (response.success === false) return null;
  return 'value' in response ? response.value : response;
}

export const fetcher = {
  async getManifest() {
    return unwrap(await window.secureElectronAPI.announcements.getManifest());
  },
  async getBody(path) {
    return unwrap(await window.secureElectronAPI.announcements.getBody(path));
  },
  async subscribe(email, vars) {
    return unwrap(await window.secureElectronAPI.announcements.subscribe(email, vars));
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/announcements/fetcher.js
git commit -m "feat(announcements): renderer fetcher wrapper"
```

---

## Task 16: Renderer — bell component

**Files:**
- Create: `src/renderer/modules/announcements/bell.js`

- [ ] **Step 1: Create the bell component**

Create `src/renderer/modules/announcements/bell.js`:
```javascript
/**
 * Bell icon + badge. Click opens the announcements panel.
 */
export function createBell({ onClick }) {
  const bell = document.getElementById('announcements-bell');
  const badge = document.getElementById('announcements-badge');
  if (!bell || !badge) return { updateBadge: () => {} };

  bell.addEventListener('click', (e) => {
    e.preventDefault();
    onClick();
  });

  function updateBadge(unreadCount) {
    if (unreadCount > 0) {
      badge.textContent = String(unreadCount);
      badge.classList.remove('d-none');
      bell.classList.add('has-unread');
    } else {
      badge.textContent = '';
      badge.classList.add('d-none');
      bell.classList.remove('has-unread');
    }
  }

  return { updateBadge };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/announcements/bell.js
git commit -m "feat(announcements): renderer bell component"
```

---

## Task 17: Renderer — panel component

**Files:**
- Create: `src/renderer/modules/announcements/panel.js`

- [ ] **Step 1: Create the panel**

Create `src/renderer/modules/announcements/panel.js`:
```javascript
/**
 * Announcements panel. Lists items (DOM-built), shows detail view
 * (sanitized markdown), handles subscribe CTA click.
 */
import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';
import { renderMarkdownInto, buildAnnouncementListItem } from './dom-utils.js';

export function createPanel({ fetcher, seenTracking, onCtaClick, trackEvent }) {
  const listEl = document.getElementById('announcements-list');
  const detailEl = document.getElementById('announcements-detail');
  const emptyEl = document.getElementById('announcements-empty');
  const ctaEl = document.getElementById('announcements-subscribe-cta');

  if (ctaEl) {
    ctaEl.addEventListener('click', (e) => {
      e.preventDefault();
      trackEvent('announcement_cta_clicked', { source: 'panel_footer' });
      onCtaClick();
    });
  }

  async function render(items, seenIds) {
    if (!listEl) return;
    listEl.replaceChildren();
    if (!items || items.length === 0) {
      emptyEl.classList.remove('d-none');
      return;
    }
    emptyEl.classList.add('d-none');

    items.forEach(item => {
      const isUnread = !seenIds.includes(item.id);
      const node = buildAnnouncementListItem(item, isUnread);
      node.addEventListener('click', async () => {
        await showDetail(item);
        await seenTracking.markSeen(item.id);
        node.classList.remove('unread');
        trackEvent('announcement_viewed', { id: item.id, severity: item.severity, source: 'panel' });
      });
      listEl.appendChild(node);
    });
  }

  async function showDetail(item) {
    const body = await fetcher.getBody(item.path);
    detailEl.replaceChildren();

    const backBtn = document.createElement('button');
    backBtn.classList.add('btn', 'btn-sm', 'btn-link');
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      detailEl.classList.add('d-none');
      listEl.classList.remove('d-none');
    });
    detailEl.appendChild(backBtn);

    const titleEl = document.createElement('h5');
    titleEl.textContent = item.title || '';
    detailEl.appendChild(titleEl);

    const bodyContainer = document.createElement('div');
    bodyContainer.classList.add('announcement-body');
    if (body) {
      renderMarkdownInto(bodyContainer, body);
    } else {
      bodyContainer.textContent = 'Could not load announcement body.';
    }
    detailEl.appendChild(bodyContainer);

    detailEl.classList.remove('d-none');
    listEl.classList.add('d-none');
  }

  function open() { safeShowModal('#announcementsPanel'); }
  function close() { safeHideModal('#announcementsPanel'); }

  return { render, open, close };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/announcements/panel.js
git commit -m "feat(announcements): renderer panel component"
```

---

## Task 18: Renderer — banner component

**Files:**
- Create: `src/renderer/modules/announcements/banner.js`

- [ ] **Step 1: Create the banner**

Create `src/renderer/modules/announcements/banner.js`:
```javascript
/**
 * Feature-severity top banner. One at a time, dismissible.
 */
export function createBanner({ seenTracking, onClick, trackEvent }) {
  const bannerEl = document.getElementById('announcements-banner');
  const textEl = document.getElementById('announcements-banner-text');
  const closeBtn = document.getElementById('announcements-banner-close');

  let currentItem = null;

  function show(item) {
    if (!bannerEl || !textEl) return;
    currentItem = item;
    textEl.textContent = item.title || '';
    bannerEl.classList.remove('d-none');
  }

  function hide() {
    if (!bannerEl) return;
    bannerEl.classList.add('d-none');
    currentItem = null;
  }

  if (bannerEl) {
    bannerEl.addEventListener('click', (e) => {
      if (e.target === closeBtn || (closeBtn && closeBtn.contains(e.target))) return;
      if (currentItem) {
        trackEvent('announcement_viewed', { id: currentItem.id, severity: currentItem.severity, source: 'banner_click' });
        onClick(currentItem);
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (currentItem) {
        await seenTracking.markSeen(currentItem.id);
        trackEvent('announcement_dismissed', { id: currentItem.id, severity: currentItem.severity, source: 'banner_x' });
      }
      hide();
    });
  }

  return { show, hide };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/announcements/banner.js
git commit -m "feat(announcements): renderer banner component"
```

---

## Task 19: Renderer — urgent modal component

**Files:**
- Create: `src/renderer/modules/announcements/urgent-modal.js`

- [ ] **Step 1: Create the urgent modal**

Create `src/renderer/modules/announcements/urgent-modal.js`:
```javascript
/**
 * Urgent-severity blocking modal. Queue one at a time.
 */
import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';
import { renderMarkdownInto } from './dom-utils.js';

export function createUrgentModal({ fetcher, seenTracking, trackEvent }) {
  const titleEl = document.getElementById('announcements-urgent-title');
  const bodyEl = document.getElementById('announcements-urgent-body');
  const okBtn = document.getElementById('announcements-urgent-ok');
  let queue = [];

  async function showNext() {
    if (queue.length === 0) return;
    const item = queue[0];
    if (titleEl) titleEl.textContent = item.title || '';
    const body = await fetcher.getBody(item.path);
    if (bodyEl) {
      if (body) {
        renderMarkdownInto(bodyEl, body);
      } else {
        bodyEl.textContent = 'Could not load announcement body.';
      }
    }
    safeShowModal('#announcementsUrgentModal');
    trackEvent('announcement_viewed', { id: item.id, severity: item.severity, source: 'urgent_modal' });
  }

  if (okBtn) {
    okBtn.addEventListener('click', async () => {
      const item = queue.shift();
      if (item) {
        await seenTracking.markSeen(item.id);
        trackEvent('announcement_dismissed', { id: item.id, severity: item.severity, source: 'urgent_got_it' });
      }
      safeHideModal('#announcementsUrgentModal');
      if (queue.length > 0) setTimeout(() => showNext(), 300);
    });
  }

  function enqueue(items) {
    queue = [...items];
    if (queue.length > 0) showNext();
  }

  return { enqueue };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/announcements/urgent-modal.js
git commit -m "feat(announcements): renderer urgent modal component"
```

---

## Task 20: Renderer — subscribe dialog

**Files:**
- Create: `src/renderer/modules/announcements/subscribe-dialog.js`

- [ ] **Step 1: Create the subscribe dialog**

Create `src/renderer/modules/announcements/subscribe-dialog.js`:
```javascript
/**
 * Email subscribe dialog. Validates email format, calls Mailgun via IPC,
 * handles success / already-subscribed / network error states.
 */
import { safeShowModal, safeHideModal } from '../ui/bootstrap-helpers.js';
import { buildResultAlert } from './dom-utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createSubscribeDialog({ fetcher, trackEvent, appVersion, platform }) {
  const emailInput = document.getElementById('announcements-subscribe-email');
  const metadataCheck = document.getElementById('announcements-subscribe-metadata');
  const resultEl = document.getElementById('announcements-subscribe-result');
  const submitBtn = document.getElementById('announcements-subscribe-submit');
  const form = document.getElementById('announcements-subscribe-form');

  function reset() {
    if (emailInput) { emailInput.value = ''; emailInput.classList.remove('is-invalid'); }
    if (metadataCheck) metadataCheck.checked = false;
    if (resultEl) {
      resultEl.classList.add('d-none');
      resultEl.replaceChildren();
    }
    if (submitBtn) submitBtn.disabled = false;
  }

  function showResult(kind, message) {
    if (!resultEl) return;
    resultEl.classList.remove('d-none');
    resultEl.replaceChildren(buildResultAlert(kind, message));
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = (emailInput?.value || '').trim();
      if (!EMAIL_RE.test(email)) {
        emailInput?.classList.add('is-invalid');
        return;
      }
      emailInput?.classList.remove('is-invalid');
      submitBtn.disabled = true;

      const includedMetadata = !!metadataCheck?.checked;
      const vars = includedMetadata ? { version: appVersion, platform } : {};

      const result = await fetcher.subscribe(email, vars);
      if (!result) {
        showResult('error', 'Could not reach the subscription server. Try again?');
        submitBtn.disabled = false;
        return;
      }
      if (result.ok && result.code === 'subscribed') {
        showResult('success', 'Check your email to confirm your subscription.');
        trackEvent('announcement_subscribe_completed', { result: 'new', included_metadata: includedMetadata });
        setTimeout(() => safeHideModal('#announcementsSubscribeDialog'), 2000);
      } else if (result.ok && result.code === 'already_subscribed') {
        showResult('info', "You're already subscribed. Check your inbox if you haven't confirmed yet.");
        trackEvent('announcement_subscribe_completed', { result: 'already_subscribed', included_metadata: includedMetadata });
        setTimeout(() => safeHideModal('#announcementsSubscribeDialog'), 2000);
      } else if (result.code === 'network_error') {
        showResult('error', 'Could not reach the subscription server. Try again?');
        submitBtn.disabled = false;
      } else {
        showResult('error', 'Something went wrong. Email support@mxvoice.app if this keeps happening.');
        submitBtn.disabled = false;
      }
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => { e.preventDefault(); });
  }

  function open() {
    reset();
    safeShowModal('#announcementsSubscribeDialog');
  }

  return { open };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/announcements/subscribe-dialog.js
git commit -m "feat(announcements): renderer subscribe dialog"
```

---

## Task 21: Renderer — orchestration (index.js)

**Files:**
- Create: `src/renderer/modules/announcements/index.js`

- [ ] **Step 1: Create the orchestration module**

Create `src/renderer/modules/announcements/index.js`:
```javascript
/**
 * Announcements module orchestration. Wires together fetcher, seen tracking,
 * audience filter, bell, panel, banner, urgent modal, subscribe dialog.
 * Exposes `initAnnouncements()` for the renderer entry point.
 */
import { fetcher } from './fetcher.js';
import { createSeenTracking } from './seen-tracking.js';
import { passesAudienceFilter, isExpired } from './audience.js';
import { createBell } from './bell.js';
import { createPanel } from './panel.js';
import { createBanner } from './banner.js';
import { createUrgentModal } from './urgent-modal.js';
import { createSubscribeDialog } from './subscribe-dialog.js';

function trackEvent(name, properties) {
  window.secureElectronAPI?.analytics?.trackEvent?.(name, properties || {});
}

function unwrap(response) {
  if (response && typeof response === 'object' && 'value' in response) return response.value;
  return response;
}

export async function initAnnouncements() {
  try {
    const seenTracking = createSeenTracking();

    // Resolve app version and platform
    const versionResponse = await window.secureElectronAPI?.app?.getVersion?.();
    const appVersion = (typeof versionResponse === 'string' ? versionResponse : unwrap(versionResponse)) || '0.0.0';
    const platform = window.secureElectronAPI?.platform || (navigator.platform?.toLowerCase().includes('mac') ? 'darwin' : 'unknown');
    const ctx = { version: appVersion, platform };

    // Construct components
    const subscribeDialog = createSubscribeDialog({ fetcher, trackEvent, appVersion, platform });
    let panel; // forward declared so bell's onClick can reference it
    const bell = createBell({ onClick: () => panel?.open() });
    const banner = createBanner({
      seenTracking,
      onClick: () => panel?.open(),
      trackEvent,
    });
    const urgentModal = createUrgentModal({ fetcher, seenTracking, trackEvent });
    panel = createPanel({
      fetcher,
      seenTracking,
      onCtaClick: () => subscribeDialog.open(),
      trackEvent,
    });

    // Expose public API for other modules (help menu IPC, tour, release modal CTA)
    window.mxvoiceAnnouncements = {
      openPanel: () => panel.open(),
      openSubscribe: () => subscribeDialog.open(),
    };

    // Wire the "open subscribe" IPC event from the main process (Help menu item)
    window.secureElectronAPI?.events?.onOpenSubscribe?.(() => {
      subscribeDialog.open();
    });

    // Initial refresh
    await refresh(ctx, seenTracking, bell, panel, banner, urgentModal);

    // Periodic refresh every 6 hours
    setInterval(() => {
      refresh(ctx, seenTracking, bell, panel, banner, urgentModal).catch(() => {});
    }, 6 * 60 * 60 * 1000);
  } catch (err) {
    console.warn('Announcements init failed', err);
  }
}

async function refresh(ctx, seenTracking, bell, panel, banner, urgentModal) {
  const manifest = await fetcher.getManifest();
  if (!manifest || !Array.isArray(manifest.announcements)) {
    bell.updateBadge(0);
    await panel.render([], []);
    return;
  }
  const now = new Date();
  const visible = manifest.announcements.filter(a =>
    passesAudienceFilter(a, ctx) && !isExpired(a, now)
  );
  const seenIds = await seenTracking.getSeen();

  const unread = visible.filter(a => !seenIds.includes(a.id));
  const unreadFeature = unread.filter(a => a.severity === 'feature');
  const unreadUrgent = unread.filter(a => a.severity === 'urgent');

  bell.updateBadge(unread.length);
  await panel.render(visible, seenIds);

  // Feature banner: newest unread feature
  if (unreadFeature.length > 0) {
    banner.show(unreadFeature[0]);
  } else {
    banner.hide();
  }

  // Urgent modal queue
  if (unreadUrgent.length > 0) {
    urgentModal.enqueue(unreadUrgent);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/modules/announcements/index.js
git commit -m "feat(announcements): renderer orchestration"
```

---

## Task 22: Wire renderer init + CTA placements

**Files:**
- Modify: `src/renderer.js`
- Modify: `src/main/modules/app-setup.js`
- Modify: `src/renderer/modules/event-coordination/ui-interaction-events.js`
- Modify: `src/renderer/modules/whats-new/tours.js`
- Modify: `src/renderer/modules/whats-new/index.js`

- [ ] **Step 1: Initialize announcements from renderer entry**

In `src/renderer.js`, add near where other renderer modules are initialized (search for `whats-new` or tour init for reference):
```javascript
import { initAnnouncements } from './renderer/modules/announcements/index.js';

// After DOM ready and other renderer init:
initAnnouncements();
```

- [ ] **Step 2: Add Help menu item (both menu blocks)**

In `src/main/modules/app-setup.js`, locate the Help submenu — there are two blocks around lines 667 and 772 (macOS and non-macOS). In each, add this item adjacent to the existing "Release Notes" item:
```javascript
{
  label: 'Get Email Updates…',
  click: () => {
    mainWindow?.webContents.send('announcements:open-subscribe');
  }
},
```

- [ ] **Step 3: Add CTA to release-notes modal footer**

In `src/renderer/modules/event-coordination/ui-interaction-events.js`, find the `updateReleaseNotesListener` function (around line 86). After the `modalBody` assignment block but still inside the listener, append:
```javascript
// Append subscribe CTA to modal footer (idempotent — only add once)
const modalFooter = document.querySelector('#newReleaseModal .modal-footer');
if (modalFooter && !modalFooter.querySelector('.announcements-release-cta')) {
  const cta = document.createElement('a');
  cta.href = '#';
  cta.classList.add('announcements-release-cta', 'text-muted', 'small', 'me-auto');
  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '📧 ';
  const label = document.createElement('span');
  label.textContent = 'Want release news by email? ';
  const strong = document.createElement('strong');
  strong.textContent = 'Subscribe';
  cta.appendChild(icon);
  cta.appendChild(label);
  cta.appendChild(strong);
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    window.secureElectronAPI?.analytics?.trackEvent?.('announcement_cta_clicked', { source: 'release_modal_footer' });
    window.mxvoiceAnnouncements?.openSubscribe?.();
  });
  modalFooter.prepend(cta);
}
```

- [ ] **Step 4: Add subscribe CTA step to What's New tour**

In `src/renderer/modules/whats-new/tours.js`, append a new step to the end of the current version's `steps` array (e.g., `'4.3.0'` tour). Note: this step does not target a specific element, it renders as a centered popover.
```javascript
{
  title: 'Stay in the loop',
  description: "Want to hear about new releases and important updates? <a href=\"#\" id=\"tour-subscribe-link\">Subscribe for email updates</a> — totally optional, unsubscribe any time.",
},
```

- [ ] **Step 5: Wire the tour subscribe link click**

In `src/renderer/modules/whats-new/index.js`, add a document-level click listener (place after the module's existing init code):
```javascript
// Handle the tour's "Subscribe for email updates" link click
document.addEventListener('click', (e) => {
  const target = e.target;
  if (target && target.id === 'tour-subscribe-link') {
    e.preventDefault();
    window.secureElectronAPI?.analytics?.trackEvent?.('announcement_cta_clicked', { source: 'tour_final_step' });
    window.mxvoiceAnnouncements?.openSubscribe?.();
  }
});
```

- [ ] **Step 6: Rebuild preload**

Run: `npm run build:preload`
Expected: clean build.

- [ ] **Step 7: Run all unit tests**

Run: `npm run test:unit`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer.js src/main/modules/app-setup.js src/renderer/modules/event-coordination/ui-interaction-events.js src/renderer/modules/whats-new/tours.js src/renderer/modules/whats-new/index.js src/preload/preload-bundle.cjs
git commit -m "feat(announcements): init + CTA placements (help menu, release modal, tour)"
```

---

## Task 23: CSS for new components

**Files:**
- Modify: `src/stylesheets/style.css` (or equivalent — verify path)

- [ ] **Step 1: Verify the main stylesheet path**

Run: `ls src/stylesheets/ 2>/dev/null || ls src/css/ 2>/dev/null || ls assets/css/ 2>/dev/null`
Note the main CSS file path. Use it in the next step.

- [ ] **Step 2: Append CSS rules**

Append to the main stylesheet identified above:
```css
/* Announcements bell + badge */
.announcements-bell {
  position: relative;
  display: inline-block;
  color: var(--bs-secondary-color, #6c757d);
  padding: 0 8px;
  text-decoration: none;
}
.announcements-bell:hover { color: var(--bs-body-color, #212529); }
.announcements-bell.has-unread { color: var(--bs-danger, #dc3545); }

.announcements-badge {
  position: absolute;
  top: -4px;
  right: 0;
  background: var(--bs-danger, #dc3545);
  color: #fff;
  border-radius: 10px;
  min-width: 16px;
  height: 16px;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  padding: 0 4px;
  font-weight: bold;
}

/* Announcements banner */
.announcements-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(90deg, #0d6efd, #6610f2);
  color: #fff;
  padding: 10px 16px;
  cursor: pointer;
}
.announcements-banner-body { flex: 1; }
.announcements-banner .btn-close { margin-left: 12px; }

/* Announcement list items */
.announcement-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--bs-border-color, #dee2e6);
  cursor: pointer;
}
.announcement-item:hover { background: var(--bs-tertiary-bg, #f8f9fa); }
.announcement-item.unread .announcement-item-title { font-weight: bold; }
.announcement-item-title { margin-bottom: 4px; }
.announcement-item-meta {
  font-size: 12px;
  color: var(--bs-secondary-color, #6c757d);
}
.announcement-severity {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  margin-left: 8px;
  font-size: 10px;
  text-transform: uppercase;
}
.severity-info { background: #cfe2ff; color: #084298; }
.severity-feature { background: #d1e7dd; color: #0f5132; }
.severity-urgent { background: #f8d7da; color: #842029; }
```

- [ ] **Step 3: Commit**

```bash
git add src/stylesheets/style.css
git commit -m "feat(announcements): CSS for bell, banner, panel items"
```

---

## Task 24: Seed welcome announcement

**Files:**
- Create: `announcements/2026-04-09-welcome.md`

- [ ] **Step 1: Create the seed announcement**

Create `announcements/2026-04-09-welcome.md`:
```markdown
---
title: Welcome to Mx. Voice announcements
published: 2026-04-09T12:00:00Z
severity: info
email: false
---

This is the first Mx. Voice announcement! From now on, you'll see release news,
important bug notices, and the occasional tip right here in the app.

If you'd like to get these updates by email too, use the **Subscribe** link
below — it's completely optional and you can unsubscribe any time.
```

Note: `email: false` intentionally — the first seed must not send to the freshly-created list.

- [ ] **Step 2: Dry-run the publish script to confirm it parses**

Run: `node scripts/publish-announcements.mjs --dry-run`
Expected: Reports "Read 1 announcement(s)", shows a generated manifest with the welcome entry, "0 new email-flagged announcement(s) to send".

- [ ] **Step 3: Commit**

```bash
git add announcements/2026-04-09-welcome.md
git commit -m "feat(announcements): seed welcome announcement"
```

Note: Do NOT manually update `manifest.json` here. When this branch eventually lands on `main`, the GitHub Action will regenerate it automatically.

---

## Task 25: Manual integration smoke test

No new files. Run the app end-to-end.

- [ ] **Step 1: Start the app**

Run: `ANALYTICS_ENABLED=1 npm start`

- [ ] **Step 2: Verify bell icon renders**

Expected: Bell icon visible in the search column header near the profile indicator.

- [ ] **Step 3: Verify panel opens and shows empty state**

Click the bell.
Expected: Announcements panel modal opens. Since the local `manifest.json` is still empty (the Action hasn't run yet), shows "No announcements yet."

- [ ] **Step 4: Verify subscribe CTA opens the dialog**

Click the subscribe CTA at the bottom of the panel.
Expected: Subscribe dialog opens.
- Enter invalid email → red validation state after Submit.
- Enter valid email → Submit button enabled, click Submit → result shown (expected: error, since `MAILGUN_API_KEY` is not set in dev). This confirms the full path UI → IPC → main.

- [ ] **Step 5: Verify Help menu entry**

Expected: Help → "Get Email Updates…" opens the subscribe dialog.

- [ ] **Step 6: Verify release notes modal CTA (requires simulating an update)**

Optional manual verification — if straightforward, trigger the auto-update flow in test mode; otherwise defer to post-merge testing. The CTA should render in the modal footer when the release notes modal is shown.

- [ ] **Step 7: Verify PostHog events (check PostHog dashboard)**

With `ANALYTICS_ENABLED=1`, click the subscribe CTA and check the PostHog dashboard for `announcement_cta_clicked` with `source: "panel_footer"`. Then try a subscribe attempt — check for `announcement_subscribe_completed` within ~30 seconds.

- [ ] **Step 8: No commit** (manual verification only; fix any issues with targeted follow-up commits)

---

## Task 26: Full test suite run and final verification

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All existing tests still pass; all new announcements tests pass.

- [ ] **Step 2: Rebuild preload (final)**

Run: `npm run build:preload`
Expected: clean build.

- [ ] **Step 3: Check for lint if configured**

Run: `ls .eslintrc* 2>/dev/null && npm run lint 2>/dev/null || echo "no lint script"`
If lint is configured and fails, fix errors and commit.

- [ ] **Step 4: Final commit if small fixes were needed**

If touch-ups were required, commit them:
```bash
git add -A
git commit -m "fix(announcements): small adjustments from final verification"
```

---

## Post-implementation manual checklist (NOT tasks — operational setup)

These happen outside the code and are required before the feature is fully live:

1. **Configure Mailgun:**
   - Create a production mailing list (e.g., `announcements@mg.mxvoice.app`).
   - Enable double opt-in in the list settings.
   - Configure the confirmation email template (Mx. Voice branded).
   - Configure the unsubscribe footer template.
   - Generate an API key.

2. **Add GitHub secrets and variables:**
   - Repo secret: `MAILGUN_API_KEY`.
   - Repo variables: `MAILGUN_DOMAIN`, `MAILGUN_LIST_ADDRESS`, `MAILGUN_FROM`.

3. **Test the GitHub Action on a PR:**
   - Create a PR that adds a test announcement with `email: false`.
   - Verify the Action regenerates `manifest.json` correctly when merged.

4. **First real email send:**
   - Create a release announcement markdown file with `email: true`.
   - Test locally with `MAILGUN_MODE=sandbox` and your own email pre-authorized in the sandbox.
   - Verify the email renders correctly and unsubscribe link works.
   - Merge to main and let the GitHub Action send for real.

---

## Spec Coverage Check

| Spec section | Implemented by task |
|---|---|
| Data model (frontmatter fields) | Task 2 |
| Manifest + schema_version | Tasks 2, 8 |
| sent.json ledger | Task 3 |
| In-app UI: bell + badge | Tasks 13, 16 |
| In-app UI: panel + list + detail | Tasks 13, 14, 17 |
| In-app UI: feature banner | Tasks 13, 18 |
| In-app UI: urgent modal | Tasks 13, 14, 19 |
| Severity → treatment mapping | Task 21 (refresh function) |
| Multi-announcement precedence | Task 21 |
| Always-visible CTA (no local state) | Task 13 (HTML static), Task 17 (panel footer), Task 20 (dialog no pre-fill), Task 22 (help menu, release modal, tour) |
| Help menu entry | Task 22 |
| Panel footer CTA | Tasks 13, 17 |
| Release modal CTA | Task 22 |
| Tour final step CTA | Task 22 |
| Signup dialog (email + version/OS opt-in) | Tasks 13, 20 |
| "Already subscribed" → success | Tasks 9, 20 |
| Double opt-in | Manual setup (post-impl checklist) |
| Unsubscribe link | Task 4 (template footer) |
| Publishing script (dry-run/send/resend) | Tasks 2, 3, 4, 5, 6 |
| GitHub Action | Task 7 |
| Mailgun sandbox default | Task 5 (resolveMailgunConfig) |
| Auto-update modal unchanged | Task 22 only appends CTA, does not modify existing flow |
| Per-profile seen tracking | Task 11 |
| Manifest fetch + cache (launch + 6h + offline) | Tasks 8, 10 (main init), 21 (refresh loop) |
| Body lazy fetch + cache | Task 9 |
| Audience filter (version + platform) | Task 12 |
| PostHog events (4 events) | Tasks 17, 18, 19, 20, 22 |
| Privacy boundary (no email→PostHog, no UUID→Mailgun) | Tasks 9, 20 keep these separate; no code crosses the boundary |
| Accessibility (keyboard, ARIA) | Task 13 (aria-label, aria-live, role, aria-hidden) |
| Retraction (delete md file) | Handled automatically — the publishing script regenerates manifest from the filesystem each run |

No gaps.

## Placeholder Scan

Searched for "TBD", "TODO", "fill in", "similar to Task", "add appropriate" — none present. Every step shows concrete code or exact commands.

## Type Consistency Check

- Main module: `fetchManifest`, `getCachedManifest`, `fetchBody`, `subscribeEmail` — consistent signatures across Tasks 8 and 9, and match the IPC handlers in Task 10 and preload in Task 10.
- Seen tracking: `getSeen`, `markSeen`, `isSeen` — consistent across Task 11 and consumers in Tasks 17, 18, 19.
- Audience filter: `passesAudienceFilter(announcement, ctx)` and `isExpired(announcement, now)` — consistent across Task 12 and use in Task 21.
- Renderer components: `createBell`, `createPanel`, `createBanner`, `createUrgentModal`, `createSubscribeDialog` — all factory pattern with options object, consistent imports in Task 21.
- DOM utils: `renderMarkdownInto(el, md)`, `buildAnnouncementListItem(ann, isUnread)`, `buildResultAlert(kind, message)` — consistent across Tasks 14 and usages in 17, 19, 20.
- PostHog event names: `announcement_viewed`, `announcement_dismissed`, `announcement_cta_clicked`, `announcement_subscribe_completed` — consistent across all firing sites.
- Public API: `window.mxvoiceAnnouncements.openPanel()` and `.openSubscribe()` — defined in Task 21, referenced in Task 22 release-modal CTA and tour click handler.
- Fetcher: `getManifest`, `getBody`, `subscribe` — consistent between Task 15 and consumers in Tasks 17, 19, 20, 21.

No mismatches found.
