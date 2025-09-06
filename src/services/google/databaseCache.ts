/**
 * SQLite-based cache implementation with WAL mode and LRU eviction
 *
 * Features:
 * - ACID transactions with prepared statements
 * - Automatic TTL cleanup and capacity management
 * - Type-aware eviction (photos, places, directions)
 * - Performance monitoring and health checks
 *
 * Default limits: 500MB total, 10k entries
 * Data sizes: Photos ~74KB, Places ~4KB, Directions ~25KB
 */

import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";

interface CacheEntry {
  key: string;
  type: CacheType;
  data: Buffer;
  size: number;
  expiresAt: Date | null;
  createdAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
}

type CacheType = "photo" | "place" | "direction";

interface DatabaseCacheOptions {
  dbPath?: string;
  enableWAL?: boolean;
  maxSize?: number; // Maximum total cache size in bytes
  maxEntries?: number; // Maximum number of cache entries
  defaultTTL?: { [K in CacheType]: number }; // Default TTL in seconds per type
  pragmaSettings?: Record<string, string | number>;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  typeBreakdown: {
    photo: { count: number; size: number };
    place: { count: number; size: number };
    direction: { count: number; size: number };
  };
  hits: number;
  misses: number;
  hitRate: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

interface PreparedStatements {
  get: Database.Statement<[string]>;
  set: Database.Statement<[string, string, Buffer, number, string | null]>;
  has: Database.Statement<[string]>;
  delete: Database.Statement<[string]>;
  clear: Database.Statement<[]>;
  updateAccess: Database.Statement<[string]>;
  cleanup: Database.Statement<[]>;
  getStats: Database.Statement<[]>;
  getKeysByType: Database.Statement<[string]>;
  getLRU: Database.Statement<[string, number]>;
  getTotalSize: Database.Statement<[]>;
  getExpiredKeys: Database.Statement<[]>;
}

export class DatabaseCache {
  private db: Database.Database;
  private statements: PreparedStatements;
  private maxSize: number;
  private maxEntries: number;
  private defaultTTL: { [K in CacheType]: number };
  private stats: { hits: number; misses: number };

  constructor(options: DatabaseCacheOptions = {}) {
    const dbPath =
      options.dbPath ?? path.join(process.cwd(), "prisma", "dev.db");
    this.maxSize = options.maxSize ?? 500 * 1024 * 1024; // 500MB default
    this.maxEntries = options.maxEntries ?? 10000; // 10k entries default
    this.defaultTTL = options.defaultTTL ?? {
      photo: 90 * 24 * 60 * 60, // 90 days for photos
      place: 30 * 24 * 60 * 60, // 30 days for places
      direction: 7 * 24 * 60 * 60, // 7 days for directions
    };
    this.stats = { hits: 0, misses: 0 };

    // Initialize database connection
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    if (options.enableWAL !== false) {
      this.db.exec("PRAGMA journal_mode = WAL");
    }

    // Apply performance optimizations
    const defaultPragmas = {
      synchronous: "NORMAL", // Faster than FULL, safer than OFF
      cache_size: -64000, // 64MB cache (negative = KB)
      temp_store: "MEMORY", // Store temp tables in memory
      mmap_size: 268435456, // 256MB memory-mapped I/O
      page_size: 4096, // 4KB page size (good for mixed workloads)
      auto_vacuum: "INCREMENTAL", // Prevent database file growth
      busy_timeout: 30000, // 30 second busy timeout
      optimize: 1, // Auto-optimize on close
    };

    const pragmas = { ...defaultPragmas, ...options.pragmaSettings };

    for (const [key, value] of Object.entries(pragmas)) {
      this.db.exec(`PRAGMA ${key} = ${value}`);
    }

    // Prepare all SQL statements for optimal performance
    this.statements = this.prepareStatements();

    // Graceful shutdown
    process.on("SIGINT", () => this.close());
    process.on("SIGTERM", () => this.close());
  }

  private prepareStatements(): PreparedStatements {
    return {
      get: this.db.prepare(`
        SELECT key, type, data, size, expiresAt, createdAt, accessCount, lastAccessedAt 
        FROM google_cache 
        WHERE key = ? AND (expiresAt IS NULL OR expiresAt > datetime('now'))
      `),

      set: this.db.prepare(`
        INSERT OR REPLACE INTO google_cache 
        (key, type, data, size, expiresAt, createdAt, accessCount, lastAccessedAt)
        VALUES (?, ?, ?, ?, ?, datetime('now'), 0, datetime('now'))
      `),

      has: this.db.prepare(`
        SELECT 1 FROM google_cache 
        WHERE key = ? AND (expiresAt IS NULL OR expiresAt > datetime('now'))
      `),

      delete: this.db.prepare(`
        DELETE FROM google_cache WHERE key = ?
      `),

      clear: this.db.prepare(`
        DELETE FROM google_cache
      `),

      updateAccess: this.db.prepare(`
        UPDATE google_cache 
        SET accessCount = accessCount + 1, lastAccessedAt = datetime('now')
        WHERE key = ?
      `),

      cleanup: this.db.prepare(`
        DELETE FROM google_cache 
        WHERE expiresAt IS NOT NULL AND expiresAt <= datetime('now')
      `),

      getStats: this.db.prepare(`
        SELECT 
          COUNT(*) as totalEntries,
          SUM(size) as totalSize,
          MIN(createdAt) as oldestEntry,
          MAX(createdAt) as newestEntry
        FROM google_cache
        WHERE expiresAt IS NULL OR expiresAt > datetime('now')
      `),

      getKeysByType: this.db.prepare(`
        SELECT key FROM google_cache 
        WHERE type = ? AND (expiresAt IS NULL OR expiresAt > datetime('now'))
        ORDER BY lastAccessedAt DESC
      `),

      getLRU: this.db.prepare(`
        SELECT key FROM google_cache 
        WHERE type = ? AND (expiresAt IS NULL OR expiresAt > datetime('now'))
        ORDER BY lastAccessedAt ASC 
        LIMIT ?
      `),

      getTotalSize: this.db.prepare(`
        SELECT COALESCE(SUM(size), 0) as totalSize FROM google_cache
        WHERE expiresAt IS NULL OR expiresAt > datetime('now')
      `),

      getExpiredKeys: this.db.prepare(`
        SELECT key FROM google_cache 
        WHERE expiresAt IS NOT NULL AND expiresAt <= datetime('now')
      `),
    };
  }

  /**
   * Get cache entry by key
   */
  get<T>(key: string): T | undefined {
    try {
      const row = this.statements.get.get(key) as CacheEntry | undefined;

      if (!row) {
        this.stats.misses++;
        return undefined;
      }

      // Update access statistics asynchronously
      setImmediate(() => {
        this.statements.updateAccess.run(key);
      });

      this.stats.hits++;

      // Deserialize data based on type
      return this.deserializeData<T>(row.data, this.getCacheType(key));
    } catch (error) {
      console.warn(`DatabaseCache: Error getting key ${key}:`, error);
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Set cache entry with automatic TTL based on key type
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    try {
      const type = this.getCacheType(key);
      const data = this.serializeData(value, type);
      const size = data.length;

      // Calculate expiration
      const effectiveTTL = ttl ?? this.defaultTTL[type];
      const expiresAt =
        effectiveTTL > 0
          ? new Date(Date.now() + effectiveTTL * 1000).toISOString()
          : null;

      // Check size constraints before inserting
      this.enforceCapacityLimits(size);

      // Insert/update the cache entry
      this.statements.set.run(key, type, data, size, expiresAt);

      return true;
    } catch (error) {
      console.warn(`DatabaseCache: Error setting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    try {
      const result = this.statements.has.get(key);
      return result !== undefined;
    } catch (error) {
      console.warn(`DatabaseCache: Error checking key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cache entry by key
   */
  delete(key: string): boolean {
    try {
      const result = this.statements.delete.run(key);
      return result.changes > 0;
    } catch (error) {
      console.warn(`DatabaseCache: Error deleting key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      this.statements.clear.run();
      console.log("🗃️ DatabaseCache: Cleared all entries");
    } catch (error) {
      console.warn("DatabaseCache: Error clearing cache:", error);
    }
  }

  /**
   * Get all keys by type
   */
  getKeysByType(type: CacheType): string[] {
    try {
      const rows = this.statements.getKeysByType.all(type) as Array<{
        key: string;
      }>;
      return rows.map((row) => row.key);
    } catch (error) {
      console.warn(
        `DatabaseCache: Error getting keys for type ${type}:`,
        error
      );
      return [];
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    try {
      const basicStats = this.statements.getStats.get() as {
        totalEntries: number;
        totalSize: number;
        oldestEntry: string | null;
        newestEntry: string | null;
      };

      // Get type-specific breakdowns
      const typeBreakdown = {
        photo: this.getTypeStats("photo"),
        place: this.getTypeStats("place"),
        direction: this.getTypeStats("direction"),
      };

      const totalRequests = this.stats.hits + this.stats.misses;

      return {
        totalEntries: basicStats.totalEntries,
        totalSize: basicStats.totalSize,
        typeBreakdown,
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate:
          totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
        oldestEntry: basicStats.oldestEntry
          ? new Date(basicStats.oldestEntry)
          : null,
        newestEntry: basicStats.newestEntry
          ? new Date(basicStats.newestEntry)
          : null,
      };
    } catch (error) {
      console.warn("DatabaseCache: Error getting stats:", error);
      return {
        totalEntries: 0,
        totalSize: 0,
        typeBreakdown: {
          photo: { count: 0, size: 0 },
          place: { count: 0, size: 0 },
          direction: { count: 0, size: 0 },
        },
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  private getTypeStats(type: CacheType): { count: number; size: number } {
    try {
      const result = this.db
        .prepare(
          `
        SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as size 
        FROM google_cache 
        WHERE type = ? AND (expiresAt IS NULL OR expiresAt > datetime('now'))
      `
        )
        .get(type) as { count: number; size: number };

      return result;
    } catch {
      return { count: 0, size: 0 };
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): { removed: number; sizeFreed: number } {
    try {
      // Get expired entries for statistics
      const expiredKeys = this.statements.getExpiredKeys.all() as Array<{
        key: string;
      }>;

      // Calculate freed size before deletion
      let sizeFreed = 0;
      if (expiredKeys.length > 0) {
        const sizeQuery = this.db.prepare(`
          SELECT COALESCE(SUM(size), 0) as totalSize 
          FROM google_cache 
          WHERE expiresAt IS NOT NULL AND expiresAt <= datetime('now')
        `);
        const result = sizeQuery.get() as { totalSize: number };
        sizeFreed = result.totalSize;
      }

      // Delete expired entries
      const deleteResult = this.statements.cleanup.run();
      const removed = deleteResult.changes;

      if (removed > 0) {
        console.log(
          `🧹 DatabaseCache: Cleaned up ${removed} expired entries (${Math.round(
            sizeFreed / 1024
          )}KB freed)`
        );
      }

      return { removed, sizeFreed };
    } catch (error) {
      console.warn("DatabaseCache: Error during cleanup:", error);
      return { removed: 0, sizeFreed: 0 };
    }
  }

  /**
   * Enforce capacity limits by evicting LRU entries if needed
   */
  private enforceCapacityLimits(newEntrySize: number): void {
    try {
      const currentStats = this.statements.getTotalSize.get() as {
        totalSize: number;
      };
      const currentSize = currentStats.totalSize;

      // Check if we would exceed size limit
      if (currentSize + newEntrySize > this.maxSize) {
        const targetReduction =
          currentSize + newEntrySize - this.maxSize + this.maxSize * 0.1; // Free up 10% extra
        this.evictLRUEntries(targetReduction);
      }

      // Check entry count limit
      const statsResult = this.statements.getStats.get() as {
        totalEntries: number;
      };
      if (statsResult.totalEntries >= this.maxEntries) {
        const excessEntries =
          statsResult.totalEntries -
          this.maxEntries +
          Math.floor(this.maxEntries * 0.1); // Free up 10% extra
        this.evictLRUEntriesByCount(excessEntries);
      }
    } catch (error) {
      console.warn("DatabaseCache: Error enforcing capacity limits:", error);
    }
  }

  private evictLRUEntries(targetBytes: number): void {
    try {
      let freedBytes = 0;
      let evicted = 0;

      // Evict photos first (largest), then places, then directions
      const types: CacheType[] = ["photo", "place", "direction"];

      for (const type of types) {
        if (freedBytes >= targetBytes) break;

        const lruEntries = this.statements.getLRU.all(type, 50) as Array<{
          key: string;
        }>;

        for (const entry of lruEntries) {
          if (freedBytes >= targetBytes) break;

          // Get entry size before deleting
          const sizeResult = this.db
            .prepare("SELECT size FROM google_cache WHERE key = ?")
            .get(entry.key) as { size: number } | undefined;

          if (sizeResult && this.statements.delete.run(entry.key).changes > 0) {
            freedBytes += sizeResult.size;
            evicted++;
          }
        }
      }

      if (evicted > 0) {
        console.log(
          `🗑️ DatabaseCache: Evicted ${evicted} LRU entries (${Math.round(
            freedBytes / 1024
          )}KB freed)`
        );
      }
    } catch (error) {
      console.warn("DatabaseCache: Error evicting LRU entries:", error);
    }
  }

  private evictLRUEntriesByCount(targetCount: number): void {
    try {
      const lruQuery = this.db.prepare(`
        SELECT key FROM google_cache 
        WHERE expiresAt IS NULL OR expiresAt > datetime('now')
        ORDER BY lastAccessedAt ASC 
        LIMIT ?
      `);

      const lruEntries = lruQuery.all(targetCount) as Array<{ key: string }>;
      let evicted = 0;

      for (const entry of lruEntries) {
        if (this.statements.delete.run(entry.key).changes > 0) {
          evicted++;
        }
      }

      if (evicted > 0) {
        console.log(
          `🗑️ DatabaseCache: Evicted ${evicted} LRU entries by count`
        );
      }
    } catch (error) {
      console.warn(
        "DatabaseCache: Error evicting LRU entries by count:",
        error
      );
    }
  }

  /**
   * Batch operations for efficiency
   */
  setBatch<T>(entries: Array<{ key: string; value: T; ttl?: number }>): number {
    const transaction = this.db.transaction(() => {
      let successCount = 0;
      for (const entry of entries) {
        if (this.set(entry.key, entry.value, entry.ttl)) {
          successCount++;
        }
      }
      return successCount;
    });

    try {
      return transaction();
    } catch (error) {
      console.warn("DatabaseCache: Error in batch set:", error);
      return 0;
    }
  }

  getBatch<T>(keys: string[]): Map<string, T> {
    const results = new Map<string, T>();

    try {
      for (const key of keys) {
        const value = this.get<T>(key);
        if (value !== undefined) {
          results.set(key, value);
        }
      }
    } catch (error) {
      console.warn("DatabaseCache: Error in batch get:", error);
    }

    return results;
  }

  /**
   * Get cache type from key pattern
   */
  private getCacheType(key: string): CacheType {
    if (key.includes("photos")) return "photo";
    if (key.startsWith("directions:")) return "direction";
    return "place";
  }

  /**
   * Serialize data based on cache type
   */
  private serializeData<T>(data: T, type: CacheType): Buffer {
    if (type === "photo" && typeof data === "string") {
      // Photos are already base64 strings, store as-is
      return Buffer.from(data, "utf8");
    } else {
      // Places and directions are objects, serialize as JSON
      return Buffer.from(JSON.stringify(data), "utf8");
    }
  }

  /**
   * Deserialize data based on cache type
   */
  private deserializeData<T>(buffer: Buffer, type: CacheType): T {
    if (type === "photo") {
      // Photos are stored as strings
      return buffer.toString("utf8") as T;
    } else {
      // Places and directions are stored as JSON
      return JSON.parse(buffer.toString("utf8")) as T;
    }
  }

  /**
   * Cache wrapper for API calls
   */
  async withCache<T>(
    key: string,
    apiCall: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Call API and cache result
    const result = await apiCall();
    this.set(key, result, ttl);
    return result;
  }

  /**
   * Get database health information
   */
  getHealth(): {
    status: "healthy" | "warning" | "critical";
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const stats = this.getStats();

    // Check hit rate
    if (stats.hitRate < 70) {
      issues.push(`Low cache hit rate: ${stats.hitRate.toFixed(1)}%`);
      recommendations.push("Consider increasing TTL values or cache size");
    }

    // Check size utilization
    const sizeUtilization = (stats.totalSize / this.maxSize) * 100;
    if (sizeUtilization > 85) {
      issues.push(
        `High cache size utilization: ${sizeUtilization.toFixed(1)}%`
      );
      recommendations.push(
        "Consider increasing cache size limit or running cleanup"
      );
    }

    // Check entry count
    const entryUtilization = (stats.totalEntries / this.maxEntries) * 100;
    if (entryUtilization > 85) {
      issues.push(
        `High entry count utilization: ${entryUtilization.toFixed(1)}%`
      );
      recommendations.push("Consider increasing max entries limit");
    }

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (issues.length > 2 || sizeUtilization > 95 || entryUtilization > 95) {
      status = "critical";
    } else if (issues.length > 0) {
      status = "warning";
    }

    return { status, issues, recommendations };
  }

  /**
   * Run database optimization and maintenance
   */
  optimize(): void {
    try {
      console.log("🔧 DatabaseCache: Running optimization...");

      // Analyze query plans and update statistics
      this.db.exec("ANALYZE google_cache");

      // Incremental vacuum to reclaim space
      this.db.exec("PRAGMA incremental_vacuum");

      // Optimize database structure
      this.db.exec("PRAGMA optimize");

      console.log("✅ DatabaseCache: Optimization completed");
    } catch (error) {
      console.warn("DatabaseCache: Error during optimization:", error);
    }
  }

  /**
   * Get database performance statistics
   */
  getPerformanceStats(): {
    cacheHitRatio: number;
    pageCount: number;
    pageSize: number;
    walSize: number;
    freelistCount: number;
    schemaVersion: number;
  } {
    try {
      const cacheHitRatio = this.db.prepare("PRAGMA cache_spill").get() as any;
      const pageInfo = this.db.prepare("PRAGMA page_count").get() as any;
      const pageSize = this.db.prepare("PRAGMA page_size").get() as any;
      const walInfo = this.db
        .prepare("PRAGMA wal_checkpoint(PASSIVE)")
        .get() as any;
      const freelistCount = this.db
        .prepare("PRAGMA freelist_count")
        .get() as any;
      const schemaVersion = this.db
        .prepare("PRAGMA schema_version")
        .get() as any;

      return {
        cacheHitRatio: cacheHitRatio?.cache_spill || 0,
        pageCount: pageInfo?.page_count || 0,
        pageSize: pageSize?.page_size || 0,
        walSize: walInfo ? walInfo[1] || 0 : 0,
        freelistCount: freelistCount?.freelist_count || 0,
        schemaVersion: schemaVersion?.schema_version || 0,
      };
    } catch (error) {
      console.warn("DatabaseCache: Error getting performance stats:", error);
      return {
        cacheHitRatio: 0,
        pageCount: 0,
        pageSize: 0,
        walSize: 0,
        freelistCount: 0,
        schemaVersion: 0,
      };
    }
  }

  /**
   * Compact database and reclaim space
   */
  vacuum(): { sizeBefore: number; sizeAfter: number; reclaimed: number } {
    try {
      const dbPath = this.db.name;
      const sizeBefore = fs.statSync(dbPath).size;

      console.log("🧹 DatabaseCache: Running VACUUM...");
      this.db.exec("VACUUM");

      const sizeAfter = fs.statSync(dbPath).size;
      const reclaimed = sizeBefore - sizeAfter;

      console.log(
        `✅ DatabaseCache: VACUUM completed, reclaimed ${Math.round(
          reclaimed / 1024
        )}KB`
      );

      return { sizeBefore, sizeAfter, reclaimed };
    } catch (error) {
      console.warn("DatabaseCache: Error during vacuum:", error);
      return { sizeBefore: 0, sizeAfter: 0, reclaimed: 0 };
    }
  }

  /**
   * Execute WAL checkpoint to persist changes
   */
  checkpoint(): { walFrames: number; checkpointedFrames: number } {
    try {
      const result = this.db
        .prepare("PRAGMA wal_checkpoint(RESTART)")
        .get() as any;
      return {
        walFrames: result?.[1] || 0,
        checkpointedFrames: result?.[2] || 0,
      };
    } catch (error) {
      console.warn("DatabaseCache: Error during checkpoint:", error);
      return { walFrames: 0, checkpointedFrames: 0 };
    }
  }

  /**
   * Get cache keys matching a pattern (useful for debugging)
   */
  findKeysByPattern(pattern: string): string[] {
    try {
      const statement = this.db.prepare(`
        SELECT key FROM google_cache 
        WHERE key LIKE ? AND (expiresAt IS NULL OR expiresAt > datetime('now'))
        LIMIT 100
      `);

      const rows = statement.all(pattern) as Array<{ key: string }>;
      return rows.map((row) => row.key);
    } catch (error) {
      console.warn("DatabaseCache: Error finding keys by pattern:", error);
      return [];
    }
  }

  /**
   * Get cache entries by size range
   */
  getEntriesBySize(
    minSize: number,
    maxSize?: number
  ): Array<{ key: string; size: number; type: string }> {
    try {
      const query = maxSize
        ? "SELECT key, size, type FROM google_cache WHERE size BETWEEN ? AND ? AND (expiresAt IS NULL OR expiresAt > datetime('now')) ORDER BY size DESC LIMIT 50"
        : "SELECT key, size, type FROM google_cache WHERE size >= ? AND (expiresAt IS NULL OR expiresAt > datetime('now')) ORDER BY size DESC LIMIT 50";

      const statement = this.db.prepare(query);
      const params = maxSize ? [minSize, maxSize] : [minSize];
      const rows = statement.all(...params) as Array<{
        key: string;
        size: number;
        type: string;
      }>;

      return rows;
    } catch (error) {
      console.warn("DatabaseCache: Error getting entries by size:", error);
      return [];
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      // Run final optimization before close
      this.db.exec("PRAGMA optimize");

      // Ensure WAL is checkpointed
      this.checkpoint();

      this.db.close();
      console.log("🗃️ DatabaseCache: Database connection closed");
    } catch (error) {
      console.warn("DatabaseCache: Error closing database:", error);
    }
  }
}
