import { describe, expect, it } from 'vitest';
import { selectBackupsForRetention } from '../../../src/main/modules/backup-retention-policy.js';

describe('backup retention policy', () => {
  const backups = [
    { id: 'newest', timestamp: 900 },
    { id: 'middle', timestamp: 800 },
    { id: 'oldest', timestamp: 100 }
  ];

  it('keeps the newest backups within count and age limits', () => {
    const result = selectBackupsForRetention(backups, {
      maxCount: 1,
      maxAge: 500,
      now: 1000
    });
    expect(result.keep.map((backup) => backup.id)).toEqual(['newest']);
    expect(result.remove.map((backup) => backup.id)).toEqual(['middle', 'oldest']);
  });

  it('orders retained backups newest first', () => {
    const result = selectBackupsForRetention([...backups].reverse(), {
      maxCount: 3,
      maxAge: 1000,
      now: 1000
    });
    expect(result.keep.map((backup) => backup.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('removes every backup when none meet the age limit', () => {
    const result = selectBackupsForRetention(backups, {
      maxCount: 3,
      maxAge: 10,
      now: 1000
    });
    expect(result.keep).toEqual([]);
    expect(result.remove).toHaveLength(3);
  });
});
