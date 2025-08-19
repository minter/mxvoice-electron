import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Windows-specific configuration for timing differences
const isWindows = process.platform === 'win32';
const WINDOWS_CONFIG = {
  audioStabilizationTime: 200,
  modalAnimationTime: 500,
  defaultTimeout: 10000,
  audioTolerance: 0.05
};

const DEFAULT_CONFIG = {
  audioStabilizationTime: 100,
  modalAnimationTime: 100,
  defaultTimeout: 5000,
  audioTolerance: 0.01
};

export const TEST_CONFIG = {
  // Platform-specific configuration
  platform: {
    isWindows,
    audioStabilizationTime: isWindows ? WINDOWS_CONFIG.audioStabilizationTime : DEFAULT_CONFIG.audioStabilizationTime,
    modalAnimationTime: isWindows ? WINDOWS_CONFIG.modalAnimationTime : DEFAULT_CONFIG.modalAnimationTime,
    defaultTimeout: isWindows ? WINDOWS_CONFIG.defaultTimeout : DEFAULT_CONFIG.defaultTimeout,
    audioTolerance: isWindows ? WINDOWS_CONFIG.audioTolerance : DEFAULT_CONFIG.audioTolerance
  },
  
  // Test database path (in-memory for isolation)
  databasePath: ':memory:',
  
  // Test data directory - completely isolated from real app
  testDataDir: path.join(__dirname, '../fixtures'),
  
  // Test songs directory - isolated from real app (source for copying)
  testSongsDir: path.join(__dirname, '../fixtures/test-songs'),
  
  // Test music directory - where the app actually stores songs (starts empty, gets populated)
  testMusicDir: path.join(__dirname, '../fixtures/test-music'),
  
  // Test session store path - isolated from real app
  testStorePath: path.join(__dirname, '../fixtures/test-store'),
  
  // Test app directories - completely separate from real app
  testAppDirs: {
    // Test database directory (separate from real app)
    databaseDirectory: path.join(__dirname, '../fixtures/test-app-data'),
    
    // Test hotkey directory (separate from real app)
    hotkeyDirectory: path.join(__dirname, '../fixtures/test-hotkeys'),
    
    // Test holding tank directory (separate from real app)
    holdingTankDirectory: path.join(__dirname, '../fixtures/test-holding-tank'),
    
    // Test preferences directory (separate from real app)
    preferencesDirectory: path.join(__dirname, '../fixtures/test-preferences'),
    
    // Test user data directory (separate from real app)
    userDataDirectory: path.join(__dirname, '../fixtures/test-user-data'),
    
    // Test temp directory (separate from real app)
    tempDirectory: path.join(__dirname, '../fixtures/test-temp'),
    
    // Test music directory - where the app stores songs (separate from real app)
    musicDirectory: path.join(__dirname, '../fixtures/test-music')
  },
  
  // Test database schema
  schema: {
    categories: [
      { code: 'GAME', description: 'Game' },
      { code: 'GROAN', description: 'Groaner' },
      { code: 'RNIN', description: 'Running In' },
      { code: 'RNOUT', description: 'Running Out' },
      { code: 'END', description: 'Show Ending' }
    ],
    songs: [
      {
        id: 1001,
        title: 'Got The Time',
        artist: 'Anthrax',
        category: 'GAME',
        filename: 'Anthrax-GotTheTime.mp3',
        time: '0:06',
        info: 'Countdown',
        daysAgo: 60
      },
      {
        id: 1002,
        title: 'The Wheel (Back And Forth)',
        artist: 'Edie Brickell',
        category: 'GAME',
        filename: 'EdieBrickell-TheWheel.mp3',
        time: '0:08',
        info: 'Replay'
      },
      {
        id: 1003,
        title: 'Theme From The Greatest American Hero',
        artist: 'Joey Scarbury',
        category: 'RNIN',
        filename: 'JoeyScarbury-GreatestAmericanHero.mp3',
        time: '0:07',
        info: ''
      },
      {
        id: 1004,
        title: 'We Are Family',
        artist: 'Sister Sledge',
        category: 'END',
        filename: 'SisterSledge-WeAreFamily.mp3',
        time: '0:07',
        info: ''
      },
      {
        id: 1005,
        title: 'Eat It',
        artist: 'Weird Al Yankovic',
        category: 'GROAN',
        filename: 'WeirdAl-EatIt.mp3',
        time: '0:06',
        info: ''
      }
    ]
  }
};

export function ensureTestDirectories() {
  const dirs = [
    TEST_CONFIG.testDataDir,
    TEST_CONFIG.testSongsDir,
    TEST_CONFIG.testMusicDir,
    TEST_CONFIG.testStorePath,
    ...Object.values(TEST_CONFIG.testAppDirs)
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function getTestDataPath(relativePath) {
  return path.join(TEST_CONFIG.testDataDir, relativePath);
}

export function getTestSongPath(filename) {
  return path.join(TEST_CONFIG.testSongsDir, filename);
}

export function getTestAppDir(key) {
  return TEST_CONFIG.testAppDirs[key] || null;
}

export function getAllTestAppDirs() {
  return TEST_CONFIG.testAppDirs;
}
