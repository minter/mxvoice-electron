## Adapters Module

Provides a unified interface for accessing Electron APIs that works in both secure (context isolation enabled) and legacy (context isolation disabled) modes.

### Structure
```
adapters/
├── secure-adapter.js  # Auto-detecting API adapter
└── README.md
```

### Exports

`secure-adapter.js` exports the following secure adapters:

- `secureDatabase` — Database operations (getCategories, searchSongs, getSongById, addSong, updateSong, deleteSong, execute, query)
- `secureStore` — Persistent key-value store (get, set, has, delete, clear)
- `secureFileSystem` — File system operations (read, write, exists, readdir, stat, copy, delete, mkdir)
- `securePath` — Path utilities (join, dirname, basename, extname, resolve, parse)
- `secureOS` — OS information (platform, homedir)
- `secureAudio` — Audio controls (play, pause, stop, volume)

### Usage

```javascript
import { secureDatabase, secureStore, securePath } from '../adapters/secure-adapter.js';

const categories = await secureDatabase.getCategories();
const value = await secureStore.get('someKey');
const fullPath = await securePath.join(dir, filename);
```

### Notes

- Automatically detects whether `window.secureElectronAPI` or `window.electronAPI` is available
- Falls back gracefully when APIs are unavailable
- Used by most renderer modules instead of accessing `window` APIs directly
