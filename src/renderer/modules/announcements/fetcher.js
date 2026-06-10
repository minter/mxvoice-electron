/**
 * Thin wrapper around the secureElectronAPI.announcements namespace.
 * Unwraps the { success, value } envelope and normalizes errors to null.
 */
function unwrap(response) {
  if (!response) return null;
  if (response.success === false) return null;
  return 'value' in response ? response.value : response;
}

export const fetcher = {
  async getManifest() {
    return unwrap(await window.secureElectronAPI.announcements.getManifest());
  },
  async getBody(path) {
    return unwrap(await window.secureElectronAPI.announcements.getBody(path));
  },
  async subscribe(email, vars) {
    return unwrap(await window.secureElectronAPI.announcements.subscribe(email, vars));
  },
};
