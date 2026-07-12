function calculatePlaybackVolume(masterVolumePercent, trackVolumePercent = 100) {
  const masterVolume = (Number(masterVolumePercent) || 0) / 100;
  const trackVolume = (Number(trackVolumePercent) || 0) / 100;
  return { masterVolume, trackVolume, targetVolume: masterVolume * trackVolume };
}

function getCrossfadePolicy(options = {}) {
  const enabled = options.crossfade === true;
  const seconds = enabled ? Number(options.crossfadeSeconds) || 3 : 0;
  return { enabled, seconds, durationMs: seconds * 1000 };
}

function getTrackBounds(row = {}) {
  return {
    startTime: row.start_time ?? null,
    endTime: row.end_time ?? null
  };
}

function determinePlaybackCompletionAction({ loop, autoplay, holdingTankMode }) {
  if (loop) return 'loop';
  if (autoplay && holdingTankMode === 'playlist') return 'autoplay';
  return 'stop';
}

export {
  calculatePlaybackVolume,
  determinePlaybackCompletionAction,
  getCrossfadePolicy,
  getTrackBounds
};
