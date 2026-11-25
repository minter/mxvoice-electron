/**
 * Filesystem IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;
import { isSupportedAudioFile, copyFileStreaming } from '../file-utils.js';
import { assertTrustedMainFrame, isPathAllowed } from './guards.js';

export function register(deps) {
  const { debugLog, getMainWindow, directoryPreferenceAuthority, trustedRendererUrl } = deps;

  ipcMain.handle(IPC.FILESYSTEM.FILE_EXISTS, async (event, filePath) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      if (!filePath || typeof filePath !== 'string') throw new Error('Invalid file path');
      const musicDirectory = directoryPreferenceAuthority.getMusicDirectory();
      if (!musicDirectory) throw new Error('Music directory is not configured');
      const { canonicalPath, allowed } = await isPathAllowed(filePath, [musicDirectory]);
      if (!allowed) {
        throw new Error('Access denied: Path must be inside the managed music directory');
      }
      return { success: true, exists: fs.existsSync(canonicalPath) };
    } catch (error) {
      debugLog?.error('File exists error:', { module: 'ipc-handlers', function: 'file-exists', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.FILESYSTEM.FILE_DELETE, async (event, filePath) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      // Security: Validate input
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }

      // Security: Restrict to allowed directories (same pattern as file-read)
      const musicDirectory = directoryPreferenceAuthority.getMusicDirectory();
      if (!musicDirectory) throw new Error('Music directory is not configured');
      const allowedPaths = [musicDirectory];

      const resolvedPath = path.resolve(filePath);
      const { canonicalPath, allowed: isAllowed } = await isPathAllowed(resolvedPath, allowedPaths);

      if (!isAllowed) {
        debugLog?.warn('File delete access denied', {
          module: 'ipc-handlers',
          function: 'file-delete',
          filePath: filePath,
          resolvedPath: resolvedPath
        });
        throw new Error('Access denied: File path not in allowed directories');
      }

      await fs.promises.unlink(canonicalPath);
      return { success: true };
    } catch (error) {
      // ENOENT means file doesn't exist - treat as success since goal is achieved
      if (error.code === 'ENOENT') {
        debugLog?.info('File already deleted (not found):', {
          module: 'ipc-handlers',
          function: 'file-delete',
          filePath: filePath
        });
        return { success: true, alreadyDeleted: true };
      }
      debugLog?.error('File delete error:', { module: 'ipc-handlers', function: 'file-delete', error: error.message, filePath: filePath });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.FILESYSTEM.FILE_COPY, async (event, sourcePath, destPath) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      if (!sourcePath || !destPath || !isSupportedAudioFile(sourcePath)) {
        throw new Error('Only supported audio files can be imported');
      }
      const musicDirectory = directoryPreferenceAuthority.getMusicDirectory();
      if (!musicDirectory) throw new Error('Music directory is not configured');
      const { canonicalPath, allowed } = await isPathAllowed(destPath, [musicDirectory]);
      if (!allowed) {
        throw new Error('Access denied: Destination must be inside the managed music directory');
      }
      // Use streaming for better memory efficiency with large files
      return await copyFileStreaming(sourcePath, canonicalPath, { debugLog });
    } catch (error) {
      debugLog?.error('File copy error:', { module: 'ipc-handlers', function: 'file-copy', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.FILESYSTEM.SCAN_AUDIO_DIRECTORY, async (event, rootPath) => {
    try {
      assertTrustedMainFrame(event, getMainWindow, trustedRendererUrl);
      if (!rootPath || typeof rootPath !== 'string') throw new Error('Invalid directory path');
      const canonicalRoot = await fsPromises.realpath(path.resolve(rootPath));
      const rootStats = await fsPromises.stat(canonicalRoot);
      if (!rootStats.isDirectory()) throw new Error('Selected path is not a directory');

      const audioFiles = [];
      const visit = async directory => {
        const entries = await fsPromises.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const entryPath = path.join(directory, entry.name);
          if (entry.isSymbolicLink()) continue;
          if (entry.isDirectory()) await visit(entryPath);
          else if (entry.isFile() && isSupportedAudioFile(entry.name)) {
            audioFiles.push(entryPath);
          }
        }
      };
      await visit(canonicalRoot);
      return { success: true, data: audioFiles };
    } catch (error) {
      debugLog?.error('Audio directory scan error', {
        module: 'ipc-handlers',
        function: 'library:scan-audio-directory',
        error: error.message
      });
      return { success: false, error: error.message };
    }
  });
}
