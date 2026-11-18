/**
 * Startup Gate
 *
 * Settles once the page has opened its show at startup, after any crash or
 * unreadable-shows prompt has been answered. Modals that would otherwise land
 * on top of those prompts (the release notes) wait for it. Kept apart from
 * shows/index.js so waiting on it pulls in nothing else.
 */

let settle;
const settled = new Promise((resolve) => { settle = resolve; });

/** @returns {Promise<void>} resolved once startup has settled; stays resolved */
export function whenStartupSettled() {
  return settled;
}

export function settleStartup() {
  settle();
}
