# Cleanup Module

The cleanup module handles proper resource cleanup when the application window is closing.

## Purpose

While profile switching uses `app.exit(0)` which cleans up the entire process, this module ensures proper cleanup for:
- Normal application quit scenarios
- Following best practices for resource management
- Preventing potential resource leaks during development/testing

## What Gets Cleaned Up

1. **Animation Frames**: Cancels any active `requestAnimationFrame` callbacks used for time tracking
2. **Audio Resources**: Unloads Howler.js sound instances and removes event listeners
3. **Event Listeners**: Cleans up delegated event handlers through the event coordination system

## Integration

The module is initialized during app bootstrap and automatically registers a `beforeunload` handler:

```javascript
import { initializeCleanup } from './modules/cleanup/index.js';

// During bootstrap
const cleanup = initializeCleanup({
  debugLog: debugLogger,
  eventCoordination: eventCoordinationInstance
});
```

## Usage

### Automatic Cleanup

Cleanup happens automatically when the window closes:

```javascript
// No action needed - the beforeunload event triggers cleanup
```

### Manual Cleanup

For testing or explicit cleanup scenarios:

```javascript
import { cleanup } from './modules/cleanup/index.js';

// Manually trigger cleanup
cleanup();
```

## API

### `initializeCleanup(dependencies)`

Initialize the cleanup module and register the beforeunload handler.

**Parameters:**
- `dependencies.debugLog` - Debug logger instance
- `dependencies.eventCoordination` - Event coordination instance

**Returns:** Object with `cleanup` function

**Example:**
```javascript
const cleanupModule = initializeCleanup({
  debugLog: window.debugLog,
  eventCoordination: window.eventCoordination
});
```

### `cleanup()`

Manually trigger cleanup of all resources.

**Example:**
```javascript
import { cleanup } from './modules/cleanup/index.js';

cleanup(); // Force cleanup now
```

## Resources Cleaned

### Animation Frames

Cancels the global animation frame used for audio time tracking:

```javascript
const animationId = sharedState.get('globalAnimation');
cancelAnimationFrame(animationId);
```

### Audio Resources

Unloads active Howler.js sound instances:

```javascript
const sound = sharedState.get('sound');
sound.off('fade');
sound.unload();
```

### Event Listeners

Cleans up delegated event handlers:

```javascript
eventCoordination.eventDelegator.cleanup();
```

## Error Handling

All cleanup operations are wrapped in try-catch blocks to ensure partial failures don't prevent other cleanup operations from running. Errors are logged but don't throw.

## Architecture Notes

- The cleanup module accesses `sharedState` for tracking active resources
- It integrates with the event coordination system for listener cleanup
- All cleanup is best-effort and non-blocking
- The module is safe to call multiple times

## Testing

To verify cleanup is working:

```javascript
// 1. Start audio playback
// 2. Check shared state
console.log(sharedState.get('sound')); // Should show Howl instance
console.log(sharedState.get('globalAnimation')); // Should show animation ID

// 3. Trigger cleanup
cleanup();

// 4. Verify cleanup
console.log(sharedState.get('sound')); // Should be null
console.log(sharedState.get('globalAnimation')); // Should be null
```

## Related Modules

- `shared-state` - Stores references to active resources
- `event-coordination/event-delegator` - Manages event listener cleanup
- `audio/audio-manager` - Creates audio resources that need cleanup
- `profile-state` - Uses beforeunload for state saving (runs before cleanup)

