import { determinePlaybackCompletionAction } from './playback-policy.js';

function handlePlaybackCompleted({ sound, songId, sharedState, onSongEnded, replaySong, autoplayNext }) {
  if (sharedState.get('sound') !== sound) {
    sound.unload();
    return 'stale';
  }
  onSongEnded();
  const action = determinePlaybackCompletionAction({
    loop: sharedState.get('loop'),
    autoplay: sharedState.get('autoplay'),
    holdingTankMode: sharedState.get('holdingTankMode')
  });
  if (action === 'loop') replaySong(songId);
  if (action === 'autoplay') autoplayNext();
  return action;
}

export { handlePlaybackCompleted };
export default handlePlaybackCompleted;
