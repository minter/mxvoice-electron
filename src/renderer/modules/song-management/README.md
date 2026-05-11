## Song Management Module

CRUD helpers and bulk actions for songs, exported as a singleton with bound methods.

### Structure
```
song-management/
├── song-crud.js
├── song-removal.js
├── index.js              # Singleton
└── README.md
```

## Exports and interface
- Default export: singleton instance
- Methods: `saveEditedSong`, `saveNewSong`, `editSelectedSong`, `deleteSelectedSong`, `deleteSong`, `removeFromHoldingTank`, `removeFromHotkey`, `startAddNewSong`

## Song Fields

Songs include the following audio enhancement fields (managed via the song form):
- `volume` — Per-track volume level (0-100, default 100)
- `start_time` — Playback start trim point in seconds (optional)
- `end_time` — Playback end trim point in seconds (optional)

## Usage
```javascript
import songs from './modules/song-management/index.js';

await songs.saveNewSong(event);
await songs.deleteSong();
```

## Notes
- Integrates with DB, file system, and UI modules
- Error handling and confirmations as needed