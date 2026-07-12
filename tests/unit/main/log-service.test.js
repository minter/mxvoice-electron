import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mxvoice-logs-')); const showSaveDialog = vi.fn();
const electronLog = { transports: { file: {} }, errorHandler: { startCatching: vi.fn() }, info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
vi.mock('electron', () => ({ default: { app: { getPath:()=>root,getName:()=> 'Mx Voice',getVersion:()=> '1.0' }, dialog: { showSaveDialog } } }));
vi.mock('electron-log', () => ({ default: electronLog }));
const { initMainLogService } = await import('../../../src/main/modules/log-service.js'); afterAll(()=>fs.rmSync(root,{recursive:true,force:true}));
describe('main log service', () => {
  it('gates info but always writes errors and handles circular context', async () => { const service=initMainLogService({getDebugPreference:async()=>false}); await service.write({level:'info',message:'hidden'}); expect(electronLog.info).not.toHaveBeenCalled(); const context={};context.self=context; await service.write({level:'error',message:'failed',context}); expect(electronLog.error).toHaveBeenCalledWith(expect.stringContaining('[Circular Reference]')); });
  it('handles export cancellation and write failures', async () => { const service=initMainLogService(); showSaveDialog.mockResolvedValueOnce({canceled:true}); await expect(service.exportLogs()).resolves.toEqual({canceled:true}); showSaveDialog.mockResolvedValueOnce({canceled:false,filePath:root}); await expect(service.exportLogs()).resolves.toMatchObject({success:false}); });
});
