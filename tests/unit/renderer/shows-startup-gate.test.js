import { beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };

const ok = (data) => ({ success: true, data });

// The gate settles once per page, so each test gets fresh modules
async function freshModules() {
  vi.resetModules();
  const gate = await import('../../../src/renderer/modules/shows/startup-gate.js');
  const shows = await import('../../../src/renderer/modules/shows/index.js');
  return { gate, shows };
}

async function isSettled(promise) {
  let settled = false;
  void promise.then(() => { settled = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return settled;
}

function deps(overrides = {}) {
  return {
    api: {
      open: vi.fn(async () => ok({ recovery: null, generation: 1 })),
      resolveRecovery: vi.fn(async () => ok({ layout: {} })),
      reportReady: vi.fn(async () => ok(null))
    },
    confirm: vi.fn(async () => false),
    applyLayout: vi.fn(async () => ({ dropped: 0, droppedIds: [] })),
    alert: vi.fn(),
    toast: vi.fn(),
    clearRestorationLock: vi.fn(),
    track: vi.fn(),
    refreshHeader: vi.fn(async () => {}),
    loadPlayedCounts: vi.fn(),
    installPlayedPills: vi.fn(),
    ...overrides
  };
}

describe('startup gate', () => {
  beforeEach(() => { window.isRestoringProfileState = false; });

  it('stays pending until settled, then stays settled', async () => {
    const { gate, shows } = await freshModules();
    expect(shows.whenStartupSettled).toBe(gate.whenStartupSettled);
    expect(await isSettled(gate.whenStartupSettled())).toBe(false);
    gate.settleStartup();
    gate.settleStartup();
    expect(await isSettled(gate.whenStartupSettled())).toBe(true);
  });

  it('the gate settles when the open throws before the prompt', async () => {
    const { gate, shows } = await freshModules();
    const failing = deps();
    failing.api.open.mockRejectedValue(new Error('ipc down'));
    await expect(shows.openSessionOnStartup(failing)).resolves.toEqual({ status: 'failed' });
    expect(failing.confirm).not.toHaveBeenCalled();
    expect(await isSettled(gate.whenStartupSettled())).toBe(true);
  });

  it('the gate settles when setup throws before the open is even tried', async () => {
    const { gate, shows } = await freshModules();
    const failing = deps({ installPlayedPills: vi.fn(() => { throw new Error('no pills'); }) });
    await expect(shows.openSessionOnStartup(failing)).rejects.toThrow('no pills');
    expect(failing.api.open).not.toHaveBeenCalled();
    expect(await isSettled(gate.whenStartupSettled())).toBe(true);
  });

  it('the gate settles when the finally itself throws', async () => {
    const { gate, shows } = await freshModules();
    const failing = deps({ refreshHeader: vi.fn(async () => { throw new Error('header'); }) });
    await expect(shows.openSessionOnStartup(failing)).rejects.toThrow('header');
    expect(await isSettled(gate.whenStartupSettled())).toBe(true);
  });
});
