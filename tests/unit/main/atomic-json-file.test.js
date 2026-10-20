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

  it('reports missing when neither exists', async () => {
    expect(await readJsonWithFallback(file)).toEqual({ status: 'missing' });
  });

  it('quarantine renames to .corrupt-<ISO ts> and returns the new path', async () => {
    nodeFs.writeFileSync(file, 'bad');
    const moved = await quarantine(file);
    expect(moved.startsWith(`${file}.corrupt-`)).toBe(true);
    expect(nodeFs.existsSync(file)).toBe(false);
    expect(nodeFs.readFileSync(moved, 'utf8')).toBe('bad');
  });
});
