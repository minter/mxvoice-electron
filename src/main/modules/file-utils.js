/**
 * Shared file utilities for the main process.
 */

import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.mp3', '.mp4', '.m4a', '.wav', '.ogg', '.flac', '.opus']);

function isSupportedAudioFile(filePath) {
  return SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

// Streaming file copy for large files with optional progress tracking.
async function copyFileStreaming(source, destination, { progressCallback = null, debugLog = null } = {}) {
  let sourceStream = null;
  let destStream = null;

  try {
    if (!fs.existsSync(source)) {
      throw new Error(`Source file does not exist: ${source}`);
    }

    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    sourceStream = createReadStream(source);
    destStream = createWriteStream(destination);

    let bytesCopied = 0;
    let totalSize = 0;

    try {
      totalSize = fs.statSync(source).size;
    } catch (_statError) {
      debugLog?.warn('Could not get file size for progress tracking', {
        module: 'file-utils',
        function: 'copyFileStreaming',
        source
      });
    }

    if (progressCallback && totalSize > 0) {
      sourceStream.on('data', (chunk) => {
        bytesCopied += chunk.length;
        const progress = Math.round((bytesCopied / totalSize) * 100);
        progressCallback(progress, bytesCopied, totalSize);
      });
    }

    sourceStream.on('error', (error) => {
      debugLog?.error('Source stream error:', {
        module: 'file-utils',
        function: 'copyFileStreaming',
        error: error.message,
        source
      });
    });

    destStream.on('error', (error) => {
      debugLog?.error('Destination stream error:', {
        module: 'file-utils',
        function: 'copyFileStreaming',
        error: error.message,
        destination
      });
    });

    await pipeline(sourceStream, destStream);

    if (progressCallback) {
      progressCallback(100, totalSize, totalSize);
    }

    return { success: true, bytesCopied: totalSize };
  } catch (error) {
    try {
      if (fs.existsSync(destination)) {
        fs.unlinkSync(destination);
        debugLog?.info('Cleaned up partial destination file', {
          module: 'file-utils',
          function: 'copyFileStreaming',
          destination
        });
      }
    } catch (cleanupError) {
      debugLog?.warn('Failed to clean up partial file', {
        module: 'file-utils',
        function: 'copyFileStreaming',
        error: cleanupError.message,
        destination
      });
    }

    debugLog?.error('Streaming file copy error:', {
      module: 'file-utils',
      function: 'copyFileStreaming',
      error: error.message,
      source,
      destination
    });
    return { success: false, error: error.message };
  } finally {
    if (sourceStream && !sourceStream.destroyed) {
      sourceStream.destroy();
    }
    if (destStream && !destStream.destroyed) {
      destStream.destroy();
    }
  }
}

export { SUPPORTED_AUDIO_EXTENSIONS, isSupportedAudioFile, copyFileStreaming };
