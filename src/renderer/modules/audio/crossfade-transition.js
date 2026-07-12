function prepareCrossfadeTransition({ sharedState, durationMs, cancelAnimationFrame }) {
  const outgoingSound = sharedState.get('sound');
  if (outgoingSound?.playing()) {
    sharedState.set('outgoingSound', outgoingSound);
    outgoingSound.off('fade');
    outgoingSound.on('fade', () => {
      outgoingSound.unload();
      if (sharedState.get('outgoingSound') === outgoingSound) {
        sharedState.set('outgoingSound', null);
      }
    });
    outgoingSound.fade(outgoingSound.volume(), 0, durationMs);
  } else if (outgoingSound) {
    outgoingSound.unload();
  }

  const animationFrame = sharedState.get('globalAnimation');
  if (animationFrame) cancelAnimationFrame(animationFrame);
  return outgoingSound || null;
}

function startCrossfadeIn({ sound, targetVolume, durationMs }) {
  if (durationMs <= 0) return false;
  sound.fade(0, targetVolume, durationMs);
  return true;
}

export { prepareCrossfadeTransition, startCrossfadeIn };
