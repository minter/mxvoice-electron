import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nodeFs from 'fs';
import os from 'os';
import path from 'path';
import { writeJsonAtomic, readJsonWithFallback, quarantine } from '../../../src/main/modules/atomic-json-file.js';

describe('atomic-json-file', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = nodeFs.mkdtempSync(path.join(os.tmpdir(), 'atomic-json-'));
    file = path.join(dir, 'data.json');
  });

  afterEach(() => {
    nodeFs.rmSync(dir, { recursive: true, force: true });
  });

  it('replaces the file without leaving temp files', async () => {
    await writeJsonAtomic(file, { a: 1 });
    await writeJsonAtomic(file, { a: 2 });
    expect(JSON.parse(nodeFs.readFileSync(file, 'utf8'))).toEqual({ a: 2 });
    expect(nodeFs.readdirSync(dir)).toEqual(['data.json']);
  });

  it('keeps the previous generation when keepPrevious', async () => {
    await writeJsonAtomic(file, { a: 1 });
    await writeJsonAtomic(file, { a: 2 }, { keepPrevious: true });
    expect(JSON.parse(nodeFs.readFileSync(`${file}.prev`, 'utf8'))).toEqual({ a: 1 });
    expect(JSON.parse(nodeFs.readFileSync(file, 'utf8'))).toEqual({ a: 2 });
    expect(nodeFs.readdirSync(dir).sort()).toEqual(['data.json', 'data.json.prev']);
  });

  it('a crash between temp write and rename leaves the old file intact', async () => {
    await writeJsonAtomic(file, { a: 1 });
    const fakeFs = {
      ...nodeFs,
      promises: {
        ...nodeFs.promises,
        rename: vi.fn().mockRejectedValue(Object.assign(new Error('boom'), { code: 'EIO' }))
      }
    };
    await expect(writeJsonAtomic(file, { a: 2 }, { fs: fakeFs })).rejects.toThrow('boom');
    expect(JSON.parse(nodeFs.readFileSync(file, 'utf8'))).toEqual({ a: 1 });
    expect(nodeFs.readdirSync(dir)).toEqual(['data.json']);
  });

  it('retries a transient EPERM rename on win32, then succeeds', async () => {
    const rename = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('perm'), { code: 'EPERM' }))
      .mockRejectedValueOnce(Object.assign(new Error('perm'), { code: 'EPERM' }))
      .mockImplementation((a, b) => nodeFs.promises.rename(a, b));
    const fakeFs = { ...nodeFs, promises: { ...nodeFs.promises, rename } };
    await writeJsonAtomic(file, { a: 3 }, { fs: fakeFs, platform: 'win32' });
    expect(rename).toHaveBeenCalledTimes(3);
    expect(JSON.parse(nodeFs.readFileSync(file, 'utf8'))).toEqual({ a: 3 });
  });

  it('gives up after 5 attempts on win32 and removes the temp file', async () => {
    const rename = vi.fn().mockRejectedValue(Object.assign(new Error('busy'), { code: 'EBUSY' }));
    const fakeFs = { ...nodeFs, promises: { ...nodeFs.promises, rename } };
    await expect(writeJsonAtomic(file, { a: 3 }, { fs: fakeFs, platform: 'win32' })).rejects.toThrow('busy');
    expect(rename).toHaveBeenCalledTimes(5);
    expect(nodeFs.readdirSync(dir)).toEqual([]);
  });

  it('does not retry EPERM off win32', async () => {
    const rename = vi.fn().mockRejectedValue(Object.assign(new Error('perm'), { code: 'EPERM' }));
    const fakeFs = { ...nodeFs, promises: { ...nodeFs.promises, rename } };
    await expect(writeJsonAtomic(file, {}, { fs: fakeFs, platform: 'darwin' })).rejects.toThrow('perm');
    expect(rename).toHaveBeenCalledTimes(1);
  });

  it('reads ok', async () => {
    await writeJsonAtomic(file, { a: 1 });
    expect(await readJsonWithFallback(file)).toEqual({ status: 'ok', value: { a: 1 } });
  });

  it('reads .prev when the main file is truncated JSON', async () => {
    await writeJsonAtomic(file, { a: 1 });
    await writeJsonAtomic(file, { a: 2 }, { keepPrevious: true });
    nodeFs.writeFileSync(file, '{"a": ');
    const result = await readJsonWithFallback(file);
    expect(result.status).toBe('recovered');
    expect(result.value).toEqual({ a: 1 });
  });

  it('reports unreadable, never empty, when both are bad', async () => {
    nodeFs.writeFileSync(file, '{"a": ');
    nodeFs.writeFileSync(`${file}.prev`, 'nope');
    const result = await readJsonWithFallback(file);
    expect(result.status).toBe('unreadable');
    expect(result.value).toBeUndefined();
    expect(typeof result.error).toBe('string');
  });

  it('reports unreadable when main is corrupt and no .prev exists', async () => {
    nodeFs.writeFileSync(file, '{"a": ');
    expect((await readJsonWithFallback(file)).status).toBe('unreadable');
  });

  it('keepPrevious never replaces a good .prev with a corrupt main file', async () => {
    nodeFs.writeFileSync(`${file}.prev`, JSON.stringify({ good: true }));
    nodeFs.writeFileSync(file, '{"a": ');
    await writeJsonAtomic(file, { a: 2 }, { keepPrevious: true });
    expect(JSON.parse(nodeFs.readFileSync(`${file}.prev`, 'utf8'))).toEqual({ good: true });
    expect(JSON.parse(nodeFs.readFileSync(file, 'utf8'))).toEqual({ a: 2 });
  });

  it('keepPrevious leaves .prev alone when the main file is missing', async () => {
    nodeFs.writeFileSync(`${file}.prev`, JSON.stringify({ good: true }));
    await writeJsonAtomic(file, { a: 2 }, { keepPrevious: true });
    expect(JSON.parse(nodeFs.readFileSync(`${file}.prev`, 'utf8'))).toEqual({ good: true });
  });

  it('returns recovered from .prev when the main file is missing', async () => {
    nodeFs.writeFileSync(`${file}.prev`, JSON.stringify({ a: 1 }));
    expect(await readJsonWithFallback(file)).toEqual({ status: 'recovered', value: { a: 1 } });
  });

  it('a copy failure midway leaves the existing .prev byte-identical', async () => {
    await writeJsonAtomic(file, { a: 1 });
    nodeFs.writeFileSync(`${file}.prev`, JSON.stringify({ good: true }));
    const before = nodeFs.readFileSync(`${file}.prev`);
    const copyFile = vi.fn(async (src, dest) => {
      nodeFs.writeFileSync(dest, '{"tru');
      throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' });
    });
    const fakeFs = { ...nodeFs, promises: { ...nodeFs.promises, copyFile } };
    await expect(writeJsonAtomic(file, { a: 2 }, { keepPrevious: true, fs: fakeFs })).rejects.toThrow('ENOSPC');
    expect(nodeFs.readFileSync(`${file}.prev`).equals(before)).toBe(true);
    expect(JSON.parse(nodeFs.readFileSync(file, 'utf8'))).toEqual({ a: 1 });
    expect(nodeFs.readdirSync(dir).sort()).toEqual(['data.json', 'data.json.prev']);
  });

  it('returns error, not .prev, when the main file cannot be read', async () => {
    nodeFs.writeFileSync(file, JSON.stringify({ a: 1 }));
    nodeFs.writeFileSync(`${file}.prev`, JSON.stringify({ stale: true }));
    const readFile = vi.fn(async (p, enc) => {
      if (p === file) throw Object.assign(new Error('locked'), { code: 'EACCES' });
      return nodeFs.promises.readFile(p, enc);
    });
    const fakeFs = { ...nodeFs, promises: { ...nodeFs.promises, readFile } };
    const result = await readJsonWithFallback(file, { fs: fakeFs });
    expect(result.status).toBe('error');
    expect(result.value).toBeUndefined();
    expect(result.error).toContain('locked');
  });

  it('keepPrevious does not touch .prev when the main read errors', async () => {
    nodeFs.writeFileSync(file, JSON.stringify({ a: 1 }));
    nodeFs.writeFileSync(`${file}.prev`, JSON.stringify({ keep: true }));
    const readFile = vi.fn(async (p, enc) => {
      if (p === file) throw Object.assign(new Error('locked'), { code: 'EBUSY' });
      return nodeFs.promises.readFile(p, enc);
    });
    const fakeFs = { ...nodeFs, promises: { ...nodeFs.promises, readFile } };
    await writeJsonAtomic(file, { a: 2 }, { keepPrevious: true, fs: fakeFs });
    expect(JSON.parse(nodeFs.readFileSync(`${file}.prev`, 'utf8'))).toEqual({ keep: true });
  });

  it('skips directory fsync on win32', async () => {
    const open = vi.fn((p, f) => nodeFs.promises.open(p, f));
    const fakeFs = { ...nodeFs, promises: { ...nodeFs.promises, open } };
    await writeJsonAtomic(file, { a: 1 }, { fs: fakeFs, platform: 'win32' });
    expect(open.mock.calls.map((c) => c[0])).not.toContain(dir);
    open.mockClear();
    await writeJsonAtomic(file, { a: 1 }, { fs: fakeFs, platform: 'darwin' });
    expect(open.mock.calls.map((c) => c[0])).toContain(dir);
  });

  it('reports missing when neither exists', async () => {
    expect(await readJsonWithFallback(file)).toEqual({ status: 'missing' });
  });

  it('quarantine renames to .corrupt-<ISO ts> and returns the new path', async () => {
    nodeFs.writeFileSync(file, 'bad');
    const moved = await quarantine(file);
    expect(moved.startsWith(`${file}.corrupt-`)).toBe(true);
    expect(moved.slice(`${file}.corrupt-`.length)).not.toMatch(/[:.]/);
    expect(nodeFs.existsSync(file)).toBe(false);
    expect(nodeFs.readFileSync(moved, 'utf8')).toBe('bad');
  });
});
