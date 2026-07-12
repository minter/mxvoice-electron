import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

globalThis.window = globalThis.window || {};

let cancelAutoplay;
let configureDependencies;
let sharedState;

beforeAll(async () => {
  ({
    cancel_autoplay: cancelAutoplay,
    configureAudioManagerDependencies: configureDependencies
  } = await import('../../../src/renderer/modules/audio/audio-manager.js'));
  sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default;
});

beforeEach(() => {
  globalThis.document = {
    getElementById: vi.fn(() => null)
  };
  sharedState.set('holdingTankMode', 'storage');
  sharedState.set('autoplay', false);
  configureDependencies({ moduleRegistry: {} });
});

describe('audio manager autoplay cancellation', () => {
  it('uses mode management to return playlist mode to storage', () => {
    const setHoldingTankMode = vi.fn();
    configureDependencies({
      moduleRegistry: { modeManagement: { setHoldingTankMode } }
    });
    sharedState.set('holdingTankMode', 'playlist');
    sharedState.set('autoplay', true);

    cancelAutoplay();

    expect(sharedState.get('autoplay')).toBe(false);
    expect(setHoldingTankMode).toHaveBeenCalledOnce();
    expect(setHoldingTankMode).toHaveBeenCalledWith('storage');
  });
});
