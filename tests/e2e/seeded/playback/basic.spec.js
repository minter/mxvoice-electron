import { _electron as electron, test, expect } from '@playwright/test';
import { launchSeededApp, closeApp } from '../../../utils/seeded-launch.js';
import { 
  rms, 
  waitForAudible, 
  waitForSilence, 
  stabilize
} from '../../../utils/audio-helpers.js';

test.describe('Playback - basic', () => {
  let app; let page;

  test.beforeAll(async () => {
    // Ensure clean test environment before each test sequence
    try {
      const { resetTestEnvironment } = await import('../../../utils/test-environment-manager.js');
      await resetTestEnvironment();
      console.log('✅ Test environment reset for playback tests');
    } catch (error) {
      console.log(`⚠️ Could not reset test environment: ${error.message}`);
    }
    
    ({ app, page } = await launchSeededApp(electron, 'playback'));
    
    // Ensure window is visible and focused for reliable input
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    });
    await page.bringToFront();
    await page.click('body');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Give app time to initialize
    await page.waitForTimeout(1500);
  });

  test.afterAll(async () => {
    await closeApp(app);
  });

  // test('can see audio controls', async () => {
  //   await expect(page.locator('#play_button')).toBeVisible();
  //   await expect(page.locator('#stop_button')).toBeVisible();
  //   await expect(page.locator('#mute_button')).toBeVisible();
  // });

  test('play button starts playback', async () => {
    // Search for "Eat It" song using the correct selector
    const searchInput = page.locator('#omni_search');
    await searchInput.fill('Eat It');
    await searchInput.press('Enter'); // Submit the search
    
    // Wait for search results to appear
    await page.waitForTimeout(1000);
    
    // Wait for a single result and double-click it to play via event delegation
    const rows = page.locator('#search_results tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 5000 });
    const songRow = rows.first();
    await songRow.dblclick();
    
    // Wait for the play button to become enabled
    const playButton = page.locator('#play_button');
    await expect(playButton).toBeEnabled({ timeout: 5000 });
    
    // Also click play button (redundant but harmless) in case UI requires it
    if (await playButton.isEnabled()) {
      await playButton.click();
    }
    // Wait a bit for playback to start and UI to update
    await page.waitForTimeout(800);

    // Quick diagnostic: if probe missing, dump preload logs
    const diag = await page.evaluate(() => ({
      usingWebAudio: window.Howler?.usingWebAudio ?? null,
      ctxState: window.Howler?.ctx?.state ?? null,
      hasGain: !!window.Howler?.masterGain,
      hasProbe: !!window.electronTest?.getAudioProbe?.(),
      logs: window.electronTest?.getLogs?.() ?? []
    }));
    if (!diag.hasProbe) {
      console.log('[diag]', diag);
    }

    // Install a test-only audio tap on Howler's HTML5 audio element (no app code changes)
    await page.evaluate(async () => {
      try {
        if (!window.electronTest) window.electronTest = {};

        // If probe already exists, keep it
        if (window.electronTest.audioProbe && typeof window.electronTest.audioProbe.currentRMS === 'function') {
          return;
        }

        // Try to locate a currently playing media element (either via Howler internals or general query)
        const findPlayingAudioElement = () => {
          // Preferred: via Howler
          const HowlerGlobal = window.Howler;
          if (HowlerGlobal && Array.isArray(HowlerGlobal._howls)) {
            for (const hl of HowlerGlobal._howls) {
              if (!hl || !Array.isArray(hl._sounds)) continue;
              for (const s of hl._sounds) {
                const node = s && s._node;
                if (node && node instanceof HTMLAudioElement && !node.paused && node.currentTime > 0) {
                  return node;
                }
              }
            }
          }
          // Fallback: any <audio> that appears to be playing
          const candidates = Array.from(document.querySelectorAll('audio'));
          return candidates.find(a => !a.paused && a.currentTime > 0 && a.readyState >= 2) || null;
        };

        // Poll briefly for an active element
        let audioEl = findPlayingAudioElement();
        const deadline = Date.now() + 3000;
        while (!audioEl && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 100));
          audioEl = findPlayingAudioElement();
        }
        if (!audioEl) return; // nothing playing yet

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        // Prefer captureStream to avoid cross-origin restrictions on file:// media
        let stream = null;
        if (typeof audioEl.captureStream === 'function') {
          stream = audioEl.captureStream();
        } else if (typeof audioEl.mozCaptureStream === 'function') {
          stream = audioEl.mozCaptureStream();
        }

        let src = null;
        if (stream) {
          src = ctx.createMediaStreamSource(stream);
        } else {
          // Fallback: may fail under file:// due to CORS; keep try/catch silent
          try {
            src = ctx.createMediaElementSource(audioEl);
          } catch (_) {
            return;
          }
        }
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.2;
        // Route element into analyser and then through a zero-gain sink to destination
        // This pulls the graph without adding audible output or double-routing
        const sink = ctx.createGain();
        sink.gain.value = 0.0;
        src.connect(analyser);
        analyser.connect(sink);
        sink.connect(ctx.destination);

        function currentRMS() {
          const buf = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          return Math.sqrt(sum / buf.length);
        }

        function isSilent(threshold = 1e-3) {
          return currentRMS() < threshold;
        }

        window.electronTest.audioProbe = { currentRMS, isSilent };
      } catch (_) {
        // ignore
      }
    });
    
    // Verify audio becomes audible via probe
    await waitForAudible(page);

    // Verify UI reflects playback state
    await expect(page.locator('#pause_button')).toBeVisible();
    await expect(page.locator('#stop_button')).toBeEnabled();
    
    // Mute → silence
    await page.locator('#mute_button').click();
    await stabilize(page, 150);
    await waitForSilence(page);
    
    // Unmute → audible again
    await page.locator('#mute_button').click();
    await waitForAudible(page);
    
    // Volume relationships
    const volumeSlider = page.locator('#volume');
    await volumeSlider.fill('50');
    await stabilize(page, 250);
    const mid = await rms(page);
    await volumeSlider.fill('90');
    await stabilize(page, 250);
    const high = await rms(page);
    await volumeSlider.fill('10');
    await stabilize(page, 250);
    const low = await rms(page);
    expect(high).toBeGreaterThan(mid * 1.1);
    expect(low).toBeLessThan(mid * 0.9);
    
    // Stop playback → silence
    const stopButton = page.locator('#stop_button');
    await stopButton.click();
    await stabilize(page, 150);
    await waitForSilence(page);
  });

  // test('stop button stops playback', async () => {
  //   ...
  // });

  // test('mute button toggles mute state', async () => {
  //   ...
  // });

  // test('volume slider can be adjusted', async () => {
  //   ...
  // });

  // test('audio probe detects audio during playback (diagnostic)', async () => {
  //   ...
  // });
});


