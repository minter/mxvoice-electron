import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  sortProfiles,
  filterProfiles,
  initialSelection,
  primaryLabel,
  isNoopChoice,
  validateNewProfileName
} from '../../../src/renderer/modules/profile-picker/picker-model.js';

const profiles = [
  { name: 'andy', description: 'Andrew Berkowitz', last_used: 30 },
  { name: 'Zed', last_used: 10 },
  { name: DEFAULT_PROFILE, description: 'Default profile', last_used: 20 },
  { name: 'Aaron', last_used: 5 },
];

describe('profile picker model', () => {
  it('sorts Default User first, then case-insensitively by name', () => {
    expect(sortProfiles(profiles).map((p) => p.name)).toEqual([DEFAULT_PROFILE, 'Aaron', 'andy', 'Zed']);
    expect(profiles[0].name).toBe('andy');
  });

  it('filters on name or description, ignoring case and surrounding space', () => {
    expect(filterProfiles(profiles, '  BERK ').map((p) => p.name)).toEqual(['andy']);
    expect(filterProfiles(profiles, 'ze').map((p) => p.name)).toEqual(['Zed']);
    expect(filterProfiles(profiles, '')).toHaveLength(4);
    expect(filterProfiles(profiles)).not.toBe(profiles);
  });

  it('preselects the most recently used profile at startup only', () => {
    expect(initialSelection({ profiles, mode: 'startup' })).toBe('andy');
    expect(initialSelection({ profiles, mode: 'switch' })).toBeNull();
    expect(initialSelection({ profiles: [{ name: 'Solo' }], mode: 'switch' })).toBe('Solo');
    expect(initialSelection({ profiles: [], mode: 'startup' })).toBeNull();
    expect(initialSelection({ profiles: [{ name: 'A' }, { name: 'B' }], mode: 'startup' })).toBe('A');
  });

  it('labels the primary button with what it will do', () => {
    expect(primaryLabel({ mode: 'startup', selected: null })).toBe('Open');
    expect(primaryLabel({ mode: 'startup', selected: 'Aaron' })).toBe('Open Aaron');
    expect(primaryLabel({ mode: 'switch', selected: null, currentProfile: 'andy' })).toBe('Switch');
    expect(primaryLabel({ mode: 'switch', selected: 'Aaron', currentProfile: 'andy' })).toBe('Switch to Aaron');
    expect(primaryLabel({ mode: 'switch', selected: 'andy', currentProfile: 'andy' })).toBe('Stay on andy');
  });

  it('treats choosing the running profile while switching as a no-op', () => {
    expect(isNoopChoice({ mode: 'switch', selected: 'andy', currentProfile: 'andy' })).toBe(true);
    expect(isNoopChoice({ mode: 'switch', selected: 'Aaron', currentProfile: 'andy' })).toBe(false);
    expect(isNoopChoice({ mode: 'startup', selected: 'andy', currentProfile: 'andy' })).toBe(false);
    expect(isNoopChoice({ mode: 'switch', selected: null, currentProfile: null })).toBe(false);
  });

  it('validates new profile names', () => {
    expect(validateNewProfileName('', profiles)).toBe('Profile name is required');
    expect(validateNewProfileName('Bad/Name', profiles)).toMatch(/can only contain/);
    expect(validateNewProfileName('Zed', profiles)).toBe('A profile with this name already exists');
    expect(validateNewProfileName('Saturday show-2_b', profiles)).toBeNull();
  });
});
