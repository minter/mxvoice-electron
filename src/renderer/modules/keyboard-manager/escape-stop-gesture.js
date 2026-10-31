/**
 * Escape stop gesture
 *
 * One-handed stop control on a single key:
 * - Tap Esc: cut the music when the key comes back up
 * - Hold Esc: fade out once the key has been down for HOLD_TO_FADE_MS
 * - Esc while a fade is running: cut at once, on the key going down
 *
 * The cut waits for the key to come up only as long as the tap takes. If
 * the keyup never arrives (focus moved to another app mid-press), the hold
 * timer still fires and the music fades rather than playing on.
 *
 * A press stops only the song that was playing when Esc went down. Operators
 * roll "Esc, then the next cue's F-key": if that next song has started by the
 * time Esc comes up (or the hold timer fires), the press is dropped.
 *
 * Tap or hold is decided by how long the key was down, not by which of the
 * keyup and the timer runs first, so a stalled renderer can't turn a hold
 * into a cut.
 */

import sharedState from '../shared-state.js';

export const HOLD_TO_FADE_MS = 300;

export class EscapeStopGesture {
  /**
   * @param {Object} options
   * @param {(fadeOut: boolean) => void} options.stop
   * @param {() => boolean} [options.isFadingOut]
   * @param {() => unknown} [options.currentSound] - the playing sound object
   * @param {() => number} [options.now] - milliseconds clock
   * @param {number} [options.holdMs]
   * @param {Function} [options.setTimer]
   * @param {Function} [options.clearTimer]
   */
  constructor({
    stop,
    isFadingOut = () => false,
    currentSound = () => sharedState.get('sound'),
    now = () => performance.now(),
    holdMs = HOLD_TO_FADE_MS,
    // Wrapped: browsers throw if setTimeout is called as another object's method
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id)
  }) {
    this.stop = stop;
    this.isFadingOut = isFadingOut;
    this.currentSound = currentSound;
    this.now = now;
    this.holdMs = holdMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.holdTimer = null;
    this.pressedSound = null;
    this.pressedAt = 0;
  }

  /** @param {KeyboardEvent} [event] */
  keyDown(event) {
    // Key repeat while held: the first keydown already decided
    if (event?.repeat) return;

    this.cancelHold();
    this.pressedSound = this.currentSound();
    this.pressedAt = this.now();
    if (this.isFadingOut()) {
      this.stopPressedSound(false);
      return;
    }
    this.holdTimer = this.setTimer(() => {
      this.holdTimer = null;
      this.stopPressedSound(true);
    }, this.holdMs);
  }

  keyUp() {
    // Released after the fade began, or a keydown we never saw
    if (this.holdTimer === null) return;
    this.cancelHold();
    // The timer may not have run yet even though the key was held long enough
    const held = this.now() - this.pressedAt >= this.holdMs;
    this.stopPressedSound(held);
  }

  /**
   * Stop, unless a different song (or none) is playing now than when Esc
   * went down
   * @param {boolean} fadeOut
   */
  stopPressedSound(fadeOut) {
    const sound = this.pressedSound;
    this.pressedSound = null;
    if (sound === null || sound === undefined || this.currentSound() !== sound) return;
    this.stop(fadeOut);
  }

  cancelHold() {
    if (this.holdTimer !== null) {
      this.clearTimer(this.holdTimer);
      this.holdTimer = null;
    }
  }
}
