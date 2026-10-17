import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE,
  sortProfiles,
  filterProfiles,
  initialSelection,
  primaryLabel,
  isSelectable,
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
    expect(initialSelection({ profiles, mode: 'switch', currentProfile: 'andy' })).toBeNull();
    expect(initialSelection({ profiles: [{ name: 'Solo' }], mode: 'startup' })).toBe('Solo');
    expect(initialSelection({ profiles: [], mode: 'startup' })).toBeNull();
    expect(initialSelection({ profiles: [{ name: 'A' }, { name: 'B' }], mode: 'startup' })).toBe('A');
  });

  it('never preselects the running profile, but preselects the only other one', () => {
    const two = [{ name: 'Running' }, { name: 'Other' }];
    expect(initialSelection({ profiles: two, mode: 'switch', currentProfile: 'Running' })).toBe('Other');
    expect(initialSelection({ profiles: [{ name: 'Running' }], mode: 'switch', currentProfile: 'Running' })).toBeNull();
  });

  it('labels the primary button with what it will do', () => {
    expect(primaryLabel({ mode: 'startup', selected: null })).toBe('Open');
    expect(primaryLabel({ mode: 'startup', selected: 'Aaron' })).toBe('Open Aaron');
    expect(primaryLabel({ mode: 'switch', selected: null })).toBe('Switch');
    expect(primaryLabel({ mode: 'switch', selected: 'Aaron' })).toBe('Switch to Aaron');
  });

  it('makes only the running profile unselectable, and only while switching', () => {
    expect(isSelectable({ mode: 'switch', name: 'andy', currentProfile: 'andy' })).toBe(false);
    expect(isSelectable({ mode: 'switch', name: 'Aaron', currentProfile: 'andy' })).toBe(true);
    expect(isSelectable({ mode: 'startup', name: 'andy', currentProfile: 'andy' })).toBe(true);
    expect(isSelectable({ mode: 'switch', name: 'andy', currentProfile: null })).toBe(true);
  });

  it('validates new profile names', () => {
    expect(validateNewProfileName('', profiles)).toBe('Profile name is required');
    expect(validateNewProfileName('Bad/Name', profiles)).toMatch(/can only contain/);
    expect(validateNewProfileName('Zed', profiles)).toBe('A profile with this name already exists');
    expect(validateNewProfileName('Saturday show-2_b', profiles)).toBeNull();
  });
});
