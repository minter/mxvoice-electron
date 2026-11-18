import { beforeEach, describe, expect, it, vi } from 'vitest';
globalThis.window = { debugLog: { info: vi.fn() } };
const { initializeLogFormatter } = await import('../../../src/renderer/modules/debug-log/log-formatter.js');
describe('renderer logging and file-operation failures', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('formats circular context and removes dependency frames from stacks', () => { const formatter = initializeLogFormatter(); const circular = {}; circular.self = circular; expect(formatter.formatContext(circular)).toContain('[Circular'); const error = new Error('boom'); error.stack = 'Error: boom\n at app.js:1\n at node_modules/pkg.js:2'; expect(formatter.formatStackTrace(error)).not.toContain('node_modules'); });
});
