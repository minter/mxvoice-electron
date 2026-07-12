import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = { updateCategory: vi.fn(), deleteCategory: vi.fn(), addCategory: vi.fn(), updateSong: vi.fn(), addSong: vi.fn(), deleteSong: vi.fn(), getSongById: vi.fn() };
vi.mock('../../../src/renderer/modules/adapters/secure-adapter.js', () => ({ secureDatabase: db }));
globalThis.window = { debugLog: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
const ops = await import('../../../src/renderer/modules/database/database-operations.js');
describe('renderer database operations', () => {
  beforeEach(() => vi.clearAllMocks());
  it('passes successful category and song operations through', async () => { db.updateCategory.mockResolvedValue({success:true,changes:1}); db.deleteCategory.mockResolvedValue({success:true}); db.getSongById.mockResolvedValue({success:true,data:[{id:1}]}); await expect(ops.editCategory('MUSC','Music')).resolves.toMatchObject({success:true}); await expect(ops.deleteCategory('OLD','Old')).resolves.toMatchObject({success:true}); await expect(ops.getSongById('1')).resolves.toMatchObject({success:true}); });
  it('turns wrapped failures and empty lookups into rejected operations', async () => { db.updateCategory.mockResolvedValue({success:false,error:'locked'}); await expect(ops.editCategory('MUSC','Music')).rejects.toThrow('locked'); db.getSongById.mockResolvedValue({success:true,data:[]}); await expect(ops.getSongById('404')).rejects.toThrow('Song not found'); });
});
