## Renderer Services

Typed facades over secure preload APIs for clean usage in renderer modules. Each service wraps `window.secureElectronAPI` or secure adapters.

### Structure
```
services/
├── database.js    # Database query and CRUD operations
├── file-system.js # File read, write, exists, readdir, stat, copy, delete
├── path.js        # Path join, dirname, basename, extname, resolve, parse
├── store.js       # Persistent key-value store (has, get, set, delete)
└── README.md
```

### Usage

```javascript
import { database } from '../services/database.js';
import { fileSystem } from '../services/file-system.js';
import { path } from '../services/path.js';
import { store } from '../services/store.js';

const song = await database.getSongById(123);
const exists = await fileSystem.exists(filePath);
const fullPath = await path.join(dir, filename);
const value = await store.get('preference_key');
```

### Notes

- These are thin wrappers providing a clean import interface
- All operations go through IPC to the main process (no direct Node.js access)
- Prefer these services or the adapters in `modules/adapters/` over accessing `window.secureElectronAPI` directly
