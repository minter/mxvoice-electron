/**
 * Centralized Log Service (Main process)
 *
 * - Sets daily log file path for electron-log
 * - Prunes old logs by retention window
 * - Exposes write/getPaths/exportLogs APIs for IPC
 * - Gates INFO/DEBUG by renderer preference `debug_log_enabled`
 */

import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';

let service = null;

function ensureDirectoryExists(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (_) {
    // ignore
  }
}

function getTodayFilePath(logsDir) {
  const iso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logsDir, `app-${iso}.log`);
}

function safeStringify(value) {
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular Reference]';
        seen.add(val);
      }
      return val;
    });
  } catch (_) {
    return '[unserializable]';
  }
}

function formatLine(level, message, meta = {}, context = null) {
  const timestamp = new Date().toISOString();
  const icon = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'DEBUG' ? '🐛' : 'ℹ️';
  const proc = meta.process || 'main';
  const source = meta.source || 'app';
  let line = `${icon} [${timestamp}] [${level}] [process=${proc}] [source=${source}] ${message}`;
  if (typeof context !== 'undefined' && context !== null) {
    line += ` | Context: ${typeof context === 'object' ? safeStringify(context) : String(context)}`;
  }
  return line;
}

export function initMainLogService({ store, keepDays = 14 } = {}) {
  const logsDir = path.join(app.getPath('userData'), 'logs');
  ensureDirectoryExists(logsDir);

  const currentFile = getTodayFilePath(logsDir);
  // Route electron-log to our daily file
  log.transports.file.resolvePath = () => currentFile;
  // Cap file size; electron-log will rotate when exceeded
  log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB

  // Capture unhandled errors in main without dialog
  log.catchErrors({ showDialog: false });

  // Prune old logs based on retention
  const pruneCutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  try {
    for (const name of fs.readdirSync(logsDir)) {
      const p = path.join(logsDir, name);
      try {
        const st = fs.statSync(p);
        if (st.isFile() && st.mtimeMs < pruneCutoff) {
          try { fs.unlinkSync(p); } catch (_) {}
        }
      } catch (_) {
        // ignore bad entries
      }
    }
  } catch (_) {
    // ignore
  }

  service = {
    write({ level, message, context = null, meta = {} }) {
      const upper = String(level || 'INFO').toUpperCase();
      // Gate info/debug by preference flag
      let debugEnabled = false;
      try { debugEnabled = !!store?.get?.('debug_log_enabled'); } catch (_) {}
      if ((upper === 'INFO' || upper === 'DEBUG') && !debugEnabled) return;

      const line = formatLine(upper, message, meta, context);
      const fn = log[upper.toLowerCase()] || log.info;
      fn(line);
    },

    async exportLogs({ days = 7 } = {}) {
      // Concatenate last N days into a single .log file for easy emailing
      const includeCutoff = Date.now() - Math.max(1, Number(days)) * 24 * 60 * 60 * 1000;
      const files = [];
      try {
        for (const name of fs.readdirSync(logsDir)) {
          if (!name.endsWith('.log')) continue;
          const p = path.join(logsDir, name);
          const st = fs.statSync(p);
          if (st.isFile() && st.mtimeMs >= includeCutoff) files.push({ p, m: st.mtimeMs });
        }
      } catch (_) {}
      files.sort((a, b) => a.m - b.m);

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export Logs',
        defaultPath: path.join(logsDir, `mxvoice-logs-${Date.now()}.log`),
        filters: [{ name: 'Log', extensions: ['log', 'txt'] }]
      });
      if (canceled || !filePath) return { canceled: true };

      const header = [
        `MxVoice Logs Export`,
        `App: ${app.getName()} v${app.getVersion()}`,
        `Platform: ${process.platform} ${process.arch}`,
        `Electron: ${process.versions.electron} | Chrome: ${process.versions.chrome} | Node: ${process.versions.node}`,
        `Exported: ${new Date().toISOString()}`,
        `Included days: ${days}`,
        `Files: ${files.map(f => path.basename(f.p)).join(', ') || '(none)'}`,
        ''.padEnd(80, '=')
      ].join('\n') + '\n\n';

      try {
        fs.writeFileSync(filePath, header, 'utf8');
        for (const { p } of files) {
          fs.appendFileSync(filePath, `\n===== ${path.basename(p)} =====\n`, 'utf8');
          fs.appendFileSync(filePath, fs.readFileSync(p, 'utf8'), 'utf8');
        }
      } catch (e) {
        return { canceled: false, success: false, error: e?.message };
      }
      return { canceled: false, success: true, filePath };
    },

    getPaths() {
      return { logsDir, current: currentFile };
    }
  };

  return service;
}

export function getLogService() {
  return service;
}

export default {
  initMainLogService,
  getLogService
};


