import { beforeEach, describe, expect, it, vi } from 'vitest';
const customAlert=vi.fn(),customConfirm=vi.fn();vi.mock('../../../src/renderer/modules/utils/index.js',()=>({customAlert,customConfirm}));vi.mock('../../../src/renderer/modules/debug-log/index.js',()=>({info:vi.fn(),warn:vi.fn(),error:vi.fn()}));vi.mock('../../../src/renderer/modules/ui/bootstrap-adapter.js',()=>({showModal:vi.fn(),hideModal:vi.fn()}));
const askToSaveUnsavedChanges=vi.fn(async()=>true);vi.mock('../../../src/renderer/modules/shows/index.js',()=>({askToSaveUnsavedChanges}));
globalThis.window={isRestoringProfileState:false,secureElectronAPI:{},location:{reload:vi.fn()}};globalThis.document={addEventListener:vi.fn(),getElementById:vi.fn(()=>null)};const backup=await import('../../../src/renderer/modules/profile-backup/index.js');
describe('profile backup renderer UI',()=>{beforeEach(()=>{vi.clearAllMocks();window.isRestoringProfileState=false;});
it('a manual backup no longer flushes or aborts on a refused save',async()=>{const createBackup=vi.fn(async()=>({success:true,backupId:'b1'}));const saveProfileState=vi.fn(async()=>({success:false,skipped:true}));backup.reinitializeProfileBackup({electronAPI:{profile:{createBackup}},moduleRegistry:{profileState:{saveProfileState}}});await backup.createBackupNow();expect(saveProfileState).not.toHaveBeenCalled();expect(createBackup).toHaveBeenCalled();expect(customAlert).toHaveBeenCalledWith('Backup created successfully.','Backup Complete');});
describe('restore confirmation',()=>{const run=async(shows,doc)=>{customConfirm.mockResolvedValue(false);backup.reinitializeProfileBackup({electronAPI:{profile:{restoreBackup:vi.fn()},shows:{getState:vi.fn(async()=>({success:true,data:{doc}}))}},moduleRegistry:{}});await backup.restoreBackup('b1',shows);return customConfirm.mock.calls[0][0];};
const docOf=n=>({shows:Array.from({length:n},()=>({}))});
it('lists backup shows and the current count',async()=>{const m=await run(['Show','Comedy Sports'],docOf(4));expect(m).toContain('This backup has 2 shows: Show, Comedy Sports. Your 4 current shows will be replaced.');});
it('uses singular forms',async()=>{const m=await run(['X'],docOf(1));expect(m).toContain('This backup has 1 show: X. Your 1 current show will be replaced.');});
it('explains a pre-shows backup',async()=>{const m=await run(null,docOf(3));expect(m).toContain('This backup is from before shows. Its layout will become a show named Default Show, and it may be a layout from the middle of a show.');});
it('omits the number when the current doc is unavailable',async()=>{const m=await run(['A','B'],null);expect(m).toContain('This backup has 2 shows: A, B. Your current shows will be replaced.');});
it('uses pre-shows wording for a pre-shows backup even without a doc',async()=>{const m=await run(null,null);expect(m).toContain('before shows');});
it('says when a backup\'s shows cannot be read',async()=>{const m=await run('unreadable',docOf(3));expect(m).toContain("saved shows can't be read");expect(m).not.toContain('before shows');});});
it('refuses backups while restoration is active',async()=>{window.isRestoringProfileState=true;const createBackup=vi.fn();backup.reinitializeProfileBackup({electronAPI:{profile:{createBackup}},moduleRegistry:{}});await backup.createBackupNow();expect(createBackup).not.toHaveBeenCalled();expect(customConfirm).toHaveBeenCalledWith(expect.stringContaining('still being restored'),'Backup Not Created');});});

describe('restore and unsaved changes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.isRestoringProfileState = false;
    askToSaveUnsavedChanges.mockResolvedValue(true);
  });

  function api(restoreResult) {
    const restoreBackup = vi.fn(async () => restoreResult);
    backup.reinitializeProfileBackup({
      electronAPI: { profile: { restoreBackup }, shows: { getState: vi.fn(async () => ({ success: true, data: { doc: null } })) } },
      moduleRegistry: {}
    });
    return restoreBackup;
  }

  it('restore asks to save unsaved changes before its confirm; Cancel stops', async () => {
    const order = [];
    askToSaveUnsavedChanges.mockImplementation(async () => { order.push('ask'); return false; });
    customConfirm.mockImplementation(async () => { order.push('confirm'); return true; });
    const restoreBackup = api({ success: true });

    await backup.restoreBackup('b1', ['Show']);

    expect(askToSaveUnsavedChanges).toHaveBeenCalledWith('restore', { allowOver: 'backupRestoreModal' });
    expect(order).toEqual(['ask']);
    expect(restoreBackup).not.toHaveBeenCalled();

    // Going on reaches the confirm, after the prompt
    order.length = 0;
    askToSaveUnsavedChanges.mockImplementation(async () => { order.push('ask'); return true; });
    customConfirm.mockImplementation(async () => { order.push('confirm'); return false; });
    await backup.restoreBackup('b1', ['Show']);
    expect(order).toEqual(['ask', 'confirm']);
    expect(restoreBackup).not.toHaveBeenCalled();
  });

  it('a sessionEnded failure reloads the window', async () => {
    customConfirm.mockResolvedValue(true);
    api({ success: false, error: 'EBUSY: resource busy or locked', sessionEnded: true });

    await backup.restoreBackup('b1', ['Show']);

    expect(customConfirm).toHaveBeenLastCalledWith(
      'Failed to restore backup: EBUSY: resource busy or locked Mx. Voice will reload the show.',
      'Restore Failed'
    );
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it('a failure before the session ended keeps the page', async () => {
    customConfirm.mockResolvedValue(true);
    api({ success: false, error: 'Backup does not exist' });

    await backup.restoreBackup('b1', ['Show']);

    expect(customConfirm).toHaveBeenLastCalledWith('Failed to restore backup: Backup does not exist', 'Restore Failed');
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
