import { showDropToast } from '../utils/toast-utils.js';
import { TOAST_MS, droppedSongsFileMessage, IMPORT_NOT_READY_MESSAGE } from '../boards/messages.js';

function callFirstAvailable(candidates, args, warn) {
  const handler = candidates.find((candidate) => typeof candidate === 'function');
  if (!handler) {
    warn();
    return;
  }
  return handler(...args);
}

function setupMainProcessEventBridge({
  electronAPI,
  moduleRegistry = {},
  logWarn = () => {},
  logError = () => {},
  toast = showDropToast
}) {
  const events = electronAPI?.events;
  if (!events) return false;

  const register = (eventName, handler) => {
    if (typeof events[eventName] === 'function') events[eventName](handler);
  };

  // Legacy file imports only touch a board that has finished loading
  const boardIsReady = async () => {
    try {
      const state = await electronAPI?.boards?.getState?.();
      return state?.success === true && state.data?.status === 'ready';
    } catch (_error) {
      return false;
    }
  };

  const finishImport = (kind, outcome) => {
    const message = droppedSongsFileMessage(outcome?.dropped);
    if (message) toast(message, TOAST_MS);
    try {
      electronAPI?.analytics?.trackEvent?.('legacy_file_imported', { kind });
    } catch (_error) {
      // Analytics never block an import
    }
  };

  const runImport = async (kind, load, missingWarning) => {
    if (!(await boardIsReady())) {
      toast(IMPORT_NOT_READY_MESSAGE, TOAST_MS);
      return;
    }
    if (!load) {
      logWarn(missingWarning);
      return;
    }
    try {
      finishImport(kind, await load());
    } catch (error) {
      logError(`Error importing ${kind} file:`, error);
    }
  };

  register('onHoldingTankLoad', (songIds) => runImport(
    'holding_tank',
    moduleRegistry.holdingTank?.populateHoldingTank
      ? () => moduleRegistry.holdingTank.populateHoldingTank(songIds)
      : null,
    'Holding tank module not yet available when holding_tank_load fired'
  ));

  register('onFkeyLoad', (fkeys, title) => runImport(
    'hotkeys',
    moduleRegistry.hotkeys?.populateHotkeys
      ? () => moduleRegistry.hotkeys.populateHotkeys(fkeys, title)
      : null,
    'populateHotkeys not yet available when fkey_load fired'
  ));
  register('onAddDialogLoad', (filename, metadata) => callFirstAvailable(
    [moduleRegistry.songManagement?.startAddNewSong?.bind(moduleRegistry.songManagement)], [filename, metadata],
    () => logWarn('startAddNewSong not available when add_dialog_load fired')
  ));
  register('onBulkAddDialogLoad', (dirname) => callFirstAvailable(
    [moduleRegistry.bulkOperations?.showBulkAddModal], [dirname],
    () => logWarn('showBulkAddModal not available when bulk_add_dialog_load fired')
  ));
  register('onExternalFilesDrop', (files) => callFirstAvailable(
    [moduleRegistry.dragDrop?.handleExternalFileDrop], [files],
    () => logWarn('handleExternalFileDrop not available when external-files-dropped fired')
  ));
  register('onManageCategories', () => callFirstAvailable(
    [moduleRegistry.categories?.openCategoriesModal], [],
    () => logWarn('openCategoriesModal not yet available when manage_categories fired')
  ));
  register('onEditSelectedSong', () => callFirstAvailable(
    [moduleRegistry.songManagement?.editSelectedSong], [],
    () => logWarn('editSelectedSong not available when edit_selected_song fired')
  ));
  register('onDeleteSelectedSong', () => callFirstAvailable(
    [moduleRegistry.songManagement?.deleteSelectedSong], [],
    () => logWarn('deleteSelectedSong not available when delete_selected_song fired')
  ));

  const uiEvents = [
    ['onIncreaseFontSize', 'increaseFontSize', 'increase_font_size'],
    ['onDecreaseFontSize', 'decreaseFontSize', 'decrease_font_size'],
    ['onToggleWaveform', 'toggleWaveform', 'toggle_wave_form'],
    ['onToggleAdvancedSearch', 'toggleAdvancedSearch', 'toggle_advanced_search']
  ];
  uiEvents.forEach(([eventName, commandName, channelName]) => {
    register(eventName, () => callFirstAvailable(
      [moduleRegistry.ui?.[commandName]?.bind(moduleRegistry.ui)], [],
      () => logWarn(`${commandName} not available when ${channelName} fired`)
    ));
  });

  return true;
}

export { setupMainProcessEventBridge };
export default setupMainProcessEventBridge;
