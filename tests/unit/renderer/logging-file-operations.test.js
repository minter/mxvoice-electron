import { beforeEach, describe, expect, it, vi } from 'vitest';
const dialog = { openHotkeyFile: vi.fn(), openHoldingTankFile: vi.fn() };
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({ secureFileDialog: dialog }));
const buttons = new Map(); globalThis.window = { debugLog: { info: vi.fn() }, hideAllTooltips: vi.fn() }; globalThis.document = { getElementById: id => { if(!buttons.has(id))buttons.set(id,{dataset:{}}); return buttons.get(id); } };
const files = await import('../../../src/renderer/modules/file-operations/file-operations.js'); const { initializeLogFormatter } = await import('../../../src/renderer/modules/debug-log/log-formatter.js');
describe('renderer logging and file-operation failures', () => {
  beforeEach(() => { buttons.clear(); vi.clearAllMocks(); files.configureFileOperationDependencies({ moduleRegistry: {} }); });
  it('delegates dialogs while suppressing stale tooltips', () => { dialog.openHotkeyFile.mockReturnValue(Promise.resolve({ canceled: true })); files.openHotkeyFile(); expect(window.hideAllTooltips).toHaveBeenCalled(); expect(dialog.openHotkeyFile).toHaveBeenCalled(); expect(buttons.get('hotkey-load-btn').dataset.tooltipSuppressUntil).toBeGreaterThan(Date.now()); });
  it('throws explicit errors when save modules are unavailable', () => { expect(() => files.saveHotkeyFile()).toThrow('Hotkeys module is unavailable'); expect(() => files.saveHoldingTankFile()).toThrow('Holding tank module is unavailable'); });
  it('formats circular context and removes dependency frames from stacks', () => { const formatter = initializeLogFormatter(); const circular = {}; circular.self = circular; expect(formatter.formatContext(circular)).toContain('[Circular'); const error = new Error('boom'); error.stack = 'Error: boom\n at app.js:1\n at node_modules/pkg.js:2'; expect(formatter.formatStackTrace(error)).not.toContain('node_modules'); });
});
