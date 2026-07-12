function showMissingAudioFile({ title, filename, documentTarget = document }) {
  const nowPlaying = documentTarget.getElementById('song_now_playing');
  if (!nowPlaying) return false;

  nowPlaying.textContent = '';
  const icon = documentTarget.createElement('i');
  icon.className = 'fas fa-exclamation-triangle text-warning';
  nowPlaying.appendChild(icon);
  nowPlaying.appendChild(documentTarget.createTextNode(` File not found: ${title || filename}`));
  nowPlaying.style.display = '';
  nowPlaying.removeAttribute('songid');
  return true;
}

export { showMissingAudioFile };
export default showMissingAudioFile;
