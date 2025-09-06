/**
 * Dry Run Migration Test
 * Test migration without actually moving data
 */

const path = require('path');

async function testMigration() {
  console.log('🧪 Testing cache migration (dry run)...\n');
  
  try {
    const { runDatabaseCacheMigration } = require('./src/services/google/databaseCacheMigration');
    
    // Analyze your cache first
    const { DatabaseCacheMigration } = require('./src/services/google/databaseCacheMigration');
    const migration = new DatabaseCacheMigration();
    
    const analysis = await migration.analyzeLegacyCache();
    
    if (!analysis.exists) {
      console.log('❌ No legacy cache found at:', 
        path.join(process.cwd(), '.cache', 'google-apis', 'google-api-cache.json'));
      return;
    }
    
    console.log('📊 Your Cache Analysis:');
    console.log(`  📁 File size: ${Math.round(analysis.fileSize / (1024 * 1024))}MB`);
    console.log(`  📝 Total entries: ${analysis.totalEntries}`);
    console.log(`  📸 Photos: ${analysis.breakdown.photos} (${Math.round(analysis.breakdown.photos/analysis.totalEntries*100)}%)`);
    console.log(`  📍 Places: ${analysis.breakdown.places} (${Math.round(analysis.breakdown.places/analysis.totalEntries*100)}%)`);
    console.log(`  🗺️ Directions: ${analysis.breakdown.directions} (${Math.round(analysis.breakdown.directions/analysis.totalEntries*100)}%)`);
    console.log(`  ⏱️ Estimated migration time: ${analysis.estimatedMigrationTime}s`);
    
    console.log('\n📝 Sample entries:');
    analysis.sampleEntries.forEach((entry, i) => {
      console.log(`  ${i+1}. ${entry.type}: ${entry.key} (${Math.round(entry.size/1024)}KB)`);
    });
    
    console.log('\n🧪 Running dry run...');
    
    // Run dry run
    const result = await runDatabaseCacheMigration({
      dryRun: true,  // Safe test mode
      verify: false,
      cleanup: false,
    });
    
    console.log('\n📋 Dry Run Results:');
    console.log(`  ✅ Would migrate ${result.photosMigrated} photos`);
    console.log(`  ✅ Would migrate ${result.placesMigrated} places`);
    console.log(`  ✅ Would migrate ${result.directionsMigrated} directions`);
    console.log(`  ⚠️ Would skip ${result.skipped} expired entries`);
    console.log(`  ❌ Would encounter ${result.errors} errors`);
    
    console.log('\n🎯 Ready for migration!');
    console.log('To run actual migration: node migrate-cache.js');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMigration();