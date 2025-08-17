import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TestSongManager {
  constructor() {
    this.testSongsDir = path.join(__dirname, '../fixtures/test-songs');
    this.testSongs = new Map();
  }

  async createTestSongFiles() {
    try {
      const { TEST_CONFIG } = await import('../config/test-environment.js');
      
      // Ensure test songs directory exists (source directory)
      if (!fs.existsSync(this.testSongsDir)) {
        fs.mkdirSync(this.testSongsDir, { recursive: true });
      }
      
      // Ensure test music directory exists (where app will store songs)
      const testMusicDir = TEST_CONFIG.testAppDirs.musicDirectory;
      if (!fs.existsSync(testMusicDir)) {
        fs.mkdirSync(testMusicDir, { recursive: true });
      }
      
      // Create test song files (short, silent MP3s for testing)
      for (const song of TEST_CONFIG.schema.songs) {
        await this.createTestSongFile(song);
      }
      
      // Copy fixture songs to the test music directory so the seeded database has songs to work with
      await this.copyFixtureSongsToMusicDir();
      
      console.log('✅ Test song files created and copied to music directory');
    } catch (error) {
      console.error('❌ Failed to create test song files:', error);
      throw error;
    }
  }

  async createTestSongFile(song) {
    try {
      const filePath = path.join(this.testSongsDir, song.filename);
      
      // If a curated fixture already exists, don't overwrite or track it
      if (fs.existsSync(filePath)) {
        return filePath;
      }

      // Create a minimal MP3 file for testing
      // In practice, you'd use actual short MP3 files
      const testMp3Data = this.generateTestMp3Data();
      
      fs.writeFileSync(filePath, testMp3Data);
      this.testSongs.set(song.filename, filePath);
      
      console.log(`✅ Created test song file: ${song.filename}`);
      return filePath;
    } catch (error) {
      console.error(`❌ Failed to create test song file ${song.filename}:`, error);
      throw error;
    }
  }

  generateTestMp3Data() {
    try {
      // This is a minimal MP3 header - in practice, use real short MP3 files
      // or create them programmatically with a library like lamejs
      const header = Buffer.from([
        0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      
      // Add some padding to make it a reasonable size
      const padding = Buffer.alloc(1024, 0);
      return Buffer.concat([header, padding]);
    } catch (error) {
      console.error('❌ Failed to generate test MP3 data:', error);
      throw error;
    }
  }

  getTestSongPath(filename) {
    return this.testSongs.get(filename);
  }

  getAllTestSongPaths() {
    return Array.from(this.testSongs.values());
  }

  async getTestSongMetadata(filename) {
    try {
      const { TEST_CONFIG } = await import('../config/test-environment.js');
      return TEST_CONFIG.schema.songs.find(song => song.filename === filename);
    } catch (error) {
      console.error(`❌ Failed to get test song metadata for ${filename}:`, error);
      return null;
    }
  }

  async copyTestSongToDirectory(filename, targetDir) {
    try {
      const sourcePath = this.getTestSongPath(filename);
      if (!sourcePath) {
        throw new Error(`Test song ${filename} not found`);
      }
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      const targetPath = path.join(targetDir, filename);
      fs.copyFileSync(sourcePath, targetPath);
      
      console.log(`✅ Copied test song ${filename} to ${targetDir}`);
      return targetPath;
    } catch (error) {
      console.error(`❌ Failed to copy test song ${filename}:`, error);
      throw error;
    }
  }

  async cleanup() {
    try {
      // Remove test song files
      this.testSongs.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`✅ Removed test song file: ${path.basename(filePath)}`);
        }
      });
      this.testSongs.clear();
      
      // Clean up the test music directory (where the app copies songs during tests)
      const { TEST_CONFIG } = await import('../config/test-environment.js');
      const testMusicDir = TEST_CONFIG.testAppDirs.musicDirectory;
      
      if (fs.existsSync(testMusicDir)) {
        fs.rmSync(testMusicDir, { recursive: true, force: true });
        console.log(`✅ Cleaned up test music directory: ${testMusicDir}`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup test songs:', error);
    }
  }

  // Helper methods for common test scenarios
  async createCustomTestSong(filename, metadata = {}) {
    try {
      const customSong = {
        title: metadata.title || 'Custom Test Song',
        artist: metadata.artist || 'Custom Test Artist',
        category: metadata.category || 'TEST_CUSTOM',
        filename: filename,
        time: metadata.time || '3:00',
        info: metadata.info || 'Custom test song for specific testing'
      };
      
      await this.createTestSongFile(customSong);
      return customSong;
    } catch (error) {
      console.error(`❌ Failed to create custom test song ${filename}:`, error);
      throw error;
    }
  }

  async createMultipleTestSongs(count, prefix = 'batch') {
    try {
      const songs = [];
      for (let i = 1; i <= count; i++) {
        const filename = `${prefix}-song-${i}.mp3`;
        const song = await this.createCustomTestSong(filename, {
          title: `${prefix} Song ${i}`,
          artist: `${prefix} Artist ${i}`,
          category: 'TEST_BATCH'
        });
        songs.push(song);
      }
      
      console.log(`✅ Created ${count} batch test songs`);
      return songs;
    } catch (error) {
      console.error(`❌ Failed to create batch test songs:`, error);
      throw error;
    }
  }
  
  /**
   * Copy fixture songs to the test music directory
   * This ensures the seeded database has songs to work with
   * Only copies the songs defined in TEST_CONFIG.schema.songs (the initial seed)
   */
  async copyFixtureSongsToMusicDir() {
    try {
      const { TEST_CONFIG } = await import('../config/test-environment.js');
      const testMusicDir = TEST_CONFIG.testAppDirs.musicDirectory;
      
      // Clear the test music directory first
      if (fs.existsSync(testMusicDir)) {
        fs.rmSync(testMusicDir, { recursive: true, force: true });
        fs.mkdirSync(testMusicDir, { recursive: true });
      }
      
      // Copy only the songs defined in the schema (initial seed songs)
      // This does NOT include the Indigo Girls song or other test-specific files
      for (const song of TEST_CONFIG.schema.songs) {
        const sourcePath = path.join(this.testSongsDir, song.filename);
        const destPath = path.join(testMusicDir, song.filename);
        
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          console.log(`✅ Copied seed song: ${song.filename}`);
        } else {
          console.log(`⚠️ Seed song not found: ${song.filename}`);
        }
      }
      
      console.log(`✅ Copied ${TEST_CONFIG.schema.songs.length} seed songs to test music directory`);
    } catch (error) {
      console.error('❌ Failed to copy fixture songs to music directory:', error);
      throw error;
    }
  }
}
