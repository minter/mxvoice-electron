async function resolveAudioSource({ musicDirectory, filename, pathAPI, fileSystemAPI }) {
  try {
    const pathResult = await pathAPI.join(musicDirectory, filename);
    if (!pathResult?.success || !pathResult.data) {
      return { success: false, reason: 'path', error: pathResult?.error || 'Path join failed' };
    }

    const filePath = pathResult.data;
    const existsResult = await fileSystemAPI.exists(filePath);
    if (!existsResult?.success || !existsResult.exists) {
      return {
        success: false,
        reason: 'missing',
        filePath,
        error: existsResult?.error || 'File does not exist'
      };
    }
    return { success: true, filePath, source: [filePath] };
  } catch (error) {
    return { success: false, reason: 'path', error: error.message };
  }
}

export { resolveAudioSource };
export default resolveAudioSource;
