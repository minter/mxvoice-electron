/**
 * Shift cue on Stop and Pause
 *
 * Shift-click on Stop fades out instead of cutting, and on Pause fades out
 * before pausing (audio-control-events.js). While the pointer is over one of
 * those buttons and Shift is held, the button shows a fade icon
 * (.fade-cue, reskin-tier2.css) and its tooltip names the fade. Only the
 * hovered button changes, so Shift while typing in search changes nothing.
 */

export const FADE_CUE_BUTTONS = [
  { id: 'stop_button', normal: 'Stop (Shift-click to fade out)', fade: 'Fade out' },
  { id: 'pause_button', normal: 'Pause (Shift-click to fade out, then pause)', fade: 'Fade out, then pause' }
];

let hovered = null;
let shiftDown = false;
let attached = false;

function setTooltip(el, text) {
  if (el.dataset.fadeCueTip === text) return;
  el.dataset.fadeCueTip = text;
  el.setAttribute('aria-label', text);
  const tip = window.bootstrap?.Tooltip?.getInstance?.(el);
  if (tip?.setContent) {
    tip.setContent({ '.tooltip-inner': text });
  } else {
    // Not set up yet: initTooltip reads the title when it runs
    el.setAttribute('title', text);
  }
}

/** Show each button's state for the current pointer and Shift key */
export function renderFadeCue(doc = document) {
  for (const { id, normal, fade } of FADE_CUE_BUTTONS) {
    const el = doc.getElementById(id);
    if (!el) continue;
    const on = shiftDown && hovered === el && !el.disabled;
    el.classList.toggle('fade-cue', on);
    setTooltip(el, on ? fade : normal);
  }
}

function update(nextShift) {
  if (typeof nextShift === 'boolean') shiftDown = nextShift;
  renderFadeCue();
}

/** Wire the hover and Shift listeners once */
export function initFadeModifierCue(doc = document, win = window) {
  if (attached) return;
  attached = true;

  for (const { id } of FADE_CUE_BUTTONS) {
    const el = doc.getElementById(id);
    if (!el) continue;
    el.addEventListener('mouseenter', (event) => { hovered = el; update(event.shiftKey); });
    el.addEventListener('mousemove', (event) => { if (event.shiftKey !== shiftDown) update(event.shiftKey); });
    el.addEventListener('mouseleave', () => { if (hovered === el) hovered = null; update(); });
    // A fade starting or the button disabling itself ends the cue
    el.addEventListener('click', () => setTimeout(() => update(), 0));
  }

  win.addEventListener('keydown', (event) => { if (event.key === 'Shift' && !shiftDown) update(true); });
  win.addEventListener('keyup', (event) => { if (event.key === 'Shift') update(false); });
  win.addEventListener('blur', () => update(false));

  renderFadeCue(doc);
}

export default { initFadeModifierCue, renderFadeCue, FADE_CUE_BUTTONS };
