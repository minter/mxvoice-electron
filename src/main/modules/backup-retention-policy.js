function selectBackupsForRetention(backups, { maxCount, maxAge, now = Date.now() }) {
  const keep = backups
    .filter((backup) => now - backup.timestamp <= maxAge)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, maxCount);
  const keptIds = new Set(keep.map((backup) => backup.id));
  return {
    keep,
    remove: backups.filter((backup) => !keptIds.has(backup.id))
  };
}

export { selectBackupsForRetention };
export default selectBackupsForRetention;
