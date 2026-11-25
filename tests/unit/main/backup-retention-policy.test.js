import { describe, expect, it } from 'vitest';
import { selectBackupsForRetention } from '../../../src/main/modules/backup-retention-policy.js';
import {
  MAX_BACKUP_AGE,
  MIN_BACKUP_AGE
} from '../../../src/main/modules/profile-preference-validator.js';

describe('backup retention policy', () => {
  const now = 10_000_000_000;
  const backups = [
    { id: 'newest', timestamp: now - 100 },
    { id: 'middle', timestamp: now - 200 },
    { id: 'oldest', timestamp: now - MIN_BACKUP_AGE - 1 }
  ];

  it('keeps the newest backups within count and age limits', () => {
    const result = selectBackupsForRetention(backups, {
      maxCount: 1,
      maxAge: MIN_BACKUP_AGE,
      now
    });
    expect(result.keep.map((backup) => backup.id)).toEqual(['newest']);
    expect(result.remove.map((backup) => backup.id)).toEqual(['middle', 'oldest']);
  });

  it('orders retained backups newest first', () => {
    const result = selectBackupsForRetention([...backups].reverse(), {
      maxCount: 3,
      maxAge: MAX_BACKUP_AGE,
      now
    });
    expect(result.keep.map((backup) => backup.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('keeps the newest backup when every backup exceeds the age limit', () => {
    const oldBackups = backups.map((backup, index) => ({
      ...backup,
      timestamp: now - MIN_BACKUP_AGE - index - 1
    }));
    const result = selectBackupsForRetention(oldBackups, {
      maxCount: 3,
      maxAge: MIN_BACKUP_AGE,
      now
    });
    expect(result.keep.map((backup) => backup.id)).toEqual(['newest']);
    expect(result.remove).toHaveLength(2);
  });

  it.each([
    ['negative count', -1, MIN_BACKUP_AGE],
    ['string count', '1', MIN_BACKUP_AGE],
    ['negative age', 3, -1],
    ['string age', 3, '604800000']
  ])('keeps every backup for an invalid policy with %s', (_label, maxCount, maxAge) => {
    const result = selectBackupsForRetention(backups, { maxCount, maxAge, now });

    expect(result.valid).toBe(false);
    expect(result.keep.map((backup) => backup.id)).toEqual(['newest', 'middle', 'oldest']);
    expect(result.remove).toEqual([]);
  });

  it('keeps every backup when age cleanup is disabled', () => {
    const result = selectBackupsForRetention(backups, { maxCount: 1, maxAge: 0, now });

    expect(result.valid).toBe(true);
    expect(result.keep.map((backup) => backup.id)).toEqual(['newest', 'middle', 'oldest']);
    expect(result.remove).toEqual([]);
  });
});
