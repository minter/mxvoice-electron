/**
 * Path authorization guards used by IPC handlers.
 * Moved verbatim from ipc-handlers.js — see that file's git history.
 *
 * Note: the original file had two functions:
 *   - `canonicalizeForAuthorization(filePath)` — single-arg realpath resolution helper.
 *   - `isPathAllowed(filePath, allowedPaths)` — the two-arg `{ canonicalPath, allowed }` check.
 * Per the ipc/ module contract, the two-arg check is exported here under the name
 * `canonicalizeForAuthorization`, and the single-arg realpath helper it depends on is kept
 * private under the name `canonicalizeRealpath` to avoid a naming collision. Bodies are
 * otherwise unchanged.
 */

import path from 'path';
import { promises as fsPromises } from 'fs';

export function isPathInside(candidatePath, allowedPath) {
  const relative = path.relative(path.resolve(allowedPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function canonicalizeRealpath(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    return await fsPromises.realpath(resolvedPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const realParent = await fsPromises.realpath(path.dirname(resolvedPath));
    return path.join(realParent, path.basename(resolvedPath));
  }
}

export async function canonicalizeForAuthorization(filePath, allowedPaths) {
  const canonicalPath = await canonicalizeRealpath(filePath);
  const canonicalAllowedPaths = await Promise.all(allowedPaths.map(async allowedPath => {
    try {
      return await fsPromises.realpath(path.resolve(allowedPath));
    } catch {
      return path.resolve(allowedPath);
    }
  }));
  return {
    canonicalPath,
    allowed: canonicalAllowedPaths.some(allowedPath => isPathInside(canonicalPath, allowedPath))
  };
}
