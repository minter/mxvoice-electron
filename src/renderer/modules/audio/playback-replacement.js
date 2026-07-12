function releaseSound(sharedState, key) {
  const sound = sharedState.get(key);
  if (!sound) return false;
  sound.off('fade');
  sound.unload();
  if (sharedState.get(key) === sound) sharedState.set(key, null);
  return true;
}

function prepareForPlaybackReplacement({ sharedState, crossfade }) {
  if (crossfade) return false;
  releaseSound(sharedState, 'sound');
  releaseSound(sharedState, 'outgoingSound');
  return true;
}

function parseCrossfadePreference(result) {
  if (!result?.success || !result.value) return 0;
  const seconds = Number.parseFloat(result.value);
  return Number.isNaN(seconds) ? 0 : seconds;
}

export { parseCrossfadePreference, prepareForPlaybackReplacement, releaseSound };
