function createBackupFileOperations({ fs, path }) {
  async function copyDirectory(source, destination) {
    await fs.promises.mkdir(destination, { recursive: true });
    const entries = await fs.promises.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destinationPath = path.join(destination, entry.name);
      if (entry.isDirectory()) await copyDirectory(sourcePath, destinationPath);
      else await fs.promises.copyFile(sourcePath, destinationPath);
    }
  }

  function removeDirectory(directory) {
    return fs.promises.rm(directory, { recursive: true, force: true });
  }

  return { copyDirectory, removeDirectory };
}

export { createBackupFileOperations };
export default createBackupFileOperations;
