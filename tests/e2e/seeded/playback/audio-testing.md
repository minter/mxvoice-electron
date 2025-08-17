# Audio Playback Testing with Playwright in Electron

## Getting Started Checklist ✅

1. **Enable test mode in your app**  
   - Add an `E2E` environment flag.  
   - Expose `window.electronTest` in preload when `E2E` is set.

2. **Add an audio probe**  
   - Implement `installAudioProbe()` (see below).  
   - Attach it **after your master gain/mute node**.  
   - Expose `currentRMS()` and `isSilent()` via `window.electronTest.audioProbe`.

3. **Use a known test signal**  
   - For reliability, use an `OscillatorNode` or bundled sine wave in test mode.  
   - Hook your Play/Pause/Stop/Mute/Volume UI to control this signal.

4. **Write Playwright helpers**  
   - Add `rms()`, `waitForAudible()`, `waitForSilence()`, and `stabilize()` utilities.  
   - Place them in `tests/audio.helpers.ts`.

5. **Add E2E tests**  
   - “Play” → audio present.  
   - “Mute/Pause/Stop” → silence.  
   - Volume slider → louder and quieter RMS values.

6. **Configure CI runner**  
   - Launch with `--autoplay-policy=no-user-gesture-required`.  
   - Avoid `--mute-audio`.  
   - Fix sample rate with `new AudioContext({ sampleRate: 48000 })`.

---

This document explains a **practical, deterministic strategy** for testing audio behavior in an Electron app with Playwright. It focuses on what a user actually experiences—**sound present vs. silent, louder vs. quieter**—while remaining stable in CI.

---

## Why this approach? (Background & Rationale)

Testing “real” system audio (what comes out of physical speakers) in CI is fragile:
- It depends on host audio drivers/devices that often don’t exist (or are sandboxed) on runners.
- It requires virtual loopback devices (e.g., BlackHole, VB-CABLE) that are hard to install and permission on CI.
- Browser autoplay and microphone permissions introduce flakiness.

**Instead**, we test inside your renderer’s **Web Audio graph**, just **before** or **after** your master output node. This gives you:
- **Determinism:** No dependence on OS devices; fully headless-friendly.
- **Speed:** Assertions finish in milliseconds.
- **Coverage of real logic:** Mute/stop/pause/volume controls are measured on the actual audio signal path.

> Think of this as a “software stethoscope” placed on your master bus. You measure exactly the signal a user would hear, without needing to mic the speakers.

### What this approach verifies
- “Play” actually produces a **non-zero** signal.
- “Mute”, “Pause”, and “Stop” produce **near-zero** signal.
- Moving the “Volume” slider **changes the measured level** in the expected direction.

### What it does **not** verify
- OS-level routing, physical devices, or system sound effects.
- Subjective audio quality, latency, or synchronization with video.
- Exact absolute loudness (we check **relationships** instead).

If you really need to validate the OS loopback, see **Appendix A** for a local-only approach.

---

## Testing Strategy at a Glance (Test Pyramid)

```
                     ┌───────────────────────────────────────┐
                     │  E2E UI + Signal Assertions (this doc)│
                     │  – mute/pause/stop/volume work        │
                     └───────────────────────────────────────┘
                     ┌───────────────────────────────────────┐
                     │  Web Audio Unit Tests (OfflineAudio)  │
                     │  – gain math, mute node, routing      │
                     └───────────────────────────────────────┘
                     ┌───────────────────────────────────────┐
                     │  Pure Logic Unit Tests                │
                     │  – UI state, reducers, commands       │
                     └───────────────────────────────────────┘
```

- **E2E** proves your UI controls manipulate the actual audio signal.
- **OfflineAudioContext** unit tests give sample-accurate checks (no timers/devices).
- **Pure logic** tests validate button state/transitions independently of audio.

---

## Where to tap the signal (Architecture)

A typical graph for a music app might look like this:

```
User Source (MediaElement/Buffer) → FX chain → MasterGain → Destination

                                 └──(Test Tap)──► Analyser (RMS)
```

- If you want to confirm the **final user experience**, place the test tap **after** `MasterGain` (your volume/mute node) and **before** `destination`.
- If you need to detect **input presence** pre-volume, tap **before** `MasterGain`.
- You can expose **two probes** (pre and post) when helpful.

---

## 1) Add an Audio Probe (test-only)

In test mode, expose an analyser that lets Playwright measure RMS.

**audioProbe.ts**
```ts
export function installAudioProbe(ctx: AudioContext, nodeBeforeDestination: AudioNode) {
  const analyser = new AnalyserNode(ctx, { fftSize: 2048 });
  analyser.smoothingTimeConstant = 0.2;
  nodeBeforeDestination.connect(analyser);

  function currentRMS(): number {
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  function isSilent(threshold = 1e-3): boolean {
    return currentRMS() < threshold;
  }

  if (process.env.E2E && (window as any).electronTest) {
    (window as any).electronTest.audioProbe = { currentRMS, isSilent };
  }

  return { currentRMS, isSilent };
}
```

**Why RMS?** Root-mean-square is a robust proxy for perceived loudness over a short window. It’s stable and compares well across small graph changes.

---

## 2) Hook It into Your Graph

```ts
const ctx = new AudioContext({ sampleRate: 48000 });

// Your master chain
const masterGain = new GainNode(ctx, { gain: 1 });
masterGain.connect(ctx.destination);

// TEST-ONLY: install the probe AFTER masterGain to reflect the user's output
if (process.env.E2E) {
  const { installAudioProbe } = await import('./audioProbe');
  installAudioProbe(ctx, masterGain);
}

// (Optional) In E2E, play a known signal for predictability
if (process.env.E2E) {
  const osc = new OscillatorNode(ctx, { type: 'sine', frequency: 440 });
  osc.connect(masterGain);
  // Your Play button should start/stop this source in test mode
}
```

---

## 3) Playwright Helpers

**tests/audio.helpers.ts**
```ts
import { Page } from '@playwright/test';

export async function rms(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).electronTest?.audioProbe?.currentRMS() ?? 0);
}

export async function waitForSilence(page: Page, thr = 1e-3) {
  await page.waitForFunction(
    (t) => (window as any).electronTest?.audioProbe?.isSilent(t),
    thr
  );
}

export async function waitForAudible(page: Page, thr = 3e-3) {
  await page.waitForFunction(
    (t) => ((window as any).electronTest?.audioProbe?.currentRMS?.() ?? 0) > t,
    thr
  );
}

export async function stabilize(page: Page, ms = 120) {
  await page.waitForTimeout(ms);
}
```

---

## 4) Example E2E Tests

**tests/audio.e2e.spec.ts**
```ts
import { test, expect } from '@playwright/test';
import { rms, waitForSilence, waitForAudible, stabilize } from './audio.helpers';

test.describe('Audio controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForFunction(() => !!(window as any).electronTest?.audioProbe);
  });

  test('Play produces audio', async ({ page }) => {
    await page.getByRole('button', { name: /play/i }).click();
    await stabilize(page);
    await waitForAudible(page);
    const level = await rms(page);
    expect(level).toBeGreaterThan(0.003);
  });

  test('Mute silences audio', async ({ page }) => {
    await page.getByRole('button', { name: /play/i }).click();
    await waitForAudible(page);
    await page.getByRole('button', { name: /mute/i }).click();
    await stabilize(page);
    await waitForSilence(page);
  });

  test('Pause and Stop silence audio', async ({ page }) => {
    await page.getByRole('button', { name: /play/i }).click();
    await waitForAudible(page);

    await page.getByRole('button', { name: /pause/i }).click();
    await stabilize(page);
    await waitForSilence(page);

    await page.getByRole('button', { name: /play/i }).click();
    await waitForAudible(page);
    await page.getByRole('button', { name: /stop/i }).click();
    await stabilize(page);
    await waitForSilence(page);
  });

  test('Volume slider changes level', async ({ page }) => {
    await page.getByRole('button', { name: /play/i }).click();
    await waitForAudible(page);

    const vol = page.getByRole('slider', { name: /volume/i });

    await vol.fill('0.5');
    await stabilize(page);
    const mid = await rms(page);

    await vol.fill('0.9');
    await stabilize(page);
    const high = await rms(page);

    await vol.fill('0.1');
    await stabilize(page);
    const low = await rms(page);

    expect(high).toBeGreaterThan(mid * 1.2);
    expect(low).toBeLessThan(mid * 0.8);
  });
});
```

---

## CI/Runner Setup Tips

- Launch Chromium/Electron with: `--autoplay-policy=no-user-gesture-required`
- **Do not** use `--mute-audio` when measuring audio.
- Fix the sample rate for stability: `new AudioContext({ sampleRate: 48000 })`.
- Keep probe logic **behind** an env flag (e.g., `E2E=1`) so it’s excluded from production bundles.

---

## Troubleshooting

- **RMS always ~0**: Verify the probe is attached to the correct node, ensure your test signal is actually started, and confirm `E2E` flag is set so `window.electronTest.audioProbe` is exposed.
- **Flaky thresholds**: Add a short `stabilize()` wait after changes; increase analyser `smoothingTimeConstant`; tune thresholds.
- **Residual signal after mute**: Ensure mute truly gates the signal (e.g., `gain=0`) and no bypass paths exist.
- **Media files behave differently**: Prefer oscillator/buffer for E2E. Add a few tests for real files separately.

---

## Appendix A: Full System Loopback (Local-only)

If you must confirm OS-level output end-to-end:
- **macOS**: Use BlackHole or Soundflower.
- **Windows**: Use VB-CABLE.
- **Linux**: Use `snd-aloop`.

Then route app output to that device and use `getUserMedia` to capture.  
**Not CI-friendly**—use locally as a sanity check.

---

## Appendix B: Deterministic Unit Tests with OfflineAudioContext

For sample-accurate validation, render your graph offline:

```ts
test('mute kills signal; volume scales RMS', async () => {
  const sr = 48000, len = sr * 1;
  const ctx = new OfflineAudioContext(2, len, sr);

  const gain = new GainNode(ctx, { gain: 1 });
  gain.connect(ctx.destination);

  const osc = new OscillatorNode(ctx, { type: 'sine', frequency: 440 });
  osc.connect(gain);
  osc.start(0); osc.stop(0.5);

  const buf = await ctx.startRendering();
  const d = buf.getChannelData(0);
  const rms = Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length);
  expect(rms).toBeGreaterThan(0.05);

  // Re-render muted
  const ctx2 = new OfflineAudioContext(2, len, sr);
  const g2 = new GainNode(ctx2, { gain: 0 });
  g2.connect(ctx2.destination);
  const osc2 = new OscillatorNode(ctx2, { type: 'sine', frequency: 440 });
  osc2.connect(g2);
  osc2.start(0); osc2.stop(0.5);
  const buf2 = await ctx2.startRendering();
  const d2 = buf2.getChannelData(0);
  const rms2 = Math.sqrt(d2.reduce((s, x) => s + x * x, 0) / d2.length);
  expect(rms2).toBeLessThan(1e-4);
});
```

---

This document can be dropped into your test directory as `audio-testing.md` for reference when implementing and maintaining audio playback tests.