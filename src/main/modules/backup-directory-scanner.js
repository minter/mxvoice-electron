function createBackupDirectoryScanner({
  fs,
  path,
  getBackupDirectory,
  getMetadataPath,
  pathExists,
  writeMetadata,
  getDebugLog
}) {
  async function calculateSize(backupPath) {
    let size = 0;
    let fileCount = 0;
    async function scan(directory) {
      const entries = await fs.promises.readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) await scan(entryPath);
        else {
          size += (await fs.promises.stat(entryPath)).size;
          fileCount++;
        }
      }
    }
    await scan(backupPath);
    return { size, fileCount };
  }

  function timestampFromBackupId(backupId, fallback) {
    const match = backupId.match(
      /backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/
    );
    if (!match) return fallback;
    const [, year, month, day, hours, minutes, seconds, milliseconds] = match;
    return Date.UTC(
      Number(year), Number(month) - 1, Number(day),
      Number(hours), Number(minutes), Number(seconds), Number(milliseconds)
    );
  }

  async function rebuildMetadata(profileName) {
    const backupDirectory = getBackupDirectory(profileName);
    const metadata = { profileName, backups: [], lastBackup: null, backupCount: 0 };
    if (!await pathExists(backupDirectory)) return metadata;

    try {
      const entries = await fs.promises.readdir(backupDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.startsWith('backup-')) continue;
        const backupPath = path.join(backupDirectory, entry.name);
        const stats = await fs.promises.stat(backupPath);
        const { size, fileCount } = await calculateSize(backupPath);
        metadata.backups.push({
          id: entry.name,
          timestamp: timestampFromBackupId(entry.name, stats.mtimeMs),
          size,
          fileCount
        });
      }
      metadata.backups.sort((a, b) => b.timestamp - a.timestamp);
      metadata.backupCount = metadata.backups.length;
      metadata.lastBackup = metadata.backups[0]?.timestamp ?? null;
      await writeMetadata(getMetadataPath(profileName), metadata);
      return metadata;
    } catch (error) {
      getDebugLog()?.error('Failed to rebuild metadata', {
        module: 'backup-directory-scanner', function: 'rebuildMetadata',
        profileName, error: error.message
      });
      return metadata;
    }
  }

  return { calculateSize, rebuildMetadata, timestampFromBackupId };
}

export { createBackupDirectoryScanner };
export default createBackupDirectoryScanner;
