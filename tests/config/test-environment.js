import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const TEST_CONFIG = {
  // Test database path (in-memory for isolation)
  databasePath: ':memory:',
  
  // Test data directory - completely isolated from real app
  testDataDir: path.join(__dirname, '../fixtures'),
  
  // Test songs directory - isolated from real app
  testSongsDir: path.join(__dirname, '../fixtures/test-songs'),
  
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
    tempDirectory: path.join(__dirname, '../fixtures/test-temp')
  },
  
  // Test database schema
  schema: {
    categories: [
      { code: 'TEST_JAZZ', description: 'Test Jazz' },
      { code: 'TEST_ROCK', description: 'Test Rock' },
      { code: 'TEST_CLASSICAL', description: 'Test Classical' },
      { code: 'TEST_BLUES', description: 'Test Blues' },
      { code: 'TEST_ELECTRONIC', description: 'Test Electronic' }
    ],
    songs: [
      {
        title: 'Test Song 1',
        artist: 'Test Artist 1',
        category: 'TEST_JAZZ',
        filename: 'test-song-1.mp3',
        time: '3:45',
        info: 'Test jazz composition for testing'
      },
      {
        title: 'Test Song 2',
        artist: 'Test Artist 2',
        category: 'TEST_ROCK',
        filename: 'test-song-2.mp3',
        time: '4:20',
        info: 'Test rock composition for testing'
      },
      {
        title: 'Test Song 3',
        artist: 'Test Artist 3',
        category: 'TEST_CLASSICAL',
        filename: 'test-song-3.mp3',
        time: '5:15',
        info: 'Test classical composition for testing'
      },
      {
        title: 'Test Song 4',
        artist: 'Test Artist 4',
        category: 'TEST_BLUES',
        filename: 'test-song-4.mp3',
        time: '3:30',
        info: 'Test blues composition for testing'
      },
      {
        title: 'Test Song 5',
        artist: 'Test Artist 5',
        category: 'TEST_ELECTRONIC',
        filename: 'test-song-5.mp3',
        time: '6:00',
        info: 'Test electronic composition for testing'
      }
    ]
  }
};

export function ensureTestDirectories() {
  const dirs = [
    TEST_CONFIG.testDataDir,
    TEST_CONFIG.testSongsDir,
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
