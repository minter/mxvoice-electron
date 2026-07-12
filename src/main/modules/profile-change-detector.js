function createProfileChangeDetector({ fs, path, crypto, getProfileDirectory, pathExists, readMetadata, getDebugLog }) {
  async function calculateHash(profileName) {
    try {
      const profileDirectory = getProfileDirectory(profileName);
      if (!await pathExists(profileDirectory)) return null;
      const hash = crypto.createHash('sha256');

      async function hashDirectory(directory) {
        const entries = await fs.promises.readdir(directory, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name.includes('backup')) continue;
          const entryPath = path.join(directory, entry.name);
          if (entry.isDirectory()) await hashDirectory(entryPath);
          else {
            const stats = await fs.promises.stat(entryPath);
            hash.update(entryPath);
            hash.update(stats.size.toString());
            hash.update(stats.mtimeMs.toString());
            hash.update(await fs.promises.readFile(entryPath));
          }
        }
      }

      await hashDirectory(profileDirectory);
      return hash.digest('hex');
    } catch (error) {
      getDebugLog()?.error('Failed to calculate profile hash', {
        module: 'profile-change-detector', function: 'calculateHash', profileName, error: error.message
      });
      return null;
    }
  }

  async function hasChanged(profileName) {
    try {
      const currentHash = await calculateHash(profileName);
      if (!currentHash) return { changed: true };
      const lastHash = (await readMetadata(profileName)).lastBackupHash || null;
      if (!lastHash) return { changed: true, currentHash };
      return { changed: currentHash !== lastHash, currentHash, lastHash };
    } catch (error) {
      getDebugLog()?.error('Failed to check profile changes', {
        module: 'profile-change-detector', function: 'hasChanged', profileName, error: error.message
      });
      return { changed: true };
    }
  }

  return { calculateHash, hasChanged };
}

export { createProfileChangeDetector };
export default createProfileChangeDetector;
