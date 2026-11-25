import { describe, expect, it, vi } from 'vitest';
import {
  setupUpdateDeferralTracking,
  showAnalyticsBannerIfNeeded
} from '../../../src/renderer/modules/analytics/consent-banner.js';

function createElement() {
  const handlers = {};
  return {
    classList: { add: vi.fn(), remove: vi.fn() },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    handlers
  };
}

describe('analytics consent banner', () => {
  it('shows an unseen banner and persists acceptance', async () => {
    const calls = [];
    const banner = createElement();
    const ok = createElement();
    const store = {
      get: vi.fn().mockResolvedValue({ success: true, value: false }),
      markAnalyticsBannerShown: vi.fn(async () => {
        calls.push('banner-shown');
        return { success: true };
      })
    };
    const analytics = {
      setOptOut: vi.fn(async () => {
        calls.push('opted-in');
        return { success: true };
      })
    };
    const documentTarget = {
      getElementById: (id) => ({
        'analytics-consent-banner': banner,
        'analytics-consent-ok': ok
      })[id] || null
    };

    await showAnalyticsBannerIfNeeded({ electronAPI: { store, analytics }, documentTarget });
    expect(banner.classList.remove).toHaveBeenCalledWith('d-none');
    await ok.handlers.click();
    expect(analytics.setOptOut).toHaveBeenCalledWith(false);
    expect(store.markAnalyticsBannerShown).toHaveBeenCalledOnce();
    expect(calls).toEqual(['opted-in', 'banner-shown']);
  });

  it('persists opt-out before marking the banner decision complete', async () => {
    const calls = [];
    const banner = createElement();
    const disable = createElement();
    const store = {
      get: vi.fn().mockResolvedValue({ success: true, value: false }),
      markAnalyticsBannerShown: vi.fn(async () => {
        calls.push('banner-shown');
        return { success: true };
      })
    };
    const analytics = {
      setOptOut: vi.fn(async () => {
        calls.push('opted-out');
        return { success: true };
      })
    };
    const documentTarget = {
      getElementById: (id) => ({
        'analytics-consent-banner': banner,
        'analytics-consent-disable': disable
      })[id] || null
    };

    await showAnalyticsBannerIfNeeded({ electronAPI: { store, analytics }, documentTarget });
    await disable.handlers.click();

    expect(calls).toEqual(['opted-out', 'banner-shown']);
    expect(banner.classList.add).toHaveBeenCalledWith('d-none');
  });

  it('keeps the banner open when opt-out cannot be persisted', async () => {
    const banner = createElement();
    const disable = createElement();
    const store = { get: vi.fn().mockResolvedValue({ success: true, value: false }), markAnalyticsBannerShown: vi.fn() };
    const analytics = { setOptOut: vi.fn().mockResolvedValue({ success: false }) };
    const documentTarget = {
      getElementById: (id) => ({
        'analytics-consent-banner': banner,
        'analytics-consent-disable': disable
      })[id] || null
    };

    await showAnalyticsBannerIfNeeded({ electronAPI: { store, analytics }, documentTarget });
    await disable.handlers.click();

    expect(store.markAnalyticsBannerShown).not.toHaveBeenCalled();
    expect(banner.classList.add).not.toHaveBeenCalledWith('d-none');
  });

  it('does not read preferences in the E2E environment', async () => {
    const store = { get: vi.fn() };
    await showAnalyticsBannerIfNeeded({ electronAPI: { store }, testEnvironment: { isE2E: true } });
    expect(store.get).not.toHaveBeenCalled();
  });

  it('tracks update deferral independently of consent visibility', () => {
    const button = createElement();
    const trackEvent = vi.fn();
    setupUpdateDeferralTracking({
      electronAPI: { analytics: { trackEvent } },
      documentTarget: { getElementById: () => button }
    });
    button.handlers.click();
    expect(trackEvent).toHaveBeenCalledWith('auto_update_action', { action: 'deferred' });
  });
});
