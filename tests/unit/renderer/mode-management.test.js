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
