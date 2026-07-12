import { startCrossfadeIn } from './crossfade-transition.js';

function handlePlaybackStarted({
  sound,
  howlerContext,
  crossfade,
  targetVolume,
  durationMs,
  sharedState,
  requestAnimationFrame,
  updateTimeTracker,
  presentPlayback,
  presentation,
  ensureAudioProbe
}) {
  if (crossfade && durationMs > 0) {
    startCrossfadeIn({ sound, targetVolume, durationMs });
  }
  sharedState.set(
    'globalAnimation',
    requestAnimationFrame(updateTimeTracker.bind(howlerContext))
  );
  presentPlayback(presentation);
  ensureAudioProbe?.();
}

export { handlePlaybackStarted };
export default handlePlaybackStarted;
