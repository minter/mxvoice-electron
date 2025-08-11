const Database = require("better-sqlite3");
const path = require("path");
const Store = require("electron-store");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");

// Initialize store to get database path (align with app config file name)
const store = new Store({ name: 'config' });
let dbDirectory = store.get("database_directory");

// Fallback logic for when running outside Electron environment
if (!dbDirectory) {
  console.log(
    "⚠️  Database directory not found in electron-store, using default location..."
  );

  // Use the same default logic as the main application
  if (process.platform === "darwin") {
    // macOS
    dbDirectory = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Mx. Voice"
    );
  } else if (process.platform === "win32") {
    // Windows
    dbDirectory = path.join(process.env.APPDATA || "", "Mx. Voice");
  } else {
    // Linux and other platforms
    dbDirectory = path.join(os.homedir(), ".config", "Mx. Voice");
  }

  console.log(`📁 Using default database directory: ${dbDirectory}`);

  // Create directory if it doesn't exist
  if (!fs.existsSync(dbDirectory)) {
    console.log(`📁 Creating database directory: ${dbDirectory}`);
    fs.mkdirSync(dbDirectory, { recursive: true });
  }
}

// Use the same database detection logic as the main application
function detectDatabaseName() {
  let dbName = "mxvoice.db";
  console.log(`Looking for database in ${dbDirectory}`);

  if (fs.existsSync(path.join(dbDirectory, "mrvoice.db"))) {
    dbName = "mrvoice.db";
  }

  console.log(`Detected database name: ${dbName}`);
  return dbName;
}

const dbName = detectDatabaseName();
const dbPath = path.join(dbDirectory, dbName);

console.log(`Opening database at: ${dbPath}`);

// Fun data arrays for generating realistic but entertaining content
const artists = [
  "The Quantum Cats",
  "Disco Llama",
  "Funk Master Penguin",
  "Jazz Giraffe Collective",
  "Rock Lobster Orchestra",
  "Synthwave Sloth",
  "Blues Badger Band",
  "Reggae Rhino",
  "Metal Marmot",
  "Folk Fox Family",
  "Electronic Elephant",
  "Punk Platypus",
  "Country Capybara",
  "Classical Capuchin",
  "Hip Hop Hippo",
  "Ambient Armadillo",
  "Ska Skunk",
  "Grunge Gorilla",
  "Pop Panda",
  "Indie Iguana",
  "R&B Raccoon",
  "Techno Turtle",
  "Soul Sloth",
  "Alternative Antelope",
  "Progressive Porcupine",
  "Experimental Echidna",
  "Psychedelic Platypus",
  "Industrial Iguana",
  "Post-Rock Penguin",
];

const titlePrefixes = [
  "The Ballad of",
  "Ode to",
  "Song for",
  "Tribute to",
  "Elegy for",
  "Hymn to",
  "Serenade for",
  "Lullaby for",
  "Anthem of",
  "March of",
  "Waltz of",
  "Sonata for",
  "Concerto for",
  "Symphony of",
  "Rhapsody in",
  "Fugue for",
  "Prelude to",
  "Interlude for",
  "Finale of",
  "Overture to",
  "Coda for",
  "Cadenza for",
  "Variations on",
  "Fantasy on",
  "Impromptu for",
  "Nocturne for",
  "Etude for",
];

const titleNouns = [
  "Quantum Entanglement",
  "Disco Inferno",
  "Jazz Hands",
  "Funk Master Flex",
  "Rock and Roll Dreams",
  "Synthwave Sunset",
  "Blues Brothers",
  "Reggae Revolution",
  "Metal Mayhem",
  "Folk Tales",
  "Electronic Dreams",
  "Punk Rock Paradise",
  "Country Roads",
  "Classical Gas",
  "Hip Hop Hooray",
  "Ambient Space",
  "Ska Skank",
  "Grunge Glory",
  "Pop Sensation",
  "Indie Spirit",
  "R&B Groove",
  "Techno Trance",
  "Soul Searching",
  "Alternative Reality",
  "Progressive Rock",
  "Experimental Jazz",
  "Psychedelic Trip",
  "Industrial Strength",
  "Post-Rock Poetry",
];

const titleSuffixes = [
  "in the Morning",
  "at Midnight",
  "Under the Stars",
  "Over the Rainbow",
  "Through the Night",
  "Across the Universe",
  "Beyond the Horizon",
  "Within the Soul",
  "Between the Lines",
  "Among the Trees",
  "Inside the Mind",
  "Outside the Box",
  "Above the Clouds",
  "Below the Surface",
  "Around the World",
  "Through Time",
  "In the Shadows",
  "On the Edge",
  "At the Crossroads",
  "In the Spotlight",
  "Under Pressure",
  "Over the Moon",
  "Through the Fire",
  "Across the Bridge",
  "Beyond Belief",
  "Within Reach",
  "Between Worlds",
  "Among Friends",
];

const categories = [
  { code: "ROCK", description: "Rock & Roll" },
  { code: "JAZZ", description: "Jazz" },
  { code: "FUNK", description: "Funk" },
  { code: "BLUE", description: "Blues" },
  { code: "COUN", description: "Country" },
  { code: "CLAS", description: "Classical" },
  { code: "ELEC", description: "Electronic" },
  { code: "FOLK", description: "Folk" },
  { code: "PUNK", description: "Punk" },
  { code: "METL", description: "Metal" },
  { code: "REGG", description: "Reggae" },
  { code: "SOUL", description: "Soul" },
  { code: "RAP", description: "Hip Hop" },
  { code: "AMBI", description: "Ambient" },
  { code: "TECH", description: "Techno" },
  { code: "INDY", description: "Indie" },
  { code: "POP", description: "Pop" },
  { code: "R&B", description: "R&B" },
  { code: "SKAA", description: "Ska" },
  { code: "GRUN", description: "Grunge" },
  { code: "PROG", description: "Progressive" },
  { code: "EXPR", description: "Experimental" },
  { code: "PSYC", description: "Psychedelic" },
  { code: "INDU", description: "Industrial" },
  { code: "POST", description: "Post-Rock" },
];

const infoPrefixes = [
  "Live from",
  "Studio recording",
  "Demo version",
  "Acoustic version",
  "Remix by",
  "Cover of",
  "Original composition",
  "Traditional arrangement",
  "Modern interpretation",
  "Classic rendition",
  "Experimental take",
  "Jazz fusion",
  "Rock opera",
  "Concept album",
  "Soundtrack from",
  "B-side track",
  "Rare recording",
  "Bootleg version",
  "Unreleased track",
  "Extended mix",
  "Radio edit",
  "Club mix",
  "Instrumental version",
  "Vocal version",
  "Piano version",
  "Guitar solo",
  "Drum solo",
];

const infoNouns = [
  "the Moon",
  "Mars",
  "Jupiter",
  "Saturn",
  "Neptune",
  "Venus",
  "Mercury",
  "Pluto",
  "the Ocean",
  "the Mountains",
  "the Forest",
  "the Desert",
  "the Arctic",
  "the Tropics",
  "the Future",
  "the Past",
  "the Present",
  "Yesterday",
  "Tomorrow",
  "Today",
  "the Universe",
  "the Galaxy",
  "the Cosmos",
  "the Void",
  "the Abyss",
  "the Heavens",
  "the Underworld",
  "the Afterlife",
  "the Dream World",
  "the Real World",
];

// Helper function to get random item from array
function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper function to generate random duration
function generateDuration() {
  const minutes = Math.floor(Math.random() * 10) + 1; // 1-10 minutes
  const seconds = Math.floor(Math.random() * 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

// Helper function to generate random filename
function generateFilename(artist, title) {
  const cleanArtist = artist.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20);
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
  const uuid = uuidv4();
  return `${cleanArtist}-${cleanTitle}-${uuid}.mp3`;
}

// Helper function to generate song title
function generateTitle() {
  const prefix = getRandomItem(titlePrefixes);
  const noun = getRandomItem(titleNouns);
  const suffix = getRandomItem(titleSuffixes);

  // Sometimes use just prefix + noun, sometimes add suffix
  if (Math.random() > 0.5) {
    return `${prefix} ${noun}`;
  } else {
    return `${prefix} ${noun} ${suffix}`;
  }
}

// Helper function to generate info
function generateInfo() {
  const prefix = getRandomItem(infoPrefixes);
  const noun = getRandomItem(infoNouns);
  return `${prefix} ${noun}`;
}

// Helper function to create backup of existing database
function createBackup() {
  if (!fs.existsSync(dbPath)) {
    console.log("📁 No existing database found - no backup needed");
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = dbPath.replace(".db", `-backup-${timestamp}.db`);

  try {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`💾 Created backup: ${path.basename(backupPath)}`);
    return backupPath;
  } catch (error) {
    console.error(`❌ Failed to create backup: ${error.message}`);
    return null;
  }
}

// Helper function to restore from backup
function restoreFromBackup(backupPath) {
  if (!backupPath || !fs.existsSync(backupPath)) {
    console.log("⚠️  No backup found to restore from");
    return false;
  }

  try {
    fs.copyFileSync(backupPath, dbPath);
    console.log(
      `🔄 Restored database from backup: ${path.basename(backupPath)}`
    );
    return true;
  } catch (error) {
    console.error(`❌ Failed to restore from backup: ${error.message}`);
    return false;
  }
}

// Helper function to find existing test database
function findTestDatabase() {
  const dbDir = path.dirname(dbPath);
  const files = fs.readdirSync(dbDir);

  // Look for files that start with the detected database name + '-test' or contain 'test' in the name
  const baseName = path.basename(dbPath, ".db");
  const testFiles = files.filter(
    (file) =>
      file.startsWith(`${baseName}-test`) ||
      (file.includes("test") && file.endsWith(".db"))
  );

  if (testFiles.length > 0) {
    // Return the first test database found
    return path.join(dbDir, testFiles[0]);
  }

  return null;
}

// Helper function to create test database
function createTestDatabase() {
  const baseName = path.basename(dbPath, ".db");
  const testDbPath = path.join(path.dirname(dbPath), `${baseName}-test.db`);

  // Check if a test database already exists
  const existingTestDb = findTestDatabase();

  if (existingTestDb) {
    console.log(
      `🧪 Found existing test database: ${path.basename(existingTestDb)}`
    );
    console.log(`🔄 Replacing existing test database...`);

    // Remove the existing test database
    try {
      fs.unlinkSync(existingTestDb);
      console.log(`🗑️  Removed existing test database`);
    } catch (error) {
      console.error(
        `❌ Failed to remove existing test database: ${error.message}`
      );
    }
  } else {
    console.log(`🧪 Creating new test database: ${path.basename(testDbPath)}`);
  }

  // Create the database schema
  const db = new Database(testDbPath);

  // Create tables with the same schema as the main application
  db.exec(`
    CREATE TABLE IF NOT EXISTS 'categories' (
      code varchar(8) NOT NULL,
      description varchar(255) NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS mrvoice (
      id INTEGER PRIMARY KEY,
      title varchar(255) NOT NULL,
      artist varchar(255),
      category varchar(8) NOT NULL,
      info varchar(255),
      filename varchar(255) NOT NULL,
      time varchar(10),
      modtime timestamp(6),
      publisher varchar(16),
      md5 varchar(32)
    );
    
    CREATE UNIQUE INDEX IF NOT EXISTS 'category_code_index' ON categories(code);
    CREATE UNIQUE INDEX IF NOT EXISTS 'category_description_index' ON categories(description);
  `);

  // Insert default category
  try {
    db.prepare("INSERT INTO categories (code, description) VALUES (?, ?)").run(
      "UNC",
      "Uncategorized"
    );
  } catch (error) {
    // Category might already exist, that's okay
  }

  db.close();

  return testDbPath;
}

// Main function to generate test data
function generateTestData(numEntries = 5000, options = {}) {
  const { testMode = false, createBackup = true, backupPath = null } = options;

  let targetDbPath = dbPath;
  let originalBackupPath = null;

  // Handle test mode
  if (testMode) {
    targetDbPath = createTestDatabase();
  } else if (createBackup && !backupPath) {
    // Create backup of existing database (only for production database, not test databases)
    originalBackupPath = createBackup();
    if (!originalBackupPath) {
      console.log("⚠️  Proceeding without backup (use --test-mode for safety)");
    }
  }

  console.log(`Generating ${numEntries} test entries...`);
  console.log(`Target database: ${path.basename(targetDbPath)}`);

  const db = new Database(targetDbPath);

  // First, ensure categories exist
  console.log("Setting up categories...");
  for (const category of categories) {
    try {
      db.prepare(
        "INSERT INTO categories (code, description) VALUES (?, ?)"
      ).run(category.code, category.description);
    } catch (error) {
      // Category might already exist, that's okay
    }
  }

  // Generate and insert song entries
  const insertStmt = db.prepare(`
    INSERT INTO mrvoice (title, artist, category, info, filename, time, modtime) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const batchSize = 100;
  const totalBatches = Math.ceil(numEntries / batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchEntries = Math.min(batchSize, numEntries - batch * batchSize);

    for (let i = 0; i < batchEntries; i++) {
      const artist = getRandomItem(artists);
      const title = generateTitle();
      const category = getRandomItem(categories);
      const info = generateInfo();
      const filename = generateFilename(artist, title);
      const time = generateDuration();
      const modtime =
        Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 31536000); // Random time in last year

      insertStmt.run(
        title,
        artist,
        category.code,
        info,
        filename,
        time,
        modtime
      );
    }

    console.log(
      `Generated batch ${batch + 1}/${totalBatches} (${
        (batch + 1) * batchSize
      } entries so far)`
    );
  }

  // Get final count
  const count = db.prepare("SELECT COUNT(*) as count FROM mrvoice").get();
  console.log(
    `\n✅ Successfully generated ${count.count} total entries in the database!`
  );

  // Show some sample entries
  console.log("\n📋 Sample entries:");
  const samples = db
    .prepare(
      "SELECT title, artist, category, info FROM mrvoice ORDER BY RANDOM() LIMIT 10"
    )
    .all();
  samples.forEach((sample, index) => {
    console.log(
      `${index + 1}. "${sample.title}" by ${sample.artist} (${sample.category})`
    );
    console.log(`   ${sample.info}`);
  });

  db.close();

  // Return information about what was done
  return {
    databasePath: targetDbPath,
    backupPath: originalBackupPath,
    testMode: testMode,
    entryCount: count.count,
  };
}

// Function to restore original database
function restoreOriginalDatabase(backupPath) {
  if (!backupPath) {
    console.log("❌ No backup path provided for restoration");
    return false;
  }

  return restoreFromBackup(backupPath);
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2);
  let numEntries = 5000;
  let testMode = false;
  let createBackup = true;
  let restoreMode = false;
  let backupPath = null;

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--test-mode" || arg === "-t") {
      testMode = true;
      createBackup = false;
    } else if (arg === "--no-backup" || arg === "-n") {
      createBackup = false;
    } else if (arg === "--restore" || arg === "-r") {
      restoreMode = true;
      backupPath = args[i + 1];
      break;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
🎵 Mx. Voice Test Data Generator - Safe Mode
===========================================

Usage: node scripts/generate-test-data.js [options] [numEntries]

Options:
  --test-mode, -t     Create a separate test database (safest option)
  --no-backup, -n     Don't create backup of existing database
  --restore <path>, -r <path>  Restore from backup file
  --help, -h          Show this help message

Examples:
  node scripts/generate-test-data.js 5000              # Generate 5000 entries with backup
  node scripts/generate-test-data.js --test-mode 10000 # Generate 10000 entries in test database
  node scripts/generate-test-data.js --no-backup 2000  # Generate 2000 entries without backup
  node scripts/generate-test-data.js --restore backup.db # Restore from backup

Safety Features:
  - Test mode creates a separate database file
  - Automatic backup of existing database
  - Restore functionality to undo changes
  - Test databases are replaced on subsequent runs (no multiple backups)
  - Automatically detects production database name (mxvoice.db or mrvoice.db)
`);
      process.exit(0);
    } else if (!isNaN(parseInt(arg))) {
      numEntries = parseInt(arg);
    }
  }

  if (restoreMode) {
    if (restoreOriginalDatabase(backupPath)) {
      console.log("🎉 Database restored successfully!");
    } else {
      console.log("❌ Failed to restore database");
      process.exit(1);
    }
  } else {
    try {
      const result = generateTestData(numEntries, {
        testMode,
        createBackup,
        backupPath,
      });

      if (testMode) {
        console.log(
          `\n🧪 Test database created: ${path.basename(result.databasePath)}`
        );
        console.log(
          "💡 To use this test database, temporarily rename it to mxvoice.db"
        );
        console.log(
          "💡 Subsequent runs will replace this test database (no multiple backups)"
        );
      } else if (result.backupPath) {
        console.log(
          `\n💾 Original database backed up to: ${path.basename(
            result.backupPath
          )}`
        );
        console.log(
          "💡 To restore: node scripts/generate-test-data.js --restore <backup-file>"
        );
      }

      console.log(`\n🎉 Test data generation complete!`);
      console.log(
        `You can now test your live search functionality with ${result.entryCount} fun songs!`
      );
    } catch (error) {
      console.error(`❌ Error generating test data:`, error.message);
      process.exit(1);
    }
  }
}

module.exports = { generateTestData, restoreOriginalDatabase, createBackup };
