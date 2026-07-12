/**
 * Utility IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import { v4 as uuidv4 } from 'uuid';
import { isSupportedAudioFile } from '../file-utils.js';
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { debugLog } = deps;

  // Utility functions for secure API
  ipcMain.handle(IPC.UTILITY.GENERATE_ID, async () => {
    try {
      return { success: true, data: uuidv4() };
    } catch (error) {
      debugLog?.error('Generate ID error:', { module: 'ipc-handlers', function: 'generate-id', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.UTILITY.FORMAT_DURATION, async (event, seconds) => {
    try {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      const formatted = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      return { success: true, data: formatted };
    } catch (error) {
      debugLog?.error('Format duration error:', { module: 'ipc-handlers', function: 'format-duration', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.UTILITY.VALIDATE_AUDIO_FILE, async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return { success: true, data: false };
      }
      return { success: true, data: isSupportedAudioFile(filePath) };
    } catch (error) {
      debugLog?.error('Validate audio file error:', { module: 'ipc-handlers', function: 'validate-audio-file', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.UTILITY.SANITIZE_FILENAME, async (event, filename) => {
    try {
      if (!filename || typeof filename !== 'string') {
        return { success: true, data: '' };
      }
      // Remove or replace invalid characters
      const sanitized = filename.replace(/[<>:"/\\|?*]/g, '_').trim();
      return { success: true, data: sanitized };
    } catch (error) {
      debugLog?.error('Sanitize filename error:', { module: 'ipc-handlers', function: 'sanitize-filename', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
