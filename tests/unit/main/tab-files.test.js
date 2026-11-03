import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const showOpenDialog = vi.fn();
const showSaveDialog = vi.fn();
vi.mock('electron', () => ({
  default: {
    dialog: {
      showOpenDialog: (...args) => showOpenDialog(...args),
      showSaveDialog: (...args) => showSaveDialog(...args)
    },
    app: { getPath: vi.fn() }
  }
}));
vi.mock('music-metadata', () => ({ parseFile: vi.fn() }));

const fileOperations = (await import('../../../src/main/modules/file-operations.js')).default;
const {
  formatHotkeyTabFile,
  formatHoldingTankTabFile,
  tabFileName
} = await import('../../../src/main/modules/file-operations.js');

let dir;
const win = { id: 'main-window' };

beforeEach(() => {
  showOpenDialog.mockReset();
  showSaveDialog.mockReset();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tab-files-'));
  fileOperations.initializeFileOperations({ getMainWindow: () => win, store: { get: (key) => (key === 'hotkey_directory' ? dir : undefined) } });
});

const allKeys = (hotkeys = {}) => Array.from({ length: 12 }, (_, i) => `f${i + 1}::${hotkeys[`f${i + 1}`] ?? ''}`);

describe('hotkey tab file writer', () => {
  it('writes f1 to f12 in order, empty keys as fN::, then the tab name with spaces as _', () => {
    const text = formatHotkeyTabFile({ tabNumber: 2, tabName: 'Friday Night Show', hotkeys: { f1: '1001', f3: 1003, f12: '7' } });
    expect(text).toBe([...allKeys({ f1: '1001', f3: '1003', f12: '7' }), 'tab_name::Friday_Night_Show', ''].join('\n'));
  });

  it('leaves out tab_name for an unnamed tab', () => {
    expect(formatHotkeyTabFile({ tabNumber: 1, tabName: null, hotkeys: {} })).toBe([...allKeys(), ''].join('\n'));
    expect(formatHotkeyTabFile({ tabNumber: 1, tabName: '   ', hotkeys: {} })).not.toContain('tab_name');
  });

  it('strips CR, LF and other control characters from the tab name, so it cannot add lines', () => {
    const text = formatHotkeyTabFile({ tabName: 'Evil\r\nf1::9999\ttab\u0000x', hotkeys: { f1: '1' } });
    const lines = text.split('\n');
    expect(lines).toHaveLength(14);
    expect(lines[0]).toBe('f1::1');
    expect(lines[12]).toBe('tab_name::Evilf1::9999tabx');
    const parsed = fileOperations.parseHotkeyFileLines(lines);
    expect(parsed.errors).toEqual([]);
    expect(parsed.hotkeys.f1).toBe('1');
  });

  it('leaves out tab_name when the name is only control characters', () => {
    expect(formatHotkeyTabFile({ tabName: '\r\n\t', hotkeys: {} })).not.toContain('tab_name');
  });

  it('round-trips through the reader', () => {
    const text = formatHotkeyTabFile({ tabName: 'A B', hotkeys: { f2: '5' } });
    const parsed = fileOperations.parseHotkeyFileLines(text.split('\n'));
    expect(parsed.errors).toEqual([]);
    expect(parsed.title).toBe('A B');
    expect(parsed.hotkeys.f2).toBe('5');
  });
});

describe('holding tank tab file writer', () => {
  it('writes one song id per line', () => {
    expect(formatHoldingTankTabFile(['12', 34, '5'])).toBe('12\n34\n5\n');
  });

  it('writes an empty file for an empty tab', () => {
    expect(formatHoldingTankTabFile([])).toBe('');
  });
});

describe('default tab file name', () => {
  it('is the tab label plus the extension', () => {
    expect(tabFileName('Preshow', 'hld')).toBe('Preshow.hld');
    expect(tabFileName('Tab 2', 'mrv')).toBe('Tab 2.mrv');
  });

  it('replaces characters invalid in file names with -', () => {
    expect(tabFileName('a/b\\c:d*e?f"g<h>i|j', 'mrv')).toBe('a-b-c-d-e-f-g-h-i-j.mrv');
    expect(tabFileName('line\nbreak', 'hld')).toBe('line-break.hld');
  });

  it('falls back to "Tab" for an empty label', () => {
    expect(tabFileName('', 'hld')).toBe('Tab.hld');
    expect(tabFileName(undefined, 'mrv')).toBe('Tab.mrv');
  });
});

describe('saving a hotkey tab', () => {
  const tab = { tabNumber: 1, tabName: 'Intros', hotkeys: { f1: '1001' } };

  it('defaults the dialog to the hotkey directory and the tab label, writes, and returns the path', async () => {
    const target = path.join(dir, 'out.mrv');
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: target });

    const result = await fileOperations.saveHotkeyTabFile(tab, 'Intros');

    expect(result).toEqual({ success: true, data: { path: target } });
    expect(showSaveDialog).toHaveBeenCalledWith(win, expect.objectContaining({
      defaultPath: path.join(dir, 'Intros.mrv'),
      filters: [{ name: 'Mx. Voice Hotkey Files', extensions: ['mrv'] }]
    }));
    expect(fs.readFileSync(target, 'utf8')).toBe(formatHotkeyTabFile(tab));
  });

  it('writes nothing when the dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' });
    expect(await fileOperations.saveHotkeyTabFile(tab, 'Intros')).toEqual({ success: true, data: { canceled: true } });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('rejects a tab with an id that is not digits, or a key outside f1 to f12, without a dialog', async () => {
    expect(await fileOperations.saveHotkeyTabFile({ hotkeys: { f1: '12a' } }, 'X')).toMatchObject({ success: false });
    expect(await fileOperations.saveHotkeyTabFile({ hotkeys: { f13: '1' } }, 'X')).toMatchObject({ success: false });
    expect(await fileOperations.saveHotkeyTabFile(null, 'X')).toMatchObject({ success: false });
    expect(showSaveDialog).not.toHaveBeenCalled();
  });

  it('reports a write that fails', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(dir, 'missing', 'out.mrv') });
    const result = await fileOperations.saveHotkeyTabFile(tab, 'Intros');
    expect(result.success).toBe(false);
    expect(result.error).toEqual(expect.any(String));
  });

  it('works without a hotkey directory', async () => {
    fileOperations.initializeFileOperations({ getMainWindow: () => null, store: { get: () => undefined } });
    showSaveDialog.mockResolvedValue({ canceled: true });
    await fileOperations.saveHotkeyTabFile(tab, 'Intros');
    expect(showSaveDialog).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'Intros.mrv' }));
  });
});

describe('saving a holding tank tab', () => {
  it('writes the ids, one per line', async () => {
    const target = path.join(dir, 'out.hld');
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: target });

    expect(await fileOperations.saveHoldingTankTabFile(['3', '1'], 'Pre/show')).toEqual({ success: true, data: { path: target } });
    expect(showSaveDialog).toHaveBeenCalledWith(win, expect.objectContaining({
      defaultPath: path.join(dir, 'Pre-show.hld'),
      filters: [{ name: 'Mx. Voice Holding Tank Files', extensions: ['hld'] }]
    }));
    expect(fs.readFileSync(target, 'utf8')).toBe('3\n1\n');
  });

  it('rejects ids that are not digits', async () => {
    expect(await fileOperations.saveHoldingTankTabFile(['1', 'x'], 'X')).toMatchObject({ success: false });
    expect(await fileOperations.saveHoldingTankTabFile('1', 'X')).toMatchObject({ success: false });
    expect(showSaveDialog).not.toHaveBeenCalled();
  });

  it('writes nothing when the dialog is canceled', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true });
    expect(await fileOperations.saveHoldingTankTabFile(['1'], 'X')).toEqual({ success: true, data: { canceled: true } });
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});

describe('loading a hotkey tab', () => {
  const pick = (contents, name = 'in.mrv') => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, contents);
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [file] });
  };

  it('returns the keys and tab name, opening in the hotkey directory', async () => {
    pick('f1::1001\r\nf2::\nf3::1003\ntab_name::Friday_Night\n');
    expect(await fileOperations.loadHotkeyTabFile()).toEqual({
      success: true,
      data: { hotkeys: { f1: '1001', f2: '', f3: '1003' }, tabName: 'Friday Night' }
    });
    expect(showOpenDialog).toHaveBeenCalledWith(win, expect.objectContaining({
      defaultPath: dir,
      filters: [{ name: 'Mx. Voice Hotkey Files', extensions: ['mrv'] }],
      properties: ['openFile']
    }));
  });

  it('returns a null tab name when the file has none', async () => {
    pick('f1::1\n');
    expect((await fileOperations.loadHotkeyTabFile()).data.tabName).toBeNull();
  });

  it('returns the validation errors for a bad file', async () => {
    pick('f1::abc\nf13::1\n');
    const result = await fileOperations.loadHotkeyTabFile();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Line 1: invalid song ID for f1');
    expect(result.error).toContain('Line 2: unknown key "f13"');
  });

  it('returns canceled when the dialog is canceled', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await fileOperations.loadHotkeyTabFile()).toEqual({ success: true, data: { canceled: true } });
  });

  it('reports a file that cannot be read', async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [path.join(dir, 'gone.mrv')] });
    expect(await fileOperations.loadHotkeyTabFile()).toMatchObject({ success: false, error: expect.any(String) });
  });
});

describe('loading a holding tank tab', () => {
  it('keeps only lines that are song ids', async () => {
    const file = path.join(dir, 'list.hld');
    fs.writeFileSync(file, '12\n  34 \nabc\n\n5x\n-7\n78\n');
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [file] });

    expect(await fileOperations.loadHoldingTankTabFile()).toEqual({ success: true, data: { songIds: ['12', '34', '78'] } });
    expect(showOpenDialog).toHaveBeenCalledWith(win, expect.objectContaining({
      filters: [{ name: 'Mx. Voice Holding Tank Files', extensions: ['hld'] }]
    }));
  });

  it('returns canceled when the dialog is canceled', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await fileOperations.loadHoldingTankTabFile()).toEqual({ success: true, data: { canceled: true } });
  });
});

describe('the old main-initiated load path', () => {
  it('is gone', () => {
    expect(fileOperations.loadHotkeysFile).toBeUndefined();
    expect(fileOperations.loadHoldingTankFile).toBeUndefined();
  });
});
