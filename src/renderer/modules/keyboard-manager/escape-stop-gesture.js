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
 */

export const HOLD_TO_FADE_MS = 300;

export class EscapeStopGesture {
  /**
   * @param {Object} options
   * @param {(fadeOut: boolean) => void} options.stop
   * @param {() => boolean} [options.isFadingOut]
   * @param {number} [options.holdMs]
   * @param {Function} [options.setTimer]
   * @param {Function} [options.clearTimer]
   */
  constructor({
    stop,
    isFadingOut = () => false,
    holdMs = HOLD_TO_FADE_MS,
    // Wrapped: browsers throw if setTimeout is called as another object's method
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id)
  }) {
    this.stop = stop;
    this.isFadingOut = isFadingOut;
    this.holdMs = holdMs;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.holdTimer = null;
  }

  /** @param {KeyboardEvent} [event] */
  keyDown(event) {
    // Key repeat while held: the first keydown already decided
    if (event?.repeat) return;

    this.cancelHold();
    if (this.isFadingOut()) {
      this.stop(false);
      return;
    }
    this.holdTimer = this.setTimer(() => {
      this.holdTimer = null;
      this.stop(true);
    }, this.holdMs);
  }

  keyUp() {
    // Released after the fade began, or a keydown we never saw
    if (this.holdTimer === null) return;
    this.cancelHold();
    this.stop(false);
  }

  cancelHold() {
    if (this.holdTimer !== null) {
      this.clearTimer(this.holdTimer);
      this.holdTimer = null;
    }
  }
}
