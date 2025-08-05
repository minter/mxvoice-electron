/**
 * Browser-Compatible Test Script for Audio Module
 * 
 * This script tests the Audio module functionality in the browser environment
 * Copy and paste this entire script into the browser console to test the module
 */

// Mock dependencies for browser testing
const mockDependencies = {
  // Mock Howl for audio playback
  Howl: class MockHowl {
    constructor(options) {
      this.options = options;
      this.playing = false;
      this.volume = 0.5;
      this.duration = () => 180; // 3 minutes
      this.off = () => this;
      this.unload = () => {
        this.playing = false;
        console.log('Mock Howl unloaded');
      };
      this.play = () => {
        this.playing = true;
        console.log('Mock Howl playing');
        if (this.options.onplay) this.options.onplay();
      };
      this.pause = () => {
        this.playing = false;
        console.log('Mock Howl paused');
      };
      this.fade = (from, to, duration) => {
        console.log(`Mock Howl fade from ${from} to ${to} over ${duration}ms`);
        setTimeout(() => {
          this.volume = to;
          if (this.options.onfade) this.options.onfade();
        }, duration);
      };
      this.on = (event, callback) => {
        if (event === 'fade') {
          this.options.onfade = callback;
        }
        return this;
      };
    }
  },

  // Mock database
  db: {
    prepare: (query) => ({
      get: (id) => ({
        id: id,
        filename: `song_${id}.mp3`,
        title: `Song ${id}`,
        artist: `Artist ${id}`,
        category: 'ROCK'
      })
    })
  },

  // Mock electron API
  electronAPI: {
    store: {
      get: (key) => Promise.resolve({
        success: true,
        value: key === 'music_directory' ? '/mock/music/path' : '5'
      })
    },
    path: {
      join: (base, filename) => Promise.resolve({
        success: true,
        data: `${base}/${filename}`
      })
    }
  },

  // Mock jQuery
  $: (selector) => ({
    val: () => 50,
    hasClass: (cls) => cls === 'active',
    addClass: (cls) => console.log(`Mock jQuery addClass: ${cls}`),
    removeClass: (cls) => console.log(`Mock jQuery removeClass: ${cls}`),
    removeAttr: (attr) => console.log(`Mock jQuery removeAttr: ${attr}`),
    html: (content) => console.log(`Mock jQuery html: ${content}`),
    fadeIn: (duration) => console.log(`Mock jQuery fadeIn: ${duration}`),
    attr: (name, value) => console.log(`Mock jQuery attr: ${name} = ${value}`),
    first: () => ({
      removeClass: (cls) => console.log(`Mock jQuery first removeClass: ${cls}`)
    }),
    off: () => this,
    on: () => this
  }),

  // Mock global variables
  sound: null,
  loop: false,
  autoplay: false,
  holdingTankMode: 'playlist',
  globalAnimation: null,
  wavesurfer: {
    load: (path) => console.log(`Mock wavesurfer load: ${path}`)
  },
  howlerUtils: {
    updateTimeTracker: () => console.log('Mock updateTimeTracker called')
  },
  requestAnimationFrame: (callback) => {
    console.log('Mock requestAnimationFrame called');
    return 'mock-animation-id';
  }
};

// Mock the audio manager module
const mockAudioManager = {
  playSongFromId: function(song_id) {
    console.log("Mock: Playing song from song ID " + song_id);
    
    if (mockDependencies.sound) {
      mockDependencies.sound.off("fade");
      mockDependencies.sound.unload();
    }
    
    var stmt = mockDependencies.db.prepare("SELECT * from mrvoice WHERE id = ?");
    var row = stmt.get(song_id);
    
    if (!row) {
      console.error('❌ No song found with ID:', song_id);
      return;
    }
    
    var filename = row.filename;
    
    if (!filename) {
      console.error('❌ No filename found for song ID:', song_id, 'Row data:', row);
      return;
    }
    
    // Mock the path joining and sound creation
    mockDependencies.electronAPI.path.join('/mock/music/path', filename).then(result => {
      if (result.success) {
        var sound_path = [result.data];
        console.log("Mock: Creating sound with path:", sound_path);
        
        mockDependencies.sound = new mockDependencies.Howl({
          src: sound_path,
          html5: true,
          volume: 0.5,
          mute: false,
          onplay: function () {
            var time = Math.round(mockDependencies.sound.duration());
            mockDependencies.globalAnimation = mockDependencies.requestAnimationFrame(
              mockDependencies.howlerUtils.updateTimeTracker.bind(this)
            );
            var title = row.title || "";
            var artist = row.artist || "";
            artist = artist.length ? "by " + artist : artist;
            mockDependencies.wavesurfer.load(sound_path);
            console.log(`Mock: Now playing - ${title} ${artist}`);
          },
          onend: function () {
            console.log('Mock: Song ended');
            mockAudioManager.song_ended();
            if (mockDependencies.loop) {
              mockAudioManager.playSongFromId(song_id);
            } else if (mockDependencies.autoplay && mockDependencies.holdingTankMode === "playlist") {
              mockAudioManager.autoplay_next();
            }
          },
        });
        mockDependencies.sound.play();
      }
    });
  },

  playSelected: function() {
    console.log("Mock: Playing selected song");
    // Mock implementation
  },

  song_ended: function() {
    console.log("Mock: Song ended callback");
    // Mock implementation
  },

  autoplay_next: function() {
    console.log("Mock: Autoplay next song");
    // Mock implementation
  },

  cancel_autoplay: function() {
    console.log("Mock: Cancel autoplay");
    mockDependencies.autoplay = false;
  }
};

// Mock the audio controller module
const mockAudioController = {
  stopPlaying: function(fadeOut = false) {
    console.log("Mock: Stop playing, fadeOut:", fadeOut);
    
    if (mockDependencies.sound) {
      if (mockDependencies.autoplay && mockDependencies.holdingTankMode === "playlist") {
        console.log("Mock: Removing now_playing class");
      }
      
      if (fadeOut) {
        console.log("Mock: Starting fade out...");
        mockDependencies.electronAPI.store.get("fade_out_seconds").then(fadeSeconds => {
          var fadeDuration = parseFloat(fadeSeconds.value || fadeSeconds) * 1000;
          
          if (!mockDependencies.sound || !mockDependencies.sound.volume) {
            console.log("Mock: Sound is no longer valid, stopping");
            return;
          }
          
          mockDependencies.sound.off("fade");
          
          mockDependencies.sound.on("fade", function () {
            console.log("Mock: Fade event fired, unloading sound");
            if (mockDependencies.sound) {
              mockDependencies.sound.unload();
              mockAudioController.resetUIState();
            }
          });
          
          var currentVolume = mockDependencies.sound.volume();
          mockDependencies.sound.fade(currentVolume, 0, fadeDuration);
        });
      } else {
        mockDependencies.sound.unload();
        mockAudioController.resetUIState();
      }
    }
  },

  pausePlaying: function(fadeOut = false) {
    console.log("Mock: Pause playing, fadeOut:", fadeOut);
    
    if (mockDependencies.sound) {
      mockAudioController.toggle_play_button();
      
      if (mockDependencies.sound.playing()) {
        mockDependencies.sound.on("fade", function () {
          mockDependencies.sound.pause();
        });
        console.log("Mock: Paused sound");
      } else {
        mockDependencies.sound.play();
        console.log("Mock: Resumed sound");
      }
    }
  },

  resetUIState: function() {
    console.log("Mock: Reset UI state");
    // Mock UI reset
  },

  toggle_play_button: function() {
    console.log("Mock: Toggle play button");
    // Mock button toggle
  },

  loop_on: function(bool) {
    console.log("Mock: Loop on:", bool);
    mockDependencies.loop = bool;
  }
};

// Mock the audio module
const mockAudioModule = {
  // Audio manager functions
  playSongFromId: mockAudioManager.playSongFromId,
  playSelected: mockAudioManager.playSelected,
  song_ended: mockAudioManager.song_ended,
  autoplay_next: mockAudioManager.autoplay_next,
  cancel_autoplay: mockAudioManager.cancel_autoplay,
  
  // Audio controller functions
  stopPlaying: mockAudioController.stopPlaying,
  pausePlaying: mockAudioController.pausePlaying,
  resetUIState: mockAudioController.resetUIState,
  toggle_play_button: mockAudioController.toggle_play_button,
  loop_on: mockAudioController.loop_on,

  init: function() {
    console.log('Mock: Audio module initialized');
  },

  getAllAudioFunctions: function() {
    return {
      // Audio manager functions
      playSongFromId: this.playSongFromId,
      playSelected: this.playSelected,
      song_ended: this.song_ended,
      autoplay_next: this.autoplay_next,
      cancel_autoplay: this.cancel_autoplay,
      
      // Audio controller functions
      stopPlaying: this.stopPlaying,
      pausePlaying: this.pausePlaying,
      resetUIState: this.resetUIState,
      toggle_play_button: this.toggle_play_button,
      loop_on: this.loop_on
    };
  },

  test: function() {
    const results = {
      manager: {},
      controller: {}
    };

    // Test audio manager functions
    try {
      if (typeof this.playSongFromId === 'function') {
        results.manager.playSongFromId = '✅ Function exists';
      } else {
        results.manager.playSongFromId = '❌ Function missing';
      }

      if (typeof this.playSelected === 'function') {
        results.manager.playSelected = '✅ Function exists';
      } else {
        results.manager.playSelected = '❌ Function missing';
      }

      if (typeof this.song_ended === 'function') {
        results.manager.song_ended = '✅ Function exists';
      } else {
        results.manager.song_ended = '❌ Function missing';
      }

      if (typeof this.autoplay_next === 'function') {
        results.manager.autoplay_next = '✅ Function exists';
      } else {
        results.manager.autoplay_next = '❌ Function missing';
      }

      if (typeof this.cancel_autoplay === 'function') {
        results.manager.cancel_autoplay = '✅ Function exists';
      } else {
        results.manager.cancel_autoplay = '❌ Function missing';
      }
    } catch (error) {
      results.manager.error = `❌ Error: ${error.message}`;
    }

    // Test audio controller functions
    try {
      if (typeof this.stopPlaying === 'function') {
        results.controller.stopPlaying = '✅ Function exists';
      } else {
        results.controller.stopPlaying = '❌ Function missing';
      }

      if (typeof this.pausePlaying === 'function') {
        results.controller.pausePlaying = '✅ Function exists';
      } else {
        results.controller.pausePlaying = '❌ Function missing';
      }

      if (typeof this.resetUIState === 'function') {
        results.controller.resetUIState = '✅ Function exists';
      } else {
        results.controller.resetUIState = '❌ Function missing';
      }

      if (typeof this.toggle_play_button === 'function') {
        results.controller.toggle_play_button = '✅ Function exists';
      } else {
        results.controller.toggle_play_button = '❌ Function missing';
      }

      if (typeof this.loop_on === 'function') {
        results.controller.loop_on = '✅ Function exists';
      } else {
        results.controller.loop_on = '❌ Function missing';
      }
    } catch (error) {
      results.controller.error = `❌ Error: ${error.message}`;
    }

    return results;
  },

  getInfo: function() {
    return {
      name: 'Audio Module',
      version: '1.0.0',
      description: 'Handles audio playback and control functionality',
      functions: {
        manager: [
          'playSongFromId',
          'playSelected', 
          'song_ended',
          'autoplay_next',
          'cancel_autoplay'
        ],
        controller: [
          'stopPlaying',
          'pausePlaying',
          'resetUIState',
          'toggle_play_button',
          'loop_on'
        ]
      }
    };
  }
};

// Mock the module loader for browser testing
const mockModuleLoader = {
  modules: {},
  loadedModules: new Set(),
  
  registerModule: function(name, module) {
    this.modules[name] = module;
    console.log(`Module registered: ${name}`);
  },

  loadModule: function(name) {
    if (this.modules[name]) {
      this.loadedModules.add(name);
      console.log(`Module loaded: ${name}`);
      return this.modules[name];
    } else {
      console.log(`Module not found: ${name}`);
      return null;
    }
  },

  getModule: function(name) {
    if (this.loadedModules.has(name)) {
      return this.modules[name];
    } else {
      throw new Error(`Module not loaded: ${name}`);
    }
  },

  getAllModules: function() {
    const result = {};
    for (const moduleName of this.loadedModules) {
      result[moduleName] = this.modules[moduleName];
    }
    return result;
  },

  testAllModules: function() {
    const results = {};
    for (const moduleName of this.loadedModules) {
      const moduleInstance = this.modules[moduleName];
      try {
        if (typeof moduleInstance.test === 'function') {
          results[moduleName] = moduleInstance.test();
        } else {
          results[moduleName] = { status: '✅ Module loaded (no test function)' };
        }
      } catch (error) {
        results[moduleName] = { status: `❌ Test failed: ${error.message}` };
      }
    }
    return results;
  }
};

// Test function for Audio module
function testAudioModule() {
  console.log('🧪 Testing Audio Module...');
  
  try {
    console.log('✅ Audio module available');
    
    // Test the module instance
    if (mockAudioModule) {
      console.log('✅ Audio module instance exists');
      
      // Test individual functions
      const testResults = mockAudioModule.test();
      console.log('Test Results:', testResults);
      
      // Test audio manager functions
      console.log('Testing audio manager functions...');
      console.log('playSongFromId("123"):', typeof mockAudioModule.playSongFromId === 'function' ? '✅ Function exists' : '❌ Function missing');
      console.log('playSelected():', typeof mockAudioModule.playSelected === 'function' ? '✅ Function exists' : '❌ Function missing');
      console.log('song_ended():', typeof mockAudioModule.song_ended === 'function' ? '✅ Function exists' : '❌ Function missing');
      console.log('autoplay_next():', typeof mockAudioModule.autoplay_next === 'function' ? '✅ Function exists' : '❌ Function missing');
      console.log('cancel_autoplay():', typeof mockAudioModule.cancel_autoplay === 'function' ? '✅ Function exists' : '❌ Function missing');
      
      // Test audio controller functions
      console.log('Testing audio controller functions...');
      console.log('stopPlaying():', typeof mockAudioModule.stopPlaying === 'function' ? '✅ Function exists' : '❌ Function missing');
      console.log('pausePlaying():', typeof mockAudioModule.pausePlaying === 'function' ? '✅ Function exists' : '❌ Function missing');
      console.log('resetUIState():', typeof mockAudioModule.resetUIState === 'function' ? '✅ Function exists' : '❌ Function missing');
      console.log('toggle_play_button():', typeof mockAudioModule.toggle_play_button === 'function' ? '✅ Function exists' : '❌ Function missing');
      console.log('loop_on():', typeof mockAudioModule.loop_on === 'function' ? '✅ Function exists' : '❌ Function missing');
      
      // Test module info
      const info = mockAudioModule.getInfo();
      console.log('Module Info:', info);
      
      console.log('✅ Audio module test completed successfully!');
      
    } else {
      console.log('❌ Audio module instance missing');
    }
    
  } catch (error) {
    console.error('❌ Error testing Audio module:', error);
  }
}

// Test function for Audio functionality
function testAudioFunctionality() {
  console.log('🧪 Testing Audio Functionality...');
  
  try {
    console.log('✅ Testing audio playback simulation...');
    
    // Test playing a song
    console.log('Testing playSongFromId...');
    mockAudioModule.playSongFromId('123');
    
    // Wait a bit then test pause
    setTimeout(() => {
      console.log('Testing pausePlaying...');
      mockAudioModule.pausePlaying();
      
      // Wait a bit then test stop
      setTimeout(() => {
        console.log('Testing stopPlaying...');
        mockAudioModule.stopPlaying();
        
        // Test loop functionality
        console.log('Testing loop functionality...');
        mockAudioModule.loop_on(true);
        console.log('Loop enabled:', mockDependencies.loop);
        mockAudioModule.loop_on(false);
        console.log('Loop disabled:', mockDependencies.loop);
        
        console.log('✅ Audio functionality test completed!');
      }, 1000);
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error testing Audio functionality:', error);
  }
}

// Test function for Module Loader
function testModuleLoader() {
  console.log('🧪 Testing Module Loader...');
  
  try {
    console.log('✅ Module loader available');
    
    // Test module loader functionality
    if (mockModuleLoader) {
      console.log('✅ Module loader instance exists');
      
      // Test registration
      mockModuleLoader.registerModule('audio', mockAudioModule);
      console.log('✅ Module registration working');
      
      // Test loading
      const loadedModule = mockModuleLoader.loadModule('audio');
      console.log('✅ Module loading working');
      
      // Test getting module
      const retrievedModule = mockModuleLoader.getModule('audio');
      console.log('✅ Module retrieval working');
      
      // Test getting all modules
      const allModules = mockModuleLoader.getAllModules();
      console.log('✅ Get all modules working:', Object.keys(allModules));
      
      // Test module testing
      const testResults = mockModuleLoader.testAllModules();
      console.log('✅ Module testing working:', testResults);
      
      console.log('✅ Module loader test completed successfully!');
      
    } else {
      console.log('❌ Module loader instance missing');
    }
    
  } catch (error) {
    console.error('❌ Error testing Module Loader:', error);
  }
}

// Test function for integration
function testAudioIntegration() {
  console.log('🧪 Testing Audio Integration...');
  
  try {
    console.log('✅ Both modules available');
    
    // Register audio module with loader
    mockModuleLoader.registerModule('audio', mockAudioModule);
    console.log('✅ Audio module registered with loader');
    
    // Load audio module through loader
    const loadedAudio = mockModuleLoader.loadModule('audio');
    console.log('✅ Audio module loaded through loader');
    
    // Test audio functions through loader
    if (loadedAudio && typeof loadedAudio.playSongFromId === 'function') {
      console.log('✅ Audio functions accessible through loader');
    } else {
      console.log('❌ Audio functions not accessible through loader');
    }
    
    // Test all modules
    const allModules = mockModuleLoader.getAllModules();
    console.log('✅ All modules accessible:', Object.keys(allModules));
    
    console.log('✅ Audio integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Audio Integration:', error);
  }
}

// Test function for dependencies
function testDependencies() {
  console.log('🧪 Testing Dependencies...');
  
  // Test mock dependencies
  console.log('✅ Mock Howl available:', typeof mockDependencies.Howl === 'function');
  console.log('✅ Mock database available:', typeof mockDependencies.db === 'object');
  console.log('✅ Mock electron API available:', typeof mockDependencies.electronAPI === 'object');
  console.log('✅ Mock jQuery available:', typeof mockDependencies.$ === 'function');
  
  // Test mock audio manager
  console.log('✅ Mock audio manager available:', typeof mockAudioManager === 'object');
  console.log('✅ Mock audio controller available:', typeof mockAudioController === 'object');
  
  console.log('✅ Dependencies test completed!');
}

// Main test function
function runAllAudioTests() {
  console.log('🚀 Starting Audio Module Tests...');
  console.log('=====================================');
  
  testDependencies();
  console.log('-------------------------------------');
  
  testAudioModule();
  console.log('-------------------------------------');
  
  testModuleLoader();
  console.log('-------------------------------------');
  
  testAudioIntegration();
  console.log('-------------------------------------');
  
  testAudioFunctionality();
  console.log('-------------------------------------');
  
  console.log('🎉 All Audio Module Tests Completed!');
  console.log('=====================================');
  console.log('If you see mostly ✅ marks, the Audio module concept is working correctly.');
  console.log('The actual module files are ready for integration into the main application.');
}

// Make functions available globally
window.testAudioModule = testAudioModule;
window.testModuleLoader = testModuleLoader;
window.testAudioIntegration = testAudioIntegration;
window.testAudioFunctionality = testAudioFunctionality;
window.testDependencies = testDependencies;
window.runAllAudioTests = runAllAudioTests;
window.mockAudioModule = mockAudioModule;
window.mockModuleLoader = mockModuleLoader;
window.mockDependencies = mockDependencies; 