/**
 * Tour definitions keyed by app version.
 * Update the version key to match package.json exactly at release time.
 */
export default {
  tours: {
    '4.3.0-pre.1': {
      title: "What's New in 4.3.0",
      steps: [
        {
          element: '#song-form-volume',
          title: 'Per-Track Volume',
          description: 'Adjust volume for individual tracks. Changes apply in real-time if the track is currently playing.',
          side: 'right',
          align: 'center',
          preAction: { type: 'function', name: 'openEditForFirstSong' },
          postAction: { type: 'closeModal', target: '#songFormModal' },
          skipIfMissing: true,
        },
        {
          element: '#song-form-start-time',
          title: 'Start & End Trim Points',
          description: 'Set custom start and end times to play just a portion of a track. Enter times as MM:SS.',
          side: 'right',
          align: 'center',
          preAction: { type: 'function', name: 'openEditForFirstSong' },
          postAction: { type: 'closeModal', target: '#songFormModal' },
          skipIfMissing: true,
        },
        {
          element: '#holding-tank-column',
          title: 'Drag to Reorder',
          description: 'Drag songs up and down in the holding tank to reorder them. A position indicator shows where the track will land.',
          side: 'right',
          align: 'center',
        },
        {
          element: '#file-drop-overlay',
          title: 'Drag & Drop Import',
          description: 'Drag audio files from Finder or Explorer directly into the app window to import them.',
          side: 'bottom',
          align: 'center',
          preAction: { type: 'function', name: 'showFileDropOverlay' },
          postAction: { type: 'function', name: 'hideFileDropOverlay' },
        },
        {
          element: '#preferences-crossfade-seconds',
          title: 'Crossfade Between Tracks',
          description: 'Set a crossfade duration for smooth transitions between tracks in playlist mode.',
          side: 'right',
          align: 'center',
          preAction: { type: 'function', name: 'openPreferencesAndScrollToCrossfade' },
          postAction: { type: 'closeModal', target: '#preferencesModal' },
          skipIfMissing: true,
        },
      ],
    },
  },
};
