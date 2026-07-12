function updateWaveform({ source, row, sharedState }) {
  let wavesurfer = sharedState.get('wavesurfer');
  if (!wavesurfer && sharedState.get('createWaveSurfer')) {
    wavesurfer = sharedState.get('createWaveSurfer')();
  }
  if (!wavesurfer) return false;

  wavesurfer.load(source);
  const regions = sharedState.get('wavesurferRegions');
  if (regions && (row?.start_time > 0 || row?.end_time != null)) {
    wavesurfer.once('ready', () => {
      regions.clearRegions();
      regions.addRegion({
        start: row?.start_time ?? 0,
        end: row?.end_time ?? wavesurfer.getDuration(),
        color: 'rgba(0, 123, 255, 0.2)',
        drag: false,
        resize: false
      });
    });
  }
  return true;
}

function showActivePlayback({ songId, row, documentTarget = document }) {
  const title = row?.title || '';
  const artist = row?.artist ? `by ${row.artist}` : '';
  const nowPlaying = documentTarget.getElementById('song_now_playing');
  if (nowPlaying) {
    nowPlaying.textContent = '';
    const icon = documentTarget.createElement('i');
    icon.id = 'song_spinner';
    icon.className = 'fas fa-volume-up';
    nowPlaying.appendChild(icon);
    nowPlaying.appendChild(documentTarget.createTextNode(` ${title} ${artist}`));
    nowPlaying.style.display = '';
    nowPlaying.setAttribute('songid', String(songId));
  }

  const playButton = documentTarget.getElementById('play_button');
  if (playButton) {
    playButton.classList.add('d-none');
    playButton.removeAttribute('disabled');
  }
  documentTarget.getElementById('pause_button')?.classList.remove('d-none');
  documentTarget.getElementById('stop_button')?.removeAttribute('disabled');
}

function presentPlaybackStarted({ songId, row, source, sharedState, documentTarget = document }) {
  updateWaveform({ source, row, sharedState });
  showActivePlayback({ songId, row, documentTarget });
}

export { presentPlaybackStarted, showActivePlayback, updateWaveform };
