import { MULTI_SONG_THRESHOLD } from '../bulk-operations/multi-song-import.js';

/**
 * Tour definitions keyed by app version.
 * Update the version key to match package.json exactly at release time.
 */
export default {
  tours: {
    // Next release: rename the key to match package.json when it is bumped
    '4.4.0': {
      title: "What's New in 4.4.0",
      steps: [
        {
          element: '#profileSwitchModal .modal-content',
          title: 'Switch Profiles Instantly',
          description: 'Profile → Switch Profile now opens right here instead of restarting the app. Your current profile is grayed out; pick another to switch, or press Esc to go back to what you were doing.',
          side: 'right',
          align: 'center',
          preAction: { type: 'function', name: 'openSwitchProfileForTour' },
          postAction: { type: 'function', name: 'closeSwitchProfileForTour' },
          skipIfMissing: true,
        },
        {
          title: 'Closing the Window Asks First',
          description: 'Closing the main window quits Mx. Voice, so it now asks first: a stray click mid-show can\'t stop the music. Choosing Quit from the menu still quits right away.',
        },
        {
          title: 'Your Layout Is Now a Show',
          description: 'The hotkeys and holding tank you had are saved as a show named Show. Quitting puts it back next time. From now on, changes made during a show are kept only if you Save the show or use Save As to make a new one.',
        },
        {
          title: 'The Shows Menu',
          description: 'Use the Shows menu to switch shows, Save the show on screen, Save As a new show, Revert to the saved one, or Rename or Delete the show on screen. To tidy another show, switch to it first.',
        },
        {
          element: '#profile-indicator',
          title: 'Which Show Is Loaded',
          description: 'The header now shows your profile and the show that is loaded. A dot after the show name means the layout on screen has unsaved changes.',
          side: 'bottom',
          align: 'center',
          skipIfMissing: true,
        },
        {
          title: "Copy Someone's Show",
          description: 'Shows → Import Show copies a saved show from another profile on this computer. Your copy is yours to change.',
        },
      ],
    },
    '4.3.0': {
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
          element: '#multiSongImportModal .modal-content',
          title: 'Fine-tune Your Imports',
          description: `When importing 2 to ${MULTI_SONG_THRESHOLD} tracks, you can now adjust the title, artist, and category for each individual track before saving them to your library.`,
          side: 'bottom',
          align: 'center',
          preAction: { type: 'function', name: 'openMultiSongImportTour' },
          postAction: { type: 'closeModal', target: '#multiSongImportModal' },
          skipIfMissing: true,
        },
        {
          element: '#preferences-crossfade-seconds',
          title: 'Crossfade Between Tracks',
          description: 'Set a crossfade duration for smooth transitions between tracks in playlist mode.',
          side: 'right',
          align: 'center',
          preAction: { type: 'function', name: 'openPreferencesAndScrollToCrossfade' },
          skipIfMissing: true,
        },
        {
          element: '#preferences-analytics-enabled',
          title: 'Anonymous Usage Analytics',
          description: 'Mx. Voice now collects anonymous usage data to help us improve the app — no personal information is ever sent. You can opt out here at any time.',
          side: 'right',
          align: 'center',
          preAction: { type: 'function', name: 'openPreferencesAndScrollToAnalytics' },
          postAction: { type: 'closeModal', target: '#preferencesModal' },
          skipIfMissing: true,
        },
      ],
    },
  },
};
