# Profile Auto-Backup and Restore Specification

## Overview

This document specifies the design and implementation of an automatic backup system for user profiles with restore functionality. This feature addresses the critical issue of profile data loss by providing automatic snapshots and a user-friendly restore interface.

## Goals

1. **Prevent Data Loss**: Automatically create backups of profile data at regular intervals
2. **Easy Recovery**: Provide a simple UI to restore from any backup snapshot
3. **Storage Management**: Automatically clean up old backups based on count or age
4. **Transparency**: Show backup status and history to users

## Architecture

### Backup Storage Structure

Backups are stored in a separate directory structure to avoid interfering with active profiles:

```text
userData/
├── profiles/
│   └── Default User/          # Active profile
│       ├── preferences.json
│       ├── state.json
│       ├── hotkeys/
│       └── holding-tank/
└── profile-backups/
    └── Default User/          # Backups for this profile
        ├── backup-2025-01-15T10-30-45-123Z/
        │   ├── preferences.json
        │   ├── state.json
        │   ├── hotkeys/
        │   └── holding-tank/
        ├── backup-2025-01-15T14-30-45-456Z/
        │   └── ...
        └── backup-metadata.json  # Index of all backups
```

### Backup Metadata Format

Each profile has a `backup-metadata.json` file that tracks all backups:

```json
{
  "profileName": "Default User",
  "backups": [
    {
      "id": "backup-2025-01-15T10-30-45-123Z",
      "timestamp": 1705315845123,
      "size": 245760,
      "fileCount": 12
    },
    {
      "id": "backup-2025-01-15T14-30-45-456Z",
      "timestamp": 1705329045456,
      "size": 256000,
      "fileCount": 13
    }
  ],
  "lastBackup": 1705329045456,
  "backupCount": 2
}
```

### Metadata File Safety (CRITICAL)

The `backup-metadata.json` file is **critical infrastructure** and must be protected from corruption, race conditions, and timing issues. The following safety measures are mandatory:

#### Atomic Write Operations

All metadata writes must use atomic file operations:

1. **Write to temporary file first**: Write to `backup-metadata.json.tmp`
2. **Verify write success**: Check file was written completely
3. **Atomic rename**: Use `fs.rename()` to atomically replace the original file
4. **Cleanup on failure**: Remove temp file if rename fails

```javascript
async function writeMetadataAtomic(metadataPath, data) {
  const tempPath = metadataPath + '.tmp';
  
  try {
    // Write to temp file
    await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    
    // Verify temp file exists and is readable
    await fs.promises.access(tempPath, fs.constants.F_OK | fs.constants.R_OK);
    
    // Atomic rename (this is atomic on most filesystems)
    await fs.promises.rename(tempPath, metadataPath);
    
    // Verify final file exists
    await fs.promises.access(metadataPath, fs.constants.F_OK | fs.constants.R_OK);
  } catch (error) {
    // Cleanup temp file on failure
    try {
      await fs.promises.unlink(tempPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

#### Read-Modify-Write Pattern

All metadata updates must follow a safe read-modify-write pattern:

```javascript
async function updateMetadata(profileName, updateFn) {
  const metadataPath = getBackupMetadataPath(profileName);
  let retries = 3;
  
  while (retries > 0) {
    try {
      // Read current metadata
      const metadata = await readMetadata(profileName);
      
      // Apply update function
      const updated = updateFn(metadata);
      
      // Atomic write
      await writeMetadataAtomic(metadataPath, updated);
      
      return updated;
    } catch (error) {
      retries--;
      if (retries === 0) {
        throw new Error(`Failed to update metadata after retries: ${error.message}`);
      }
      
      // Exponential backoff on retry
      await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
    }
  }
}
```

#### File Locking

Use a simple file-based lock to prevent concurrent writes:

```javascript
async function withMetadataLock(profileName, operation) {
  const lockPath = getBackupMetadataPath(profileName) + '.lock';
  const maxWait = 5000; // 5 seconds max wait
  const checkInterval = 100; // Check every 100ms
  const startTime = Date.now();
  
  // Wait for lock to be released
  while (fs.existsSync(lockPath)) {
    if (Date.now() - startTime > maxWait) {
      throw new Error('Timeout waiting for metadata lock');
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  // Create lock file
  try {
    await fs.promises.writeFile(lockPath, process.pid.toString(), 'utf8');
    
    try {
      // Execute operation
      return await operation();
    } finally {
      // Always remove lock
      try {
        await fs.promises.unlink(lockPath);
      } catch (error) {
        // Log but don't throw - lock cleanup failure is non-critical
        debugLog?.warn('Failed to remove metadata lock', { error: error.message });
      }
    }
  } catch (error) {
    // Remove lock on error
    try {
      await fs.promises.unlink(lockPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    throw error;
  }
}
```

#### Metadata Backup and Recovery

The metadata file itself must be backed up:

1. **Backup before write**: Create `backup-metadata.json.bak` before any write
2. **Verify after write**: Validate JSON structure after write
3. **Recovery on corruption**: If metadata is corrupted, restore from `.bak` file
4. **Fallback recovery**: If `.bak` is also corrupted, rebuild from backup directories

```javascript
async function readMetadataSafe(profileName) {
  const metadataPath = getBackupMetadataPath(profileName);
  const backupPath = metadataPath + '.bak';
  
  try {
    // Try to read primary file
    const data = await fs.promises.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(data);
    
    // Validate structure
    if (!metadata.backups || !Array.isArray(metadata.backups)) {
      throw new Error('Invalid metadata structure');
    }
    
    // Backup is valid, create/update .bak file
    await fs.promises.writeFile(backupPath, data, 'utf8');
    
    return metadata;
  } catch (error) {
    // Primary file is corrupted, try backup
    if (fs.existsSync(backupPath)) {
      try {
        const backupData = await fs.promises.readFile(backupPath, 'utf8');
        const metadata = JSON.parse(backupData);
        
        // Validate backup structure
        if (!metadata.backups || !Array.isArray(metadata.backups)) {
          throw new Error('Backup metadata also corrupted');
        }
        
        // Restore from backup
        await fs.promises.writeFile(metadataPath, backupData, 'utf8');
        debugLog?.warn('Restored metadata from backup file', { profileName });
        
        return metadata;
      } catch (backupError) {
        debugLog?.error('Both metadata and backup are corrupted', { 
          profileName, 
          error: backupError.message 
        });
      }
    }
    
    // Last resort: rebuild from backup directories
    debugLog?.warn('Rebuilding metadata from backup directories', { profileName });
    return await rebuildMetadataFromDirectories(profileName);
  }
}
```

#### Race Condition Prevention

1. **Single operation queue**: Use a queue to serialize metadata operations
2. **Lock before read**: Acquire lock before reading metadata
3. **Validate before write**: Verify metadata structure before writing
4. **Idempotent operations**: Design operations to be safe if run multiple times

```javascript
// Operation queue to serialize metadata operations
const metadataOperationQueue = new Map();

async function queueMetadataOperation(profileName, operation) {
  if (!metadataOperationQueue.has(profileName)) {
    metadataOperationQueue.set(profileName, []);
  }
  
  const queue = metadataOperationQueue.get(profileName);
  
  return new Promise((resolve, reject) => {
    queue.push({ operation, resolve, reject });
    
    // Process queue if this is the first item
    if (queue.length === 1) {
      processMetadataQueue(profileName);
    }
  });
}

async function processMetadataQueue(profileName) {
  const queue = metadataOperationQueue.get(profileName);
  
  while (queue.length > 0) {
    const { operation, resolve, reject } = queue[0];
    
    try {
      const result = await withMetadataLock(profileName, operation);
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      queue.shift();
    }
  }
  
  // Clean up empty queue
  if (queue.length === 0) {
    metadataOperationQueue.delete(profileName);
  }
}
```

#### Implementation Requirements

All metadata operations MUST:

1. Use atomic write operations (temp file + rename)
2. Use file locking to prevent concurrent writes
3. Validate JSON structure after read/write
4. Have backup/recovery mechanisms
5. Use retry logic with exponential backoff
6. Queue operations to prevent race conditions
7. Log all metadata operations for debugging

## What Gets Backed Up

A complete profile backup includes:

1. **preferences.json** - All profile preferences (fade_out_seconds, screen_mode, font_size, etc.)
2. **state.json** - Profile state (hotkey tabs, holding tank tabs, tab names)
3. **hotkeys/** directory - All hotkey files (if any)
4. **holding-tank/** directory - All holding tank files (if any)

### What Does NOT Get Backed Up

- Database files (shared across profiles)
- Global preferences (stored separately)
- Temporary files or caches

## Configuration

### Default Settings

```javascript
{
  // Auto-backup interval in milliseconds
  backupInterval: 30 * 60 * 1000,  // 30 minutes (default)
  
  // Maximum number of backups to keep
  maxBackupCount: 25,  // Keep last 25 backups (default)
  
  // Maximum age of backups in milliseconds
  maxBackupAge: 30 * 24 * 60 * 60 * 1000,  // 30 days (default)
  
  // Enable/disable auto-backup
  autoBackupEnabled: true  // Enabled by default
}
```

### Configuration Storage

Backup settings are stored in profile preferences:

```json
{
  "backup_settings": {
    "autoBackupEnabled": true,
    "backupInterval": 1800000,
    "maxBackupCount": 25,
    "maxBackupAge": 2592000000
  }
}
```

## Auto-Backup Behavior

### When Backups Are Created

1. **Scheduled Backups**: Every X minutes (configurable, default 30 minutes)
   - Timer starts when app launches with a profile
   - Timer resets after each backup
   - Only creates backup if profile data has changed since last backup

2. **Manual Backups**: User can trigger immediate backup via menu
   - "Profile → Create Backup Now"

3. **Before Critical Operations**: (Optional enhancement)
   - Before profile deletion
   - Before profile duplication
   - Before major state changes

### Backup Naming Convention

Backups use ISO 8601 timestamps in filename-safe format:

- Format: `backup-YYYY-MM-DDTHH-MM-SS-sssZ`
- Example: `backup-2025-01-15T14-30-45-123Z`
- Includes milliseconds for uniqueness

### Change Detection

To avoid unnecessary backups, the system tracks:

- Last backup timestamp
- Profile data hash (MD5/SHA-256 of combined file contents)
- Only creates backup if hash differs from last backup

## Restore Functionality

### Restore UI

A new menu item in the Profile menu:

- **"Profile → Restore from Backup..."**
  - Opens a modal dialog showing available backups
  - Displays: Date/time, size, file count
  - Allows preview of backup contents
  - Confirmation dialog before restore

### Restore Process

1. User selects backup from list
2. System shows preview of what will be restored
3. User confirms restore
4. System:
   - Creates a backup of CURRENT state (safety measure)
   - Copies backup files to active profile directory
   - Reloads profile state
   - Shows success message

### Restore Safety

- Always creates a backup of current state before restoring
- Restore creates a backup named `pre-restore-{timestamp}`
- User can undo restore by restoring the pre-restore backup

## Cleanup Policy

### Automatic Cleanup

Runs after each backup creation:

1. **Count-based cleanup**: Keep only the N most recent backups (default: 25)
2. **Age-based cleanup**: Delete backups older than X days (default: 30 days)
3. **Combined policy**: Apply both limits (keep up to N backups, but delete if older than X days)

### Cleanup Algorithm

```javascript
function cleanupOldBackups(metadata, maxCount, maxAge) {
  const now = Date.now();
  const backups = metadata.backups
    .filter(backup => {
      // Keep if within age limit
      return (now - backup.timestamp) <= maxAge;
    })
    .sort((a, b) => b.timestamp - a.timestamp)  // Newest first
    .slice(0, maxCount);  // Keep only N most recent
  
  // Delete backups not in the filtered list
  // Update metadata
}
```

## User Interface

### Menu Integration

Add to existing Profile menu in `app-setup.js`:

```javascript
{
  label: "Profile",
  submenu: [
    // ... existing items ...
    { type: "separator" },
    {
      label: "Create Backup Now",
      click: () => {
        mainWindow.webContents.send('menu:create-backup');
      }
    },
    {
      label: "Restore from Backup...",
      click: () => {
        mainWindow.webContents.send('menu:restore-backup');
      }
    },
    {
      label: "Backup Settings...",
      click: () => {
        mainWindow.webContents.send('menu:backup-settings');
      }
    }
  ]
}
```

### Restore Dialog

Modal dialog showing:

- List of available backups (newest first)
- For each backup:
  - Date/time (formatted: "Jan 15, 2025 2:30 PM")
  - Size (formatted: "245 KB")
  - File count
  - Preview button (optional)
- "Restore" button (disabled until selection)
- "Cancel" button

### Backup Settings Dialog

Modal dialog for configuring:

- Enable/disable auto-backup (checkbox)
- Backup interval (dropdown: 15 min, 30 min, 1 hour, 2 hours, 6 hours, 12 hours, 24 hours)
- Max backups to keep (number input, 1-100)
- Max backup age (dropdown: 7 days, 14 days, 30 days, 60 days, 90 days, Never)

## Implementation Plan

### Phase 1: Core Backup System (Main Process)

1. **Create `profile-backup-manager.js` module** (`src/main/modules/`)
   - `createBackup(profileName)` - Create a backup snapshot
   - `listBackups(profileName)` - List all backups for a profile
   - `getBackupMetadata(profileName)` - Get backup metadata
   - `restoreBackup(profileName, backupId)` - Restore from backup
   - `deleteBackup(profileName, backupId)` - Delete a backup
   - `cleanupOldBackups(profileName)` - Clean up old backups
   - `getBackupDirectory(profileName)` - Get backup directory path
   - **CRITICAL**: `readMetadataSafe(profileName)` - Safe metadata read with recovery
   - **CRITICAL**: `writeMetadataAtomic(metadataPath, data)` - Atomic metadata write
   - **CRITICAL**: `withMetadataLock(profileName, operation)` - Lock-protected operations
   - **CRITICAL**: `queueMetadataOperation(profileName, operation)` - Queue operations
   - **CRITICAL**: `rebuildMetadataFromDirectories(profileName)` - Recovery mechanism

2. **Backup creation logic**:
   - Copy entire profile directory to backup location
   - **Use locked, queued metadata update** to create/update backup metadata
   - Calculate backup size and file count
   - Run cleanup after backup (also using locked, queued operations)

3. **Restore logic**:
   - Create pre-restore backup
   - Copy backup files to active profile
   - Reload profile state

4. **Metadata safety implementation** (MANDATORY):
   - Implement atomic write operations (temp file + rename)
   - Implement file-based locking mechanism
   - Implement operation queue per profile
   - Implement metadata backup/recovery
   - Implement validation after all reads/writes
   - Add comprehensive error handling and logging

### Phase 2: IPC Handlers

Add to `src/main/modules/ipc-handlers.js`:

- `profile:createBackup` - Create backup now
- `profile:listBackups` - Get list of backups
- `profile:getBackupMetadata` - Get backup details
- `profile:restoreBackup` - Restore from backup
- `profile:deleteBackup` - Delete a backup
- `profile:getBackupSettings` - Get backup configuration
- `profile:saveBackupSettings` - Save backup configuration

### Phase 3: Preload API

Add to `src/preload/modules/secure-api-exposer.js`:

```javascript
profile: {
  createBackup: () => ipcRenderer.invoke('profile:createBackup'),
  listBackups: () => ipcRenderer.invoke('profile:listBackups'),
  restoreBackup: (backupId) => ipcRenderer.invoke('profile:restoreBackup', backupId),
  getBackupSettings: () => ipcRenderer.invoke('profile:getBackupSettings'),
  saveBackupSettings: (settings) => ipcRenderer.invoke('profile:saveBackupSettings', settings)
}
```

### Phase 4: Auto-Backup Timer

1. **Initialize timer on app start** (in `index-modular.js` or `app-setup.js`)
   - Start timer when profile is loaded
   - Reset timer after each backup
   - Clear timer on app quit

2. **Change detection**:
   - Track last backup hash
   - Compare current profile hash before creating backup
   - Skip backup if no changes

### Phase 5: Renderer UI

1. **Backup restore module** (`src/renderer/modules/profile-backup/`)
   - `backup-restore-dialog.js` - Restore dialog UI
   - `backup-settings-dialog.js` - Settings dialog UI
   - `index.js` - Module entry point

2. **Menu handlers**:
   - Handle `menu:create-backup` event
   - Handle `menu:restore-backup` event
   - Handle `menu:backup-settings` event

3. **Dialog UI**:
   - Bootstrap modal for restore dialog
   - List backups with formatted dates
   - Confirmation before restore
   - Success/error notifications

### Phase 6: Integration

1. **Menu integration** in `app-setup.js`
2. **Bootstrap integration** in `module-config.js`
3. **Event coordination** for backup notifications
4. **Testing** with various profile states

## Error Handling

### Metadata File Failures (CRITICAL)

- **Corruption detection**: Validate JSON structure on every read
- **Automatic recovery**: Restore from `.bak` file if primary is corrupted
- **Rebuild fallback**: Rebuild metadata from backup directories if both are corrupted
- **Lock timeout**: Fail gracefully if lock cannot be acquired within timeout
- **Queue overflow**: Reject operations if queue becomes too large
- **Atomic write failures**: Retry with exponential backoff, max 3 attempts
- **Never lose data**: Always preserve existing backups even if metadata update fails

### Backup Failures

- Log errors but don't crash app
- Show user-friendly error message
- Retry logic for transient failures
- Skip backup if profile directory is locked
- **Never update metadata if backup creation fails**

### Restore Failures

- Always create pre-restore backup first
- Validate backup integrity before restore
- Rollback on failure (restore pre-restore backup)
- Clear error messages to user

### Storage Issues

- Check available disk space before backup
- Warn if disk space is low
- Delete oldest backups if space is critical
- Fail gracefully if no space available

## Security Considerations

1. **Backup location**: Stored in userData, same security as profiles
2. **File permissions**: Same as profile files
3. **Validation**: Verify backup integrity before restore
4. **Sanitization**: Sanitize profile names in backup paths
5. **Metadata protection**: Lock files prevent concurrent access
6. **Atomic operations**: Prevent partial writes that could corrupt metadata

## Performance Considerations

1. **Incremental backups**: (Future enhancement) Only backup changed files
2. **Compression**: (Future enhancement) Compress backups to save space
3. **Async operations**: All file operations are async
4. **Progress indicators**: Show progress for large backups

## Testing Plan

1. **Unit tests**:
   - Backup creation
   - Backup listing
   - Backup restore
   - Cleanup logic
   - Change detection
   - **CRITICAL**: Atomic metadata writes
   - **CRITICAL**: Metadata locking mechanism
   - **CRITICAL**: Metadata recovery from corruption
   - **CRITICAL**: Operation queue serialization

2. **Integration tests**:
   - Auto-backup timer
   - Menu integration
   - Dialog UI
   - Settings persistence
   - **CRITICAL**: Concurrent backup operations (race conditions)
   - **CRITICAL**: Metadata file corruption recovery
   - **CRITICAL**: Lock timeout handling
   - **CRITICAL**: Queue overflow handling

3. **E2E tests**:
   - Create backup manually
   - Restore from backup
   - Auto-backup creation
   - Cleanup of old backups
   - **CRITICAL**: Multiple simultaneous backup operations
   - **CRITICAL**: Metadata corruption and recovery scenarios
   - **CRITICAL**: App crash during metadata write (verify atomicity)

## Future Enhancements

1. **Backup export/import**: Export backups to external location
2. **Cloud backup**: Optional cloud storage integration
3. **Backup scheduling**: More flexible scheduling options
4. **Backup encryption**: Encrypt sensitive backup data
5. **Backup verification**: Automatic integrity checks
6. **Backup compression**: Compress backups to save space
7. **Incremental backups**: Only backup changed files

## Configuration Examples

### Conservative (More Backups)

```json
{
  "autoBackupEnabled": true,
  "backupInterval": 15 * 60 * 1000,  // 15 minutes
  "maxBackupCount": 20,
  "maxBackupAge": 60 * 24 * 60 * 60 * 1000  // 60 days
}
```

### Aggressive (Fewer Backups)

```json
{
  "autoBackupEnabled": true,
  "backupInterval": 60 * 60 * 1000,  // 1 hour
  "maxBackupCount": 5,
  "maxBackupAge": 14 * 24 * 60 * 60 * 1000  // 14 days
}
```

### Disabled

```json
{
  "autoBackupEnabled": false,
  "backupInterval": 30 * 60 * 1000,
  "maxBackupCount": 25,
  "maxBackupAge": 30 * 24 * 60 * 60 * 1000
}
```

## Questions to Resolve

1. **Backup location**: Should backups be in `userData/profile-backups/` or `userData/profiles/{profile}/backups/`?
   - **Decision**: `userData/profile-backups/` (separate from active profiles)

2. **Backup on profile switch**: Should we backup before switching profiles?
   - **Decision**: Yes, create backup before profile switch

3. **Backup notification**: Should users be notified when auto-backup runs?
   - **Decision**: Silent by default, optional notification in settings

4. **Backup size limits**: Should there be a maximum backup size?
   - **Decision**: No hard limit, but warn if backup is unusually large

5. **Multiple profile backups**: Should backups be per-profile or global?
   - **Decision**: Per-profile (each profile has its own backup history)
