import { validateBackupRetentionPolicy } from './profile-preference-validator.js';

function selectBackupsForRetention(backups, { maxCount, maxAge, now = Date.now() }) {
  const ordered = [...backups]
    .sort((a, b) => b.timestamp - a.timestamp);
  const validation = validateBackupRetentionPolicy(maxCount, maxAge);

  // Invalid policy must never become authorization to delete recovery data.
  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
      keep: ordered,
      remove: []
    };
  }

  // Zero is the documented "Never delete" age setting.
  if (maxAge === 0) {
    return {
      valid: true,
      keep: ordered,
      remove: []
    };
  }

  const keep = ordered
    .filter((backup) => now - backup.timestamp <= maxAge)
    .slice(0, maxCount);

  // Always retain the newest recovery point, even when every backup is older
  // than the configured age limit.
  if (ordered.length > 0 && !keep.some((backup) => backup.id === ordered[0].id)) {
    keep.unshift(ordered[0]);
  }

  const keptIds = new Set(keep.map((backup) => backup.id));
  return {
    valid: true,
    keep,
    remove: backups.filter((backup) => !keptIds.has(backup.id))
  };
}

export { selectBackupsForRetention };
export default selectBackupsForRetention;
