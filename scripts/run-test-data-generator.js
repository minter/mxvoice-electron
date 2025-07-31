#!/usr/bin/env node

const {
  generateTestData,
  restoreOriginalDatabase,
} = require("./generate-test-data");

// Parse command line arguments
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
============================================

Usage: node scripts/run-test-data-generator.js [options] [numEntries]

Options:
  --test-mode, -t     Create a separate test database (safest option)
  --no-backup, -n     Don't create backup of existing database
  --restore <path>, -r <path>  Restore from backup file
  --help, -h          Show this help message

Examples:
  node scripts/run-test-data-generator.js 5000              # Generate 5000 entries with backup
  node scripts/run-test-data-generator.js --test-mode 10000 # Generate 10000 entries in test database
  node scripts/run-test-data-generator.js --no-backup 2000  # Generate 2000 entries without backup
  node scripts/run-test-data-generator.js --restore backup.db # Restore from backup

Safety Features:
  - Test mode creates a separate database file
  - Automatic backup of existing database
  - Restore functionality to undo changes
`);
    process.exit(0);
  } else if (!isNaN(parseInt(arg))) {
    numEntries = parseInt(arg);
  }
}

console.log(`🎵 Mx. Voice Test Data Generator - Safe Mode`);
console.log(`============================================`);

if (restoreMode) {
  console.log(`🔄 Restoring database from backup...`);
  try {
    if (restoreOriginalDatabase(backupPath)) {
      console.log(`🎉 Database restored successfully!`);
    } else {
      console.log(`❌ Failed to restore database`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error restoring database:`, error.message);
    process.exit(1);
  }
} else {
  if (testMode) {
    console.log(`🧪 Test Mode: Creating separate test database`);
    console.log(`Generating ${numEntries} fun mock song entries...\n`);
  } else if (createBackup) {
    console.log(`💾 Safe Mode: Will create backup of existing database`);
    console.log(`Generating ${numEntries} fun mock song entries...\n`);
  } else {
    console.log(`⚠️  No Backup Mode: Proceeding without backup`);
    console.log(`Generating ${numEntries} fun mock song entries...\n`);
  }

  try {
    const result = generateTestData(numEntries, {
      testMode,
      createBackup,
      backupPath,
    });

    if (testMode) {
      console.log(`\n🧪 Test database created: ${result.databasePath}`);
      console.log("💡 To use this test database:");
      console.log("   1. Close Mx. Voice");
      console.log(
        "   2. Rename your current mxvoice.db to mxvoice.db.original"
      );
      console.log("   3. Rename the test database to mxvoice.db");
      console.log("   4. Start Mx. Voice and test your search functionality");
      console.log("   5. When done testing, restore your original database");
    } else if (result.backupPath) {
      console.log(`\n💾 Original database backed up to: ${result.backupPath}`);
      console.log("💡 To restore your original database:");
      console.log(
        `   node scripts/run-test-data-generator.js --restore "${result.backupPath}"`
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
