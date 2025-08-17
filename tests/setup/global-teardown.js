import { cleanupTestEnvironment } from '../utils/test-environment-manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

async function globalTeardown() {
  try {
    console.log('🧹 Starting global test teardown...');
    
    // Clean up test environment
    await cleanupTestEnvironment();
    
    console.log('✅ Global test environment cleaned up');
    
    // Remove per-suite artifacts created under tests/fixtures/suites/* and userData dirs
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const fixturesRoot = path.join(__dirname, '../fixtures');
      const suitesDir = path.join(fixturesRoot, 'suites');
      if (fs.existsSync(suitesDir)) {
        fs.rmSync(suitesDir, { recursive: true, force: true });
        console.log('✅ Removed per-suite suites directory:', suitesDir);
      }
      // Clean per-suite userData directories (prefix test-user-data)
      const entries = fs.existsSync(fixturesRoot) ? fs.readdirSync(fixturesRoot) : [];
      for (const name of entries) {
        if (name.startsWith('test-user-data')) {
          const p = path.join(fixturesRoot, name);
          fs.rmSync(p, { recursive: true, force: true });
          console.log('✅ Removed per-suite userData directory:', p);
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to remove per-suite artifacts:', e?.message || e);
    }
    
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
  }
}

export default globalTeardown;
