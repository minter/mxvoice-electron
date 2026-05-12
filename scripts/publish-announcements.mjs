#!/usr/bin/env node
/**
 * Publish announcements: regenerate manifest.json, send new email-flagged
 * announcements via Mailgun, update sent.json.
 */
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);

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

export function renderEmail(item) {
  const templatePath = path.join(scriptDir, 'email-template.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyHtml = marked.parse(item.body);
  const html = template
    .replace(/\{\{title\}\}/g, escapeHtml(item.title))
    .replace(/\{\{body\}\}/g, bodyHtml);
  const text = markdownToText(item.body);
  return { subject: item.title, html, text };
}

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function markdownToText(md) {
  return String(md)
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function main(argv, env, cwd) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const send = args.includes('--send');
  const resendFlag = args.indexOf('--resend');
  const resendId = resendFlag !== -1 ? args[resendFlag + 1] : null;

  if (resendFlag !== -1 && !resendId) {
    console.error('Error: --resend requires an <id> argument');
    process.exit(1);
  }

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
      saveSentLedger(sentPath, ledger);
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
