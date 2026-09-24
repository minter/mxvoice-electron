import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupUpdateIndicator } from '../../../src/renderer/modules/ui/update-indicator.js';

function fakeButton() {
  const classes = new Set(['d-none']);
  const listeners = {};
  return {
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
    label: { textContent: '' },
    querySelector(selector) { return selector === '.update-label' ? this.label : null; },
    setAttribute(name, value) { this[name] = value; },
    addEventListener: (event, handler) => { listeners[event] = handler; },
    click: () => listeners.click?.(),
  };
}

describe('update indicator', () => {
  let windowTarget;
  let button;
  let dispatched;

  beforeEach(() => {
    windowTarget = new EventTarget();
    button = fakeButton();
    dispatched = [];
    const originalDispatch = windowTarget.dispatchEvent.bind(windowTarget);
    windowTarget.dispatchEvent = vi.fn((event) => { dispatched.push(event); return originalDispatch(event); });
    setupUpdateIndicator({ documentTarget: { getElementById: () => button }, windowTarget });
  });

  it('stays hidden until a background check finds an update', () => {
    expect(button.classList.contains('d-none')).toBe(true);
  });

  it('shows the version on the button without opening the modal', () => {
    windowTarget.dispatchEvent(new CustomEvent('mxvoice:update-available-quiet', { detail: { name: '4.3.3', notes: '<p>notes</p>' } }));

    expect(button.classList.contains('d-none')).toBe(false);
    expect(button.label.textContent).toBe('Update 4.3.3');
    expect(button['aria-label']).toBe('Update 4.3.3 available');
    expect(dispatched.map((e) => e.type)).not.toContain('mxvoice:show-modal');
  });

  it('opens the usual release-notes modal when clicked', () => {
    windowTarget.dispatchEvent(new CustomEvent('mxvoice:update-available-quiet', { detail: { name: '4.3.3', notes: '<p>notes</p>' } }));
    dispatched.length = 0;

    button.click();

    expect(dispatched.map((e) => e.type)).toEqual(['mxvoice:update-release-notes', 'mxvoice:show-modal']);
    expect(dispatched[0].detail).toEqual({ name: '4.3.3', notes: '<p>notes</p>' });
    expect(dispatched[1].detail).toEqual({ selector: '#newReleaseModal' });
  });

  it('hides once the update has downloaded', () => {
    windowTarget.dispatchEvent(new CustomEvent('mxvoice:update-available-quiet', { detail: { name: '4.3.3', notes: '' } }));
    windowTarget.dispatchEvent(new CustomEvent('mxvoice:update-ready', { detail: { version: '4.3.3' } }));

    expect(button.classList.contains('d-none')).toBe(true);
  });

  it('does nothing when clicked before an update is known', () => {
    button.click();
    expect(dispatched).toHaveLength(0);
  });

  it('restores a pending update after a reload by asking the main process', async () => {
    const restoredButton = fakeButton();
    const electronAPI = { fileOperations: { getPendingUpdate: vi.fn(async () => ({ success: true, data: { name: '4.3.3', notes: '<p>n</p>' } })) } };

    setupUpdateIndicator({ documentTarget: { getElementById: () => restoredButton }, windowTarget: new EventTarget(), electronAPI });

    await vi.waitFor(() => expect(restoredButton.classList.contains('d-none')).toBe(false));
    expect(restoredButton.label.textContent).toBe('Update 4.3.3');
  });

  it('stays hidden when the main process has no pending update', async () => {
    const hiddenButton = fakeButton();
    const getPendingUpdate = vi.fn(async () => ({ success: true, data: null }));

    setupUpdateIndicator({ documentTarget: { getElementById: () => hiddenButton }, windowTarget: new EventTarget(), electronAPI: { fileOperations: { getPendingUpdate } } });
    await vi.waitFor(() => expect(getPendingUpdate).toHaveBeenCalled());

    expect(hiddenButton.classList.contains('d-none')).toBe(true);
  });

  it('is a no-op when the button is missing from the page', () => {
    expect(() => setupUpdateIndicator({ documentTarget: { getElementById: () => null }, windowTarget: new EventTarget() })).not.toThrow();
  });
});
