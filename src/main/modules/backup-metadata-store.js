function createBackupMetadataStore({
  fs,
  getMetadataPath,
  pathExists,
  coordinator,
  rebuildMetadata,
  getDebugLog,
  retryDelay = (attempt) => new Promise((resolve) => setTimeout(resolve, 100 * attempt))
}) {
  function validate(metadata) {
    if (!metadata?.backups || !Array.isArray(metadata.backups)) {
      throw new Error('Invalid metadata structure');
    }
    return metadata;
  }

  async function readSafe(profileName) {
    const metadataPath = getMetadataPath(profileName);
    const backupPath = `${metadataPath}.bak`;
    try {
      const data = await fs.promises.readFile(metadataPath, 'utf8');
      const metadata = validate(JSON.parse(data));
      await fs.promises.writeFile(backupPath, data, 'utf8');
      return metadata;
    } catch (primaryError) {
      if (await pathExists(backupPath)) {
        try {
          const backupData = await fs.promises.readFile(backupPath, 'utf8');
          const metadata = validate(JSON.parse(backupData));
          await fs.promises.writeFile(metadataPath, backupData, 'utf8');
          getDebugLog()?.warn('Restored metadata from backup file', {
            module: 'backup-metadata-store', function: 'readSafe', profileName
          });
          return metadata;
        } catch (backupError) {
          getDebugLog()?.error('Both metadata and backup are corrupted', {
            module: 'backup-metadata-store', function: 'readSafe',
            profileName, error: backupError.message
          });
        }
      }
      return rebuildMetadata(profileName, primaryError);
    }
  }

  async function update(profileName, updateFn) {
    return coordinator.queueOperation(profileName, async () => {
      let retries = 3;
      while (retries > 0) {
        try {
          const updated = validate(updateFn(await readSafe(profileName)));
          const metadataPath = getMetadataPath(profileName);
          const backupPath = `${metadataPath}.bak`;
          if (await pathExists(metadataPath)) {
            await fs.promises.writeFile(
              backupPath,
              await fs.promises.readFile(metadataPath, 'utf8'),
              'utf8'
            );
          }
          await coordinator.writeAtomic(metadataPath, updated);
          return updated;
        } catch (error) {
          retries--;
          if (retries === 0) {
            throw new Error(`Failed to update metadata after retries: ${error.message}`, { cause: error });
          }
          await retryDelay(4 - retries);
        }
      }
    });
  }

  return { readSafe, update, validate };
}

export { createBackupMetadataStore };
export default createBackupMetadataStore;
