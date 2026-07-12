function createBackupMetadataCoordinator({ fs, getMetadataPath, pathExists, getDebugLog, lockWaitMs = 5000, pollMs = 100 }) {
  const operationQueues = new Map();

  async function writeAtomic(metadataPath, data) {
    const tempPath = `${metadataPath}.tmp`;
    try {
      await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
      await fs.promises.access(tempPath, fs.constants.F_OK | fs.constants.R_OK);
      await fs.promises.rename(tempPath, metadataPath);
      await fs.promises.access(metadataPath, fs.constants.F_OK | fs.constants.R_OK);
    } catch (error) {
      try { await fs.promises.unlink(tempPath); } catch { /* best-effort cleanup */ }
      throw error;
    }
  }

  async function withLock(profileName, operation) {
    const lockPath = `${getMetadataPath(profileName)}.lock`;
    const startedAt = Date.now();
    while (await pathExists(lockPath)) {
      if (Date.now() - startedAt > lockWaitMs) throw new Error('Timeout waiting for metadata lock');
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    try {
      await fs.promises.writeFile(lockPath, process.pid.toString(), 'utf8');
      try {
        return await operation();
      } finally {
        try {
          await fs.promises.unlink(lockPath);
        } catch (error) {
          getDebugLog()?.warn('Failed to remove metadata lock', {
            module: 'backup-metadata-coordinator', function: 'withLock', error: error.message
          });
        }
      }
    } catch (error) {
      try { await fs.promises.unlink(lockPath); } catch { /* best-effort cleanup */ }
      throw error;
    }
  }

  async function processQueue(profileName) {
    const queue = operationQueues.get(profileName);
    while (queue.length > 0) {
      const { operation, resolve, reject } = queue[0];
      try {
        resolve(await withLock(profileName, operation));
      } catch (error) {
        reject(error);
      } finally {
        queue.shift();
      }
    }
    operationQueues.delete(profileName);
  }

  function queueOperation(profileName, operation) {
    if (!operationQueues.has(profileName)) operationQueues.set(profileName, []);
    const queue = operationQueues.get(profileName);
    return new Promise((resolve, reject) => {
      queue.push({ operation, resolve, reject });
      if (queue.length === 1) processQueue(profileName);
    });
  }

  return { queueOperation, withLock, writeAtomic };
}

export { createBackupMetadataCoordinator };
export default createBackupMetadataCoordinator;
