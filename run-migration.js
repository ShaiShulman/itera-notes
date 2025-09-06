/**
 * Cache Migration Runner
 * Migrates your existing 95MB JSON cache to SQLite database
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const legacyCachePath = path.join(process.cwd(), '.cache', 'google-apis', 'google-api-cache.json');
const dbPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev.db');

function analyzeLegacyCache() {
  if (!fs.existsSync(legacyCachePath)) {
    console.log('❌ Legacy cache file not found at:', legacyCachePath);
    return null;
  }

  const stats = fs.statSync(legacyCachePath);
  console.log('📊 Analyzing your cache...');
  
  try {
    const cacheData = JSON.parse(fs.readFileSync(legacyCachePath, 'utf8'));
    const keys = Object.keys(cacheData);
    
    const breakdown = {
      photos: keys.filter(k => k.includes('photos')).length,
      places: keys.filter(k => k.startsWith('places:') && !k.includes('photos')).length,
      directions: keys.filter(k => k.startsWith('directions:')).length,
    };

    console.log(`📁 File size: ${Math.round(stats.size / (1024 * 1024))}MB`);
    console.log(`📝 Total entries: ${keys.length}`);
    console.log(`📸 Photos: ${breakdown.photos} (${Math.round(breakdown.photos/keys.length*100)}%)`);
    console.log(`📍 Places: ${breakdown.places} (${Math.round(breakdown.places/keys.length*100)}%)`);
    console.log(`🗺️ Directions: ${breakdown.directions} (${Math.round(breakdown.directions/keys.length*100)}%)`);
    
    return { cacheData, keys, breakdown, fileSize: stats.size };
  } catch (error) {
    console.error('❌ Error parsing cache file:', error);
    return null;
  }
}

function getCacheType(key) {
  if (key.includes('photos')) return 'photo';
  if (key.startsWith('directions:')) return 'direction';
  return 'place';
}

async function migrateToDatabase(analysis) {
  console.log('\n🔄 Starting migration to database...');
  
  const db = new Database(dbPath);
  
  // Prepare statements for optimal performance
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO google_cache 
    (key, type, data, size, expiresAt, createdAt, accessCount, lastAccessedAt)
    VALUES (?, ?, ?, ?, ?, datetime('now'), 0, datetime('now'))
  `);

  const { cacheData, keys } = analysis;
  let migrated = { photos: 0, places: 0, directions: 0 };
  let errors = 0;
  let skipped = 0;
  let totalSize = 0;
  
  const now = Math.floor(Date.now() / 1000);
  const startTime = Date.now();
  
  console.log('📈 Migrating entries...');
  
  // Use transaction for better performance
  const migrateTransaction = db.transaction(() => {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const entry = cacheData[key];
      
      try {
        // Skip expired entries
        if (entry.ttl > 0 && entry.timestamp + entry.ttl <= now) {
          skipped++;
          continue;
        }

        const type = getCacheType(key);
        const dataStr = typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data);
        const dataBuffer = Buffer.from(dataStr, 'utf8');
        const size = dataBuffer.length;
        
        // Calculate expiration
        const expiresAt = entry.ttl > 0 ? 
          new Date((entry.timestamp + entry.ttl) * 1000).toISOString() : 
          null;

        insertStmt.run(key, type, dataBuffer, size, expiresAt);
        
        migrated[type]++;
        totalSize += size;
        
        // Progress indicator
        if ((i + 1) % 100 === 0) {
          const percent = Math.round(((i + 1) / keys.length) * 100);
          process.stdout.write(`\r📈 Progress: ${percent}% (${i + 1}/${keys.length})`);
        }
        
      } catch (error) {
        errors++;
        if (errors < 5) {
          console.log(`\n⚠️ Error migrating ${key}:`, error.message);
        }
      }
    }
  });

  try {
    migrateTransaction();
    
    const duration = Date.now() - startTime;
    console.log('\n\n✅ Migration completed!');
    console.log('📊 Migration Summary:');
    console.log(`  Photos migrated: ${migrated.photo || 0}`);
    console.log(`  Places migrated: ${migrated.place || 0}`);
    console.log(`  Directions migrated: ${migrated.direction || 0}`);
    console.log(`  Errors: ${errors}`);
    console.log(`  Skipped (expired): ${skipped}`);
    console.log(`  Data migrated: ${Math.round(totalSize / (1024 * 1024))}MB`);
    console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
    
    const successRate = ((migrated.photo + migrated.place + migrated.direction) / keys.length) * 100;
    console.log(`  Success rate: ${successRate.toFixed(1)}%`);
    
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  } finally {
    db.close();
  }
}

async function verifyMigration(originalAnalysis) {
  console.log('\n🔍 Verifying migration...');
  
  const db = new Database(dbPath);
  
  try {
    const result = db.prepare('SELECT COUNT(*) as count, type FROM google_cache GROUP BY type').all();
    
    console.log('📊 Database contents:');
    let totalInDb = 0;
    result.forEach(row => {
      console.log(`  ${row.type}: ${row.count} entries`);
      totalInDb += row.count;
    });
    
    console.log(`  Total in database: ${totalInDb}`);
    console.log(`  Original entries: ${originalAnalysis.keys.length}`);
    
    if (totalInDb > originalAnalysis.keys.length * 0.8) {
      console.log('✅ Migration verification passed');
      return true;
    } else {
      console.log('⚠️ Migration may be incomplete');
      return false;
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  } finally {
    db.close();
  }
}

async function runMigration() {
  console.log('🚀 Google API Cache Migration\n');
  
  // Step 1: Analyze existing cache
  const analysis = analyzeLegacyCache();
  if (!analysis) {
    return;
  }
  
  // Step 2: Migrate to database
  const migrationSuccess = await migrateToDatabase(analysis);
  if (!migrationSuccess) {
    return;
  }
  
  // Step 3: Verify migration
  const verificationSuccess = await verifyMigration(analysis);
  
  if (verificationSuccess) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Your cache now uses the SQLite database');
    console.log('2. The original JSON file is preserved as backup');
    console.log('3. Your app will automatically use the database cache');
    console.log('4. You can monitor cache with SQL queries');
  } else {
    console.log('\n⚠️ Migration completed with warnings - manual review recommended');
  }
}

// Run the migration
runMigration().catch(console.error);