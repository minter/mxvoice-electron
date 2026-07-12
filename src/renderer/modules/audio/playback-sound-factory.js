function createPlaybackSound({ createHowl, source, volume, muted, debugLog, onPlay, onEnd }) {
  return createHowl({
    src: source,
    volume,
    mute: muted,
    onload: function () {
      debugLog?.info('Sound fully loaded', {
        module: 'playback-sound-factory',
        function: 'onload',
        duration: this.duration(),
        state: this.state()
      });
    },
    onloaderror: function (soundId, error) {
      debugLog?.error('Sound load error', {
        module: 'playback-sound-factory', function: 'onloaderror', soundId, error, src: source
      });
    },
    onplayerror: function (soundId, error) {
      debugLog?.error('Sound play error', {
        module: 'playback-sound-factory', function: 'onplayerror', soundId, error, src: source
      });
    },
    onplay: function () {
      debugLog?.info('Sound playback started', {
        module: 'playback-sound-factory', function: 'onplay'
      });
      onPlay?.call(this);
    },
    onend: function () {
      debugLog?.info('Sound playback ended', {
        module: 'playback-sound-factory', function: 'onend'
      });
      onEnd?.call(this);
    }
  });
}

export { createPlaybackSound };
export default createPlaybackSound;
