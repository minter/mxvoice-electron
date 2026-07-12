/**
 * Shared IPC channel manifest — the single source of truth for channel
 * names used by BOTH the main process (ESM: default-import this file and
 * destructure { IPC }) and the preload script (CJS: require it).
 *
 * Scope: channels registered by src/main/modules/ipc-handlers.js and its
 * ipc/ domain modules. launcher:* (launcher-window.js) and about:*
 * (app-setup.js) are registered elsewhere and intentionally not listed.
 */

const deepFreeze = (obj) => {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
};

const IPC = deepFreeze({
  LOGGING: {
    PRELOAD_LOG: 'preload-log',
    WRITE: 'logs:write',
    GET_PATHS: 'logs:get-paths',
    EXPORT: 'logs:export',
  },
  DIALOG: {
    SHOW_DIRECTORY_PICKER: 'show-directory-picker',
    OPEN_HOTKEY_FILE: 'open-hotkey-file',
    SAVE_HOTKEY_FILE: 'save-hotkey-file',
    OPEN_HOLDING_TANK_FILE: 'open-holding-tank-file',
    SAVE_HOLDING_TANK_FILE: 'save-holding-tank-file',
    SHOW_FILE_PICKER: 'show-file-picker',
  },
  UI: {
    INCREASE_FONT_SIZE: 'increase-font-size',
    DECREASE_FONT_SIZE: 'decrease-font-size',
    TOGGLE_WAVEFORM: 'toggle-waveform',
    TOGGLE_ADVANCED_SEARCH: 'toggle-advanced-search',
    CLOSE_ALL_TABS: 'close-all-tabs',
    MANAGE_CATEGORIES: 'manage-categories',
    SHOW_PREFERENCES: 'show-preferences',
  },
  DATABASE: {
    GET_CATEGORIES: 'get-categories',
    ADD_SONG: 'add-song',
    GET_SONG_BY_ID: 'get-song-by-id',
    DELETE_SONG: 'delete-song',
    DELETE_SELECTED_SONG: 'delete-selected-song',
    EDIT_SELECTED_SONG: 'edit-selected-song',
    UPDATE_SONG: 'update-song',
    ADD_CATEGORY: 'add-category',
    UPDATE_CATEGORY: 'update-category',
    DELETE_CATEGORY: 'delete-category',
    SEARCH_SONGS: 'search-songs',
    GET_CATEGORY_BY_CODE: 'get-category-by-code',
    GET_SONGS_BY_IDS: 'get-songs-by-ids',
    REASSIGN_SONG_CATEGORY: 'reassign-song-category',
    FIND_CATEGORY_CODES_LIKE: 'find-category-codes-like',
    COUNT_SONGS: 'count-songs',
  },
  FILESYSTEM: {
    FILE_EXISTS: 'file-exists',
    FILE_DELETE: 'file-delete',
    FILE_COPY: 'file-copy',
    SCAN_AUDIO_DIRECTORY: 'library:scan-audio-directory',
  },
  STORE: {
    GET: 'store-get',
    SET: 'store-set',
    DELETE: 'store-delete',
    HAS: 'store-has',
    KEYS: 'store-keys',
    CLEAR: 'store-clear',
  },
  AUDIO: {
    PLAY: 'audio-play',
    STOP: 'audio-stop',
    PAUSE: 'audio-pause',
    FADE: 'audio-fade',
    RESUME: 'audio-resume',
    SET_VOLUME: 'audio-set-volume',
    GET_DURATION: 'audio-get-duration',
    GET_METADATA: 'audio-get-metadata',
    GET_POSITION: 'audio-get-position',
    SET_POSITION: 'audio-set-position',
  },
  PATH_OS: {
    PATH_JOIN: 'path-join',
    PATH_PARSE: 'path-parse',
    PATH_EXTNAME: 'path-extname',
    PATH_DIRNAME: 'path-dirname',
    PATH_BASENAME: 'path-basename',
    PATH_RESOLVE: 'path-resolve',
    PATH_NORMALIZE: 'path-normalize',
    OS_HOMEDIR: 'os-homedir',
    OS_PLATFORM: 'os-platform',
    OS_ARCH: 'os-arch',
    OS_TMPDIR: 'os-tmpdir',
  },
  APP: {
    GET_PATH: 'app-get-path',
    GET_VERSION: 'app-get-version',
    GET_NAME: 'app-get-name',
    QUIT: 'app-quit',
    RESTART: 'app-restart',
    RESTART_AND_INSTALL: 'restart-and-install-new-version',
    CHECK_FOR_UPDATE: 'check-for-update',
    DOWNLOAD_UPDATE: 'download-update',
    INSTALL_UPDATE: 'install-update',
  },
  UTILITY: {
    IMPORT_AUDIO_FILES: 'import-audio-files',
    EXPORT_DATA: 'export-data',
    GENERATE_ID: 'generate-id',
    FORMAT_DURATION: 'format-duration',
    VALIDATE_AUDIO_FILE: 'validate-audio-file',
    SANITIZE_FILENAME: 'sanitize-filename',
  },
  PROFILE: {
    GET_CURRENT: 'profile:get-current',
    GET_DIRECTORY: 'profile:get-directory',
    LOAD_STATE: 'profile:load-state',
    SAVE_STATE: 'profile:save-state',
    GET_PREFERENCE: 'profile:get-preference',
    SET_PREFERENCE: 'profile:set-preference',
    SET_PREFERENCES: 'profile:set-preferences',
    GET_ALL_PREFERENCES: 'profile:get-all-preferences',
    SWITCH: 'profile:switch',
    SAVE_STATE_BEFORE_SWITCH: 'profile:save-state-before-switch',
    CREATE: 'profile:create',
    DUPLICATE: 'profile:duplicate',
    SWITCH_TO: 'profile:switch-to',
    DELETE: 'profile:delete',
  },
  PROFILE_BACKUP: {
    CREATE: 'profile:createBackup',
    LIST: 'profile:listBackups',
    GET_METADATA: 'profile:getBackupMetadata',
    RESTORE: 'profile:restoreBackup',
    DELETE: 'profile:deleteBackup',
    GET_SETTINGS: 'profile:getBackupSettings',
    SAVE_SETTINGS: 'profile:saveBackupSettings',
  },
  LIBRARY: {
    EXPORT: 'library:export',
    IMPORT: 'library:import',
    IMPORT_CONFIRM: 'library:import-confirm',
  },
  ANALYTICS: {
    TRACK_EVENT: 'analytics:track-event',
    GET_OPT_OUT_STATUS: 'analytics:get-opt-out-status',
    SET_OPT_OUT: 'analytics:set-opt-out',
  },
});

module.exports = { IPC };
