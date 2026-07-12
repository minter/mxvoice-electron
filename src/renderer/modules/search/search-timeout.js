import sharedState from '../shared-state.js';

export function clearSearchTimeout() {
  const timeout = sharedState.get('searchTimeout');
  if (timeout) clearTimeout(timeout);
  sharedState.set('searchTimeout', null);
}

export function scheduleSearch(callback, delay = 300) {
  clearSearchTimeout();
  const timeout = setTimeout(() => {
    sharedState.set('searchTimeout', null);
    callback();
  }, delay);
  sharedState.set('searchTimeout', timeout);
  return timeout;
}
