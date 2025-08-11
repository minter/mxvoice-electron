# DebugLog Module

The DebugLog module provides centralized logging functionality for the MxVoice application. It respects the debug log preference and provides structured logging with different levels and context support.

## Module Structure

```
debug-log/
├── index.js              # Main module entry point
├── debug-logger.js       # Core logging functionality
├── log-formatter.js      # Message and context formatting
└── README.md            # This documentation
```

## Features

### ✅ Centralized Logging
- **Respects Debug Preference**: Only logs debug messages when debug logging is enabled
- **Multiple Log Levels**: ERROR, WARN, INFO, DEBUG
- **Context Support**: Rich context information for better debugging
- **Performance Optimized**: Caches debug preference to avoid repeated checks

### ✅ Structured Output
- **Timestamped Messages**: All logs include ISO timestamps
- **Level Icons**: Visual indicators for different log levels
- **Context Formatting**: Structured context information
- **Stack Trace Support**: Clean stack trace formatting

### ✅ Backward Compatibility
- **Drop-in Replacement**: Can replace existing console.log calls
- **Same Interface**: Familiar logging methods
- **Gradual Migration**: Can be adopted incrementally

## API Reference

### Core Logging Functions

#### `log(message, context?)`
Log a general message (uses INFO level by default).

```javascript
// Simple logging
debugLog.log("Application started");

// With context
debugLog.log("User action", { 
  function: "handleClick", 
  data: { buttonId: "play" } 
});
```

#### `info(message, context?)`
Log an informational message.

```javascript
debugLog.info("Module loaded successfully", { module: "audio-controller" });
```

#### `warn(message, context?)`
Log a warning message.

```javascript
debugLog.warn("Deprecated function called", { 
  function: "oldMethod", 
  suggestion: "Use newMethod instead" 
});
```

#### `error(message, context?)`
Log an error message.

```javascript
debugLog.error("Failed to load file", { 
  error: errorObject, 
  file: "config.json" 
});
```

#### `debug(message, context?)`
Log a debug message (only if debug logging is enabled).

```javascript
debugLog.debug("Processing audio file", { 
  file: "song.mp3", 
  duration: "3:45" 
});
```

### Utility Functions

#### `isDebugEnabled()`
Check if debug logging is currently enabled.

```javascript
const debugEnabled = await debugLog.isDebugEnabled();
if (debugEnabled) {
  // Perform debug operations
}
```

#### `setDebugEnabled(enabled)`
Enable or disable debug logging.

```javascript
await debugLog.setDebugEnabled(true);
```

#### `getLogLevel()` / `setLogLevel(level)`
Get or set the current log level.

```javascript
const currentLevel = debugLog.getLogLevel();
debugLog.setLogLevel(LOG_LEVELS.DEBUG);
```

### Context Support

The module supports rich context information:

```javascript
// Function context
debugLog.info("Processing data", { function: "processUserData" });

// Module context
debugLog.warn("API call failed", { module: "database" });

// Error context
debugLog.error("Database error", { error: errorObject });

// Data context
debugLog.debug("User data", { data: userData });

// Custom context
debugLog.info("Custom event", { 
  event: "button_click", 
  userId: "12345", 
  sessionId: "abc123" 
});
```

## Log Levels

| Level | Value | Description | Emitted When |
|-------|-------|-------------|--------------|
| ERROR | 0 | Error messages | Always (level >= ERROR) |
| WARN | 1 | Warning messages | Always (level >= WARN) |
| INFO | 2 | Informational messages | Only if debug enabled and level >= INFO |
| DEBUG | 3 | Debug messages | Only if debug enabled and level >= DEBUG |

## Usage Examples

### Basic Logging

```javascript
// Import the module
import debugLog from './modules/debug-log/index.js';

// Simple logging
await debugLog.info('Application started');
debugLog.warn('Deprecated feature used');
debugLog.error('Critical error occurred');
await debugLog.debug('Debug information');
```

### Context-Aware Logging

```javascript
// With function context
debugLog.info("Processing user input", { 
  function: "handleUserInput",
  data: { inputType: "text", length: 50 }
});

// With error context
try {
  // Some operation
} catch (error) {
  debugLog.error("Operation failed", { 
    error: error,
    function: "performOperation",
    data: { operationType: "database" }
  });
}
```

### Conditional Debug Logging

```javascript
// Check if debug is enabled before expensive operations
const debugEnabled = await debugLog.isDebugEnabled();
if (debugEnabled) {
  const performanceData = collectPerformanceData();
  debugLog.debug("Performance metrics", { data: performanceData });
}
```

### Module-Specific Logging

```javascript
// In a specific module
const moduleContext = { module: "audio-controller" };

debugLog.info("Audio file loaded", { 
  ...moduleContext,
  data: { filename: "song.mp3", duration: "3:45" }
});

debugLog.debug("Audio processing details", {
  ...moduleContext,
  data: { sampleRate: 44100, channels: 2 }
});
```

## Output Format

Log messages are formatted with consistent structure:

```
🐛 [2024-01-15T10:30:45.123Z] [DEBUG] Processing audio file | Context: {"file":"song.mp3","duration":"3:45"}
⚠️ [2024-01-15T10:30:46.456Z] [WARN] Deprecated function called | Function: oldMethod | Suggestion: Use newMethod instead
❌ [2024-01-15T10:30:47.789Z] [ERROR] Failed to load file | Error: File not found | File: config.json
ℹ️ [2024-01-15T10:30:48.012Z] [INFO] Module loaded successfully | Module: audio-controller
```

## Performance Considerations

### Caching
- Debug preference is cached for 5 seconds to avoid repeated store access
- Log level is cached in memory
- Context formatting is optimized for common patterns

### Conditional Execution
- Debug messages are only processed if debug logging is enabled
- Context formatting is skipped for disabled log levels
- Expensive operations should be wrapped in debug checks

```javascript
// Good: Check before expensive operation
if (await debugLog.isDebugEnabled()) {
  const expensiveData = collectExpensiveData();
  debugLog.debug("Expensive data", { data: expensiveData });
}

// Avoid: Always collecting expensive data
const expensiveData = collectExpensiveData(); // Always runs
debugLog.debug("Expensive data", { data: expensiveData }); // Only logs if enabled
```

## Migration Guide

### From console.log to debugLog

**Before:**
```javascript
console.log("Processing data");
console.warn("Deprecated function");
console.error("Error occurred", error);
```

**After:**
```javascript
debugLog.info("Processing data");
debugLog.warn("Deprecated function");
debugLog.error("Error occurred", { error: error });
```

### From console.log with context

**Before:**
```javascript
console.log("User action:", { userId: "123", action: "click" });
```

**After:**
```javascript
debugLog.info("User action", { userId: "123", action: "click" });
```

### Debug-only logging

**Before:**
```javascript
if (debugMode) {
  console.log("Debug info:", data);
}
```

**After:**
```javascript
debugLog.debug("Debug info", { data: data });
```

## Configuration

### Reinitialize with dependencies (during bootstrap)
```javascript
import debugLog from './modules/debug-log/index.js';

debugLog.reinitializeDebugLog({
  electronAPI: window.electronAPI,
  db: window.db,
  store: window.store
});
```

### Log level and preference
```javascript
// Set/get level
debugLog.setLogLevel(3); // DEBUG
const level = debugLog.getLogLevel();

// Check or change preference
const enabled = await debugLog.isDebugEnabled();
await debugLog.setDebugEnabled(true);
```

## Best Practices

### 1. Use Appropriate Log Levels
- **ERROR**: For errors that affect functionality
- **WARN**: For issues that don't break functionality but should be addressed
- **INFO**: For important application events
- **DEBUG**: For detailed debugging information

### 2. Provide Rich Context
```javascript
// Good: Rich context
debugLog.error("Database operation failed", {
  function: "saveUserData",
  error: error,
  data: { userId: "123", operation: "insert" }
});

// Avoid: Minimal context
debugLog.error("Database operation failed");
```

### 3. Use Debug Level for Expensive Operations
```javascript
// Good: Check before expensive operation
if (await debugLog.isDebugEnabled()) {
  const metrics = collectPerformanceMetrics();
  debugLog.debug("Performance metrics", { data: metrics });
}
```

### 4. Consistent Context Structure
```javascript
// Use consistent context properties
const context = {
  function: "currentFunction",
  module: "currentModule",
  data: relevantData
};

debugLog.info("Operation completed", context);
```

## Integration with Centralized Log Service

- All renderer logs still show in DevTools for advanced users.
- The same logs are forwarded to the main process via `window.secureElectronAPI.logs.write` (also available under `window.electronAPI.logs` for compatibility) and persisted to files under `userData/logs/`.
- Errors and warnings from the renderer `console` and unhandled errors/rejections are mirrored to the centralized log service by preload.
- Rotation: daily file (selected at app start) with 5 MB rollover; retention: 14 days (pruned at app start).
- Users can export recent logs via the app menu (“Export Logs…”) or programmatically via `window.secureElectronAPI.logs.export({ days })`.