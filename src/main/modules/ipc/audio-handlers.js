/**
 * Audio (Howler / music-metadata) IPC handlers.
 * Bodies moved verbatim from ipc-handlers.js — see that file's git history.
 */

import electron from 'electron';
const { ipcMain } = electron;
import { Howl, Howler } from 'howler';
import { parseFile as parseAudioFile } from 'music-metadata';
import ipcChannels from '../../../shared/ipc-channels.cjs';
const { IPC } = ipcChannels;

export function register(deps) {
  const { audioInstances, debugLog } = deps;

  ipcMain.handle(IPC.AUDIO.PLAY, async (event, filePath) => {
    try {
      // Stop any currently playing audio
      Howler.stop();

      // Create new audio instance
      const sound = new Howl({
        src: [filePath],
        html5: true,
        volume: 1.0
      });

      // Store the instance
      const soundId = Date.now().toString();
      audioInstances.set(soundId, sound);

      // Play the audio
      sound.play();

      return { success: true, id: soundId };
    } catch (error) {
      debugLog?.error('Audio play error:', { module: 'ipc-handlers', function: 'audio-play', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.AUDIO.STOP, async (event, soundId) => {
    try {
      if (soundId) {
        // Stop specific sound
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.stop();
          audioInstances.delete(soundId);
        }
      } else {
        // Stop all sounds
        Howler.stop();
        audioInstances.clear();
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio stop error:', { module: 'ipc-handlers', function: 'audio-stop', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.AUDIO.PAUSE, async (event, soundId) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.pause();
        }
      } else {
        Howler.stop();
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio pause error:', { module: 'ipc-handlers', function: 'audio-pause', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.AUDIO.FADE, async (event, soundId, fromVolume, toVolume, duration) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.fade(fromVolume, toVolume, duration);
        }
      } else {
        // Fade all sounds
        audioInstances.forEach(sound => {
          sound.fade(fromVolume, toVolume, duration);
        });
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio fade error:', { module: 'ipc-handlers', function: 'audio-fade', error: error.message });
      return { success: false, error: error.message };
    }
  });

  // ===============================================
  // SECURE IPC HANDLERS FOR CONTEXT ISOLATION
  // ===============================================

  // Enhanced audio operations for secure API
  ipcMain.handle(IPC.AUDIO.RESUME, async (event, soundId) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.play();
        }
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio resume error:', { module: 'ipc-handlers', function: 'audio-resume', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.AUDIO.SET_VOLUME, async (event, volume, soundId) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.volume(volume);
        }
      } else {
        Howler.volume(volume);
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio set volume error:', { module: 'ipc-handlers', function: 'audio-set-volume', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.AUDIO.GET_DURATION, async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      // First attempt: music-metadata with duration calculation enabled
      let durationSec = 0;
      try {
        const metadata = await parseAudioFile(filePath, { duration: true });
        durationSec = metadata?.format?.duration ? Number(metadata.format.duration) : 0;
      } catch (e) {
        debugLog?.warn('music-metadata parse failed for duration', { module: 'ipc-handlers', function: 'audio-get-duration', error: e?.message, filePath });
      }

      // Fallback: Howler (loads audio to get accurate duration)
      if (!(durationSec > 0.5)) {
        await new Promise((resolve) => setImmediate(resolve));
        durationSec = await new Promise((resolve, _reject) => {
          const sound = new Howl({ src: [filePath], html5: true, preload: true });
          const cleanup = () => {
            try {
              sound.unload();
            } catch (error) {
              debugLog?.warn('Failed to unload Howler sound during cleanup', {
                module: 'ipc-handlers',
                function: 'audio-get-duration',
                error: error?.message || 'Unknown error'
              });
            }
          };
          sound.once('load', () => {
            try {
              const d = Number(sound.duration());
              cleanup();
              resolve(isFinite(d) ? d : 0);
            } catch (_err) {
              cleanup();
              resolve(0);
            }
          });
          sound.once('loaderror', (_id, err) => {
            cleanup();
            debugLog?.warn('Howler loaderror while getting duration', { module: 'ipc-handlers', function: 'audio-get-duration', error: err, filePath });
            resolve(0);
          });
        });
      }

      debugLog?.info('audio-get-duration result', { module: 'ipc-handlers', function: 'audio-get-duration', filePath, durationSec });
      return { success: true, duration: isFinite(durationSec) ? durationSec : 0 };
    } catch (error) {
      debugLog?.error('Audio get duration error:', { module: 'ipc-handlers', function: 'audio-get-duration', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.AUDIO.GET_METADATA, async (event, filePath) => {
    try {
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path');
      }
      // Enable duration calculation to get accurate duration for OGG and other formats
      // Without this option, music-metadata may report incorrect durations for OGG/Vorbis files
      const metadata = await parseAudioFile(filePath, { duration: true });
      const title = metadata?.common?.title || '';
      // Some files store artist as array
      const artist = Array.isArray(metadata?.common?.artist)
        ? metadata.common.artist.join(', ')
        : (metadata?.common?.artist || '');
      const duration = metadata?.format?.duration ? Number(metadata.format.duration) : 0;
      return { success: true, data: { title, artist, duration } };
    } catch (error) {
      debugLog?.warn('Audio get metadata error', { module: 'ipc-handlers', function: 'audio-get-metadata', error: error.message, filePath });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.AUDIO.GET_POSITION, async (event, soundId) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          return { success: true, position: sound.seek() };
        }
      }
      return { success: true, position: 0 };
    } catch (error) {
      debugLog?.error('Audio get position error:', { module: 'ipc-handlers', function: 'audio-get-position', error: error.message });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC.AUDIO.SET_POSITION, async (event, soundId, position) => {
    try {
      if (soundId) {
        const sound = audioInstances.get(soundId);
        if (sound) {
          sound.seek(position);
        }
      }
      return { success: true };
    } catch (error) {
      debugLog?.error('Audio set position error:', { module: 'ipc-handlers', function: 'audio-set-position', error: error.message });
      return { success: false, error: error.message };
    }
  });
}
