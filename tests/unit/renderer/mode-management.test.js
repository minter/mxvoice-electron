import { beforeEach, describe, expect, it, vi } from 'vitest';
const setPreference = vi.fn(async () => ({ success: true }));
vi.mock('../../../src/renderer/modules/preferences/profile-preference-adapter.js', () => ({ setPreference }));
const nodes = new Map(); function el(){const set=new Set(); return { classList:{add:x=>set.add(x),remove:x=>set.delete(x),contains:x=>set.has(x)}, getAttribute:vi.fn(), style:{} };}
globalThis.window = { debugLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, secureElectronAPI: { analytics: { trackEvent: vi.fn() } } }; globalThis.document = { getElementById: id => { if(!nodes.has(id))nodes.set(id,el()); return nodes.get(id); }, querySelectorAll: () => [], querySelector: () => null };
const sharedState = (await import('../../../src/renderer/modules/shared-state.js')).default; const mode = await import('../../../src/renderer/modules/mode-management/index.js');
describe('mode management', () => {
  beforeEach(() => { nodes.clear(); vi.clearAllMocks(); });
  it('switches playlist/storage state and persists it', async () => { await mode.setHoldingTankMode('playlist'); expect(mode.getHoldingTankMode()).toBe('playlist'); expect(sharedState.get('autoplay')).toBe(true); expect(setPreference).toHaveBeenCalledWith('holding_tank_mode','playlist',window.secureElectronAPI); await mode.setHoldingTankMode('storage'); expect(sharedState.get('autoplay')).toBe(false); });
});
describe('playlist re-find across board swaps', () => {
  function setup({ source, generation }) {
    nodes.clear();
    const tankRow = el();
    const songNowPlaying = el(); songNowPlaying.getAttribute.mockReturnValue('5');
    nodes.set('song_now_playing', songNowPlaying);
    sharedState.set('sound', { playing: () => true });
    sharedState.set('boardGeneration', generation);
    sharedState.set('nowPlayingSource', source);
    const originalQuery = document.querySelector;
    document.querySelector = (selector) => (selector === '#holding_tank .list-group-item[songid="5"]' ? tankRow : null);
    return { tankRow, restore: () => { document.querySelector = originalQuery; sharedState.set('sound', null); } };
  }
  it('reattaches to the tank row when the song started on the current board', async () => {
    const { tankRow, restore } = setup({ source: 2, generation: 2 });
    try { await mode.setHoldingTankMode('playlist'); expect(tankRow.classList.contains('now_playing')).toBe(true); } finally { restore(); }
  });
  it('does not reattach when the song started before a board swap', async () => {
    const { tankRow, restore } = setup({ source: 1, generation: 2 });
    try { await mode.setHoldingTankMode('playlist'); expect(tankRow.classList.contains('now_playing')).toBe(false); } finally { restore(); }
  });
});
