# Test Data Generator for Mx. Voice - Safe Mode

This script generates thousands of fun mock song entries for testing the live search functionality in Mx. Voice, with multiple safety options to protect your existing database.

## 🛡️ Safety Features

### **Test Mode (Safest Option)**

Creates a separate test database file, leaving your original database completely untouched. **Subsequent runs replace the test database** - no multiple backups of test data.

### **Automatic Backup**

Automatically creates a timestamped backup of your existing database before making changes (only for production database, not test databases).

### **Restore Functionality**

Easy one-command restoration of your original database from backup.

### **Smart Test Database Management**

- Test databases are identified by `mxvoice-test.db` naming
- Existing test databases are automatically replaced on subsequent runs
- No accumulation of multiple test database backups

### **🔍 Automatic Database Detection**

- **Automatically detects** whether your production database is `mxvoice.db` or `mrvoice.db`
- **Backward compatible** with Mr. Voice 2 databases
- **No hardcoded assumptions** about database names
- **Same detection logic** as the main Mx. Voice application

## What it generates

The script creates realistic but entertaining song data including:

- **Fun artist names** like "The Quantum Cats", "Disco Llama", "Funk Master Penguin"
- **Creative song titles** like "The Ballad of Quantum Entanglement in the Morning"
- **Various music categories** (Rock, Jazz, Funk, Blues, Electronic, etc.)
- **Realistic metadata** including durations, filenames, and timestamps
- **Diverse search terms** to test different search scenarios

## Usage Options

### 🧪 Test Mode (Recommended - Safest)

Creates a separate test database file:

```bash
node scripts/run-test-data-generator.js --test-mode 5000
```

**Behavior:**

- First run: Creates `mxvoice-test.db` or `mrvoice-test.db` (based on detected production database)
- Subsequent runs: Replaces existing test database
- Your original database remains untouched

### 💾 Safe Mode (Default)

Creates backup and modifies existing database:

```bash
node scripts/run-test-data-generator.js 5000
```

### ⚠️ No Backup Mode

Modifies existing database without backup:

```bash
node scripts/run-test-data-generator.js --no-backup 5000
```

### 🔄 Restore Mode

Restore your original database from backup:

```bash
node scripts/run-test-data-generator.js --restore "mxvoice-backup-2025-01-27T12-34-56-789Z.db"
```

### 📖 Help

Show all available options:

```bash
node scripts/run-test-data-generator.js --help
```

## Detailed Usage Examples

### Test Mode (Safest for Production)

```bash
# Generate 10,000 entries in a separate test database
node scripts/run-test-data-generator.js --test-mode 10000
```

**What happens:**

1. Detects your production database name (`mxvoice.db` or `mrvoice.db`)
2. Creates corresponding test database (`mxvoice-test.db` or `mrvoice-test.db`)
3. Your original database remains untouched
4. You can safely test without any risk

**On subsequent runs:**

1. Finds existing test database (regardless of name)
2. Replaces it with fresh test data
3. No accumulation of multiple test databases

**To use the test database:**

1. Close Mx. Voice
2. Rename your current production database to `[name].db.original`
3. Rename the test database to match your production database name
4. Start Mx. Voice and test your search functionality
5. When done, restore your original database

### Safe Mode (Default)

```bash
# Generate 5,000 entries with automatic backup
node scripts/run-test-data-generator.js 5000
```

**What happens:**

1. Detects your production database name
2. Creates backup: `[name]-backup-2025-01-27T12-34-56-789Z.db`
3. Adds test data to your existing database
4. Provides restore command for easy recovery

### Restore Your Original Database

```bash
# Restore from the backup created during safe mode
node scripts/run-test-data-generator.js --restore "mxvoice-backup-2025-01-27T12-34-56-789Z.db"
```

## What you'll get

The script will generate entries like:

- "The Ballad of Quantum Entanglement" by The Quantum Cats
- "Ode to Disco Inferno Under the Stars" by Disco Llama
- "Song for Jazz Hands at Midnight" by Jazz Giraffe Collective
- "Tribute to Funk Master Flex Over the Rainbow" by Funk Master Penguin

## Testing your live search

Once you've generated the test data:

1. **Start Mx. Voice** - the database will be automatically loaded
2. **Try the search box** - type various terms to test live search
3. **Test different scenarios**:
   - Artist names: "Penguin", "Llama", "Cats"
   - Song titles: "Ballad", "Ode", "Quantum"
   - Categories: Use the category dropdown
   - Partial matches: "Jazz", "Rock", "Funk"

## Database location

The script automatically finds your Mx. Voice database at:

- **macOS**: `~/Library/Application Support/Mx. Voice/`
- **Windows**: `%APPDATA%/Mx. Voice/`

## Database Detection

The script uses the same detection logic as Mx. Voice:

1. **Looks for `mrvoice.db`** first (Mr. Voice 2 compatibility)
2. **Falls back to `mxvoice.db`** if mrvoice.db doesn't exist
3. **Creates test databases** with corresponding names (`mrvoice-test.db` or `mxvoice-test.db`)
4. **Works with both** old Mr. Voice 2 databases and new Mx. Voice databases

## Safety Levels

### 🟢 **Test Mode** (Safest)

- ✅ Creates separate database file
- ✅ Original database untouched
- ✅ No risk to existing data
- ✅ Perfect for production environments
- ✅ **Test databases are replaced on subsequent runs**
- ✅ **Automatically detects database name**

### 🟡 **Safe Mode** (Default)

- ✅ Automatic backup created
- ✅ Easy one-command restore
- ✅ Modifies existing database
- ✅ Good for development/testing
- ✅ **Automatically detects database name**

### 🔴 **No Backup Mode** (Risky)

- ⚠️ No backup created
- ⚠️ Modifies existing database
- ⚠️ No easy way to restore
- ⚠️ Only use if you're sure

## Sample output

### Test Mode (First Run)

```
🎵 Mx. Voice Test Data Generator - Safe Mode
============================================
🧪 Test Mode: Creating separate test database
Generating 5000 fun mock song entries...

Looking for database in /Users/username/Library/Application Support/Mx. Voice
Detected database name: mxvoice.db
🧪 Creating new test database: mxvoice-test.db
Opening database at: /Users/username/Library/Application Support/Mx. Voice/mxvoice-test.db
Setting up categories...
Generated batch 1/50 (100 entries so far)
...
Generated batch 50/50 (5000 entries so far)

✅ Successfully generated 5000 total entries in the database!

🧪 Test database created: mxvoice-test.db
💡 To use this test database, temporarily rename it to mxvoice.db
💡 Subsequent runs will replace this test database (no multiple backups)

🎉 Test data generation complete!
```

### Test Mode (Subsequent Run)

```
🎵 Mx. Voice Test Data Generator - Safe Mode
============================================
🧪 Test Mode: Creating separate test database
Generating 5000 fun mock song entries...

Looking for database in /Users/username/Library/Application Support/Mx. Voice
Detected database name: mxvoice.db
🧪 Found existing test database: mxvoice-test.db
🔄 Replacing existing test database...
🗑️  Removed existing test database
🧪 Creating new test database: mxvoice-test.db
Opening database at: /Users/username/Library/Application Support/Mx. Voice/mxvoice-test.db
Setting up categories...
...
✅ Successfully generated 5000 total entries in the database!

🧪 Test database created: mxvoice-test.db
💡 To use this test database, temporarily rename it to mxvoice.db
💡 Subsequent runs will replace this test database (no multiple backups)

🎉 Test data generation complete!
```

### Safe Mode

```
🎵 Mx. Voice Test Data Generator - Safe Mode
============================================
💾 Safe Mode: Will create backup of existing database
Generating 5000 fun mock song entries...

Looking for database in /Users/username/Library/Application Support/Mx. Voice
Detected database name: mxvoice.db
💾 Created backup: mxvoice-backup-2025-01-27T12-34-56-789Z.db
Opening database at: /Users/username/Library/Application Support/Mx. Voice/mxvoice.db
Setting up categories...
...
✅ Successfully generated 5000 total entries in the database!

💾 Original database backed up to: /Users/username/Library/Application Support/Mx. Voice/mxvoice-backup-2025-01-27T12-34-56-789Z.db
💡 To restore your original database:
   node scripts/run-test-data-generator.js --restore "/Users/username/Library/Application Support/Mx. Voice/mxvoice-backup-2025-01-27T12-34-56-789Z.db"

🎉 Test data generation complete!
```

## Troubleshooting

### Database not found

1. Make sure Mx. Voice has been run at least once
2. Check that the database directory exists
3. Ensure you have write permissions to the database location

### Backup failed

1. Check disk space availability
2. Ensure write permissions to the database directory
3. Try using test mode instead

### Restore failed

1. Verify the backup file path is correct
2. Ensure the backup file exists and is readable
3. Check that Mx. Voice is not currently running

### Test database not found

1. The script will automatically create a new test database
2. Check that you have write permissions to the database directory

### Wrong database detected

1. The script uses the same detection logic as Mx. Voice
2. If you have both `mxvoice.db` and `mrvoice.db`, it will use `mrvoice.db` (Mr. Voice 2 compatibility)
3. Check the console output to see which database was detected

## Customization

You can modify the arrays in `generate-test-data.js` to create different types of test data:

- `artists` - Add more artist names
- `titlePrefixes`, `titleNouns`, `titleSuffixes` - Create different title patterns
- `categories` - Add new music categories
- `infoPrefixes`, `infoNouns` - Generate different metadata

## Best Practices

1. **Always use Test Mode** when working with production data
2. **Keep backups** of important databases
3. **Test on a copy** before modifying production data
4. **Document your changes** for easy recovery
5. **Use Test Mode for iterative testing** - it automatically replaces test databases
6. **Trust the database detection** - it uses the same logic as Mx. Voice
