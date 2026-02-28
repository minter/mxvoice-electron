/**
 * Module Configuration for MxVoice Application Bootstrap
 * 
 * This is Step 1 of the incremental bootstrap extraction.
 * Contains the basic module loading configuration extracted from renderer.js lines 322-875
 */

export const moduleConfig = [
  { name: 'utils', path: '../utils/index.js', required: false },
  { name: 'fileOperations', path: '../file-operations/index.js', required: false },
  { name: 'songManagement', path: '../song-management/index.js', required: false },
  { name: 'holdingTank', path: '../holding-tank/index.js', required: true },
  { name: 'hotkeys', path: '../hotkeys/index.js', required: false },
  { name: 'profileState', path: '../profile-state/index.js', required: false },
  { name: 'profileBackup', path: '../profile-backup/index.js', required: false },
  { name: 'categories', path: '../categories/index.js', required: false },
  { name: 'bulkOperations', path: '../bulk-operations/index.js', required: false },
  { name: 'dragDrop', path: '../drag-drop/index.js', required: false },
  { name: 'navigation', path: '../navigation/index.js', required: false },
  { name: 'modeManagement', path: '../mode-management/index.js', required: false },
  { name: 'preferences', path: '../preferences/index.js', required: true },
  { name: 'themeManagement', path: '../theme-management/index.js', required: false },
  { name: 'testUtils', path: '../test-utils/index.js', required: false },
  { name: 'search', path: '../search/index.js', required: false },
  { name: 'audio', path: '../audio/index.js', required: false },
  { name: 'ui', path: '../ui/index.js', required: true },
  { name: 'debugLog', path: '../debug-log/index.js', required: false },
  { name: 'database', path: '../database/index.js', required: false },
  { name: 'cleanup', path: '../cleanup/index.js', required: false },
  { name: 'viewManager', path: '../view-manager/index.js', required: false },
  { name: 'soundboard', path: '../soundboard/index.js', required: false }
];

export default moduleConfig;
