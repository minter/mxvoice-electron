import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

// Guards against contract drift between the renderer adapter and the
// preload contextBridge surface: every fileSystem method the adapter
// exposes must exist in the preload's fileSystem API.
describe('secure-adapter fileSystem surface matches preload', () => {
  const preload = fs.readFileSync('src/preload/modules/secure-api-exposer.cjs', 'utf8');
  const adapter = fs.readFileSync('src/renderer/modules/adapters/secure-adapter.js', 'utf8');

  const fsBlock = preload.match(/fileSystem:\s*{([\s\S]*?)\n\s*}/);
  const preloadMethods = new Set(
    [...fsBlock[1].matchAll(/^\s*(\w+):/gm)].map(m => m[1])
  );

  const adapterBlock = adapter.match(/export const secureFileSystem = {([\s\S]*?)\n};/);
  const adapterMethods = [...adapterBlock[1].matchAll(/^  (\w+): async/gm)].map(m => m[1]);

  it('found both surfaces', () => {
    expect(preloadMethods.size).toBeGreaterThan(0);
    expect(adapterMethods.length).toBeGreaterThan(0);
  });

  it.each([...new Set(adapterMethods)])('adapter fileSystem.%s exists in preload', method => {
    expect(preloadMethods.has(method)).toBe(true);
  });
});
