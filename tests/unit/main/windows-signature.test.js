import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { inspectAuthenticodeSignature, verifyExpectedPublisher } = require('../../../build/win-sign-utils.cjs');

function powershellResult({ status = 'Valid', publisher = 'Haynie Minter' } = {}) {
  return {
    status: 0,
    stdout: JSON.stringify({
      Status: status,
      Publisher: publisher,
      Subject: publisher ? `CN=${publisher}, O=${publisher}` : null,
      Thumbprint: publisher ? 'ABC123' : null,
    }),
    stderr: '',
  };
}

describe('Windows publisher verification', () => {
  it('accepts a valid installer from the pinned publisher', () => {
    const runPowerShell = vi.fn(() => powershellResult());

    expect(verifyExpectedPublisher('C:\\dist\\setup.exe', 'Haynie Minter', runPowerShell))
      .toMatchObject({ status: 'Valid', publisher: 'Haynie Minter' });
  });

  it('rejects an installer signed by another valid publisher', () => {
    const runPowerShell = vi.fn(() => powershellResult({ publisher: 'Release Host Attacker' }));

    expect(() => verifyExpectedPublisher('C:\\dist\\setup.exe', 'Haynie Minter', runPowerShell))
      .toThrow('does not match');
  });

  it('rejects missing or invalid Authenticode signatures', () => {
    const runPowerShell = vi.fn(() => powershellResult({ status: 'NotSigned', publisher: null }));

    expect(() => verifyExpectedPublisher('C:\\dist\\setup.exe', 'Haynie Minter', runPowerShell))
      .toThrow('no valid Authenticode signature');
  });

  it('fails closed when no publisher identity is configured', () => {
    const runPowerShell = vi.fn(() => powershellResult());

    expect(() => verifyExpectedPublisher('C:\\dist\\setup.exe', undefined, runPowerShell))
      .toThrow('must pin at least one expected publisher');
    expect(runPowerShell).not.toHaveBeenCalled();
  });

  it('keeps the inspected path out of PowerShell source', () => {
    const artifact = 'C:\\dist\\setup.exe; Write-Error injected';
    const runPowerShell = vi.fn(() => powershellResult());

    inspectAuthenticodeSignature(artifact, runPowerShell);

    const [, args, options] = runPowerShell.mock.calls[0];
    expect(args.join(' ')).not.toContain(artifact);
    expect(options.env.MXVOICE_SIGNATURE_PATH).toBe(artifact);
  });
});

