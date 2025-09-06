/**
 * Simple Cache Migration Script
 * Run this to migrate your 95MB JSON cache to SQLite database
 */

const path = require('path');

async function migrateCache() {
  console.log('🔄 Starting cache migration to database...\n');
  
  try {
    // Import the migration function
    const { runDatabaseCacheMigration } = require('./src/services/google/databaseCacheMigration');
    
    // Run the migration with safe defaults
    const result = await runDatabaseCacheMigration({
      legacyCachePath: path.join(process.cwd(), '.cache', 'google-apis', 'google-api-cache.json'),
      dryRun: false,        // Set to true for test run
      verify: true,         // Verify migration success
      cleanup: false,       // Keep original as backup
    });
    
    console.log('\n🎉 Migration completed successfully!');
    console.log(`✅ Migrated ${result.photosMigrated} photos`);
    console.log(`✅ Migrated ${result.placesMigrated} places`);  
    console.log(`✅ Migrated ${result.directionsMigrated} directions`);
    console.log(`📊 Total: ${result.sizeMigrated} bytes migrated`);
    console.log(`⏱️ Time: ${result.duration}ms`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure your database is running');
    console.log('2. Check that .cache/google-apis/google-api-cache.json exists');
    console.log('3. Try a dry run first by setting dryRun: true');
  }
}

// Run the migration
migrateCache();