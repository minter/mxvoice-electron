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
  const text = stripHtml(bodyHtml);
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
