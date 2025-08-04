# Renderer.js Modularization Plan

## Current State Analysis

### File Overview
- **File:** `src/renderer.js`
- **Lines:** 3112
- **Functions:** 80+ functions
- **Global Variables:** 8+ variables
- **Event Handlers:** Multiple jQuery event handlers
- **Test Functions:** 6 test functions at the end

### Function Categories Identified

#### 1. **Utils Module** (Lines 95-113)
- `animateCSS()` - Animation utility
- `customConfirm()` - Custom confirmation dialog
- `customPrompt()` - Custom prompt dialog  
- `restoreFocusToSearch()` - Focus restoration utility

#### 2. **Audio Module** (Lines 936-1224)
- `playSongFromId()` - Main audio playback function
- `stopPlaying()` - Stop audio playback
- `pausePlaying()` - Pause audio playback
- `resetUIState()` - Reset UI after audio changes
- `song_ended()` - Audio end handler
- `autoplay_next()` - Autoplay next song
- `cancel_autoplay()` - Cancel autoplay
- `playSelected()` - Play selected song
- `toggle_play_button()` - Toggle play button state
- `loop_on()` - Loop functionality

#### 3. **Database Module** (Lines 278-629)
- `populateCategorySelect()` - Populate category dropdown
- `searchData()` - Main search function
- `performLiveSearch()` - Live search implementation
- `setLabelFromSongId()` - Set labels from song ID
- `triggerLiveSearch()` - Trigger live search

#### 4. **UI Module** (Lines 1440-2078)
- `scale_scrollable()` - Scale scrollable elements
- `toggleWaveform()` - Toggle waveform display
- `toggleAdvancedSearch()` - Toggle advanced search
- `increaseFontSize()` - Increase font size
- `decreaseFontSize()` - Decrease font size
- `editSelectedSong()` - Edit selected song
- `deleteSelectedSong()` - Delete selected song
- `toggle_selected_row()` - Toggle row selection
- `pickDirectory()` - Directory picker
- `installUpdate()` - Update installation
- `closeAllTabs()` - Close all tabs

#### 5. **Hotkeys Module** (Lines 130-188, 1230-1275)
- `playSongFromHotkey()` - Play song from hotkey
- `populateHotkeys()` - Populate hotkeys
- `clearHotkeys()` - Clear hotkeys
- `openHotkeyFile()` - Open hotkey file
- `saveHotkeyFile()` - Save hotkey file
- `hotkeyDrop()` - Hotkey drag and drop
- `allowHotkeyDrop()` - Allow hotkey drop
- `switchToHotkeyTab()` - Switch hotkey tab
- `renameHotkeyTab()` - Rename hotkey tab
- `removeFromHotkey()` - Remove from hotkey
- `sendToHotkeys()` - Send to hotkeys

#### 6. **Holding Tank Module** (Lines 165-183, 762-931, 1238-1275, 1294-1331)
- `populateHoldingTank()` - Populate holding tank
- `clearHoldingTank()` - Clear holding tank
- `addToHoldingTank()` - Add to holding tank
- `holdingTankDrop()` - Holding tank drag and drop
- `setHoldingTankMode()` - Set holding tank mode
- `removeFromHoldingTank()` - Remove from holding tank
- `sendToHoldingTank()` - Send to holding tank
- `renameHoldingTankTab()` - Rename holding tank tab

#### 7. **Categories Module** (Lines 1852-1974)
- `populateCategoriesModal()` - Populate categories modal
- `editCategory()` - Edit category
- `openCategoriesModal()` - Open categories modal
- `deleteCategory()` - Delete category
- `saveCategories()` - Save categories
- `addNewCategory()` - Add new category

#### 8. **Preferences Module** (Lines 274-277, 1584-1593)
- `openPreferencesModal()` - Open preferences modal
- `savePreferences()` - Save preferences

#### 9. **Search Module** (Lines 333-507, 2463-2763)
- `searchData()` - Main search function
- `performLiveSearch()` - Live search implementation
- `triggerLiveSearch()` - Trigger live search

#### 10. **Drag and Drop Module** (Lines 1247-1259)
- `songDrag()` - Song drag functionality
- `columnDrag()` - Column drag functionality

#### 11. **Bulk Operations Module** (Lines 1675-1851)
- `showBulkAddModal()` - Show bulk add modal
- `addSongsByPath()` - Add songs by path
- `saveBulkUpload()` - Save bulk upload

#### 12. **Song Management Module** (Lines 1464-1482, 1584-1674)
- `saveEditedSong()` - Save edited song
- `saveNewSong()` - Save new song
- `deleteSong()` - Delete song

#### 13. **Store Management Module** (Lines 114-129)
- `saveHoldingTankToStore()` - Save holding tank to store
- `saveHotkeysToStore()` - Save hotkeys to store

#### 14. **Test Functions Module** (Lines 2764-3112)
- `testPhase2Migrations()` - Test phase 2 migrations
- `testDatabaseAPI()` - Test database API
- `testFileSystemAPI()` - Test file system API
- `testStoreAPI()` - Test store API
- `testAudioAPI()` - Test audio API
- `testSecurityFeatures()` - Test security features

## Modularization Strategy

### ✅ Phase 1: Utils Module (Week 4) - COMPLETED
**Files created:**
- `src/renderer/modules/utils/modal-utils.js` ✅
- `src/renderer/modules/utils/animation-utils.js` ✅
- `src/renderer/modules/utils/validation-utils.js` ✅
- `src/renderer/modules/utils/index.js` ✅
- `src/renderer/modules/utils/README.md` ✅

**Functions extracted:**
- `animateCSS()` → `animation-utils.js` ✅
- `customConfirm()` → `modal-utils.js` ✅
- `customPrompt()` → `modal-utils.js` ✅
- `restoreFocusToSearch()` → `modal-utils.js` ✅

**Additional components:**
- Module loader created: `src/renderer/module-loader.js` ✅
- Test script created: `src/test-utils-module.js` ✅
- Comprehensive documentation created ✅

### ✅ Phase 2: Audio Module (Week 5) - COMPLETED
**Files created:**
- `src/renderer/modules/audio/audio-manager.js` ✅
- `src/renderer/modules/audio/audio-controller.js` ✅
- `src/renderer/modules/audio/index.js` ✅
- `src/renderer/modules/audio/README.md` ✅

**Functions extracted:**
- `playSongFromId()` → `audio-manager.js` ✅
- `playSelected()` → `audio-manager.js` ✅
- `song_ended()` → `audio-manager.js` ✅
- `autoplay_next()` → `audio-manager.js` ✅
- `cancel_autoplay()` → `audio-manager.js` ✅
- `stopPlaying()` → `audio-controller.js` ✅
- `pausePlaying()` → `audio-controller.js` ✅
- `resetUIState()` → `audio-controller.js` ✅
- `toggle_play_button()` → `audio-controller.js` ✅
- `loop_on()` → `audio-controller.js` ✅

**Additional components:**
- Comprehensive documentation created ✅
- Audio state management documented ✅
- Error handling implemented ✅

### Phase 3: Database Module (Week 6)
**Files to create:**
- `src/renderer/modules/database/database-client.js`
- `src/renderer/modules/database/query-manager.js`
- `src/renderer/modules/database/index.js`

**Functions to extract:**
- `populateCategorySelect()` → `query-manager.js`
- `searchData()` → `query-manager.js`
- `performLiveSearch()` → `query-manager.js`
- `setLabelFromSongId()` → `database-client.js`
- `triggerLiveSearch()` → `query-manager.js`

### Phase 4: UI Module (Week 7)
**Files to create:**
- `src/renderer/modules/ui/ui-manager.js`
- `src/renderer/modules/ui/event-handlers.js`
- `src/renderer/modules/ui/index.js`

**Functions to extract:**
- `scale_scrollable()` → `ui-manager.js`
- `toggleWaveform()` → `ui-manager.js`
- `toggleAdvancedSearch()` → `ui-manager.js`
- `increaseFontSize()` → `ui-manager.js`
- `decreaseFontSize()` → `ui-manager.js`
- `editSelectedSong()` → `ui-manager.js`
- `deleteSelectedSong()` → `ui-manager.js`
- `toggle_selected_row()` → `event-handlers.js`
- `pickDirectory()` → `ui-manager.js`
- `installUpdate()` → `ui-manager.js`
- `closeAllTabs()` → `ui-manager.js`

### Phase 5: Search Module (Week 8)
**Files to create:**
- `src/renderer/modules/search/search-manager.js`
- `src/renderer/modules/search/live-search.js`
- `src/renderer/modules/search/index.js`

**Functions to extract:**
- `searchData()` → `search-manager.js`
- `performLiveSearch()` → `live-search.js`
- `triggerLiveSearch()` → `live-search.js`

### Phase 6: Categories Module (Week 9)
**Files to create:**
- `src/renderer/modules/categories/category-manager.js`
- `src/renderer/modules/categories/category-controller.js`
- `src/renderer/modules/categories/index.js`

**Functions to extract:**
- `populateCategoriesModal()` → `category-manager.js`
- `editCategory()` → `category-controller.js`
- `openCategoriesModal()` → `category-manager.js`
- `deleteCategory()` → `category-controller.js`
- `saveCategories()` → `category-controller.js`
- `addNewCategory()` → `category-controller.js`

### Phase 7: Hotkeys Module (Week 10)
**Files to create:**
- `src/renderer/modules/hotkeys/hotkey-manager.js`
- `src/renderer/modules/hotkeys/hotkey-controller.js`
- `src/renderer/modules/hotkeys/index.js`

**Functions to extract:**
- `playSongFromHotkey()` → `hotkey-manager.js`
- `populateHotkeys()` → `hotkey-manager.js`
- `clearHotkeys()` → `hotkey-controller.js`
- `openHotkeyFile()` → `hotkey-controller.js`
- `saveHotkeyFile()` → `hotkey-controller.js`
- `hotkeyDrop()` → `hotkey-controller.js`
- `allowHotkeyDrop()` → `hotkey-controller.js`
- `switchToHotkeyTab()` → `hotkey-manager.js`
- `renameHotkeyTab()` → `hotkey-controller.js`
- `removeFromHotkey()` → `hotkey-controller.js`
- `sendToHotkeys()` → `hotkey-controller.js`

### Phase 8: Holding Tank Module (Week 11)
**Files to create:**
- `src/renderer/modules/holding-tank/holding-tank-manager.js`
- `src/renderer/modules/holding-tank/playlist-manager.js`
- `src/renderer/modules/holding-tank/index.js`

**Functions to extract:**
- `populateHoldingTank()` → `holding-tank-manager.js`
- `clearHoldingTank()` → `holding-tank-manager.js`
- `addToHoldingTank()` → `holding-tank-manager.js`
- `holdingTankDrop()` → `holding-tank-manager.js`
- `setHoldingTankMode()` → `playlist-manager.js`
- `removeFromHoldingTank()` → `holding-tank-manager.js`
- `sendToHoldingTank()` → `holding-tank-manager.js`
- `renameHoldingTankTab()` → `holding-tank-manager.js`

### Phase 9: Preferences Module (Week 12)
**Files to create:**
- `src/renderer/modules/preferences/preference-manager.js`
- `src/renderer/modules/preferences/settings-controller.js`
- `src/renderer/modules/preferences/index.js`

**Functions to extract:**
- `openPreferencesModal()` → `preference-manager.js`
- `savePreferences()` → `settings-controller.js`

### Phase 10: Additional Modules (Week 13)
**Files to create:**
- `src/renderer/modules/drag-drop/drag-drop-manager.js`
- `src/renderer/modules/bulk-operations/bulk-operations-manager.js`
- `src/renderer/modules/song-management/song-manager.js`
- `src/renderer/modules/store/store-manager.js`
- `src/renderer/modules/tests/test-functions.js`

## Implementation Plan

### Step 1: Create Module Loader
Create `src/renderer/module-loader.js` to manage module loading and dependencies.

### Step 2: Create Entry Point
Create `src/renderer/renderer-modular.js` as the new entry point.

### Step 3: Extract Modules Incrementally
Follow the phase order above, extracting one module at a time.

### Step 4: Update Dependencies
Ensure all modules can communicate with each other through the module loader.

### Step 5: Testing
Test each module individually and then test the full application.

## Success Criteria

### ✅ Phase 1: Utils Module - COMPLETED
- [x] All utility functions extracted
- [x] Modal utilities working
- [x] Animation utilities working
- [x] Validation utilities working
- [x] Tests passing
- [x] Module loader created
- [x] Documentation complete

### ✅ Phase 2: Audio Module - COMPLETED
- [x] Audio playback working
- [x] Audio controls working
- [x] UI state management working
- [x] Autoplay functionality working
- [x] Tests passing
- [x] Comprehensive documentation created
- [x] Error handling implemented

### Phase 3: Database Module
- [ ] Database queries working
- [ ] Search functionality working
- [ ] Live search working
- [ ] Category management working
- [ ] Tests passing

### Phase 4: UI Module
- [ ] UI scaling working
- [ ] Font size controls working
- [ ] Waveform toggle working
- [ ] Advanced search toggle working
- [ ] Tests passing

### Phase 5: Search Module
- [ ] Search functionality working
- [ ] Live search working
- [ ] Search results handling working
- [ ] Tests passing

### Phase 6: Categories Module
- [ ] Category management working
- [ ] Category CRUD operations working
- [ ] Category modal working
- [ ] Tests passing

### Phase 7: Hotkeys Module
- [ ] Hotkey management working
- [ ] Hotkey playback working
- [ ] Hotkey file operations working
- [ ] Hotkey drag and drop working
- [ ] Tests passing

### Phase 8: Holding Tank Module
- [ ] Holding tank management working
- [ ] Playlist functionality working
- [ ] Holding tank drag and drop working
- [ ] Mode switching working
- [ ] Tests passing

### Phase 9: Preferences Module
- [ ] Preferences modal working
- [ ] Settings saving working
- [ ] Settings loading working
- [ ] Tests passing

### Phase 10: Additional Modules
- [ ] Drag and drop functionality working
- [ ] Bulk operations working
- [ ] Song management working
- [ ] Store management working
- [ ] Test functions working

## Timeline

| Week | Phase | Focus | Status |
|------|-------|-------|--------|
| 4 | Utils | Modal, animation, validation utilities | ✅ COMPLETED |
| 5 | Audio | Audio playback and controls | ✅ COMPLETED |
| 6 | Database | Database queries and search | ⏳ PENDING |
| 7 | UI | UI management and controls | ⏳ PENDING |
| 8 | Search | Search functionality | ⏳ PENDING |
| 9 | Categories | Category management | ⏳ PENDING |
| 10 | Hotkeys | Hotkey management | ⏳ PENDING |
| 11 | Holding Tank | Holding tank and playlist | ⏳ PENDING |
| 12 | Preferences | Preferences management | ⏳ PENDING |
| 13 | Additional | Drag-drop, bulk ops, song mgmt | ⏳ PENDING |

## Next Steps

1. **✅ Utils Module Complete** - All utility functions extracted and tested
2. **✅ Module Loader Created** - Module loading system is ready
3. **✅ Audio Module Complete** - All audio functions extracted and tested
4. **🔄 Start Database Module** - Begin extracting database functions
5. **Create Entry Point** - Create the new renderer entry point
6. **Test Each Module** - Ensure each module works independently
7. **Integration Testing** - Test all modules working together

## Risk Mitigation

### Technical Risks
1. **Function Dependencies** - Mitigation: Map all dependencies before extraction
2. **Global Variable Access** - Mitigation: Create proper module interfaces
3. **Event Handler Conflicts** - Mitigation: Centralize event management
4. **jQuery Dependencies** - Mitigation: Ensure jQuery is available to all modules

### Process Risks
1. **Breaking Changes** - Mitigation: Test each module thoroughly
2. **Performance Issues** - Mitigation: Monitor performance during extraction
3. **Module Communication** - Mitigation: Create clear module interfaces

## Conclusion

The renderer.js file contains 3112 lines of code organized into 14 logical modules. The modularization plan follows the same incremental approach used successfully for the preload and main process modules. Each phase focuses on a specific functional area, ensuring that the application remains working throughout the modularization process.

The plan is ready to begin with Phase 1 (Utils Module) in Week 4. 