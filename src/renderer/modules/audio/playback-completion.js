import { determinePlaybackCompletionAction } from './playback-policy.js';

function handlePlaybackCompleted({ sound, songId, sharedState, onSongEnded, replaySong, autoplayNext }) {
  if (sharedState.get('sound') !== sound) {
    sound.unload();
    return 'stale';
  }
  return completeActivePlayback({ songId, sharedState, onSongEnded, replaySong, autoplayNext });
}

function completeActivePlayback({ songId, sharedState, onSongEnded, replaySong, autoplayNext }) {
  onSongEnded();
  const action = determinePlaybackCompletionAction({
    loop: sharedState.get('loop'),
    autoplay: sharedState.get('autoplay'),
    holdingTankMode: sharedState.get('holdingTankMode')
  });
  if (action === 'loop' && songId) replaySong(songId);
  if (action === 'autoplay') autoplayNext();
  return action;
}

export { completeActivePlayback, handlePlaybackCompleted };
export default handlePlaybackCompleted;
