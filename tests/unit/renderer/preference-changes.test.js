import { describe, expect, it } from 'vitest';
import { changedPreferenceKeys } from '../../../src/renderer/modules/preferences/preference-changes.js';

describe('changedPreferenceKeys', () => {
  it('reports only preferences whose value changed', () => {
    const previous = { fade_out_seconds: 3, screen_mode: 'auto', music_directory: '/music' };
    const next = { fade_out_seconds: 5, screen_mode: 'auto', music_directory: '/music' };

    expect(changedPreferenceKeys(previous, next)).toEqual(['fade_out_seconds']);
  });

  it('treats stored strings and form numbers/booleans as equal', () => {
    const previous = { fade_out_seconds: '3', debug_log_enabled: 'true' };
    const next = { fade_out_seconds: 3, debug_log_enabled: true };

    expect(changedPreferenceKeys(previous, next)).toEqual([]);
  });

  it('never reports analytics_enabled', () => {
    expect(changedPreferenceKeys({ analytics_enabled: true }, { analytics_enabled: false })).toEqual([]);
  });

  it('ignores keys that are not being saved', () => {
    expect(changedPreferenceKeys({ screen_mode: 'dark' }, {})).toEqual([]);
  });
});
