import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  WINDOWS_PUBLISHER_THUMBPRINT,
  buildSignArgs,
  signFiles,
  verifySignedFile
} = require('../../../build/win-sign-utils.cjs');

describe('Windows publisher signing', () => {
  it('selects the repository-pinned certificate for every file', () => {
    const files = ['C:\\dist\\Mx.-Voice-Setup-4.4.0.exe', 'C:\\dist\\__uninstaller-nsis-mxvoice.exe'];
    expect(buildSignArgs(files)).toEqual([
      'sign',
      '/s', 'My',
      '/sha1', WINDOWS_PUBLISHER_THUMBPRINT,
      '/fd', 'sha256',
      '/td', 'sha256',
      '/tr', 'http://ts.ssl.com',
      ...files
    ]);
  });

  it('passes filenames as process arguments instead of shell text', () => {
    const runFile = vi.fn();
    const filename = 'C:\\dist\\Setup & injected.exe';

    signFiles('C:\\sdk\\signtool.exe', [filename], runFile);
    expect(runFile).toHaveBeenCalledWith(
      'C:\\sdk\\signtool.exe',
      expect.arrayContaining([filename]),
      { stdio: 'inherit', timeout: 300000 }
    );
  });

  it('accepts a trusted signature only when its signer matches the pinned publisher', () => {
    const runFile = vi.fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(`Valid|${WINDOWS_PUBLISHER_THUMBPRINT.toLowerCase()}\r\n`);

    expect(() => verifySignedFile('signtool.exe', 'C:\\dist\\Setup.exe', runFile)).not.toThrow();
    expect(runFile.mock.calls[0]).toEqual([
      'signtool.exe',
      ['verify', '/pa', '/all', 'C:\\dist\\Setup.exe'],
      { stdio: 'ignore' }
    ]);
    expect(runFile.mock.calls[1][0]).toBe('powershell.exe');
    expect(runFile.mock.calls[1][1]).toEqual(expect.arrayContaining([
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'C:\\dist\\Setup.exe'
    ]));
    expect(runFile.mock.calls[1][1][3]).toContain('param([string]$File)');
  });

  it('rejects a valid signature from a different publisher', () => {
    const runFile = vi.fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('Valid|AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n');

    expect(() => verifySignedFile('signtool.exe', 'C:\\dist\\Setup.exe', runFile))
      .toThrow('expected pinned publisher');
  });

  it('rejects invalid Authenticode status and propagates signtool failures', () => {
    const invalidStatus = vi.fn()
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(`HashMismatch|${WINDOWS_PUBLISHER_THUMBPRINT}\n`);
    expect(() => verifySignedFile('signtool.exe', 'C:\\dist\\Setup.exe', invalidStatus))
      .toThrow('Authenticode status');

    const failedVerification = vi.fn(() => { throw new Error('signature verification failed'); });
    expect(() => verifySignedFile('signtool.exe', 'C:\\dist\\Setup.exe', failedVerification))
      .toThrow('signature verification failed');
  });
});
